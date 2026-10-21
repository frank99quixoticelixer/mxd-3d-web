import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Pieza } from "@/lib/esquema";

/** Imagen ya cargada, en el formato que espera el componente Image de react-pdf. */
export type ImagenPdf = { data: Buffer; format: "jpg" | "png" };

/**
 * Carga el render de una pieza para incrustarlo en el PDF.
 *
 * Intenta primero el disco y despues la red, y el orden importa:
 *
 *  - En desarrollo y con `next start`, public/ esta en el disco y leerlo es
 *    inmediato y sin red.
 *  - En Vercel, public/ lo sirve el CDN y NO viaja dentro del paquete de la
 *    funcion, asi que la lectura de disco falla y hay que pedirlo por HTTP.
 *
 * Si las dos fallan devuelve null y la ficha se imprime con un marco vacio que
 * dice que el render esta pendiente. Un documento sin foto sigue siendo util;
 * un documento que no se genera, no.
 */
export async function cargarImagen(
  pieza: Pieza,
  origen: string,
): Promise<ImagenPdf | null> {
  const ruta = pieza.imagen;
  if (!ruta) return null;

  const formato: ImagenPdf["format"] = ruta.toLowerCase().endsWith(".png")
    ? "png"
    : "jpg";
  const relativa = ruta.replace(/^\//, "");

  try {
    const data = await readFile(path.join(process.cwd(), "public", relativa));
    return { data, format: formato };
  } catch {
    // Sigue al respaldo por HTTP.
  }

  try {
    const respuesta = await fetch(new URL(relativa, origen), {
      cache: "force-cache",
    });
    if (!respuesta.ok) return null;
    return { data: Buffer.from(await respuesta.arrayBuffer()), format: formato };
  } catch {
    return null;
  }
}

/** Carga los renders de varias piezas en paralelo, indexados por SKU. */
export async function cargarImagenes(
  piezas: Pieza[],
  origen: string,
): Promise<Map<string, ImagenPdf>> {
  const cargadas = await Promise.all(
    piezas.map(async (p) => [p.sku, await cargarImagen(p, origen)] as const),
  );

  const mapa = new Map<string, ImagenPdf>();
  for (const [sku, imagen] of cargadas) {
    if (imagen) mapa.set(sku, imagen);
  }
  return mapa;
}

/**
 * Logo de marca para el encabezado y la portada.
 *
 * Se usa el PNG y no el SVG porque el componente Image de react-pdf no carga
 * SVG. El PNG lo genera scripts/logo_a_png.mjs a partir del SVG oficial; si
 * falta, las paginas caen al texto "MXD" y el documento se genera igual.
 */
export async function cargarLogo(origen: string): Promise<ImagenPdf | null> {
  const relativa = "brand/logo-mxd.png";

  try {
    const data = await readFile(path.join(process.cwd(), "public", relativa));
    return { data, format: "png" };
  } catch {
    // Sigue al respaldo por HTTP.
  }

  try {
    const respuesta = await fetch(new URL(relativa, origen), { cache: "force-cache" });
    if (!respuesta.ok) return null;
    return { data: Buffer.from(await respuesta.arrayBuffer()), format: "png" };
  } catch {
    return null;
  }
}
