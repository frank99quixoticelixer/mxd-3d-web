"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";

import { COLORES_3D } from "@/config/marca";
import { useVisor } from "./estado";
import { Escenario } from "./Escenario";
import { LimiteError } from "./LimiteError";

/** Mismo giro de referencia que las piezas sueltas (EscenaPieza.tsx). */
const VELOCIDAD_GIRO = 0.63;

function Cargando() {
  const { progress } = useProgress();
  return (
    <Html center>
      <span className="whitespace-nowrap text-xs font-medium tracking-wide text-mxd-gris">
        Cargando accesorio {Math.round(progress)}%
      </span>
    </Html>
  );
}

/**
 * Caja gris generica: se muestra en vez de un GLB cuando el accesorio
 * todavia no tiene modelo 3D propio. Mismos colores de "modo demostracion"
 * que config/marca.ts ya reserva para esto (COLORES_3D.demo/demoAlterno).
 */
function PlaceholderGenerico({
  girando,
  alMedir,
}: {
  girando: boolean;
  alMedir: (medidas: { radio: number; semialto: number }) => void;
}) {
  const giro = useRef<THREE.Group>(null);
  const radio = 1;
  const semialto = 0.4;

  useEffect(() => {
    useVisor.setState({ radio });
    alMedir({ radio, semialto });
  }, [alMedir]);

  useFrame((_, delta) => {
    if (giro.current && girando) giro.current.rotation.y += delta * VELOCIDAD_GIRO;
  });

  return (
    <group ref={giro}>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[1.4, 0.8, 1]} />
        <meshStandardMaterial color={COLORES_3D.demo} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.06, 32]} />
        <meshStandardMaterial color={COLORES_3D.demoAlterno} roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

/** Carga el GLB del accesorio, lo centra y lo gira sobre su eje vertical. */
function ModeloAccesorio({
  url,
  girando,
  alMedir,
}: {
  url: string;
  girando: boolean;
  alMedir: (medidas: { radio: number; semialto: number }) => void;
}) {
  const gltf = useGLTF(url);
  const camara = useThree((s) => s.camera);
  const giro = useRef<THREE.Group>(null);

  const { raiz, radio, semialto } = useMemo(() => {
    const copia = gltf.scene.clone(true);
    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);
    const tamano = caja.getSize(new THREE.Vector3());
    return {
      raiz: copia,
      radio: tamano.length() / 2 || 1,
      semialto: tamano.y / 2 || 0.5,
    };
  }, [gltf]);

  useEffect(() => {
    useVisor.setState({ radio });
    alMedir({ radio, semialto });
    if (camara instanceof THREE.PerspectiveCamera) {
      const distancia =
        (radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2))) * 1.5;
      camara.position.set(1, 0.6, 1.3).normalize().multiplyScalar(distancia);
      camara.near = Math.max(radio * 0.01, 0.001);
      camara.far = radio * 60;
      camara.lookAt(0, 0, 0);
      camara.updateProjectionMatrix();
    }
  }, [radio, semialto, camara, alMedir]);

  useFrame((_, delta) => {
    if (giro.current && girando) giro.current.rotation.y += delta * VELOCIDAD_GIRO;
  });

  return (
    <group ref={giro}>
      <primitive object={raiz} />
    </group>
  );
}

/**
 * Visor de un solo accesorio: aparece solo, girando. No tiene despiece ni
 * subpiezas clicables, a diferencia de EscenaPieza — un accesorio es un
 * objeto completo, no se arma a partir del GLB del dron.
 */
export function EscenaAccesorio({
  url,
  girando = true,
}: {
  /** URL publica del GLB (ya resuelta con urlModelo), o null para la primitiva generica. */
  url: string | null;
  girando?: boolean;
}) {
  const [medidas, setMedidas] = useState<{ radio: number; semialto: number } | null>(null);
  const radio = medidas?.radio ?? null;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 35, position: [1.8, 1.1, 2.3], near: 0.01, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Escenario sombraY={medidas ? -medidas.semialto * 1.02 : undefined} />
      <LimiteError respaldo={null}>
        {url ? (
          <Suspense fallback={<Cargando />}>
            <ModeloAccesorio url={url} girando={girando} alMedir={setMedidas} />
          </Suspense>
        ) : (
          <PlaceholderGenerico girando={girando} alMedir={setMedidas} />
        )}
      </LimiteError>
      {radio !== null && (
        <OrbitControls
          makeDefault
          enableDamping
          enablePan={false}
          minDistance={radio * 1.5}
          maxDistance={radio * 9}
          maxPolarAngle={Math.PI * 0.495}
        />
      )}
    </Canvas>
  );
}
