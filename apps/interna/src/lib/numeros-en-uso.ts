/**
 * Los numeros de parte MXD que ya existen, y a que pieza pertenecen. Sirve para
 * sugerir el siguiente consecutivo libre al agregar una pieza al BOM y para no
 * dejar que dos piezas lleven el mismo numero.
 *
 * Solo servidor: lee el BOM de la base y el maestro importado.
 */
import MAESTRO from "@/data/maestro-mx80.json";
import { CRUCE_MAESTRO } from "@/data/cruce-maestro";

import { leerBom, leerNumerosVariantes } from "./bom";

/** Dueno de un numero que esta en el maestro pero que ninguna pieza del 3D ha tomado todavia. */
export const SIN_DUENO = "maestro";

/**
 * numero -> a que pieza pertenece: un SKU, o SIN_DUENO si es una partida del
 * maestro que aun no se cruza con ninguna pieza (esa si se puede tomar).
 */
export async function numerosEnUso(): Promise<Map<string, string>> {
  const usados = new Map<string, string>();

  for (const partida of MAESTRO.partidas) usados.set(partida.numero, SIN_DUENO);
  // Los cruces (confirmados o propuestos) asignan la partida a una pieza.
  for (const [sku, cruce] of Object.entries(CRUCE_MAESTRO)) {
    if (cruce.numero) usados.set(cruce.numero, sku);
    for (const numero of Object.values(cruce.porVariante ?? {})) usados.set(numero, sku);
  }
  for (const fila of (await leerBom()).values()) {
    if (fila.numero_parte_mxd) usados.set(fila.numero_parte_mxd, fila.sku);
    for (const numero of Object.values(leerNumerosVariantes(fila.numeros_variantes ?? null))) {
      usados.set(numero, fila.sku);
    }
  }
  return usados;
}
