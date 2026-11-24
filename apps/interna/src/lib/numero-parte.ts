/**
 * Nomenclatura del numero de parte MXD, tal como la usa el maestro de partes:
 *
 *   MXD-MX80-<SISTEMA>-<TIPO>-<CONSECUTIVO>-R<REVISION>
 *   MXD-MX80-PRO-ENS-001-R00   (ensamble de propulsion, el primero)
 *
 * - SISTEMA, TIPO: los codigos del catalogo (data/catalogo-codigos.ts), que sale
 *   de la hoja "Catalogo de Codigos" del maestro: 20 sistemas (PRO, EST, ASP...)
 *   y 9 tipos (PZA pieza, SUB subconjunto comprado armado, ENS ensamble con BOM
 *   de nivel inferior, KIT, CON, REF, ACC, DOC, MAT).
 * - CONSECUTIVO: tres digitos, irrepetible por sistema y tipo. El 000 queda
 *   para el ensamble de nivel 1 del sistema (MXD-MX80-PRO-ENS-000-R00) y no se
 *   sugiere.
 * - REVISION: R00, R01...
 *
 * Modulo sin dependencias de servidor ni de datos: lo usan el formulario de la
 * ficha (cliente) y la accion que guarda (servidor), para que sugieran y
 * validen lo mismo.
 */

import { SISTEMAS_DE_PARTE, TIPOS_DE_PARTE_CATALOGO } from "@/data/catalogo-codigos";

export const TIPOS_DE_PARTE = TIPOS_DE_PARTE_CATALOGO;

export type CodigoTipo = string;

const TIPOS_REGEX = TIPOS_DE_PARTE_CATALOGO.map((t) => t.codigo).join("|");
const FORMATO = new RegExp(String.raw`^MXD-MX80-([A-Z]{3})-(${TIPOS_REGEX})-(\d{3})-R(\d{2})$`);

export interface NumeroDeParte {
  sistema: string;
  tipo: CodigoTipo;
  consecutivo: number;
  revision: number;
}

/** Descompone un numero de parte, o devuelve null si no sigue la nomenclatura. */
export function leerNumeroDeParte(numero: string): NumeroDeParte | null {
  const m = FORMATO.exec(numero.trim());
  if (!m) return null;
  return {
    sistema: m[1],
    tipo: m[2],
    consecutivo: Number(m[3]),
    revision: Number(m[4]),
  };
}

export function armarNumeroDeParte(sistema: string, tipo: string, consecutivo: number, revision = 0): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `MXD-MX80-${sistema}-${tipo}-${String(consecutivo).padStart(3, "0")}-R${dos(revision)}`;
}

/**
 * El siguiente consecutivo libre de un sistema y tipo: el mayor que haya mas uno.
 * El 000 no cuenta (es del ensamble padre del sistema), asi que el primero es 001.
 */
export function siguienteNumeroDeParte(usados: Iterable<string>, sistema: string, tipo: string): string {
  let mayor = 0;
  for (const numero of usados) {
    const n = leerNumeroDeParte(numero);
    if (n && n.sistema === sistema && n.tipo === tipo && n.consecutivo > mayor) mayor = n.consecutivo;
  }
  return armarNumeroDeParte(sistema, tipo, mayor + 1);
}

/** Los sistemas del catalogo, cada uno con cuantos numeros de la lista le pertenecen. */
export function sistemasEnUso(usados: Iterable<string>): { sistema: string; nombre: string; cantidad: number }[] {
  const cuenta = new Map<string, number>();
  for (const numero of usados) {
    const n = leerNumeroDeParte(numero);
    if (n) cuenta.set(n.sistema, (cuenta.get(n.sistema) ?? 0) + 1);
  }
  return SISTEMAS_DE_PARTE.map((s) => ({
    sistema: s.codigo,
    nombre: s.nombre,
    cantidad: cuenta.get(s.codigo) ?? 0,
  })).sort((a, b) => a.sistema.localeCompare(b.sistema));
}

/** Mensaje de error si el numero no sigue la nomenclatura; null si esta bien. Un numero vacio no es error. */
export function errorDeFormato(numero: string): string | null {
  const limpio = numero.trim();
  if (limpio === "") return null;
  const partes = FORMATO.exec(limpio);
  if (!partes) {
    return `No sigue la nomenclatura. Ejemplo: MXD-MX80-PRO-ENS-001-R00 (sistema de 3 letras, tipo ${TIPOS_REGEX.replaceAll("|", ", ")}, consecutivo de 3 dígitos y revisión R00).`;
  }
  if (!SISTEMAS_DE_PARTE.some((s) => s.codigo === partes[1])) {
    return `El sistema ${partes[1]} no está en el catálogo de códigos del maestro.`;
  }
  return null;
}
