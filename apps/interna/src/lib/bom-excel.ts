/**
 * El BOM como archivo Excel: importarlo a la base y descargarlo.
 *
 * La fuente de verdad del BOM es la base de datos (lib/bom.ts). El Excel ya no
 * se edita en el servidor: se genera al descargarlo, para que el equipo
 * administrativo conserve su archivo, y se lee una sola vez para la carga
 * inicial (`npm run bom:importar`).
 *
 * Usa exceljs (node:fs): solo servidor, nunca desde un componente de cliente.
 */
import ExcelJS from "exceljs";
import { join } from "node:path";

import { COLUMNAS_BOM as COLUMNAS, normalizarFila, type FilaBom, type TipoColumna } from "./bom";

export const RUTA_BOM = process.env.BOM_XLSX_PATH ?? join(process.cwd(), "contenido", "BOM_MX80.xlsx");
const HOJA = "BOM_MX80";

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

function celdaALista(valor: unknown, separador: string): string[] {
  if (typeof valor !== "string" || valor.trim() === "") return [];
  return valor.split(separador).map((s) => s.trim()).filter(Boolean);
}

function listaACelda(valor: string[] | undefined, separador: string): string {
  return (valor ?? []).join(separador);
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

/** Lee las filas de un Excel con el formato del BOM. Falla si no tiene la hoja BOM_MX80. */
export async function leerFilasDeExcel(ruta: string = RUTA_BOM): Promise<FilaBom[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const hoja = libro.getWorksheet(HOJA);
  if (!hoja) throw new Error(`${ruta} no tiene la hoja ${HOJA}.`);
  const filas: FilaBom[] = [];
  for (let i = 2; i <= hoja.rowCount; i++) {
    const obj = filaAObjeto(hoja, i);
    if (!obj.sku) continue;
    filas.push(normalizarFila(obj));
  }
  return filas;
}

/** Arma el Excel del BOM con las filas dadas, con el formato de siempre. */
export async function generarExcel(filas: FilaBom[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(HOJA);
  hoja.addRow(COLUMNAS.map((c) => c.encabezado));
  for (const fila of filas) {
    hoja.addRow(objetoAValoresFila(fila as unknown as Record<string, unknown>));
  }
  aplicarFormato(hoja);
  return Buffer.from(await libro.xlsx.writeBuffer());
}
