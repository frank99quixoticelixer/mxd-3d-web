"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { GLB_FRAME, urlModelo } from "@/config/modelos3d";
import { ACCESORIOS_MX80 } from "@/data/accesorios";

/** Radianes por segundo: giro lento, de fondo, nunca el protagonista. */
const VELOCIDAD_GIRO = 0.12;

/** GLB de un accesorio, desde data/accesorios.ts: una sola fuente de rutas. */
function glbDeAccesorio(id: string): string | null {
  return ACCESORIOS_MX80.find((a) => a.id === id)?.glb ?? null;
}

const GLB_CARGADOR = glbDeAccesorio("cargador");
const GLB_GENERADOR = glbDeAccesorio("generador");

/**
 * Donde va cada equipo del paquete, en metros, con el dron en el centro. Los
 * tres GLB estan en metros, asi que se ven a escala real: el generador mide
 * mas de la mitad del dron plegado y el cargador como su bateria.
 */
const POSICION_GENERADOR = new THREE.Vector3(1.35, 0, -0.45);
const POSICION_CARGADOR = new THREE.Vector3(-1.05, 0, 0.45);

/** Copia de una escena apoyada en el piso (y = 0) y centrada en `posicion`. */
function enPiso(escena: THREE.Object3D, posicion: THREE.Vector3): THREE.Object3D {
  const copia = escena.clone(true);
  const caja = new THREE.Box3().setFromObject(copia);
  const centro = caja.getCenter(new THREE.Vector3());
  copia.position.set(posicion.x - centro.x, posicion.y - caja.min.y, posicion.z - centro.z);
  return copia;
}

/**
 * El paquete completo del MX80: el dron, el generador y el cargador, sobre el
 * mismo piso y girando juntos como en una tornamesa.
 */
function PaqueteGirando() {
  const grupo = useRef<THREE.Group>(null);
  const camara = useThree((s) => s.camera);
  const dron = useGLTF(urlModelo(GLB_FRAME));
  const generador = useGLTF(urlModelo(GLB_GENERADOR ?? GLB_FRAME));
  const cargador = useGLTF(urlModelo(GLB_CARGADOR ?? GLB_FRAME));

  const { escena, radio } = useMemo(() => {
    const raiz = new THREE.Group();
    raiz.add(enPiso(dron.scene, new THREE.Vector3(0, 0, 0)));
    if (GLB_GENERADOR) raiz.add(enPiso(generador.scene, POSICION_GENERADOR));
    if (GLB_CARGADOR) raiz.add(enPiso(cargador.scene, POSICION_CARGADOR));
    // El giro es sobre el centro del conjunto, no sobre el dron: si no, el
    // generador describiria un circulo grande y saldria del cuadro.
    const caja = new THREE.Box3().setFromObject(raiz);
    const centro = caja.getCenter(new THREE.Vector3());
    raiz.position.sub(centro);
    return { escena: raiz, radio: caja.getBoundingSphere(new THREE.Sphere()).radius || 1 };
  }, [dron.scene, generador.scene, cargador.scene]);

  // Encuadre: el conjunto entero, desde el mismo angulo que antes tenia el dron.
  useEffect(() => {
    if (!(camara instanceof THREE.PerspectiveCamera)) return;
    const distancia = (radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2))) * 1.02;
    camara.position.set(1.7, 1.1, 2.3).normalize().multiplyScalar(distancia);
    camara.near = radio * 0.01;
    camara.far = radio * 40;
    camara.lookAt(0, 0, 0);
    camara.updateProjectionMatrix();
  }, [camara, radio]);

  useFrame((_, delta) => {
    if (grupo.current) grupo.current.rotation.y += delta * VELOCIDAD_GIRO;
  });

  return (
    <group ref={grupo}>
      <primitive object={escena} />
    </group>
  );
}

/**
 * Escena decorativa, SIN estado ni interaccion: no usa useVisor ni el BVH
 * del visor real (esos existen para resolver clicks/hover al pasar el
 * mouse, que aqui no hacen falta). Gira sola, de fondo.
 */
export function EscenaFondo() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [1.7, 1.1, 2.3], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
    >
      <hemisphereLight args={["#ffffff", "#dfe7e3", 0.8]} />
      <directionalLight position={[3, 4, 2]} intensity={1.8} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
      <Suspense fallback={null}>
        <PaqueteGirando />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(urlModelo(GLB_FRAME));
if (GLB_GENERADOR) useGLTF.preload(urlModelo(GLB_GENERADOR));
if (GLB_CARGADOR) useGLTF.preload(urlModelo(GLB_CARGADOR));
