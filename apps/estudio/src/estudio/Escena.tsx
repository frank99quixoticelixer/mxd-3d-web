"use client";

import { OrbitControls, Sky, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { ALTURA_VUELO, ETIQUETAS, GLB_CAMPO, HORAS, type Formato } from "./config";
import { Dron, type Ancla } from "./Dron";
import { useEstudio, type Camara, type EstadoEscena } from "./estado";
import { dibujarEtiquetas } from "./etiquetas";

/** Direccion del sol a partir de elevacion y azimut (grados). */
function direccionSol(elevacion: number, azimut: number): THREE.Vector3 {
  const el = THREE.MathUtils.degToRad(elevacion);
  const az = THREE.MathUtils.degToRad(azimut);
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

/** El campo de Blender, cuando exista (config.ts, GLB_CAMPO). */
function Campo({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const escena = useMemo(() => {
    const copia = gltf.scene.clone(true);
    copia.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) n.receiveShadow = true;
    });
    return copia;
  }, [gltf.scene]);
  return <primitive object={escena} />;
}

/**
 * Cielo, sol y piso. Se esconden al exportar en PNG transparente: en ese
 * formato solo queda el dron.
 */
function Mundo({ escena, fondo }: { escena: EstadoEscena; fondo: React.RefObject<THREE.Group | null> }) {
  const hora = HORAS[escena.hora];
  const sol = useMemo(() => direccionSol(hora.elevacion, hora.azimut), [hora]);
  return (
    <>
      <hemisphereLight args={[hora.cielo, "#5b4a35", 0.7]} />
      <directionalLight
        position={sol.clone().multiplyScalar(20)}
        intensity={hora.intensidad}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <group ref={fondo}>
        <Sky sunPosition={sol.toArray()} turbidity={6} rayleigh={1.4} mieCoefficient={0.006} />
        {GLB_CAMPO ? (
          <Campo url={GLB_CAMPO} />
        ) : (
          // Piso de tierra mientras llega el campo de maiz de Blender.
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color="#6e5640" roughness={1} />
          </mesh>
        )}
      </group>
    </>
  );
}

/** Mueve las etiquetas del DOM a la posicion en pantalla de su ancla, cada cuadro. */
function ProyectorEtiquetas({
  anclas,
  nodos,
  visibles,
}: {
  anclas: React.RefObject<Ancla[]>;
  nodos: React.RefObject<(HTMLDivElement | null)[]>;
  visibles: boolean;
}) {
  const camara = useThree((s) => s.camera);
  const tamano = useThree((s) => s.size);
  useFrame(() => {
    const lista = anclas.current ?? [];
    lista.forEach((a, i) => {
      const el = nodos.current?.[i];
      if (!el) return;
      const p = a.punto.clone().project(camara);
      const delante = p.z < 1;
      el.style.display = visibles && a.visible && delante ? "block" : "none";
      el.style.transform = `translate(${((p.x + 1) / 2) * tamano.width}px, ${((1 - p.y) / 2) * tamano.height}px)`;
    });
  });
  return null;
}

/**
 * Registra en el estado lo que la interfaz necesita del lienzo: capturar una
 * imagen y leer o aplicar la camara.
 */
function Capturador({
  fondo,
  anclas,
  escena,
}: {
  fondo: React.RefObject<THREE.Group | null>;
  anclas: React.RefObject<Ancla[]>;
  escena: EstadoEscena;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camara = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controles = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  const setCapturador = useEstudio((s) => s.setCapturador);

  useEffect(() => {
    setCapturador({
      /**
       * Render al tamano final (no una captura de pantalla): el lienzo se
       * agranda un instante, se dibuja, se copia y se devuelve a su tamano.
       */
      capturar: async (formato: Formato) => {
        const tamanoPrevio = gl.getSize(new THREE.Vector2());
        const densidadPrevia = gl.getPixelRatio();
        const aspectoPrevio = camara.aspect;
        const fondoVisible = fondo.current?.visible ?? true;
        try {
          gl.setPixelRatio(1);
          gl.setSize(formato.ancho, formato.alto, false);
          camara.aspect = formato.ancho / formato.alto;
          camara.updateProjectionMatrix();
          if (fondo.current) fondo.current.visible = !formato.transparente;
          gl.setClearColor(0x000000, 0);
          gl.render(scene, camara);

          // Copiar en el mismo instante del render: el lienzo WebGL se borra
          // en cuanto el navegador lo compone.
          const lienzo = document.createElement("canvas");
          lienzo.width = formato.ancho;
          lienzo.height = formato.alto;
          const ctx = lienzo.getContext("2d")!;
          ctx.drawImage(gl.domElement, 0, 0);
          // Se lee al capturar, no en el render: el lote cambia la escena entre tomas.
          if (useEstudio.getState().escena.etiquetas) {
            dibujarEtiquetas(ctx, anclas.current ?? [], camara, formato.ancho, formato.alto);
          }
          return await new Promise<Blob>((resolver, rechazar) =>
            lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error("No se pudo crear la imagen"))), "image/png"),
          );
        } finally {
          if (fondo.current) fondo.current.visible = fondoVisible;
          camara.aspect = aspectoPrevio;
          camara.updateProjectionMatrix();
          gl.setPixelRatio(densidadPrevia);
          gl.setSize(tamanoPrevio.x, tamanoPrevio.y, false);
        }
      },
      leerCamara: (): Camara => ({
        posicion: camara.position.toArray() as [number, number, number],
        objetivo: (controles?.target ?? new THREE.Vector3()).toArray() as [number, number, number],
        fov: camara.fov,
      }),
      aplicarCamara: (c: Camara) => {
        camara.position.fromArray(c.posicion);
        camara.fov = c.fov;
        camara.updateProjectionMatrix();
        if (controles) {
          controles.target.fromArray(c.objetivo);
          controles.update();
        }
      },
    });
    return () => setCapturador(null);
  }, [gl, scene, camara, controles, fondo, anclas, setCapturador]);

  return null;
}

const OBJETIVO_INICIAL: [number, number, number] = [0, ALTURA_VUELO.inicial + 0.4, 0];

/** La escena completa del estudio, con las etiquetas encima del lienzo. */
export function Escena() {
  const escena = useEstudio((s) => s.escena);
  const fondo = useRef<THREE.Group>(null);
  const anclas = useRef<Ancla[]>([]);
  const nodosEtiqueta = useRef<(HTMLDivElement | null)[]>([]);
  const [gotas, setGotas] = useState<THREE.Points | null>(null);
  const alGotas = useCallback((p: THREE.Points) => setGotas(p), []);
  const textos = useEstudio((s) => s.escena.etiquetas);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 32, position: [3.2, 3.4, 4.6], near: 0.05, far: 2000 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <Mundo escena={escena} fondo={fondo} />
        <Suspense fallback={null}>
          <Dron escena={escena} anclasRef={anclas} alGotas={alGotas} />
        </Suspense>
        {gotas && <primitive object={gotas} />}
        {/* El objetivo se fija al inicio: atarlo a la altura en cada render
            desharia el encuadre del usuario al mover cualquier mando. */}
        <OrbitControls makeDefault target={OBJETIVO_INICIAL} enableDamping />
        <Capturador fondo={fondo} anclas={anclas} escena={escena} />
        <ProyectorEtiquetas anclas={anclas} nodos={nodosEtiqueta} visibles={textos} />
      </Canvas>

      {/* Etiquetas en pantalla: las mueve ProyectorEtiquetas sin re-renderizar. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ETIQUETAS.map((etiqueta, i) => (
          <div
            key={i}
            ref={(el) => {
              nodosEtiqueta.current[i] = el;
            }}
            className="absolute left-0 top-0 hidden"
          >
            <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-mxd-verde" />
            <span className="absolute left-0 top-0 h-px w-14 origin-left -rotate-45 bg-white/90" />
            <span className="absolute left-10 -top-14 whitespace-nowrap rounded-md bg-black/70 px-2.5 py-1 text-sm font-semibold text-white">
              {etiqueta.texto}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
