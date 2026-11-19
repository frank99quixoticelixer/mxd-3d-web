"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { GLB_DRON, RPM_MESA } from "./config";
import { useEstudio } from "./estado";

/**
 * El taller: un granero donde se personaliza el dron antes de salir al campo,
 * como en los juegos de autos. Madera, pacas de paja, un porton abierto al
 * maizal y, en el banco de trabajo, refacciones reales del MX80 sacadas del
 * mismo GLB del dron (no se descarga nada extra).
 *
 * Medidas en metros. El dron se para sobre la plataforma giratoria, cuya cara
 * de arriba queda en y = 0 (donde el dron apoya su punto mas bajo). Las
 * texturas (madera, paja, campo) se dibujan en un canvas: sin imagenes.
 */

const RADIO_MESA = 2.25;
const GRANERO = { ancho: 20, fondo: 24, alero: 5, cumbrera: 9 };
const PISO_Y = -0.14;

// ---------------------------------------------------------------------------
// Texturas dibujadas
// ---------------------------------------------------------------------------

function lienzo(ancho: number, alto: number, dibujar: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  dibujar(canvas.getContext("2d")!);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
  textura.anisotropy = 8;
  return textura;
}

/** Numeros pseudoaleatorios con semilla: la madera sale igual cada vez. */
function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Tablones verticales con veta. */
function texturaTablones(base: [number, number, number], semilla: number) {
  return lienzo(512, 512, (c) => {
    const r = azar(semilla);
    const tablones = 8;
    const ancho = 512 / tablones;
    for (let i = 0; i < tablones; i++) {
      const v = 0.82 + r() * 0.3;
      c.fillStyle = `rgb(${base[0] * v},${base[1] * v},${base[2] * v})`;
      c.fillRect(i * ancho, 0, ancho, 512);
      // Veta
      for (let k = 0; k < 40; k++) {
        const x = i * ancho + r() * ancho;
        c.strokeStyle = `rgba(30,18,8,${0.05 + r() * 0.1})`;
        c.lineWidth = 0.5 + r() * 1.5;
        c.beginPath();
        c.moveTo(x, 0);
        c.bezierCurveTo(x + r() * 6 - 3, 170, x + r() * 6 - 3, 340, x + r() * 4 - 2, 512);
        c.stroke();
      }
      // Junta entre tablones y nudos
      c.fillStyle = "rgba(20,12,6,0.75)";
      c.fillRect(i * ancho, 0, 2, 512);
      if (r() > 0.4) {
        c.fillStyle = "rgba(40,24,10,0.45)";
        c.beginPath();
        c.ellipse(i * ancho + r() * ancho, r() * 512, 4 + r() * 4, 7 + r() * 6, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}

/** Paja: muchas briznas cortas sobre un tono dorado. */
function texturaPaja() {
  return lienzo(256, 256, (c) => {
    const r = azar(7);
    c.fillStyle = "#b8923f";
    c.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1400; k++) {
      const x = r() * 256;
      const y = r() * 256;
      const a = (r() - 0.5) * 0.6;
      const l = 6 + r() * 16;
      const v = r();
      c.strokeStyle = v > 0.5 ? `rgba(232,200,120,${0.4 + r() * 0.4})` : `rgba(120,88,32,${0.3 + r() * 0.4})`;
      c.lineWidth = 0.6 + r();
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
  });
}

/** Lo que se ve por el porton: cielo, sierra y surcos de maiz. */
function texturaCampo() {
  return lienzo(1024, 512, (c) => {
    const cielo = c.createLinearGradient(0, 0, 0, 260);
    cielo.addColorStop(0, "#8fb8dc");
    cielo.addColorStop(1, "#e6eef0");
    c.fillStyle = cielo;
    c.fillRect(0, 0, 1024, 512);
    // Sierra lejana
    c.fillStyle = "#8a9aa3";
    c.beginPath();
    c.moveTo(0, 250);
    for (let x = 0; x <= 1024; x += 64) c.lineTo(x, 215 + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.037) * 8);
    c.lineTo(1024, 260);
    c.lineTo(0, 260);
    c.fill();
    // Maizal: hileras que convergen al horizonte
    const campo = c.createLinearGradient(0, 255, 0, 512);
    campo.addColorStop(0, "#5d7a35");
    campo.addColorStop(1, "#2f4a1c");
    c.fillStyle = campo;
    c.fillRect(0, 255, 1024, 257);
    c.strokeStyle = "rgba(20,35,10,0.55)";
    for (let i = -30; i <= 30; i++) {
      c.lineWidth = 1 + Math.abs(i) * 0.08;
      c.beginPath();
      c.moveTo(512 + i * 6, 258);
      c.lineTo(512 + i * 70, 512);
      c.stroke();
    }
  });
}

// ---------------------------------------------------------------------------
// Refacciones del MX80 (del mismo GLB del dron)
// ---------------------------------------------------------------------------

/**
 * Copia de los nodos del GLB del dron que cumplen el filtro, con su
 * transformacion del mundo horneada, centrada y apoyada en y = 0.
 */
function refaccion(escena: THREE.Object3D, filtro: (nombre: string) => boolean, primero = false) {
  escena.updateMatrixWorld(true);
  const grupo = new THREE.Group();
  const elegidos: THREE.Object3D[] = [];
  escena.traverse((n) => {
    if (primero && elegidos.length > 0) return;
    if (!filtro(n.name)) return;
    // Si un ancestro ya entro, el nodo ya viene adentro de esa copia.
    for (let p = n.parent; p; p = p.parent) if (elegidos.includes(p)) return;
    elegidos.push(n);
  });
  for (const n of elegidos) {
    const copia = n.clone(true);
    n.matrixWorld.decompose(copia.position, copia.quaternion, copia.scale);
    grupo.add(copia);
  }
  grupo.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) n.castShadow = n.receiveShadow = true;
  });
  const caja = new THREE.Box3().setFromObject(grupo);
  const centro = caja.getCenter(new THREE.Vector3());
  const pieza = new THREE.Group();
  grupo.position.set(-centro.x, -caja.min.y, -centro.z);
  pieza.add(grupo);
  return pieza;
}

function Refacciones() {
  const gltf = useGLTF(GLB_DRON);
  const piezas = useMemo(() => {
    const s = gltf.scene;
    return {
      bateria: () => refaccion(s, (n) => n.startsWith("BAT_")),
      pala: () => refaccion(s, (n) => n === "CW_1_1", true),
      motor: () => refaccion(s, (n) => n === "motor_giratorio" || n === "cubierta_motor", false),
      aspersor: () => refaccion(s, (n) => n === "pieza_A_cuerpo_Y" || n === "der_disco"),
      esc: () => refaccion(s, (n) => n === "ESC", true),
    };
  }, [gltf.scene]);

  // Una copia por lugar (un objeto de three.js solo puede estar en un sitio).
  const copias = useMemo(
    () => ({
      bateriaBanco: piezas.bateria(),
      motor: piezas.motor(),
      aspersor: piezas.aspersor(),
      esc: piezas.esc(),
      palaMuro1: piezas.pala(),
      palaMuro2: piezas.pala(),
      bateriasRepisa: [piezas.bateria(), piezas.bateria(), piezas.bateria()],
    }),
    [piezas],
  );

  return (
    <>
      {/* Banco de trabajo, al fondo a la izquierda */}
      <group position={[-4.3, PISO_Y, -7.4]} rotation-y={0.35}>
        <BancoDeTrabajo />
        <primitive object={copias.bateriaBanco} position={[-1.1, 0.95, 0]} rotation-y={0.35} />
        <primitive object={copias.motor} position={[0.05, 0.95, 0.05]} />
        <primitive object={copias.aspersor} position={[0.8, 0.95, -0.05]} rotation-y={-0.5} />
        <primitive object={copias.esc} position={[1.35, 0.95, 0.15]} rotation-y={0.9} />
        {/* Palas de repuesto colgadas en el muro, sobre el banco */}
        <primitive object={copias.palaMuro1} position={[-0.4, 2.15, -0.62]} rotation={[Math.PI / 2, 0, 0]} />
        <primitive object={copias.palaMuro2} position={[-0.4, 2.75, -0.62]} rotation={[Math.PI / 2, 0, Math.PI]} />
      </group>

      {/* Repisa con baterias de repuesto, al fondo a la derecha del porton */}
      <group position={[5.8, PISO_Y, -11.3]}>
        <Repisa />
        {copias.bateriasRepisa.map((b, i) => (
          <primitive key={i} object={b} position={[-0.9 + i * 0.9, 1.06, 0]} />
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobiliario
// ---------------------------------------------------------------------------

function useMadera(base: [number, number, number], semilla: number, repetir: [number, number]) {
  return useMemo(() => {
    const t = texturaTablones(base, semilla);
    t.repeat.set(...repetir);
    return t;
  }, [base, semilla, repetir]);
}

const MADERA_CLARA: [number, number, number] = [150, 104, 62];
const MADERA_OSCURA: [number, number, number] = [96, 62, 36];
const REPETIR_1: [number, number] = [1, 1];

function BancoDeTrabajo() {
  const madera = useMadera(MADERA_CLARA, 11, REPETIR_1);
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.08, 1]} />
        <meshStandardMaterial map={madera} roughness={0.8} />
      </mesh>
      {[-1.65, 1.65].map((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.45, z]} castShadow>
            <boxGeometry args={[0.1, 0.9, 0.1]} />
            <meshStandardMaterial color="#4a3020" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* Tablero de herramienta sobre el banco, con sus postes */}
      {[-1.75, 1.75].map((x) => (
        <mesh key={x} position={[x, 1.55, -0.45]} castShadow>
          <boxGeometry args={[0.1, 3.1, 0.1]} />
          <meshStandardMaterial color="#4a3020" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.3, -0.68]} receiveShadow>
        <boxGeometry args={[3.6, 1.6, 0.04]} />
        <meshStandardMaterial color="#8b6a45" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Repisa() {
  const madera = useMadera(MADERA_OSCURA, 23, REPETIR_1);
  return (
    <group>
      {[0.3, 1.0, 1.7].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 0.06, 0.7]} />
          <meshStandardMaterial map={madera} roughness={0.85} />
        </mesh>
      ))}
      {[-1.45, 1.45].map((x) => (
        <mesh key={x} position={[x, 1, 0]} castShadow>
          <boxGeometry args={[0.08, 2, 0.7]} />
          <meshStandardMaterial color="#3d2817" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Pacas de paja apiladas. */
function Pacas({ posicion, rotacionY = 0, arreglo }: {
  posicion: [number, number, number];
  rotacionY?: number;
  /** [x, y, z] de cada paca, en pacas (no en metros). */
  arreglo: [number, number, number][];
}) {
  const paja = useMemo(() => {
    const t = texturaPaja();
    t.repeat.set(2, 1);
    return t;
  }, []);
  const P = { x: 1.1, y: 0.45, z: 0.55 };
  return (
    <group position={posicion} rotation-y={rotacionY}>
      {arreglo.map(([i, j, k]) => (
        <mesh
          key={`${i}${j}${k}`}
          position={[i * (P.x + 0.04), P.y / 2 + j * P.y, k * (P.z + 0.04)]}
          rotation-y={(i + j + k) % 2 ? 0.04 : -0.03}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[P.x, P.y, P.z]} />
          <meshStandardMaterial map={paja} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Lampara colgante: pantalla de lamina y foco calido. */
function Lampara({ posicion, sombra = false }: { posicion: [number, number, number]; sombra?: boolean }) {
  return (
    <group position={posicion}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 2.4]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh>
        <coneGeometry args={[0.38, 0.3, 32, 1, true]} />
        <meshStandardMaterial color="#1f3a2a" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color="#ffe2a8" toneMapped={false} />
      </mesh>
      <pointLight
        position={[0, -0.2, 0]}
        color="#ffcf8a"
        intensity={18}
        distance={14}
        decay={2}
        castShadow={sombra}
        shadow-mapSize={[1024, 1024]}
      />
    </group>
  );
}

/** El granero: piso, muros de tablones, techo a dos aguas, porton y pacas. */
function Granero() {
  const { ancho, fondo, alero, cumbrera } = GRANERO;
  const muroLargo = useMadera(MADERA_CLARA, 3, useMemo<[number, number]>(() => [fondo / 4, 1], [fondo]));
  const muroCorto = useMadera(MADERA_CLARA, 5, useMemo<[number, number]>(() => [ancho / 4, 1], [ancho]));
  const piso = useMadera(MADERA_OSCURA, 9, useMemo<[number, number]>(() => [ancho / 3, fondo / 3], [ancho, fondo]));
  const campo = useMemo(() => texturaCampo(), []);

  // Hastial: triangulo del muro bajo el techo.
  const hastial = useMemo(() => {
    const forma = new THREE.Shape();
    forma.moveTo(-ancho / 2, 0);
    forma.lineTo(ancho / 2, 0);
    forma.lineTo(0, cumbrera - alero);
    forma.closePath();
    return new THREE.ShapeGeometry(forma);
  }, [ancho, alero, cumbrera]);

  const pendiente = Math.atan2(cumbrera - alero, ancho / 2);
  const faldon = Math.hypot(ancho / 2, cumbrera - alero);
  const PORTON = { ancho: 6, alto: 4.4 };

  return (
    <group position={[0, PISO_Y, 0]}>
      {/* Piso de duela */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ancho, fondo]} />
        <meshStandardMaterial map={piso} roughness={0.85} />
      </mesh>

      {/* Muros laterales */}
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[(lado * ancho) / 2, alero / 2, 0]} rotation-y={-lado * (Math.PI / 2)} receiveShadow>
          <planeGeometry args={[fondo, alero]} />
          <meshStandardMaterial map={muroLargo} roughness={0.9} />
        </mesh>
      ))}

      {/* Muro del fondo con el porton abierto: cuatro paneles alrededor del hueco */}
      <group position={[0, 0, -fondo / 2]}>
        {[-1, 1].map((lado) => (
          <mesh key={lado} position={[(lado * (ancho / 2 + PORTON.ancho / 2)) / 2, alero / 2, 0]} receiveShadow>
            <planeGeometry args={[ancho / 2 - PORTON.ancho / 2, alero]} />
            <meshStandardMaterial map={muroCorto} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, (alero + PORTON.alto) / 2, 0]}>
          <planeGeometry args={[PORTON.ancho, alero - PORTON.alto]} />
          <meshStandardMaterial map={muroCorto} roughness={0.9} />
        </mesh>
        <mesh geometry={hastial} position={[0, alero, 0]}>
          <meshStandardMaterial map={muroCorto} roughness={0.9} />
        </mesh>
        {/* El campo, afuera, visto por el porton */}
        <mesh position={[0, PORTON.alto / 2 + 0.6, -6]}>
          <planeGeometry args={[PORTON.ancho * 3.2, PORTON.alto * 2]} />
          <meshBasicMaterial map={campo} toneMapped={false} />
        </mesh>
        {/* Hojas del porton, abiertas hacia adentro, con su cruz de refuerzo */}
        {[-1, 1].map((lado) => (
          <group key={lado} position={[(lado * PORTON.ancho) / 2, 0, 0]} rotation-y={lado * -1.15}>
            <mesh position={[(-lado * PORTON.ancho) / 4, PORTON.alto / 2, 0.05]} castShadow receiveShadow>
              <boxGeometry args={[PORTON.ancho / 2, PORTON.alto, 0.08]} />
              <meshStandardMaterial color="#7a2a1e" roughness={0.85} />
            </mesh>
            {[1, -1].map((d) => (
              <mesh key={d} position={[(-lado * PORTON.ancho) / 4, PORTON.alto / 2, 0.11]}
                rotation-z={d * Math.atan2(PORTON.alto, PORTON.ancho / 2)}>
                <boxGeometry args={[Math.hypot(PORTON.alto, PORTON.ancho / 2) - 0.2, 0.14, 0.04]} />
                <meshStandardMaterial color="#e9e2d0" roughness={0.8} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Muro de enfrente (detras de la camara) con su hastial */}
      <group position={[0, 0, fondo / 2]} rotation-y={Math.PI}>
        <mesh position={[0, alero / 2, 0]}>
          <planeGeometry args={[ancho, alero]} />
          <meshStandardMaterial map={muroCorto} roughness={0.9} />
        </mesh>
        <mesh geometry={hastial} position={[0, alero, 0]}>
          <meshStandardMaterial map={muroCorto} roughness={0.9} />
        </mesh>
      </group>

      {/* Techo a dos aguas */}
      {[-1, 1].map((lado) => (
        <mesh
          key={lado}
          position={[(lado * ancho) / 4, (alero + cumbrera) / 2, 0]}
          rotation={[0, 0, lado * pendiente]}
        >
          <boxGeometry args={[faldon, 0.08, fondo]} />
          <meshStandardMaterial color="#3a2a1d" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Armaduras: tirante, pares y cumbrera */}
      {[-9, -4.5, 0, 4.5, 9].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, alero - 0.1, 0]} castShadow>
            <boxGeometry args={[ancho, 0.22, 0.18]} />
            <meshStandardMaterial color="#5a3b22" roughness={0.9} />
          </mesh>
          {[-1, 1].map((lado) => (
            <mesh key={lado} position={[(lado * ancho) / 4, (alero + cumbrera) / 2 - 0.2, 0]}
              rotation-z={lado * pendiente}>
              <boxGeometry args={[faldon, 0.2, 0.16]} />
              <meshStandardMaterial color="#5a3b22" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, (alero + cumbrera) / 2 - 0.2, 0]}>
            <boxGeometry args={[0.16, cumbrera - alero - 0.4, 0.16]} />
            <meshStandardMaterial color="#5a3b22" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, cumbrera - 0.3, 0]}>
        <boxGeometry args={[0.2, 0.24, fondo]} />
        <meshStandardMaterial color="#4a301b" roughness={0.9} />
      </mesh>

      {/* Pacas de paja */}
      <Pacas posicion={[7.2, 0, -10.6]} rotacionY={0.1}
        arreglo={[[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0], [0.5, 2, 0]]} />
      <Pacas posicion={[-8.4, 0, 1.5]} rotacionY={Math.PI / 2 - 0.08}
        arreglo={[[0, 0, 0], [1, 0, 0], [2, 0, 0], [0.5, 1, 0], [1.5, 1, 0]]} />
      <Pacas posicion={[6.5, 0, 3]} rotacionY={-0.4} arreglo={[[0, 0, 0], [0, 1, 0]]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Plataforma giratoria
// ---------------------------------------------------------------------------

/** Plataforma giratoria de lamina con aro verde. Gira lo que lleva adentro. */
export function Mesa({ children }: { children: React.ReactNode }) {
  const giro = useRef<THREE.Group>(null);
  const girando = useEstudio((s) => s.mesaGirando);
  useFrame((_, delta) => {
    if (girando && giro.current) giro.current.rotation.y += (RPM_MESA / 60) * Math.PI * 2 * delta;
  });
  return (
    <group>
      <mesh position={[0, -0.09, 0]} receiveShadow>
        <cylinderGeometry args={[RADIO_MESA + 0.25, RADIO_MESA + 0.35, 0.1, 96]} />
        <meshStandardMaterial color="#2b2c2a" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.04, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[RADIO_MESA + 0.12, 0.022, 12, 128]} />
        <meshBasicMaterial color="#34d399" toneMapped={false} />
      </mesh>
      <group ref={giro}>
        <mesh position={[0, -0.04, 0]} receiveShadow>
          <cylinderGeometry args={[RADIO_MESA, RADIO_MESA, 0.08, 96]} />
          <meshStandardMaterial color="#4a4d4f" roughness={0.45} metalness={0.6} />
        </mesh>
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * (RADIO_MESA - 0.18), 0.002, Math.sin(a) * (RADIO_MESA - 0.18)]}
              rotation={[-Math.PI / 2, 0, -a]}
            >
              <planeGeometry args={[0.22, 0.03]} />
              <meshBasicMaterial color="#2a2c2e" />
            </mesh>
          );
        })}
        {children}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------

/** El taller completo: granero, luces y refacciones. */
export function Taller() {
  return (
    <>
      {/* Luz calida de granero y luz de dia que entra por el porton */}
      <hemisphereLight args={["#ffe7c4", "#3a2614", 0.45]} />
      <directionalLight position={[0, 5, -22]} intensity={1.2} color="#dfeaf5" />
      {/* Foco principal sobre el dron: da su sombra en la plataforma */}
      <spotLight
        position={[3, 7, 4.5]}
        angle={0.5}
        penumbra={0.7}
        intensity={220}
        distance={30}
        decay={2}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0003}
      />
      <spotLight position={[-4, 5, -3]} angle={0.6} penumbra={0.9} intensity={70} distance={25} decay={2} color="#ffd9a8" />

      <Granero />
      <Lampara posicion={[0, 4.4, -1]} sombra />
      <Lampara posicion={[-4.3, 4.2, -6.6]} />
      <Lampara posicion={[5.8, 4.2, -9.4]} />
      {/* Las refacciones salen del GLB del dron: esperan a que este cargado. */}
      <Suspense fallback={null}>
        <Refacciones />
      </Suspense>
    </>
  );
}
