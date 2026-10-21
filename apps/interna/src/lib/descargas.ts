import INDICE from "@/data/descargas-mx80.json";

/**
 * Descargas por pieza (GLB y STL).
 *
 * Los archivos viven en apps/interna/descargas/<SKU>/<SKU>.glb|.stl y se
 * sirven por la ruta /api/descargas, que pasa por la contrasena de proxy.ts.
 * No van en public/: en Hostinger esos archivos los entrega el servidor
 * estatico sin pasar por la app y quedaban abiertos. El indice JSON lo genera
 * brazo_completo/exportar_descargas.py junto con los archivos; sirve para que
 * la interfaz solo ofrezca botones de lo que existe.
 *
 * Este modulo no toca el disco, asi que es seguro importarlo desde componentes
 * de cliente.
 */

export type FormatoDescarga = "glb" | "stl";
export const FORMATOS: readonly FormatoDescarga[] = ["glb", "stl"];

type Indice = Record<string, Partial<Record<FormatoDescarga, number>>>;

/** Formatos disponibles de un SKU, con su tamanio en bytes. */
export function descargasDe(sku: string): Partial<Record<FormatoDescarga, number>> {
  return (INDICE as Indice)[sku] ?? {};
}

export function urlDescarga(sku: string, formato: FormatoDescarga): string {
  return `/api/descargas/${sku}/${sku}.${formato}`;
}

export function tamanoLegible(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
