"use client";

import { useEffect } from "react";
import { useStore } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { useVisor } from "./estado";

/**
 * Iluminacion del visor.
 *
 * Se usa RoomEnvironment (incluida en three) como mapa de entorno en vez de
 * un HDRI descargado: los materiales PBR reciben reflejos suaves de estudio
 * sin depender de internet ni de archivos externos. Es lo que hace que las
 * piezas se vean con volumen y no planas.
 *
 * Para sustituirlo por un HDRI propio mas adelante:
 *   1. Coloca el archivo en public/hdri/estudio.hdr
 *   2. Reemplaza este componente por <Environment files="/hdri/estudio.hdr" /> de drei
 */
function EntornoEstudio() {
  // Se accede al store de react-three-fiber en vez de a los valores del hook:
  // asi la escena se modifica dentro del efecto y no durante el render.
  const store = useStore();

  useEffect(() => {
    const { gl, scene } = store.getState();

    const pmrem = new THREE.PMREMGenerator(gl);
    const objetivo = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = objetivo.texture;

    return () => {
      scene.environment = null;
      objetivo.dispose();
      pmrem.dispose();
    };
  }, [store]);

  return null;
}

export function Escenario({ sombraY }: { sombraY?: number } = {}) {
  const radio = useVisor((s) => s.radio);

  // Las luces se escalan con el tamanio del modelo para que la escena
  // funcione igual con un tornillo o con el dron completo.
  const d = Math.max(radio, 0.2);

  return (
    <>
      <EntornoEstudio />

      {/* Luz ambiental muy suave: evita negros absolutos en las sombras. */}
      <hemisphereLight args={["#ffffff", "#dfe7e3", 0.55]} />

      {/* Luz principal: define la forma y proyecta la sombra. */}
      <directionalLight
        position={[d * 2.2, d * 3.2, d * 2.0]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-camera-near={0.1}
        shadow-camera-far={d * 14}
        shadow-camera-left={-d * 3}
        shadow-camera-right={d * 3}
        shadow-camera-top={d * 3}
        shadow-camera-bottom={-d * 3}
      />

      {/* Relleno: abre las sombras del lado opuesto. */}
      <directionalLight
        position={[-d * 2.6, d * 1.2, -d * 1.4]}
        intensity={0.55}
      />

      {/* Contraluz: separa la silueta del fondo blanco. */}
      <directionalLight
        position={[0, d * 1.1, -d * 3.2]}
        intensity={0.8}
        color="#eaf6ef"
      />

      {/* Sombra de contacto: da la sensacion de que la pieza se apoya. */}
      <ContactShadows
        position={[0, sombraY ?? -d * 1.02, 0]}
        opacity={0.38}
        scale={d * 7}
        blur={2.6}
        far={d * 3}
        resolution={1024}
        color="#0d1512"
      />
    </>
  );
}
