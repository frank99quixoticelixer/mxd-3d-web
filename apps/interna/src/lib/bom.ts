/**
 * Capa de lectura/escritura del BOM editable (especificaciones + compras +
 * inventario), un Excel en contenido/BOM_MX80.xlsx: una fila por SKU, una
 * columna por campo. Es la fuente de verdad que reemplaza al import de CSV
 * (ver scripts/migrar-a-bom.ts para la migracion inicial).
 *
 * contenido/ esta gitignored y no existe en Hostinger salvo que se suba por
 * FTP o se genere en el propio servidor: la primera escritura (vía
 * escribirPieza) crea el archivo si no existe.
 *
 * No vive en vitrina ni se sincroniza con ella: es exclusivo de interna.
 */
import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { EspecificacionesEsquema, type Especificaciones } from "./esquema";

const RUTA_BOM = process.env.BOM_XLSX_PATH ?? join(process.cwd(), "contenido", "BOM_MX80.xlsx");
const HOJA = "BOM_MX80";

/**
 * Orden de columnas del Excel. Es la unica lista que define "que campos
 * tiene el BOM": el migrador y leerBom/escribirPieza la reusan, asi que
 * agregar una columna es agregar una entrada aqui.
 *
 * "tipo" controla como se serializa la celda:
 *   texto/numero -> tal cual
 *   lista        -> array de string, unido con "; " en la celda
 *   listaCorta   -> array de string, unido con "," en la celda (nombres de
 *                   campo sin espacios, para camposNoAplican)
 */
type TipoColumna = "texto" | "numero" | "lista" | "listaCorta" | "booleano";
const COLUMNAS: { clave: string; encabezado: string; tipo: TipoColumna }[] = [
  { clave: "sku", encabezado: "SKU", tipo: "texto" },
  { clave: "nombre", encabezado: "Nombre (referencia, no editable aqui)", tipo: "texto" },
  { clave: "categoria", encabezado: "Categoria", tipo: "texto" },
  { clave: "masa_g", encabezado: "Masa (g)", tipo: "numero" },
  { clave: "largo_mm", encabezado: "Largo (mm)", tipo: "numero" },
  { clave: "ancho_mm", encabezado: "Ancho (mm)", tipo: "numero" },
  { clave: "alto_mm", encabezado: "Alto (mm)", tipo: "numero" },
  { clave: "material", encabezado: "Material", tipo: "texto" },
  { clave: "acabado", encabezado: "Acabado", tipo: "texto" },
  { clave: "tolerancia_mm", encabezado: "Tolerancia general (mm)", tipo: "numero" },
  { clave: "par_apriete_nm", encabezado: "Par de apriete (N·m)", tipo: "numero" },
  { clave: "numero_tornillos", encabezado: "No. de tornillos", tipo: "numero" },
  { clave: "rosca", encabezado: "Rosca", tipo: "texto" },
  { clave: "longitud_mm", encabezado: "Longitud (mm)", tipo: "numero" },
  { clave: "sentido_giro", encabezado: "Sentido de giro", tipo: "texto" },
  { clave: "modulo_conectado", encabezado: "Modulo al que conecta", tipo: "texto" },
  { clave: "volumen_ml", encabezado: "Volumen (mL)", tipo: "numero" },
  { clave: "diametro_tubo_mm", encabezado: "Diametro de tubo (mm)", tipo: "numero" },
  { clave: "grosor_pared_mm", encabezado: "Grosor de pared (mm)", tipo: "numero" },
  { clave: "diametro_barreno_mm", encabezado: "Diametro de barreno (mm)", tipo: "numero" },
  { clave: "ancho_perfil_mm", encabezado: "Ancho de perfil (mm)", tipo: "numero" },
  { clave: "alto_perfil_mm", encabezado: "Alto de perfil (mm)", tipo: "numero" },
  { clave: "motor_kv", encabezado: "Motor: KV (RPM/V)", tipo: "numero" },
  { clave: "motor_voltaje_nominal_v", encabezado: "Motor: voltaje nominal (V)", tipo: "numero" },
  { clave: "motor_rpm_nominal", encabezado: "Motor: RPM nominal", tipo: "numero" },
  { clave: "motor_torque_nominal_nm", encabezado: "Motor: torque nominal (Nm)", tipo: "numero" },
  { clave: "motor_torque_max_nm", encabezado: "Motor: torque maximo (Nm)", tipo: "numero" },
  { clave: "proveedor", encabezado: "Proveedor", tipo: "texto" },
  { clave: "parte_proveedor", encabezado: "No. de parte del proveedor", tipo: "texto" },
  { clave: "numero_parte_mxd", encabezado: "No. parte MXD", tipo: "texto" },
  { clave: "precio_mxn", encabezado: "Precio (MXN)", tipo: "numero" },
  { clave: "stock", encabezado: "Existencias", tipo: "numero" },
  { clave: "proceso_fabricacion", encabezado: "Proceso de fabricacion", tipo: "texto" },
  { clave: "descripcion_funcional", encabezado: "Descripcion funcional", tipo: "texto" },
  { clave: "especificaciones_tecnicas", encabezado: "Requisitos tecnicos", tipo: "lista" },
  { clave: "camposNoAplican", encabezado: "Campos que no aplican", tipo: "listaCorta" },
  { clave: "fuente", encabezado: "Origen del dato", tipo: "lista" },
  { clave: "notas", encabezado: "Notas", tipo: "texto" },
  // -- Costos de produccion. Claves con prefijo costo_ para no chocar con
  // "material" y "notas" de especificaciones (son conceptos distintos: uno es
  // el material que declara el proveedor, el otro el material que de verdad
  // se gasto al producir la pieza).
  { clave: "costo_fabricado_inhouse", encabezado: "Fabricado in-house", tipo: "booleano" },
  { clave: "costo_equipo", encabezado: "Equipo de produccion", tipo: "texto" },
  { clave: "costo_material", encabezado: "Material de produccion", tipo: "texto" },
  { clave: "costo_masa_g", encabezado: "Masa de produccion (g)", tipo: "numero" },
  { clave: "costo_horas_produccion", encabezado: "Horas de produccion", tipo: "numero" },
  { clave: "costo_pintura_mxn", encabezado: "Costo de pintura (MXN)", tipo: "numero" },
  { clave: "costo_mano_obra_mxn", encabezado: "Costo de mano de obra (MXN)", tipo: "numero" },
  { clave: "costo_notas", encabezado: "Notas de costos", tipo: "texto" },
  // -- Trazabilidad de manufactura. Claves con prefijo trazabilidad_, mismo
  // criterio que costo_: columnas del BOM maestro sin equivalente en el resto
  // de este esquema (ver comentario en TrazabilidadEsquema).
  { clave: "trazabilidad_criticidad", encabezado: "Criticidad", tipo: "texto" },
  { clave: "trazabilidad_control_calidad", encabezado: "Control de calidad", tipo: "texto" },
  { clave: "trazabilidad_intercambiable", encabezado: "Interc.", tipo: "booleano" },
  { clave: "trazabilidad_carpeta_pieza", encabezado: "Carpeta de la pieza", tipo: "texto" },
  { clave: "trazabilidad_archivo_step", encabezado: "Archivo STEP", tipo: "booleano" },
  { clave: "trazabilidad_archivo_stl", encabezado: "Archivo STL", tipo: "booleano" },
];

/**
 * Formato visual del Excel: mismo criterio que
 * mxd-3d/Maestro_Partes_MX80.xlsx (encabezado azul marino con texto blanco
 * centrado y en negritas, columnas anchas segun su contenido, encabezado
 * inmovilizado). Ese archivo vive fuera de este repo y nunca se toca desde
 * aqui -- esto solo copia su formato, no lo lee ni lo escribe.
 */
const ANCHO_AMPLIO = new Set<string>([
  "nombre",
  "descripcion_funcional",
  "especificaciones_tecnicas",
  "camposNoAplican",
  "fuente",
  "notas",
  "costo_notas",
  "trazabilidad_control_calidad",
  "trazabilidad_carpeta_pieza",
]);

function anchoColumna(col: { clave: string; encabezado: string; tipo: TipoColumna }): number {
  if (ANCHO_AMPLIO.has(col.clave)) return 45;
  if (col.tipo === "numero" || col.tipo === "booleano") return Math.max(col.encabezado.length + 4, 14);
  return Math.max(col.encabezado.length + 6, 22);
}

const RELLENO_ENCABEZADO: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3864" },
};
const BORDE_ENCABEZADO: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const BORDE_FILA_DATOS: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9D9D9" } },
  left: { style: "thin", color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
  right: { style: "thin", color: { argb: "FFD9D9D9" } },
};

/**
 * Se reaplica cada vez que se abre el libro, no solo al crearlo, para que un
 * archivo ya existente (como el que hoy tiene todo apretado) tambien quede
 * al corriente la proxima vez que se guarde algo.
 */
function aplicarFormato(hoja: ExcelJS.Worksheet): void {
  COLUMNAS.forEach((col, i) => {
    hoja.getColumn(i + 1).width = anchoColumna(col);
  });

  const encabezado = hoja.getRow(1);
  encabezado.height = 32;
  encabezado.eachCell({ includeEmpty: true }, (celda) => {
    celda.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = RELLENO_ENCABEZADO;
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.border = BORDE_ENCABEZADO;
  });

  for (let i = 2; i <= hoja.rowCount; i++) {
    const fila = hoja.getRow(i);
    fila.height = 28;
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celda.font = { name: "Calibri", size: 10 };
      celda.alignment = { horizontal: "left", vertical: "middle" };
      celda.border = BORDE_FILA_DATOS;
    });
  }

  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

/** Una fila del BOM ya tipada: especificaciones + compras/inventario + metadatos. */
export type FilaBom = Pick<Especificaciones, Exclude<keyof Especificaciones, "fuente">> & {
  sku: string;
  nombre: string;
  categoria: string | null;
  proceso_fabricacion: string | null;
  descripcion_funcional: string | null;
  especificaciones_tecnicas: string[];
  camposNoAplican: string[];
  fuente: string[];
  numero_parte_mxd: string | null;
  precio_mxn: number | null;
  stock: number | null;
  costo_fabricado_inhouse: boolean | null;
  costo_equipo: string | null;
  costo_material: string | null;
  costo_masa_g: number | null;
  costo_horas_produccion: number | null;
  costo_pintura_mxn: number | null;
  costo_mano_obra_mxn: number | null;
  costo_notas: string | null;
  trazabilidad_criticidad: string | null;
  trazabilidad_control_calidad: string | null;
  trazabilidad_intercambiable: boolean | null;
  trazabilidad_carpeta_pieza: string | null;
  trazabilidad_archivo_step: boolean | null;
  trazabilidad_archivo_stl: boolean | null;
};

/** Campos editables desde la UI (todo menos sku/nombre, que no se tocan aqui). */
export type CambiosFilaBom = Partial<Omit<FilaBom, "sku" | "nombre">>;

function celdaALista(valor: unknown, separador: string): string[] {
  if (typeof valor !== "string" || valor.trim() === "") return [];
  return valor.split(separador).map((s) => s.trim()).filter(Boolean);
}

function listaACelda(valor: string[] | undefined, separador: string): string {
  return (valor ?? []).join(separador);
}

async function abrirOCrearLibro(): Promise<{ libro: ExcelJS.Workbook; hoja: ExcelJS.Worksheet }> {
  const libro = new ExcelJS.Workbook();
  const existe = await libro.xlsx
    .readFile(RUTA_BOM)
    .then(() => true)
    .catch(() => false);

  let hoja = libro.getWorksheet(HOJA);
  if (!existe || !hoja) {
    hoja = libro.addWorksheet(HOJA);
    hoja.addRow(COLUMNAS.map((c) => c.encabezado));
  }
  aplicarFormato(hoja);
  return { libro, hoja };
}

function filaAObjeto(hoja: ExcelJS.Worksheet, indiceFila: number): Record<string, unknown> {
  const fila = hoja.getRow(indiceFila);
  const obj: Record<string, unknown> = {};
  COLUMNAS.forEach((col, i) => {
    const celda = fila.getCell(i + 1).value;
    const valorCrudo = celda && typeof celda === "object" && "result" in celda ? celda.result : celda;
    if (col.tipo === "lista") obj[col.clave] = celdaALista(valorCrudo, "; ");
    else if (col.tipo === "listaCorta") obj[col.clave] = celdaALista(valorCrudo, ",");
    else if (col.tipo === "numero") obj[col.clave] = typeof valorCrudo === "number" ? valorCrudo : null;
    else if (col.tipo === "booleano") {
      const texto = typeof valorCrudo === "string" ? valorCrudo.trim().toLowerCase() : "";
      obj[col.clave] = texto === "si" ? true : texto === "no" ? false : null;
    } else
      obj[col.clave] =
        valorCrudo === undefined || valorCrudo === null || valorCrudo === "" ? null : String(valorCrudo);
  });
  return obj;
}

function objetoAValoresFila(obj: Record<string, unknown>): unknown[] {
  return COLUMNAS.map((col) => {
    const v = obj[col.clave];
    if (col.tipo === "lista") return listaACelda(v as string[], "; ");
    if (col.tipo === "listaCorta") return listaACelda(v as string[], ",");
    if (col.tipo === "booleano") return v === true ? "si" : v === false ? "no" : null;
    return v ?? null;
  });
}

/** Valida la forma minima de una fila leida (sku no vacio); el resto son los defaults de Zod. */
function normalizarFila(obj: Record<string, unknown>): FilaBom {
  if (!obj.sku || typeof obj.sku !== "string") {
    throw new Error(`Fila del BOM sin SKU valido: ${JSON.stringify(obj)}`);
  }
  // Las especificaciones "clasicas" se validan con el mismo esquema que usa
  // el resto de la app, para no duplicar reglas (positive(), etc.).
  const especPartial = EspecificacionesEsquema.partial().parse(obj);
  return {
    ...especPartial,
    sku: obj.sku,
    nombre: typeof obj.nombre === "string" ? obj.nombre : "",
    categoria: (obj.categoria as string | null) ?? null,
    proceso_fabricacion: (obj.proceso_fabricacion as string | null) ?? null,
    descripcion_funcional: (obj.descripcion_funcional as string | null) ?? null,
    especificaciones_tecnicas: (obj.especificaciones_tecnicas as string[]) ?? [],
    camposNoAplican: (obj.camposNoAplican as string[]) ?? [],
    fuente: (obj.fuente as string[]) ?? [],
    numero_parte_mxd: (obj.numero_parte_mxd as string | null) ?? null,
    precio_mxn: (obj.precio_mxn as number | null) ?? null,
    stock: (obj.stock as number | null) ?? null,
    costo_fabricado_inhouse: (obj.costo_fabricado_inhouse as boolean | null) ?? null,
    costo_equipo: (obj.costo_equipo as string | null) ?? null,
    costo_material: (obj.costo_material as string | null) ?? null,
    costo_masa_g: (obj.costo_masa_g as number | null) ?? null,
    costo_horas_produccion: (obj.costo_horas_produccion as number | null) ?? null,
    costo_pintura_mxn: (obj.costo_pintura_mxn as number | null) ?? null,
    costo_mano_obra_mxn: (obj.costo_mano_obra_mxn as number | null) ?? null,
    costo_notas: (obj.costo_notas as string | null) ?? null,
    trazabilidad_criticidad: (obj.trazabilidad_criticidad as string | null) ?? null,
    trazabilidad_control_calidad: (obj.trazabilidad_control_calidad as string | null) ?? null,
    trazabilidad_intercambiable: (obj.trazabilidad_intercambiable as boolean | null) ?? null,
    trazabilidad_carpeta_pieza: (obj.trazabilidad_carpeta_pieza as string | null) ?? null,
    trazabilidad_archivo_step: (obj.trazabilidad_archivo_step as boolean | null) ?? null,
    trazabilidad_archivo_stl: (obj.trazabilidad_archivo_stl as boolean | null) ?? null,
  } as FilaBom;
}

/** Lee el BOM completo. Si el archivo no existe todavia, devuelve un mapa vacio. */
export async function leerBom(): Promise<Map<string, FilaBom>> {
  const { hoja } = await abrirOCrearLibro();
  const mapa = new Map<string, FilaBom>();
  for (let i = 2; i <= hoja.rowCount; i++) {
    const obj = filaAObjeto(hoja, i);
    if (!obj.sku) continue;
    const fila = normalizarFila(obj);
    mapa.set(fila.sku, fila);
  }
  return mapa;
}

export async function leerPieza(sku: string): Promise<FilaBom | null> {
  const bom = await leerBom();
  return bom.get(sku) ?? null;
}

// Mutex en memoria: serializa escrituras dentro de este proceso de Node.
// Suficiente para un equipo de 3 personas en un solo servidor; no protege
// contra dos procesos de Node escribiendo el mismo archivo a la vez.
let colaEscritura: Promise<unknown> = Promise.resolve();
function conBloqueo<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = colaEscritura.then(tarea, tarea);
  colaEscritura = resultado.catch(() => undefined);
  return resultado;
}

/**
 * Actualiza una pieza (crea la fila si el SKU no existe todavia) y guarda el
 * archivo. `nombre` se pasa solo para piezas nuevas (filas ya existentes no
 * lo tocan: el nombre vive en mx80.ts, aqui es solo referencia).
 */
export async function escribirPieza(
  sku: string,
  cambios: CambiosFilaBom,
  nombreSiEsNueva?: string,
): Promise<void> {
  return conBloqueo(async () => {
    await mkdir(dirname(RUTA_BOM), { recursive: true });
    const { libro, hoja } = await abrirOCrearLibro();

    let indiceFila = -1;
    for (let i = 2; i <= hoja.rowCount; i++) {
      if (hoja.getRow(i).getCell(1).value === sku) {
        indiceFila = i;
        break;
      }
    }

    if (indiceFila === -1) {
      const base = normalizarFila({ sku, nombre: nombreSiEsNueva ?? "" });
      const combinado = { ...base, ...cambios };
      hoja.addRow(objetoAValoresFila(combinado as unknown as Record<string, unknown>));
    } else {
      const actual = normalizarFila(filaAObjeto(hoja, indiceFila));
      const combinado = { ...actual, ...cambios };
      const valores = objetoAValoresFila(combinado as unknown as Record<string, unknown>);
      const fila = hoja.getRow(indiceFila);
      valores.forEach((v, i) => fila.getCell(i + 1).value = v as ExcelJS.CellValue);
      fila.commit();
    }

    await libro.xlsx.writeFile(RUTA_BOM);
  });
}

export { COLUMNAS as COLUMNAS_BOM, RUTA_BOM };
