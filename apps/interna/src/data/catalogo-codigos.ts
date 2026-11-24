/**
 * Catalogo de codigos del sistema de numeros de parte MXD: lo que dice la hoja
 * "Catalogo de Codigos" del maestro de partes (Maestro_Partes_MX80.xlsx).
 *
 *   MXD-MX80-<SISTEMA>-<TIPO>-<CONSECUTIVO>-R<REVISION>
 *
 * Son reglas y listas de validacion, no datos de una pieza: pueden ir en el repo.
 * Lo que si NO va en el repo es el contenido del maestro (proveedores, numeros
 * OEM, notas de calidad): vive en la base de datos (tabla maestro_partidas).
 *
 * Si ingenieria cambia el catalogo en el Excel, se actualiza aqui a mano.
 */

export interface CodigoSistema {
  codigo: string;
  nombre: string;
  /** Cuanto se usa en la BOM del MX80 (texto del catalogo; informativo). */
  uso: string;
}

export const SISTEMAS_DE_PARTE: CodigoSistema[] = [
  { codigo: "PRD", nombre: "Producto terminado (nivel 0 de la BOM)", uso: "1 partida: dron MX80 completo" },
  { codigo: "EST", nombre: "Estructura y chasis", uso: "23 piezas + 2 ensambles" },
  { codigo: "PRO", nombre: "Propulsión", uso: "7 piezas, 2 ensambles, 2 subconjuntos" },
  { codigo: "ELE", nombre: "Sistema eléctrico y distribución de energía", uso: "1 pieza, 1 ensamble, 3 subconjuntos" },
  { codigo: "AVI", nombre: "Aviónica y control de vuelo", uso: "3 ensambles, 3 subconjuntos" },
  { codigo: "NAV", nombre: "Navegación, GPS y RTK", uso: "2 piezas" },
  { codigo: "COM", nombre: "Comunicaciones y telemetría", uso: "2 ensambles" },
  { codigo: "AGR", nombre: "Sistema agrícola", uso: "11 piezas" },
  { codigo: "BOM", nombre: "Bombas y sistema hidráulico", uso: "1 pieza, 2 ensambles, 3 subconjuntos" },
  { codigo: "ASP", nombre: "Aspersión, boquillas y tuberías", uso: "11 piezas, 3 ensambles, 1 materia prima" },
  { codigo: "GRA", nombre: "Sistema de dispersión de granulados", uso: "Sin uso en MX80 (reservado)" },
  { codigo: "BAT", nombre: "Baterías", uso: "1 pieza, 2 ensambles, 1 subconjunto (batería MX80, 3 pzas/kit)" },
  { codigo: "CAR", nombre: "Carga y alimentación", uso: "1 subconjunto: cargador MX80" },
  { codigo: "CAB", nombre: "Cableado, conectores y arneses", uso: "3 piezas + 14 arneses" },
  { codigo: "TOR", nombre: "Tornillería y elementos de fijación", uso: "4 piezas" },
  { codigo: "PLA", nombre: "Piezas plásticas, cubiertas y carcasas", uso: "3 piezas" },
  { codigo: "SEG", nombre: "Seguridad y señalización", uso: "1 subconjunto" },
  { codigo: "EMP", nombre: "Empaque y transporte", uso: "Sin uso en MX80 (reservado)" },
  { codigo: "HER", nombre: "Herramientas y accesorios", uso: "Sin uso en MX80 (reservado)" },
  { codigo: "DOC", nombre: "Documentación, etiquetas y manuales", uso: "Sin uso en MX80 (reservado)" },
];

export interface CodigoTipo {
  codigo: string;
  nombre: string;
  /** Criterio de asignacion. */
  criterio: string;
}

export const TIPOS_DE_PARTE_CATALOGO: CodigoTipo[] = [
  { codigo: "PZA", nombre: "Pieza individual", criterio: "No se puede desarmar sin destruirla" },
  { codigo: "SUB", nombre: "Subconjunto", criterio: "Unidad funcional comprada ya armada (módulos, motores, ESC, arneses)" },
  { codigo: "ENS", nombre: "Ensamble", criterio: "Conjunto armado con BOM de nivel inferior" },
  { codigo: "KIT", nombre: "Kit de componentes", criterio: "Agrupación comercial de varias partes" },
  { codigo: "CON", nombre: "Consumible", criterio: "Se reemplaza por desgaste o en cada mantenimiento" },
  { codigo: "REF", nombre: "Refacción", criterio: "Parte que se comercializa exclusivamente como repuesto" },
  { codigo: "ACC", nombre: "Accesorio", criterio: "Opcional, no requerido para el vuelo" },
  { codigo: "DOC", nombre: "Documento o etiqueta", criterio: "Manuales, etiquetas y placas de datos" },
  { codigo: "MAT", nombre: "Materia prima", criterio: "Se surte por longitud, peso o volumen" },
];

/** Reglas de consecutivo, revision, criticidad, estatus y numero corporativo (texto del catalogo). */
export const REGLAS_CONSECUTIVO: [string, string][] = [
  ["0", "Reservado para el ensamble de nivel 1 de cada sistema (ej. MXD-MX80-PRO-ENS-000-R00)"],
  ["001 – 999", "Secuencial e irrepetible por combinación SISTEMA + TIPO; no se reutilizan números de partes descontinuadas"],
];
export const REGLAS_REVISION: [string, string][] = [
  ["R00", "Revisión de liberación inicial"],
  ["R01, R02, …", "Cambio que afecta diseño, material, dimensiones, desempeño, compatibilidad o fabricación conservando la intercambiabilidad"],
  ["Nuevo número de parte", "Cuando el cambio elimina la intercambiabilidad, o cambia lado, capacidad, material o color funcional"],
];
export const DEFINICIONES_CRITICIDAD: [string, string][] = [
  ["Alta", "Su falla causa pérdida de la aeronave, riesgo a personas o paro total de la operación"],
  ["Media", "Su falla degrada el desempeño o detiene la aspersión sin comprometer el vuelo"],
  ["Baja", "Falla sin impacto funcional inmediato"],
];
export const DEFINICIONES_ESTATUS: [string, string][] = [
  ["Activo", "Liberado para producción y compras"],
  ["Prototipo", "En validación de ingeniería, no liberado a producción"],
  ["Pendiente", "Falta información técnica para liberarlo (ver hoja Hallazgos)"],
  ["Descontinuado", "Fuera de uso; su número de parte no se reutiliza"],
];
export const NUMERO_CORPORATIVO =
  "Para partes usadas sin modificación en varios modelos MXD, migrar a MXD-CORP-[SISTEMA]-[TIPO]-[CONSECUTIVO]-[REVISIÓN]";

/**
 * Las listas desplegables de la hoja del maestro, tal como estan en el Excel
 * (el texto de Sistema y Tipo es "CODIGO – nombre corto", y no siempre coincide
 * con el nombre largo de las tablas de arriba).
 */
export const LISTA_SISTEMA = [
  "AGR – Sistema agrícola",
  "ASP – Aspersión, boquillas y tuberías",
  "AVI – Aviónica y control de vuelo",
  "BAT – Baterías",
  "BOM – Bombas y sistema hidráulico",
  "CAB – Cableado, conectores y arneses",
  "CAR – Carga y alimentación",
  "COM – Comunicaciones y telemetría",
  "DOC – Documentación y etiquetas",
  "ELE – Sistema eléctrico y distribución de energía",
  "EMP – Empaque y transporte",
  "EST – Estructura y chasis",
  "GRA – Dispersión de granulados",
  "HER – Herramientas y accesorios",
  "NAV – Navegación, GPS y RTK",
  "PLA – Piezas plásticas, cubiertas y carcasas",
  "PRD – Producto terminado",
  "PRO – Propulsión",
  "SEG – Seguridad y señalización",
  "TOR – Tornillería y elementos de fijación",
] as const;

export const LISTA_TIPO = [
  "ENS – Ensamble",
  "SUB – Subconjunto",
  "PZA – Pieza individual",
  "KIT – Kit de componentes",
  "CON – Consumible",
  "REF – Refacción",
  "ACC – Accesorio",
  "DOC – Documento o etiqueta",
  "MAT – Materia prima",
] as const;

/** Listas de validacion del resto de las columnas con menu desplegable. */
export const LISTAS_DE_VALIDACION = {
  unidad: ["pza", "m", "kg", "L", "jgo"],
  origen: ["Fabricación propia", "Compra", "Personalización", "PENDIENTE"],
  criticidad: ["Alta", "Media", "Baja"],
  revision: ["R00", "R01", "R02", "R03", "R04", "R05"],
  estatus: ["Activo", "Prototipo", "Pendiente", "Descontinuado"],
  intercambiable: ["Sí", "No", "REVISAR"],
} as const;

/** "AGR – Sistema agrícola": como se escribe un sistema en la columna Sistema del maestro. */
export function etiquetaSistema(codigo: string): string | null {
  return LISTA_SISTEMA.find((x) => x.startsWith(`${codigo} –`)) ?? null;
}

/** "ENS – Ensamble": como se escribe un tipo en la columna Tipo del maestro. */
export function etiquetaTipo(codigo: string): string | null {
  return LISTA_TIPO.find((x) => x.startsWith(`${codigo} –`)) ?? null;
}
