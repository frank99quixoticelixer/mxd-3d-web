import INDICE from "@/data/descargas-mx80.json";

/**
 * Descargas por pieza (GLB y STL).
 *
 * Los archivos viven en contenido/piezas_MX80/descargas/<SKU>/<SKU>.glb|.stl y
 * se sirven con /api/descarga/<SKU>/<formato>. El indice de este JSON lo genera
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
  return `/api/descarga/${sku}/${formato}`;
}

export function tamanoLegible(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
