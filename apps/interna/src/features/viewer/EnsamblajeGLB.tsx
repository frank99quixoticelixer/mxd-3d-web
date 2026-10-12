"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import type { Pieza } from "@/lib/esquema";
import { PlataformaPiezas } from "./PlataformaPiezas";

/**
 * Carga el GLB del ensamble y lo entrega a la plataforma de piezas.
 *
 * COMPRESION
 * - Sin comprimir o con Meshopt: funciona tal cual (el decodificador de
 *   Meshopt viene incluido en three, no descarga nada de internet).
 * - Con Draco: drei descarga el decodificador de un CDN de Google la
 *   primera vez. Si necesitas funcionar sin internet, copia los archivos
 *   del decodificador a public/draco/ y cambia la llamada por:
 *       useGLTF(url, "/draco/")
 *
 * NORMALIZACION
 * El modelo se centra en el origen y se reorienta para que la camara
 * siempre lo encuadre bien, sin importar donde este el origen en Blender.
 */
export function EnsamblajeGLB({
  url,
  catalogo,
}: {
  url: string;
  catalogo: Pieza[];
}) {
  const gltf = useGLTF(url);

  const raiz = useMemo(() => {
    // Clon para no mutar el objeto en cache de drei si el componente se remonta.
    const copia = gltf.scene.clone(true);

    // Centrar el modelo en el origen: la camara y el explosionado
    // asumen que el ensamble esta centrado.
    const contenedor = new THREE.Group();
    contenedor.name = "MXD_Contenedor";
    contenedor.add(copia);

    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);

    return contenedor;
  }, [gltf]);

  return (
    <PlataformaPiezas raiz={raiz} catalogo={catalogo} modoDemo={false} />
  );
}
