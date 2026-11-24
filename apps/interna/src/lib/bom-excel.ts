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

import { COLUMNAS_BOM as COLUMNAS, esAgregada, normalizarFila, type FilaBom, type TipoColumna } from "./bom";

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

/** Texto de una celda tal como se ve (listas ya unidas), para medirlo. */
function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

const SALTO = "\n";

/** Cuantas lineas ocupa un texto en una columna de `ancho` caracteres, con ajuste de texto. */
function lineasQueOcupa(texto: string, ancho: number): number {
  return texto
    .split(SALTO)
    .reduce((total, linea) => total + Math.max(1, Math.ceil(linea.length / Math.max(ancho - 2, 1))), 0);
}

const ANCHO_MINIMO = 20;
const ANCHO_MAXIMO = 60;
const ANCHO_MINIMO_AMPLIO = 48;
const ALTO_LINEA = 14;

/**
 * El ancho sale del contenido: el mas largo de la columna, con piso y tope. Las
 * columnas de texto largo (descripciones, notas) parten de un piso mas alto. Lo
 * que pase del tope se acomoda en varias lineas (ajuste de texto) en vez de
 * cortarse o desbordar a la celda de al lado.
 */
function anchoColumna(
  col: { clave: string; encabezado: string; tipo: TipoColumna },
  valores: string[],
): number {
  const masLargo = valores.reduce((max, v) => Math.max(max, ...v.split(SALTO).map((l) => l.length)), 0);
  const piso = ANCHO_AMPLIO.has(col.clave) ? ANCHO_MINIMO_AMPLIO : ANCHO_MINIMO;
  const deseado = Math.max(piso, Math.ceil(col.encabezado.length * 0.7) + 4, masLargo + 3);
  return Math.min(deseado, ANCHO_MAXIMO);
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
  // Anchos segun lo que haya en cada columna (la fila 1 es el encabezado).
  const anchos = COLUMNAS.map((col, i) => {
    const valores: string[] = [];
    for (let r = 2; r <= hoja.rowCount; r++) valores.push(textoDeCelda(hoja.getRow(r).getCell(i + 1).value));
    const ancho = anchoColumna(col, valores);
    hoja.getColumn(i + 1).width = ancho;
    return ancho;
  });

  const encabezado = hoja.getRow(1);
  const lineasEncabezado = Math.max(
    ...COLUMNAS.map((col, i) => lineasQueOcupa(col.encabezado, anchos[i] * 0.9)),
  );
  encabezado.height = Math.max(34, lineasEncabezado * ALTO_LINEA + 12);
  encabezado.eachCell({ includeEmpty: true }, (celda) => {
    celda.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = RELLENO_ENCABEZADO;
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.border = BORDE_ENCABEZADO;
  });

  for (let i = 2; i <= hoja.rowCount; i++) {
    const fila = hoja.getRow(i);
    // Ajuste de texto en todas las celdas, y la fila crece hasta que cabe el
    // texto mas largo (Excel tope: 409 puntos).
    const lineas = Math.max(
      1,
      ...COLUMNAS.map((_, c) => lineasQueOcupa(textoDeCelda(fila.getCell(c + 1).value), anchos[c])),
    );
    fila.height = Math.min(Math.max(30, lineas * ALTO_LINEA + 10), 409);
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celda.font = { name: "Calibri", size: 10 };
      celda.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      celda.border = BORDE_FILA_DATOS;
    });
  }

  // Encabezado y las dos primeras columnas (SKU y nombre) siempre a la vista.
  hoja.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
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
    // Sin marca es del maestro original: el Excel lo dice en vez de dejar la celda vacia.
    if (col.clave === "origen_bom") return v ?? "maestro";
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

/** Relleno ambar de las filas que no vienen del maestro original. */
const RELLENO_AGREGADA: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF2CC" },
};

/** Arma el Excel del BOM con las filas dadas, con el formato de siempre. */
export async function generarExcel(filas: FilaBom[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(HOJA);
  hoja.addRow(COLUMNAS.map((c) => c.encabezado));
  const agregadas: number[] = [];
  for (const fila of filas) {
    const agregada = hoja.addRow(objetoAValoresFila(fila as unknown as Record<string, unknown>));
    if (esAgregada(fila.origen_bom)) agregadas.push(agregada.number);
  }
  aplicarFormato(hoja);
  // Las piezas sumadas a mano se distinguen a simple vista de las del maestro.
  for (const numero of agregadas) {
    hoja.getRow(numero).eachCell({ includeEmpty: true }, (celda) => {
      celda.fill = RELLENO_AGREGADA;
    });
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
