import type { Pieza } from "./esquema";

/**
 * Costo por kilogramo de cada material de produccion, en MXN.
 *
 * Fuente: precio del rollo/material tal como lo compra MXD. Se actualiza
 * aqui cuando cambie el precio del proveedor; las piezas no guardan el
 * numero, solo la clave (`costosProduccion.material`), asi que un cambio de
 * precio recalcula el costo de todas las piezas de ese material sin tocarlas
 * una por una.
 *
 * PLA: $296/kg (rollo comprado para la Neptune 4 Pro Max).
 */
export const COSTO_MATERIAL_MXN_KG: Record<string, number> = {
  PLA: 296,
};

/**
 * Costo de material para producir UNA pieza.
 *
 * Null si falta el peso (costosProduccion.masaG, pendiente de pesar) o si
 * el material no tiene precio capturado en COSTO_MATERIAL_MXN_KG. No se
 * inventa un costo con un peso o un precio supuestos.
 */
export function costoMaterial(pieza: Pieza): number | null {
  const { masaG, material } = pieza.costosProduccion;
  if (masaG === null || material === null) return null;

  const costoKg = COSTO_MATERIAL_MXN_KG[material.toUpperCase()];
  if (costoKg === undefined) return null;

  return (masaG / 1000) * costoKg;
}

/**
 * Costo total de produccion de UNA pieza: material + pintura + mano de obra.
 *
 * Null si falta cualquiera de los tres. Un total que suma solo lo que ya se
 * conoce se leeria igual que un total completo, y esta hoja existe para no
 * confundir "pendiente" con "cero".
 */
export function costoProduccionTotal(pieza: Pieza): number | null {
  const material = costoMaterial(pieza);
  const { costoPinturaMxn, costoManoObraMxn } = pieza.costosProduccion;
  if (material === null || costoPinturaMxn === null || costoManoObraMxn === null) {
    return null;
  }
  return material + costoPinturaMxn + costoManoObraMxn;
}
