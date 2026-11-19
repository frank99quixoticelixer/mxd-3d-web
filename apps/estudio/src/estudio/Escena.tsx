"use client";

import { OrbitControls, Sky, useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { ALTURA_VUELO, DISTANCIA_VISIBLE, entornoPorClave, ETIQUETAS, HORAS, LUZ, NEBLINA, type Formato } from "./config";
import { Dron, type Ancla } from "./Dron";
import { useEstudio, type Camara, type EstadoEscena, type Modo } from "./estado";
import { Mesa, Taller } from "./Taller";
import { Piloto } from "./vuelo/Piloto";
import { dibujarEtiquetas } from "./etiquetas";

/** Ref que hace que un objeto se dibuje antes que los demas (el cielo). */
function primeroEnDibujarse(objeto: THREE.Object3D | null) {
  if (objeto) objeto.renderOrder = -1;
}

/** Direccion del sol a partir de elevacion y azimut (grados). */
function direccionSol(elevacion: number, azimut: number): THREE.Vector3 {
  const el = THREE.MathUtils.degToRad(elevacion);
  const az = THREE.MathUtils.degToRad(azimut);
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

/** Tope de metalicidad para el entorno: el estudio no tiene mapa de entorno. */
const METALICO_MAXIMO = 0.35;

/**
 * El mapa elegido (config.ts, ENTORNOS). Las plantas llegan como instancias
 * de GPU (EXT_mesh_gpu_instancing -> THREE.InstancedMesh): reciben sombra pero
 * no la proyectan, porque son miles y proyectar duplicaria el costo.
 *
 * Ajustes de materiales al cargar:
 * - Hojas con textura y transparencia: recorte alfa (alphaTest) en vez de
 *   mezcla. Con miles de arboles, la mezcla se dibuja en desorden y cuesta.
 * - Transmision (vidrio): fuera. En three.js obliga a dibujar la escena dos
 *   veces por cuadro.
 */
function Campo({ url }: { url: string }) {
  const gltf = useGLTF(url);
  useMemo(() => {
    gltf.scene.traverse((n) => {
      const malla = n as THREE.Mesh;
      if (!malla.isMesh) return;
      malla.receiveShadow = true;
      malla.castShadow = !(malla as THREE.InstancedMesh).isInstancedMesh;
      // Sin un entorno que reflejar, un material metalico sale casi negro.
      for (const m of Array.isArray(malla.material) ? malla.material : [malla.material]) {
        const estandar = m as THREE.MeshStandardMaterial;
        if (!estandar.isMeshStandardMaterial) continue;
        estandar.metalness = Math.min(estandar.metalness, METALICO_MAXIMO);
        if (estandar.map && (estandar.transparent || estandar.alphaTest > 0)) {
          estandar.alphaTest = 0.5;
          estandar.transparent = false;
          estandar.depthWrite = true;
        }
        const fisico = estandar as THREE.MeshPhysicalMaterial;
        if (fisico.isMeshPhysicalMaterial && fisico.transmission > 0) fisico.transmission = 0;
        estandar.needsUpdate = true;
      }
    });
  }, [gltf.scene]);
  return <primitive object={gltf.scene} />;
}

/**
 * Cielo, sol y piso. Se esconden al exportar en PNG transparente: en ese
 * formato solo queda el dron.
 */
function Mundo({ escena, fondo }: { escena: EstadoEscena; fondo: React.RefObject<THREE.Group | null> }) {
  const hora = HORAS[escena.hora];
  const glb = useEstudio((s) => entornoPorClave(s.entorno).glb);
  const sol = useMemo(() => direccionSol(hora.elevacion, hora.azimut), [hora]);
  // El cielo se pinta siempre con el sol de mediodia: la hora solo mueve las
  // sombras, no cambia colores.
  const solDelCielo = useMemo(() => direccionSol(LUZ.solDelCielo.elevacion, LUZ.solDelCielo.azimut), []);
  return (
    <>
      <hemisphereLight args={[LUZ.cielo, LUZ.suelo, LUZ.ambiente]} />
      <directionalLight
        position={sol.clone().multiplyScalar(20)}
        intensity={LUZ.sol}
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
        {/* Primero el cielo: no escribe profundidad, y asi no tapa la sierra
            que queda mas lejos que su esfera. */}
        <Sky
          ref={primeroEnDibujarse}
          sunPosition={solDelCielo.toArray()}
          turbidity={6}
          rayleigh={1.4}
          mieCoefficient={0.006}
        />
        <fog attach="fog" args={[LUZ.cielo, NEBLINA.desde, NEBLINA.hasta]} />
        {glb ? (
          <Suspense fallback={null}>
            <Campo key={glb} url={glb} />
          </Suspense>
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

/** Encuadre con el que arranca cada modo. */
const ENCUADRE: Record<Modo, { posicion: [number, number, number]; objetivo: [number, number, number] }> = {
  taller: { posicion: [3.7, 1.75, 4.3], objetivo: [-0.3, 0.5, 0] },
  campo: { posicion: [3.2, 3.4, 4.6], objetivo: OBJETIVO_INICIAL },
};

/** Al cambiar de modo, la camara va al encuadre de ese modo. */
function CamaraDelModo({ modo }: { modo: Modo }) {
  const camara = useThree((s) => s.camera);
  const controles = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    const { posicion, objetivo } = ENCUADRE[modo];
    camara.position.set(...posicion);
    if (controles) {
      controles.target.set(...objetivo);
      controles.update();
    }
  }, [modo, camara, controles]);
  return null;
}

/** Aviso mientras se baja el mapa del campo (no bloquea el lienzo). */
function AvisoCarga() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
      <p className="rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white">
        Cargando el campo… {Math.round(progress)} %
      </p>
    </div>
  );
}

/** La escena completa del estudio, con las etiquetas encima del lienzo. */
export function Escena() {
  const escena = useEstudio((s) => s.escena);
  const modo = useEstudio((s) => s.modo);
  const pilotando = useEstudio((s) => s.pilotando && s.modo === "campo");
  const persecucion = useEstudio((s) => s.persecucion);
  // Con el simulador, el grupo `cuerpo` lleva al dron y el empuje real manda
  // sobre el giro de los rotores.
  const cuerpo = useRef<THREE.Group>(null);
  const encendidoRef = useRef<number | null>(null);
  // En el taller el dron esta parado en la plataforma, quieto y armado: solo
  // se ve su color.
  const escenaDron = useMemo<EstadoEscena>(
    () =>
      modo === "taller"
        ? { ...escena, altura: 0, encendido: 0, aspersion: false, despiece: 0, despliegue: 1, etiquetas: false }
        : pilotando
          ? // Volando: brazos abiertos y armado; la altura la pone el simulador.
            { ...escena, altura: 0, despiece: 0, despliegue: 1 }
          : escena,
    [modo, escena, pilotando],
  );
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
        camera={{ fov: 32, position: [3.2, 3.4, 4.6], near: 0.1, far: DISTANCIA_VISIBLE }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        {modo === "campo" ? (
          <Mundo escena={escena} fondo={fondo} />
        ) : (
          <group ref={fondo}>
            <Taller />
          </group>
        )}
        <Suspense fallback={null}>
          {modo === "taller" ? (
            <Mesa>
              <Dron escena={escenaDron} anclasRef={anclas} alGotas={alGotas} />
            </Mesa>
          ) : (
            <group ref={cuerpo}>
              <Dron escena={escenaDron} anclasRef={anclas} alGotas={alGotas} encendidoRef={encendidoRef} />
            </group>
          )}
        </Suspense>
        {gotas && modo === "campo" && !escena.lineas && <primitive object={gotas} />}
        {/* El objetivo se fija al inicio: atarlo a la altura en cada render
            desharia el encuadre del usuario al mover cualquier mando. */}
        <OrbitControls
          makeDefault
          target={OBJETIVO_INICIAL}
          enableDamping
          enabled={!(pilotando && persecucion)}
        />
        <CamaraDelModo modo={modo} />
        {pilotando && <Piloto cuerpo={cuerpo} encendidoRef={encendidoRef} />}
        <Capturador fondo={fondo} anclas={anclas} escena={escena} />
        <ProyectorEtiquetas anclas={anclas} nodos={nodosEtiqueta} visibles={textos && modo === "campo"} />
      </Canvas>

      {modo === "campo" && <AvisoCarga />}

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
