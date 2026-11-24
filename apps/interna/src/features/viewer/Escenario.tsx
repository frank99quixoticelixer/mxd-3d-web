"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useStore } from "@react-three/fiber";
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

/**
 * Una cifra que cambia cuando algo de la escena se mueve, aparece o desaparece:
 * suma, por cada objeto visible, un trozo de su matriz de mundo. No hace falta
 * que sea exacta, solo que dos escenas distintas casi nunca den lo mismo. La
 * camara no cuenta (no cuelga de la escena): orbitar no cambia la sombra, que
 * se proyecta desde abajo.
 */
function firmaDeEscena(escena: THREE.Object3D): number {
  let firma = 0;
  let n = 0;
  escena.traverseVisible((objeto) => {
    n++;
    const e = objeto.matrixWorld.elements;
    firma +=
      (e[0] + e[1] + e[2] + e[4] + e[5] + e[6] + e[8] + e[9] + e[10] + 3 * e[12] + 5 * e[13] + 7 * e[14]) *
      (1 + (n % 97) * 0.01);
  });
  return firma + n * 1013;
}

/** Cada cuantos cuadros se compara la escena, y cada cuantos segundos se redibuja la sombra como maximo. */
const CUADROS_ENTRE_REVISIONES = 3;
const SEGUNDOS_ENTRE_SOMBRAS = 0.08;

/**
 * Sombra de contacto que solo se redibuja cuando cambia la escena.
 *
 * ContactShadows de drei vuelve a renderizar la escena completa a un render
 * target (mas el blur) EN CADA CUADRO si no se le limita "frames". Con el dron
 * completo (~1,200 objetos y ~4.5 M de triangulos) eso es un segundo render del
 * dron 60 veces por segundo, aunque no se mueva nada: con el dron quieto la
 * pagina gastaba un tercio de su trabajo en una sombra que no cambiaba.
 *
 * Aqui `frames={1}` y se vuelve a pedir un dibujo solo cuando la firma de la
 * escena cambia (el despliegue, el despiece, el giro de los rotores, aislar una
 * pieza, terminar de cargar el modelo...). drei cuenta los cuadros dentro del
 * render del componente, asi que volver a renderizarlo reinicia la cuenta y la
 * sombra se redibuja una vez. Durante un movimiento se actualiza a unos 12 Hz
 * en vez de 60: es una sombra difusa y no se nota. El ultimo cambio siempre se
 * alcanza, porque la firma solo se da por vista cuando se pide el dibujo.
 *
 * La luz principal NO proyecta sombra: su mapa (2048 x 2048) era otro render
 * completo del dron, y medido con visor-glb.html quitarlo mejora la fluidez. Se
 * pierde la sombra del dron sobre si mismo; la sombra de contacto del piso se
 * conserva.
 */
function SombraDeContacto({
  position,
  scale,
  far,
}: {
  position: [number, number, number];
  scale: number;
  far: number;
}) {
  const [, redibujar] = useState(0);
  const estado = useRef({ firma: Number.NaN, cuadros: 0, ultimo: -Infinity });

  useFrame(({ scene, clock }) => {
    const s = estado.current;
    if (++s.cuadros % CUADROS_ENTRE_REVISIONES !== 0) return;
    const firma = firmaDeEscena(scene);
    if (firma === s.firma) return;
    if (clock.elapsedTime - s.ultimo < SEGUNDOS_ENTRE_SOMBRAS) return;
    s.firma = firma;
    s.ultimo = clock.elapsedTime;
    redibujar((n) => n + 1);
  });

  return (
    <ContactShadows
      position={position}
      frames={1}
      opacity={0.38}
      scale={scale}
      blur={2.6}
      far={far}
      resolution={512}
      smooth={false}
      color="#0d1512"
    />
  );
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

      {/* Luz principal: define la forma. No proyecta sombra (cuesta un render completo del dron). */}
      <directionalLight position={[d * 2.2, d * 3.2, d * 2.0]} intensity={2.1} />

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
      <SombraDeContacto position={[0, sombraY ?? -d * 1.02, 0]} scale={d * 7} far={d * 3} />
    </>
  );
}
