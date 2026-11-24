/**
 * Nomenclatura del numero de parte MXD, tal como la usa el maestro de partes:
 *
 *   MXD-MX80-<SISTEMA>-<TIPO>-<CONSECUTIVO>-R<REVISION>
 *   MXD-MX80-PRO-ENS-001-R00   (ensamble de propulsion, el primero)
 *
 * - SISTEMA: tres letras (PRO, EST, ASP, BAT...). Los que existan los dicta el
 *   maestro; aqui no se inventa una lista.
 * - TIPO: PZA pieza, SUB conjunto que se compra como una sola partida (motor,
 *   ESC, bateria), ENS ensamble de varias piezas, MAT material.
 * - CONSECUTIVO: tres digitos por sistema y tipo. El 000 queda para el ensamble
 *   padre del sistema (p. ej. MXD-MX80-PRO-ENS-000-R00) y no se sugiere.
 * - REVISION: R00, R01...
 *
 * Modulo sin dependencias de servidor ni de datos: lo usan el formulario de la
 * ficha (cliente) y la accion que guarda (servidor), para que sugieran y
 * validen lo mismo.
 */

export const TIPOS_DE_PARTE = [
  { codigo: "PZA", nombre: "Pieza" },
  { codigo: "SUB", nombre: "Conjunto que se compra completo (motor, ESC, batería)" },
  { codigo: "ENS", nombre: "Ensamble de varias piezas" },
  { codigo: "MAT", nombre: "Material" },
] as const;

export type CodigoTipo = (typeof TIPOS_DE_PARTE)[number]["codigo"];

const FORMATO = /^MXD-MX80-([A-Z]{3})-(PZA|SUB|ENS|MAT)-(\d{3})-R(\d{2})$/;

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
    tipo: m[2] as CodigoTipo,
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

/** Los sistemas que aparecen en una lista de numeros, con cuantos hay de cada uno. */
export function sistemasEnUso(usados: Iterable<string>): { sistema: string; cantidad: number }[] {
  const cuenta = new Map<string, number>();
  for (const numero of usados) {
    const n = leerNumeroDeParte(numero);
    if (n) cuenta.set(n.sistema, (cuenta.get(n.sistema) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([sistema, cantidad]) => ({ sistema, cantidad }))
    .sort((a, b) => a.sistema.localeCompare(b.sistema));
}

/** Mensaje de error si el numero no sigue la nomenclatura; null si esta bien. Un numero vacio no es error. */
export function errorDeFormato(numero: string): string | null {
  const limpio = numero.trim();
  if (limpio === "") return null;
  if (!FORMATO.test(limpio)) {
    return "No sigue la nomenclatura. Ejemplo: MXD-MX80-PRO-ENS-001-R00 (sistema de 3 letras, tipo PZA, SUB, ENS o MAT, consecutivo de 3 dígitos y revisión R00).";
  }
  return null;
}
