"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { COLORES_3D } from "@/config/marca";
import { useVisor } from "./estado";
import { Escenario } from "./Escenario";
import { AvisoCarga, MarcaCargado } from "./AvisoCarga";
import { LimiteError } from "./LimiteError";

/** Mismo giro de referencia que las piezas sueltas (EscenaPieza.tsx). */
const VELOCIDAD_GIRO = 0.63;


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
  nodos,
  girando,
  alMedir,
}: {
  url: string;
  /** Solo los nodos con estos prefijos (y lo que cuelga de ellos). */
  nodos?: string[];
  girando: boolean;
  alMedir: (medidas: { radio: number; semialto: number }) => void;
}) {
  const gltf = useGLTF(url);
  const camara = useThree((s) => s.camera);
  const giro = useRef<THREE.Group>(null);

  const { raiz, radio, semialto } = useMemo(() => {
    const copia = gltf.scene.clone(true);
    // Accesorio dentro de otro GLB (la bateria en el modelo del dron): se
    // quitan de la copia las mallas que no son suyas antes de medir, para que
    // el encuadre y la sombra sean los de la bateria y no los del dron.
    if (nodos && nodos.length > 0) {
      const esDelAccesorio = (n: THREE.Object3D) => {
        for (let a: THREE.Object3D | null = n; a; a = a.parent) {
          const nombre = a.name;
          if (nodos.some((prefijo) => nombre.startsWith(prefijo))) return true;
        }
        return false;
      };
      const ajenas: THREE.Object3D[] = [];
      copia.traverse((n) => {
        if ((n as THREE.Mesh).isMesh && !esDelAccesorio(n)) ajenas.push(n);
      });
      for (const n of ajenas) n.removeFromParent();
    }
    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);
    const tamano = caja.getSize(new THREE.Vector3());
    return {
      raiz: copia,
      radio: tamano.length() / 2 || 1,
      semialto: tamano.y / 2 || 0.5,
    };
  }, [gltf, nodos]);

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
  nodos,
  girando = true,
}: {
  /** URL publica del GLB (ya resuelta con urlModelo), o null para la primitiva generica. */
  url: string | null;
  /** Prefijos de los nodos del GLB que son el accesorio. */
  nodos?: string[];
  girando?: boolean;
}) {
  const [medidas, setMedidas] = useState<{ radio: number; semialto: number } | null>(null);
  const radio = medidas?.radio ?? null;
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(false);

  return (
    <>
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
      <LimiteError respaldo={null} alFallar={() => setFallo(true)}>
        {url ? (
          <Suspense fallback={null}>
            <MarcaCargado alCambiar={setCargado} />
            <ModeloAccesorio url={url} nodos={nodos} girando={girando} alMedir={setMedidas} />
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
    {/* Sin GLB (la caja generica) no hay nada que esperar. */}
    <AvisoCarga texto="Cargando accesorio" listo={!url || cargado} fallo={fallo} />
    </>
  );
}
