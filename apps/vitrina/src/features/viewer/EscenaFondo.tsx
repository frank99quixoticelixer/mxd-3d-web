"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { GLB_FRAME, urlModelo } from "@/config/modelos3d";

/** Radianes por segundo: giro lento, de fondo, nunca el protagonista. */
const VELOCIDAD_GIRO = 0.12;

function ModeloGirando() {
  const grupo = useRef<THREE.Group>(null);
  const gltf = useGLTF(urlModelo(GLB_FRAME));

  // Mismo centrado que EscenaFrame: el GLB no trae el origen en el centro
  // del dron, asi que sin esto el modelo gira descuadrado en vez de girar
  // sobre si mismo.
  const escena = useMemo(() => {
    const copia = gltf.scene.clone(true);
    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);
    return copia;
  }, [gltf.scene]);

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
        <ModeloGirando />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(urlModelo(GLB_FRAME));
