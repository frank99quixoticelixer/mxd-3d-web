/**
 * El BOM como Excel en el formato del maestro de partes (hoja "Maestro Partes
 * MX80" + "Catalogo de Codigos"), con el numero de parte MXD como llave:
 *
 *  - Una Tabla de Excel sobre TODAS las columnas, para que la flecha de cada
 *    encabezado ordene y filtre sin desalinear nada.
 *  - 28 columnas azules: las del maestro oficial. Cuando la web tiene un dato
 *    capturado (material, proveedor, criticidad, notas...) sale ese; si no, el
 *    del maestro.
 *  - Columnas verdes: lo que se captura en la ficha de la pagina. Las 12 que ya
 *    traia el maestro y, despues, el resto de los campos del BOM.
 *  - Columnas grises: las llena el sistema, no se editan (modelos, estado, SKU).
 *  - Las piezas que el maestro no trae van al final; las que ademas no tienen
 *    numero de parte salen como "SIN NÚMERO".
 *
 * Solo servidor (exceljs usa Buffer de Node).
 */
import ExcelJS from "exceljs";

import {
  DEFINICIONES_CRITICIDAD,
  DEFINICIONES_ESTATUS,
  etiquetaSistema,
  etiquetaTipo,
  LISTA_SISTEMA,
  LISTA_TIPO,
  LISTAS_DE_VALIDACION,
  NUMERO_CORPORATIVO,
  REGLAS_CONSECUTIVO,
  REGLAS_REVISION,
  SISTEMAS_DE_PARTE,
  TIPOS_DE_PARTE_CATALOGO,
} from "@/data/catalogo-codigos";
import { CRUCE_MAESTRO } from "@/data/cruce-maestro";

import { COLUMNAS_BOM, leerNumerosVariantes, type FilaBom } from "./bom";
import type { PartidaMaestro, ValorMaestro } from "./maestro-base";
import { leerNumeroDeParte } from "./numero-parte";

export const SIN_NUMERO = "SIN NÚMERO";
const HOJA_MAESTRO = "Maestro Partes MX80";
const HOJA_CATALOGO = "Catálogo de Códigos";
const FILA_ENCABEZADO = 3;

type Grupo = "azul" | "verde" | "gris";

interface Contexto {
  /** Columnas del maestro por titulo; null si la pieza no esta en el maestro. */
  m: Record<string, ValorMaestro> | null;
  b: FilaBom | null;
  numero: string;
  /** true si una persona edito ese campo de la pieza (consta en el historial). */
  editado: (clave: string) => boolean;
}

interface Columna {
  titulo: string;
  grupo: Grupo;
  ancho: number;
  valor: (c: Contexto) => ExcelJS.CellValue;
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

const clave = (b: FilaBom | null, k: string): unknown => (b ? (b as unknown as Record<string, unknown>)[k] : undefined);

/** Un dato capturado en la web: ni vacio, ni lista vacia. */
function capturado(b: FilaBom | null, k: string): unknown {
  const v = clave(b, k);
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return v;
}

const deMaestro = (c: Contexto, titulo: string): ValorMaestro => c.m?.[titulo] ?? null;
const siNo = (v: unknown): string | null => (v === true ? "Sí" : v === false ? "No" : null);

function texto(v: unknown, tipo: string): ExcelJS.CellValue {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.join(tipo === "listaCorta" ? ", " : "; ");
  if (typeof v === "boolean") return siNo(v);
  return v as ExcelJS.CellValue;
}

const maestro = (titulo: string, ancho: number, grupo: Grupo = "azul"): Columna => ({
  titulo,
  grupo,
  ancho,
  valor: (c) => deMaestro(c, titulo),
});

/** "PENDIENTE" y vacio cuentan como "el maestro no tiene el dato". */
const sinDato = (v: unknown): boolean => v === null || v === undefined || v === "" || /^pendiente$/i.test(String(v).trim());

/**
 * Que dato sale cuando el maestro y la web tienen cada uno el suyo:
 *  - si una persona edito el campo en la web, ese (es lo mas reciente);
 *  - si el maestro tiene un dato real, el del maestro (lo oficial: lo que la
 *    web trae sin editar sale del catalogo del 3D, no de un plano);
 *  - si el maestro no sabe ("PENDIENTE"), lo que tenga la web.
 */
const webOMaestro = (
  titulo: string,
  ancho: number,
  k: string,
  tipo = "texto",
  grupo: Grupo = "azul",
): Columna => ({
  titulo,
  grupo,
  ancho,
  valor: (c) => {
    const w = capturado(c.b, k);
    const m = deMaestro(c, titulo);
    if (w !== null && (c.editado(k) || sinDato(m))) return texto(w, tipo);
    return m ?? (w !== null ? texto(w, tipo) : null);
  },
});

function dimensiones(b: FilaBom | null): string | null {
  const l = clave(b, "largo_mm");
  const a = clave(b, "ancho_mm");
  const h = clave(b, "alto_mm");
  return typeof l === "number" && typeof a === "number" && typeof h === "number" ? `${l} × ${a} × ${h}` : null;
}

// ---------------------------------------------------------------------------
// Columnas
// ---------------------------------------------------------------------------

/** Las columnas de la web que ya viven en alguna columna del maestro: no se repiten como verdes extra. */
const CLAVES_YA_CUBIERTAS = new Set([
  "sku",
  "nombre",
  "numero_parte_mxd",
  "descripcion_funcional",
  "material",
  "proveedor",
  "parte_proveedor",
  "trazabilidad_criticidad",
  "trazabilidad_control_calidad",
  "trazabilidad_intercambiable",
  "notas",
  "masa_g",
  "largo_mm",
  "ancho_mm",
  "alto_mm",
  "acabado",
  "tolerancia_mm",
  "par_apriete_nm",
  "proceso_fabricacion",
  "especificaciones_tecnicas",
  "fuente",
  "trazabilidad_carpeta_pieza",
  "trazabilidad_archivo_step",
  "trazabilidad_archivo_stl",
]);

function columnasDelMaestro(): Columna[] {
  const partes = (c: Contexto) => leerNumeroDeParte(c.numero);
  return [
    maestro("Partida", 9),
    { titulo: "No. parte MXD", grupo: "azul", ancho: 31, valor: (c) => c.numero },
    maestro("Nombre técnico (OEM)", 34),
    {
      titulo: "Nombre corto",
      grupo: "azul",
      ancho: 30,
      valor: (c) => deMaestro(c, "Nombre corto") ?? c.b?.nombre ?? null,
    },
    {
      titulo: "Sistema",
      grupo: "azul",
      ancho: 32,
      valor: (c) => deMaestro(c, "Sistema") ?? (partes(c) ? etiquetaSistema(partes(c)!.sistema) : null),
    },
    {
      titulo: "Tipo",
      grupo: "azul",
      ancho: 24,
      valor: (c) => deMaestro(c, "Tipo") ?? (partes(c) ? etiquetaTipo(partes(c)!.tipo) : null),
    },
    {
      titulo: "Descripción y función",
      grupo: "azul",
      ancho: 46,
      valor: (c) => deMaestro(c, "Descripción y función") ?? texto(capturado(c.b, "descripcion_funcional"), "texto"),
    },
    maestro("Cant.", 8),
    maestro("Unidad", 10),
    maestro("Origen", 20),
    webOMaestro("Material", 24, "material"),
    maestro("Especificación / dimensión", 34),
    maestro("Lado o posición", 22),
    maestro("Nivel", 8),
    maestro("Ensamble padre", 30),
    webOMaestro("Proveedor", 22, "proveedor"),
    webOMaestro("No. parte OEM", 24, "parte_proveedor"),
    {
      titulo: "Rev.",
      grupo: "azul",
      ancho: 8,
      valor: (c) =>
        deMaestro(c, "Rev.") ?? (partes(c) ? `R${String(partes(c)!.revision).padStart(2, "0")}` : null),
    },
    webOMaestro("Criticidad", 14, "trazabilidad_criticidad"),
    webOMaestro("Control de calidad", 34, "trazabilidad_control_calidad"),
    {
      titulo: "Interc.",
      grupo: "azul",
      ancho: 10,
      valor: (c) => {
        const w = siNo(capturado(c.b, "trazabilidad_intercambiable"));
        const m = deMaestro(c, "Interc.");
        return w !== null && (c.editado("trazabilidad_intercambiable") || sinDato(m)) ? w : (m ?? w);
      },
    },
    maestro("Modelos", 12),
    maestro("Estatus", 14),
    webOMaestro("Observaciones", 44, "notas"),
    maestro("Fotografía", 16),
    {
      titulo: "Peso unit. (kg)",
      grupo: "azul",
      ancho: 14,
      valor: (c) => {
        const g = capturado(c.b, "masa_g");
        const m = deMaestro(c, "Peso unit. (kg)");
        if (typeof g === "number" && (c.editado("masa_g") || sinDato(m))) return g / 1000;
        return m ?? (typeof g === "number" ? g / 1000 : null);
      },
    },
    {
      titulo: "Dimensiones L×An×Al (mm)",
      grupo: "azul",
      ancho: 26,
      valor: (c) => {
        const w = dimensiones(c.b);
        const m = deMaestro(c, "Dimensiones L×An×Al (mm)");
        const editada = ["largo_mm", "ancho_mm", "alto_mm"].some((k) => c.editado(k));
        if (w !== null && (editada || sinDato(m))) return w;
        return m ?? w;
      },
    },
    // Peso total: formula (cantidad x peso unitario); se llena al armar cada fila.
    { titulo: "Peso total (kg)", grupo: "azul", ancho: 14, valor: () => null },
    // --- Verdes que ya traia el maestro (se capturan en la ficha) ---
    webOMaestro("Acabado", 24, "acabado", "texto", "verde"),
    webOMaestro("Tolerancia general", 20, "tolerancia_mm", "numero", "verde"),
    webOMaestro("Par de apriete (N·m)", 18, "par_apriete_nm", "numero", "verde"),
    webOMaestro("Proceso de fabricación", 30, "proceso_fabricacion", "texto", "verde"),
    webOMaestro("Requisitos técnicos", 50, "especificaciones_tecnicas", "lista", "verde"),
    webOMaestro("Origen del dato", 36, "fuente", "lista", "verde"),
    webOMaestro("Carpeta de la pieza", 44, "trazabilidad_carpeta_pieza", "texto", "gris"),
    maestro("Modelo GLB", 12, "gris"),
    {
      titulo: "Archivo STEP",
      grupo: "gris",
      ancho: 12,
      valor: (c) => {
        const w = siNo(capturado(c.b, "trazabilidad_archivo_step"));
        const m = deMaestro(c, "Archivo STEP");
        return w !== null && (c.editado("trazabilidad_archivo_step") || sinDato(m)) ? w : (m ?? w);
      },
    },
    {
      titulo: "Archivo STL",
      grupo: "gris",
      ancho: 12,
      valor: (c) => {
        const w = siNo(capturado(c.b, "trazabilidad_archivo_stl"));
        const m = deMaestro(c, "Archivo STL");
        return w !== null && (c.editado("trazabilidad_archivo_stl") || sinDato(m)) ? w : (m ?? w);
      },
    },
    maestro("Estado del modelado", 20, "gris"),
    maestro("Zona del dron", 18, "verde"),
  ];
}

/** El resto de los campos de la ficha, en verde, tras las columnas del maestro. */
function columnasExtraDeLaWeb(): Columna[] {
  return COLUMNAS_BOM.filter((col) => !CLAVES_YA_CUBIERTAS.has(col.clave)).map<Columna>((col) => ({
    titulo: col.encabezado.replace(/\s*\(referencia[^)]*\)/i, ""),
    grupo: "verde",
    ancho: col.tipo === "texto" || col.tipo === "lista" ? 30 : 18,
    valor: (c) => texto(capturado(c.b, col.clave), col.tipo),
  }));
}

export function columnasDelExcel(): Columna[] {
  return [
    ...columnasDelMaestro(),
    ...columnasExtraDeLaWeb(),
    { titulo: "SKU (catálogo 3D)", grupo: "gris", ancho: 20, valor: (c) => c.b?.sku ?? null },
  ];
}

// ---------------------------------------------------------------------------
// Filas: maestro + BOM
// ---------------------------------------------------------------------------

interface FilaArmada {
  contexto: Contexto;
}

/**
 * Une el maestro con las filas del BOM por numero de parte. Una fila del BOM se
 * liga a una partida por su numero_parte_mxd, por el de cada version (CW/CCW) o
 * por el cruce escrito en data/cruce-maestro.ts. Las partidas sin pieza salen
 * con solo el dato del maestro; las piezas sin partida, al final.
 */
export function armarFilas(
  maestroPartidas: PartidaMaestro[],
  bom: FilaBom[],
  editados: ReadonlySet<string> = new Set(),
): FilaArmada[] {
  const deLaPieza = (b: FilaBom | null) => (k: string) => (b ? editados.has(`${b.sku}|${k}`) : false);
  const porSku = new Map(bom.map((f) => [f.sku, f]));
  const porNumero = new Map<string, FilaBom>();
  const ligar = (numero: string | null | undefined, fila: FilaBom | undefined) => {
    if (numero && fila && !porNumero.has(numero)) porNumero.set(numero, fila);
  };

  for (const f of bom) ligar(f.numero_parte_mxd, f);
  for (const f of bom) for (const n of Object.values(leerNumerosVariantes(f.numeros_variantes ?? null))) ligar(n, f);
  for (const [sku, cruce] of Object.entries(CRUCE_MAESTRO)) {
    ligar(cruce.numero, porSku.get(sku));
    for (const n of Object.values(cruce.porVariante ?? {})) ligar(n, porSku.get(sku));
  }

  const usados = new Set<string>();
  const filas: FilaArmada[] = maestroPartidas.map((p) => {
    const b = porNumero.get(p.numero) ?? null;
    if (b) usados.add(b.sku);
    return { contexto: { m: p.datos, b, numero: p.numero, editado: deLaPieza(b) } };
  });

  const numerosDelMaestro = new Set(maestroPartidas.map((p) => p.numero));
  const sueltas = bom.filter((f) => !usados.has(f.sku));
  const conNumero = sueltas
    .filter((f) => f.numero_parte_mxd && !numerosDelMaestro.has(f.numero_parte_mxd))
    .sort((a, b) => (a.numero_parte_mxd ?? "").localeCompare(b.numero_parte_mxd ?? ""));
  const sinNumero = sueltas.filter((f) => !f.numero_parte_mxd).sort((a, b) => a.sku.localeCompare(b.sku));
  for (const b of [...conNumero, ...sinNumero]) {
    filas.push({ contexto: { m: null, b, numero: b.numero_parte_mxd ?? SIN_NUMERO, editado: deLaPieza(b) } });
  }
  return filas;
}

// ---------------------------------------------------------------------------
// Libro
// ---------------------------------------------------------------------------

const AZUL = "FF1F3864";
const VERDE = "FF0F8A4C";
const GRIS_ENCABEZADO = "FF5B6B63";
const RELLENO_VERDE = "FFE9F5EE";
const RELLENO_GRIS = "FFF2F4F3";

const ENCABEZADO_POR_GRUPO: Record<Grupo, string> = { azul: AZUL, verde: VERDE, gris: GRIS_ENCABEZADO };
const RELLENO_POR_GRUPO: Record<Grupo, string | null> = { azul: null, verde: RELLENO_VERDE, gris: RELLENO_GRIS };

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Columnas del maestro con menu desplegable: titulo -> nombre de la lista. */
const VALIDACIONES: Record<string, string> = {
  Sistema: "lista_sistema",
  Tipo: "lista_tipo",
  Unidad: "lista_unidad",
  Origen: "lista_origen",
  "Rev.": "lista_revision",
  Criticidad: "lista_criticidad",
  "Interc.": "lista_intercambiable",
  Estatus: "lista_estatus",
};

export async function generarExcelMaestro(
  maestroPartidas: PartidaMaestro[],
  bom: FilaBom[],
  editados: ReadonlySet<string> = new Set(),
): Promise<Buffer> {
  const columnas = columnasDelExcel();
  const filas = armarFilas(maestroPartidas, bom, editados);
  const ultimaFila = FILA_ENCABEZADO + Math.max(filas.length, 1);

  const indiceDe = (titulo: string) => columnas.findIndex((c) => c.titulo === titulo);
  const letra = (i: number) => {
    let n = i + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const cCant = letra(indiceDe("Cant."));
  const cPeso = letra(indiceDe("Peso unit. (kg)"));
  const iTotal = indiceDe("Peso total (kg)");

  const libro = new ExcelJS.Workbook();
  libro.creator = "MXD interna";
  const hoja = libro.addWorksheet(HOJA_MAESTRO, {
    views: [{ state: "frozen", xSplit: 2, ySplit: FILA_ENCABEZADO, topLeftCell: "C4" }],
  });

  hoja.getCell("A1").value = "MAESTRO DE NÚMEROS DE PARTE Y LISTA DE MATERIALES — DRON AGRÍCOLA MX80";
  hoja.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: AZUL } };
  const primeraVerde = columnas.findIndex((c) => c.grupo !== "azul");
  hoja.getCell(2, primeraVerde + 1).value =
    "Columnas verdes: campos de la ficha en la página de interna (se editan allá) · gris: las llena el sistema, no editar";
  hoja.getCell(2, primeraVerde + 1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF5B6B63" } };

  const filasValores = filas.map((f, i) => {
    const fila = FILA_ENCABEZADO + 1 + i;
    return columnas.map((col, j) =>
      j === iTotal ? ({ formula: `IFERROR(${cCant}${fila}*${cPeso}${fila},0)` } as ExcelJS.CellValue) : col.valor(f.contexto),
    );
  });

  hoja.addTable({
    name: "MaestroPartes_MX80",
    ref: `A${FILA_ENCABEZADO}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleLight8", showRowStripes: true },
    columns: columnas.map((c) => ({ name: c.titulo, filterButton: true })),
    rows: filasValores,
  });

  // Anchos, encabezados y relleno por grupo.
  columnas.forEach((col, j) => {
    hoja.getColumn(j + 1).width = col.ancho;
    const cabecera = hoja.getCell(FILA_ENCABEZADO, j + 1);
    cabecera.fill = fill(ENCABEZADO_POR_GRUPO[col.grupo]);
    cabecera.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cabecera.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    const relleno = RELLENO_POR_GRUPO[col.grupo];
    for (let r = FILA_ENCABEZADO + 1; r <= ultimaFila; r++) {
      const celda = hoja.getCell(r, j + 1);
      celda.font = { name: "Calibri", size: 10 };
      // Ajuste de texto y sin altura fija: Excel ajusta cada fila a su contenido.
      celda.alignment = { vertical: "top", wrapText: true };
      if (relleno) celda.fill = fill(relleno);
    }
  });
  hoja.getRow(FILA_ENCABEZADO).height = 34;

  // Piezas sin numero de parte: se marcan para que no pasen desapercibidas.
  const iNumero = indiceDe("No. parte MXD");
  filas.forEach((f, i) => {
    if (f.contexto.numero !== SIN_NUMERO) return;
    const celda = hoja.getCell(FILA_ENCABEZADO + 1 + i, iNumero + 1);
    celda.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF9A3412" } };
    celda.fill = fill("FFFEF3C7");
  });

  // Menus desplegables (apuntan a las listas de la hoja de codigos).
  for (const [titulo, lista] of Object.entries(VALIDACIONES)) {
    const j = indiceDe(titulo);
    if (j < 0) continue;
    for (let r = FILA_ENCABEZADO + 1; r <= ultimaFila; r++) {
      hoja.getCell(r, j + 1).dataValidation = { type: "list", allowBlank: true, formulae: [lista], showErrorMessage: false };
    }
  }

  construirCatalogo(libro, ultimaFila, letra(indiceDe("Sistema")), cCant);

  const bytes = await libro.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// Hoja "Catalogo de Codigos"
// ---------------------------------------------------------------------------

function construirCatalogo(libro: ExcelJS.Workbook, ultimaFilaMaestro: number, colSistema: string, colCant: string): void {
  const hoja = libro.addWorksheet(HOJA_CATALOGO);
  const titulo = (celda: string, valor: string, tam = 12) => {
    hoja.getCell(celda).value = valor;
    hoja.getCell(celda).font = { name: "Calibri", size: tam, bold: true, color: { argb: AZUL } };
  };
  const encabezado = (fila: number, col: number, valor: string) => {
    const c = hoja.getCell(fila, col);
    c.value = valor;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill(AZUL);
    c.alignment = { vertical: "middle", wrapText: true };
  };
  const texto10 = (fila: number, col: number, valor: ExcelJS.CellValue) => {
    const c = hoja.getCell(fila, col);
    c.value = valor;
    c.font = { name: "Calibri", size: 10 };
    c.alignment = { vertical: "top", wrapText: true };
  };

  titulo("A1", "MXD – CATÁLOGO DE CÓDIGOS DEL SISTEMA DE NÚMEROS DE PARTE", 14);
  titulo("E1", "LISTAS DE VALIDACIÓN – no modificar sin autorización de ingeniería", 10);
  titulo("N1", "RESUMEN DE PARTIDAS POR SISTEMA", 10);

  // Bloques de la izquierda (A:C).
  let f = 4;
  encabezado(f, 1, "CÓDIGOS DE SISTEMA");
  encabezado(f, 2, "Descripción");
  encabezado(f, 3, "Uso en la BOM del MX80");
  for (const s of SISTEMAS_DE_PARTE) {
    f++;
    texto10(f, 1, s.codigo);
    texto10(f, 2, s.nombre);
    texto10(f, 3, s.uso);
  }
  const bloque = (cabeceras: [string, string, string?], filas: ([string, string] | [string, string, string])[]) => {
    f += 2;
    encabezado(f, 1, cabeceras[0]);
    encabezado(f, 2, cabeceras[1]);
    if (cabeceras[2]) encabezado(f, 3, cabeceras[2]);
    for (const fila of filas) {
      f++;
      texto10(f, 1, fila[0]);
      texto10(f, 2, fila[1]);
      if (fila[2]) texto10(f, 3, fila[2]);
    }
  };
  bloque(
    ["TIPOS DE COMPONENTE", "Descripción", "Criterio de asignación"],
    TIPOS_DE_PARTE_CATALOGO.map((t) => [t.codigo, t.nombre, t.criterio] as [string, string, string]),
  );
  bloque(["CONSECUTIVO", "Regla"], REGLAS_CONSECUTIVO);
  bloque(["REVISIÓN", "Regla"], REGLAS_REVISION);
  bloque(["CRITICIDAD", "Definición"], DEFINICIONES_CRITICIDAD);
  bloque(["ESTATUS", "Definición"], DEFINICIONES_ESTATUS);
  bloque(["NÚMERO CORPORATIVO", "Regla"], [["NÚMERO CORPORATIVO", NUMERO_CORPORATIVO]]);

  // Listas de validacion (E:L), desde la fila 3: titulo y valores desde la 4.
  const listas: [string, readonly string[], string][] = [
    ["Sistema", LISTA_SISTEMA, "lista_sistema"],
    ["Tipo", LISTA_TIPO, "lista_tipo"],
    ["Unidad", LISTAS_DE_VALIDACION.unidad, "lista_unidad"],
    ["Origen", LISTAS_DE_VALIDACION.origen, "lista_origen"],
    ["Criticidad", LISTAS_DE_VALIDACION.criticidad, "lista_criticidad"],
    ["Revisión", LISTAS_DE_VALIDACION.revision, "lista_revision"],
    ["Estatus", LISTAS_DE_VALIDACION.estatus, "lista_estatus"],
    ["Intercambiable", LISTAS_DE_VALIDACION.intercambiable, "lista_intercambiable"],
  ];
  listas.forEach(([nombre, valores, definido], i) => {
    const col = 5 + i;
    encabezado(3, col, nombre);
    valores.forEach((v, k) => texto10(4 + k, col, v));
    const letraCol = hoja.getColumn(col).letter;
    libro.definedNames.add(`'${HOJA_CATALOGO}'!$${letraCol}$4:$${letraCol}$${3 + valores.length}`, definido);
  });

  // Resumen por sistema (N:Q), con formulas sobre la hoja maestra.
  encabezado(2, 14, "Código");
  encabezado(2, 15, "Sistema");
  encabezado(2, 16, "Partidas");
  encabezado(2, 17, "Piezas por dron");
  const rangoSistema = `'${HOJA_MAESTRO}'!$${colSistema}$4:$${colSistema}$${ultimaFilaMaestro}`;
  const rangoCant = `'${HOJA_MAESTRO}'!$${colCant}$4:$${colCant}$${ultimaFilaMaestro}`;
  SISTEMAS_DE_PARTE.forEach((s, i) => {
    const fila = 3 + i;
    texto10(fila, 14, s.codigo);
    texto10(fila, 15, s.nombre);
    texto10(fila, 16, { formula: `COUNTIF(${rangoSistema},$N${fila}&"*")` });
    texto10(fila, 17, { formula: `SUMIF(${rangoSistema},$N${fila}&"*",${rangoCant})` });
  });
  const total = 3 + SISTEMAS_DE_PARTE.length;
  texto10(total, 14, "TOTAL");
  hoja.getCell(total, 14).font = { name: "Calibri", size: 10, bold: true };
  texto10(total, 16, { formula: `SUM(P3:P${total - 1})` });
  texto10(total, 17, { formula: `SUM(Q3:Q${total - 1})` });

  hoja.getColumn(1).width = 28;
  hoja.getColumn(2).width = 50;
  hoja.getColumn(3).width = 55;
  for (let c = 5; c <= 12; c++) hoja.getColumn(c).width = c === 5 || c === 6 ? 44 : 18;
  hoja.getColumn(14).width = 9;
  hoja.getColumn(15).width = 40;
  hoja.getColumn(16).width = 14;
  hoja.getColumn(17).width = 16;
}
