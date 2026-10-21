/**
 * Utilidades de normalizacion de texto.
 *
 * El visor usa "normalizarNombre" para emparejar los nombres de los objetos
 * de Blender con las piezas del catalogo, sin que importen mayusculas,
 * acentos, espacios, guiones bajos o los sufijos .001 .002 que Blender
 * agrega cuando duplicas un objeto.
 */

/** Quita acentos y diacriticos. */
export function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Convierte "Balanceador de hélices .001" -> "balanceadordehelices"
 * para comparar nombres de forma tolerante.
 */
export function normalizarNombre(texto: string): string {
  return sinAcentos(texto)
    .toLowerCase()
    .replace(/\.\d+$/, "") // sufijo de duplicado de Blender con punto: .001
    .replace(/0\d{2}$/, "") // sufijo Blender sin punto (sanitizado por THREE.js): brazo001 → brazo
    .replace(/(_\d+)+$/, "") // sufijo de instancia por brazo: motor_1, Propela_CW_1_2
    .replace(/[^a-z0-9]/g, ""); // espacios, guiones, puntos, etc.
}

/** Genera un slug apto para URL a partir de un nombre. */
export function aSlug(texto: string): string {
  return sinAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Formatea un numero con separador de miles, o "Pendiente" si es null. */
export function valorOPendiente(
  valor: number | string | null,
  unidad = "",
): string {
  if (valor === null || valor === "") return "Pendiente";
  if (typeof valor === "number") {
    return `${valor.toLocaleString("es-MX")}${unidad ? ` ${unidad}` : ""}`;
  }
  return valor;
}
