"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { EXPLOSION } from "@/config/modelos3d";
import { ajustarDetalleAlPlaceholder } from "./ajusteTuerca";
import { useVisor } from "./estado";
import { prepararMateriales, type PiezaEnEscena } from "./resolverPiezas";

const URL_TUERCA_DETALLADA = "/models/mx80/piezas/MX80-003_v2.glb";

/**
 * Cuanto se separan jacket/spacers/tornillo entre si, como fraccion de su
 * propia distancia al centro de la tuerca. Mas grande que en la ficha
 * individual (0.9 en EscenaPieza): aqui la tuerca es diminuta dentro del
 * ensamble completo, asi que necesita una separacion relativa mayor para
 * que el despiece interno se note (si no, se ve como un solo bloque que
 * simplemente se aleja, sin distinguirse las 4 sub-piezas).
 */
const FACTOR_DESPIECE_INTERNO = 1.6;

/**
 * Geometria vacia compartida: se le asigna al placeholder original para que
 * no dibuje nada el mismo, sin tocar su `.visible`.
 *
 * Por que no usar `.visible = false`: three.js corta ahi toda la rama al
 * renderizar (Object3D.visible=false detiene la recursion antes de llegar
 * a los hijos, sin importar el .visible de cada uno). Si el detalle fuera
 * hijo de un placeholder oculto asi, tambien quedaria invisible. Vaciando
 * la geometria en vez de ocultar el objeto, el placeholder sigue
 * "visible" (no dibuja nada porque no tiene vertices) y sus hijos —el
 * detalle— se siguen recorriendo y dibujando con normalidad. Esto ademas
 * es lo que permite que el detalle sea hijo real del placeholder: hereda
 * su posicion animada automaticamente (el despiece general lo mueve) y
 * ContornoPantalla.tsx lo encuentra al recorrer pieza.objeto para dibujar
 * el contorno verde de seleccion.
 */
const GEOMETRIA_VACIA = new THREE.BufferGeometry();

interface ParteInterna {
  objeto: THREE.Object3D;
  base: THREE.Vector3;
}

interface Instancia {
  pieza: PiezaEnEscena;
  copia: THREE.Object3D;
  partes: ParteInterna[];
  /**
   * Escala calculada UNA sola vez, a partir de geometria sin mutar: el
   * tamano real del placeholder (su propio bounding box) entre el tamano
   * del detalle recien clonado y centrado. Por instancia y no un factor
   * fijo para toda la escena, porque el placeholder de arriba y el de abajo
   * del balanceador no miden exactamente lo mismo en el GLB del ensamble.
   */
  escala: number;
  /**
   * Centro real del placeholder, en su propio espacio local (objeto).
   *
   * El nodo del placeholder (sujetador_balanceador_1/2) no tiene TRS propio
   * (position/rotation/scale son identidad): su ubicacion real esta
   * horneada directamente en los vertices de la malla. Por eso el ancla
   * correcta NO es pieza.objeto.position (que es [0,0,0] en reposo), sino
   * el centro de su bounding box en espacio local.
   */
  centroLocal: THREE.Vector3;
}

/**
 * Sustituye, dentro del ensamble completo, la geometria de relleno de la
 * tuerca del balanceador (`sujetador_balanceador_1/2`) por el modelo
 * detallado de la pieza sola (jacket + 2 spacers + tornillo) y le aplica
 * su propio despiece interno, enganchado al mismo control global de
 * despiece del explorador.
 *
 * Por que existe: mx80_ensamble_v1.glb es un export mas viejo y simple que
 * MX80-003_v2.glb (la ficha de la pieza sola) y no trae esos 4 nodos.
 * Hasta que alguien reexporte el ensamble completo con el mismo detalle,
 * se superpone aqui en tiempo de ejecucion, sin tocar el archivo del
 * ensamble.
 */
/**
 * El GLB del ensamble trae, ademas de los dos placeholders `sujetador_balanceador_*`,
 * dos tornillos horneados por separado (`tornillo_balanceador_1/2`, acostados a
 * 90 grados). Vienen de un export mas nuevo del brazo y "tornillo_balanceador" ya
 * era alias de esta pieza desde antes, asi que sin este filtro tambien caen en
 * `objetivos` de abajo: cada uno recibe SU PROPIA copia del detalle completo
 * (jacket + spacers + tornillo) ajustada a su caja, y el tornillo se ve
 * duplicado y de lado. Sobran: el detalle ya trae su propio tornillo vertical.
 */
const esTornilloHorneado = (nombre: string) => /^tornillo_balanceador/i.test(nombre);
/** El placeholder que se reemplaza por el detalle completo. */
const esPlaceholderTuerca = (nombre: string) => /^sujetador_balanceador/i.test(nombre);

export function TuercaDetallada({ piezas }: { piezas: PiezaEnEscena[] }) {
  const gltf = useGLTF(URL_TUERCA_DETALLADA);

  // Se filtra por NOMBRE del nodo, no por sku: jacket_balanceador,
  // spacer_balanceador_1/2 y tornillo_balanceador (los 4 nodos de este mismo
  // detalle) tambien son nombresBlender de las subpiezas MX80-001-04..07 en
  // mx80.ts (para que su propia ficha, mas chica, pueda reconocerlos). Si
  // este filtro comparara sku en vez de nombre, un cambio en como
  // resolverPiezas reparte esos alias entre MX80-001-03 y sus subpiezas
  // podria dejar de encontrar el placeholder o de ocultar el tornillo
  // horneado. El nombre del nodo no cambia nunca: es la llave estable.
  const objetivos = useMemo(
    () => piezas.filter((p) => esPlaceholderTuerca(p.objeto.name)),
    [piezas],
  );

  // Los tornillos horneados sobrantes: se ocultan vaciando su geometria, igual
  // que se hace con los placeholders reemplazados (ver GEOMETRIA_VACIA).
  const sobrantes = useMemo(
    () => piezas.filter((p) => esTornilloHorneado(p.objeto.name)),
    [piezas],
  );

  // Una copia independiente del detalle por cada instancia de la tuerca en
  // el ensamble (arriba y abajo de cada balanceador). La escala y el centro
  // se calculan UNA sola vez aqui, a partir de geometria recien clonada y
  // sin mutar (el efecto de abajo solo los aplica) para que sea seguro
  // reejecutar el efecto sin acumular error, como hace React en modo
  // estricto.
  const instancias: Instancia[] = useMemo(() => {
    return objetivos.map((pieza) => {
      const copia = gltf.scene.clone(true);

      const original = pieza.objeto as THREE.Mesh;
      original.geometry.computeBoundingBox();
      const cajaPlaceholder = original.geometry.boundingBox ?? new THREE.Box3();
      const { escala, posicion: centroLocal } = ajustarDetalleAlPlaceholder(
        copia,
        cajaPlaceholder,
      );

      const partes: ParteInterna[] = copia.children.map((hijo) => ({
        objeto: hijo,
        base: hijo.position.clone(),
      }));

      return { pieza, copia, partes, escala, centroLocal };
    });
  }, [objetivos, gltf]);

  // Vacia la geometria del placeholder original e inserta el detalle en su
  // lugar, como hijo (ver comentario de GEOMETRIA_VACIA arriba). Tambien
  // reusa el resaltado hover/seleccion de la pieza original.
  useEffect(() => {
    // Se recuerda exactamente que se agrego a pieza.materiales en esta
    // pasada, para poder quitar justo eso en la limpieza (React vuelve a
    // correr este efecto en modo estricto; sin esto se duplicarian).
    const materialesAgregados: (typeof instancias)[number]["pieza"]["materiales"] =
      [];
    const geometriasOriginales = new Map<THREE.Mesh, THREE.BufferGeometry>();

    for (const { objeto } of sobrantes) {
      const malla = objeto as THREE.Mesh;
      if (malla.isMesh) {
        geometriasOriginales.set(malla, malla.geometry);
        malla.geometry = GEOMETRIA_VACIA;
      }
    }

    for (const { pieza, copia, escala, centroLocal } of instancias) {
      const original = pieza.objeto as THREE.Mesh;
      copia.scale.setScalar(escala);
      copia.position.copy(centroLocal);

      original.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          geometriasOriginales.set(m, m.geometry);
          m.geometry = GEOMETRIA_VACIA;
        }
      });
      original.add(copia);

      // El resaltado de PlataformaPiezas y el contorno verde de seleccion
      // (ContornoPantalla.tsx) recorren pieza.objeto con .traverse(): al
      // ser copia un hijo real de original, ambos encuentran el detalle
      // sin cambios en ese codigo. Aqui solo se agregan sus materiales a
      // pieza.materiales para que el resaltado hover/seleccion los tina.
      const nuevos = prepararMateriales(copia);
      pieza.materiales.push(...nuevos);
      materialesAgregados.push(...nuevos);
    }

    return () => {
      for (const { pieza, copia } of instancias) {
        pieza.objeto.remove(copia);
        pieza.objeto.traverse((n) => {
          const m = n as THREE.Mesh;
          const original = geometriasOriginales.get(m);
          if (original) m.geometry = original;
        });
      }
      for (const { objeto } of sobrantes) {
        const malla = objeto as THREE.Mesh;
        const original = geometriasOriginales.get(malla);
        if (original) malla.geometry = original;
      }
      const agregadosSet = new Set(materialesAgregados);
      for (const { pieza } of instancias) {
        pieza.materiales = pieza.materiales.filter(
          (m) => !agregadosSet.has(m),
        );
      }
    };
  }, [instancias, sobrantes]);

  const separacion = useRef(0);

  useFrame((_, delta) => {
    const objetivo = Math.min(useVisor.getState().explosion, 1);
    const k = 1 - Math.exp(-EXPLOSION.suavizado * delta);
    separacion.current += (objetivo - separacion.current) * k;

    // copia es hijo de pieza.objeto: hereda su posicion animada por el
    // despiece general sola, no hace falta seguirla a mano aqui. Solo se
    // anima la separacion INTERNA (jacket/spacers/tornillo entre si).
    const escala = 1 + separacion.current * FACTOR_DESPIECE_INTERNO;
    for (const { partes } of instancias) {
      for (const parte of partes) {
        parte.objeto.position.copy(parte.base).multiplyScalar(escala);
      }
    }
  });

  return null;
}

useGLTF.preload(URL_TUERCA_DETALLADA);
