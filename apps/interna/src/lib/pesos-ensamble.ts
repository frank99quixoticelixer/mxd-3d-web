/**
 * De donde sale el peso de cada pieza, y los pesos de una ficha. Solo servidor.
 *
 * Orden de preferencia para el peso unitario de una pieza:
 *  1. el capturado en su ficha (campo Masa, en g) o el del catalogo del 3D;
 *  2. el "Peso unit. (kg)" de su partida en el maestro de partes.
 */
import { CRUCE_MAESTRO } from "@/data/cruce-maestro";

import type { FilaBom } from "./bom";
import { leerBom } from "./bom";
import { obtenerPiezaPorSku, obtenerSubpiezas } from "./catalogo";
import type { Pieza } from "./esquema";
import { leerMaestro, type PartidaMaestro } from "./maestro-base";
import { resumirEnsamble, type PesoPropio, type ResumenEnsamble } from "./pesos";

const TITULO_PESO = "Peso unit. (kg)";

/** Un peso unitario por pieza, con su origen. */
export function crearPesoPropio(
  bom: Map<string, FilaBom>,
  maestro: PartidaMaestro[],
): (sku: string) => PesoPropio {
  const pesoDePartida = new Map<string, number>();
  for (const p of maestro) {
    const kg = p.datos[TITULO_PESO];
    if (typeof kg === "number" && kg > 0) pesoDePartida.set(p.numero, kg);
  }
  return (sku) => {
    const g = bom.get(sku)?.masa_g ?? obtenerPiezaPorSku(sku)?.especificaciones.masa_g ?? null;
    if (typeof g === "number" && g > 0) return { kg: g / 1000, origen: "ficha" };
    const numero = bom.get(sku)?.numero_parte_mxd ?? CRUCE_MAESTRO[sku]?.numero ?? null;
    const kg = numero ? pesoDePartida.get(numero) : undefined;
    return kg !== undefined ? { kg, origen: "maestro" } : { kg: null, origen: null };
  };
}

/** El peso unitario de la pieza y, si se desarma en el 3D, el peso de su ensamble. */
export async function pesosDeLaFicha(
  pieza: Pieza,
): Promise<{ propio: PesoPropio; ensamble: ResumenEnsamble | null }> {
  let bom: Map<string, FilaBom>;
  let maestro: PartidaMaestro[];
  try {
    [bom, maestro] = await Promise.all([leerBom(), leerMaestro()]);
  } catch {
    // Sin base o sin la tabla del maestro: la ficha sigue sin este bloque.
    return { propio: { kg: null, origen: null }, ensamble: null };
  }
  const pesoPropio = crearPesoPropio(bom, maestro);
  const hijos = obtenerSubpiezas(pieza.sku);
  return {
    propio: pesoPropio(pieza.sku),
    ensamble: hijos.length > 0 ? resumirEnsamble(pieza, obtenerSubpiezas, pesoPropio) : null,
  };
}
