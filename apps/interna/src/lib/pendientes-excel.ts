/**
 * Los pendientes del maestro de partes como Excel de trabajo (no como CSV).
 *
 * Un CSV solo se lee. Este libro se usa: cada hoja trae un enlace que abre la
 * ficha de la pieza (donde se asocia con su partida), la partida que mas se
 * parece, y columnas de decision con menu desplegable para que quien lo
 * revise vaya anotando. Filtros en todas las hojas, y una hoja con el maestro
 * completo que alimenta el menu de numeros.
 *
 * Lo anotado aqui no se carga solo al sistema: se captura en la ficha (el
 * enlace de cada fila) o en /maestro. La hoja "Léeme" lo dice.
 *
 * Mismas listas que la pagina /maestro (ver lib/pendientes-maestro.ts).
 */
import ExcelJS from "exceljs";

import type { Pieza } from "./esquema";
import { MAESTRO_PARTIDAS_JSON, pendientesMaestro } from "./pendientes-maestro";
import { sugerirPartidas } from "./sugerencias-maestro";

const VERDE = "FF0F8A4C";
const AMARILLO = "FFFFF4C2";
const GRIS_CLARO = "FFF2F5F3";
const AZUL_ENLACE = "FF0B5ED7";

const HOJA_MAESTRO = "Maestro";

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

interface Columna {
  titulo: string;
  ancho: number;
  /** Columna donde la persona anota: se pinta de amarillo. */
  captura?: boolean;
}

/** Una hoja con encabezado verde, primera fila inmovilizada y filtro en todas las columnas. */
function hojaDeTrabajo(libro: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: (string | number | { text: string; hyperlink: string } | null)[][]) {
  const hoja = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho }));
  const cab = hoja.getRow(1);
  cab.height = 28;
  cab.eachCell((celda, i) => {
    celda.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = fill(columnas[i - 1]?.captura ? "FFB45309" : VERDE);
    celda.alignment = { vertical: "middle", wrapText: true };
  });

  for (const datos of filas) {
    const fila = hoja.addRow(datos.map((d) => (d === null ? "" : d)));
    fila.alignment = { vertical: "top", wrapText: true };
    fila.eachCell({ includeEmpty: true }, (celda, i) => {
      celda.font = { name: "Calibri", size: 10 };
      const col = columnas[i - 1];
      if (col?.captura) celda.fill = fill(AMARILLO);
      const valor = celda.value;
      if (valor && typeof valor === "object" && "hyperlink" in valor) {
        celda.font = { name: "Calibri", size: 10, underline: true, color: { argb: AZUL_ENLACE } };
      }
    });
  }
  if (filas.length > 0) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + filas.length, column: columnas.length } };
  }
  return hoja;
}

/** Menu desplegable en una columna, de la fila 2 a la ultima. */
function conMenu(hoja: ExcelJS.Worksheet, columna: number, filas: number, formula: string) {
  for (let r = 2; r <= 1 + filas; r++) {
    hoja.getCell(r, columna).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: false,
    };
  }
}

const lista = (opciones: string[]) => `"${opciones.join(",")}"`;

export async function generarExcelPendientes(piezas: readonly Pieza[], duenos: ReadonlyMap<string, string>, origen: string): Promise<Uint8Array> {
  const p = pendientesMaestro(piezas);
  const partidas = MAESTRO_PARTIDAS_JSON.filter((m) => m.sistema !== "PRD");
  const nombrePartida = new Map(MAESTRO_PARTIDAS_JSON.map((m) => [m.numero, m.nombre ?? m.nombreOem ?? m.numero]));
  const ficha = (pieza: Pieza) => ({ text: "Abrir ficha", hyperlink: `${origen}/catalogo/${pieza.slug}` });
  const rangoNumeros = `${HOJA_MAESTRO}!$A$2:$A$${1 + partidas.length}`;

  const libro = new ExcelJS.Workbook();
  libro.creator = "MXD";
  libro.created = new Date();

  // -- Léeme ----------------------------------------------------------------
  const leeme = libro.addWorksheet("Léeme");
  leeme.columns = [{ width: 34 }, { width: 14 }, { width: 70 }];
  const lineas: [string, string | number, string][] = [
    ["Pendientes del maestro de partes MX80", "", `Generado el ${new Date().toISOString().slice(0, 10)}`],
    ["", "", ""],
    ["Hoja", "Filas", "Qué es y qué hacer"],
    ["Por confirmar", p.porConfirmar.length, "Ya tienen un número propuesto. Revisa si es el correcto y anótalo en Decisión."],
    ["Sin número", p.porDarDeAlta.length, "Piezas sin número. Se muestra la partida del maestro que más se parece; si es la correcta, ábrela en su ficha y asóciala ahí."],
    ["Tornillería", p.tornilleria.length, "Tornillos, arandelas y tuercas sin número: el maestro casi no los desglosa."],
    ["Partidas sin pieza", p.partidasSinPieza.length, "Partidas del maestro que ninguna pieza del 3D lleva todavía."],
    [HOJA_MAESTRO, partidas.length, "El maestro completo. Alimenta el menú de «Número correcto»."],
    ["", "", ""],
    ["Cómo se usa", "", "1. Filtra con la flecha de cada encabezado. 2. Anota en las columnas amarillas (tienen menú desplegable). 3. Para que quede en el sistema, abre la ficha con el enlace de la fila y asocia ahí el número: queda confirmado y con tu nombre en el historial. Lo anotado en este archivo no se guarda solo."],
  ];
  lineas.forEach((l, i) => {
    const fila = leeme.addRow(l);
    fila.alignment = { vertical: "top", wrapText: true };
    fila.font = { name: "Calibri", size: i === 0 ? 14 : 10, bold: i === 0 || i === 2 };
    if (i === 2) fila.eachCell((c) => (c.fill = fill(GRIS_CLARO)));
  });

  // -- Por confirmar ----------------------------------------------------------
  const decisionConfirmar = ["Es correcto", "Es otro número", "Esta pieza no lleva número"];
  const hojaConfirmar = hojaDeTrabajo(
    libro,
    "Por confirmar",
    [
      { titulo: "SKU", ancho: 14 },
      { titulo: "Pieza", ancho: 30 },
      { titulo: "Número propuesto", ancho: 34 },
      { titulo: "Partida propuesta", ancho: 32 },
      { titulo: "Nota del equipo", ancho: 48 },
      { titulo: "Decisión", ancho: 24, captura: true },
      { titulo: "Número correcto (si es otro)", ancho: 34, captura: true },
      { titulo: "Comentario", ancho: 34, captura: true },
      { titulo: "Ficha", ancho: 14 },
    ],
    p.porConfirmar.map((x) => [
      x.sku,
      x.nombre,
      x.numeroBom,
      (x.numeroBom ?? "")
        .split(" / ")
        .map((n) => nombrePartida.get(n.trim()) ?? "")
        .filter(Boolean)
        .join(" / "),
      x.cruceBom?.nota ?? null,
      null,
      null,
      null,
      ficha(x),
    ]),
  );
  conMenu(hojaConfirmar, 6, p.porConfirmar.length, lista(decisionConfirmar));
  conMenu(hojaConfirmar, 7, p.porConfirmar.length, rangoNumeros);

  // -- Sin número y tornillería (misma forma) ----------------------------------
  const hojaSinNumero = (nombre: string, piezasHoja: Pieza[], opciones: string[]) => {
    const hoja = hojaDeTrabajo(
      libro,
      nombre,
      [
        { titulo: "SKU", ancho: 14 },
        { titulo: "Pieza", ancho: 34 },
        { titulo: "Categoría", ancho: 24 },
        { titulo: "Partida que más se parece", ancho: 36 },
        { titulo: "Número de esa partida", ancho: 34 },
        { titulo: "Por qué", ancho: 46 },
        { titulo: "Decisión", ancho: 26, captura: true },
        { titulo: "Número correcto (si es otra)", ancho: 34, captura: true },
        { titulo: "Comentario", ancho: 34, captura: true },
        { titulo: "Ficha", ancho: 14 },
      ],
      piezasHoja.map((x) => {
        const s = sugerirPartidas(x, duenos, 1)[0];
        return [
          x.sku,
          x.nombre,
          x.categoria,
          s ? s.nombre : null,
          s ? s.numero : null,
          s ? `${s.parecido === "alto" ? "Muy probable" : s.parecido === "medio" ? "Probable" : "Posible"}. ${s.razones.join("; ")}` : "Ninguna partida se parece por nombre.",
          null,
          null,
          null,
          ficha(x),
        ];
      }),
    );
    conMenu(hoja, 7, piezasHoja.length, lista(opciones));
    conMenu(hoja, 8, piezasHoja.length, rangoNumeros);
  };
  hojaSinNumero("Sin número", p.porDarDeAlta, [
    "Usar la partida sugerida",
    "Es otra partida",
    "Hay que dar de alta en el maestro",
    "Esta pieza no lleva número",
  ]);
  hojaSinNumero("Tornillería", p.tornilleria, [
    "Hay que dar de alta en el maestro",
    "Se surte con su conjunto",
    "Esta pieza no lleva número",
  ]);

  // -- Partidas sin pieza -----------------------------------------------------
  const decisionPartida = ["Falta modelarla en el 3D", "Es una pieza que ya está (anotar SKU)", "No es una pieza del dron"];
  const hojaPartidas = hojaDeTrabajo(
    libro,
    "Partidas sin pieza",
    [
      { titulo: "Número", ancho: 34 },
      { titulo: "Partida", ancho: 34 },
      { titulo: "Nombre técnico (OEM)", ancho: 34 },
      { titulo: "Posición", ancho: 20 },
      { titulo: "Cantidad", ancho: 11 },
      { titulo: "Decisión", ancho: 34, captura: true },
      { titulo: "SKU de la pieza (si ya está)", ancho: 20, captura: true },
      { titulo: "Comentario", ancho: 34, captura: true },
      { titulo: "Maestro", ancho: 14 },
    ],
    p.partidasSinPieza.map((m) => [
      m.numero,
      m.nombre,
      m.nombreOem,
      m.posicion,
      m.cantidad === null ? null : `${m.cantidad}${m.unidad ? ` ${m.unidad}` : ""}`,
      null,
      null,
      null,
      { text: "Abrir maestro", hyperlink: `${origen}/maestro` },
    ]),
  );
  conMenu(hojaPartidas, 6, p.partidasSinPieza.length, lista(decisionPartida));

  // -- Maestro (referencia y origen del menu de numeros) ------------------------
  hojaDeTrabajo(
    libro,
    HOJA_MAESTRO,
    [
      { titulo: "Número", ancho: 36 },
      { titulo: "Partida", ancho: 36 },
      { titulo: "Nombre técnico (OEM)", ancho: 36 },
      { titulo: "Sistema", ancho: 10 },
      { titulo: "Posición", ancho: 22 },
      { titulo: "Cantidad", ancho: 11 },
    ],
    partidas.map((m) => [
      m.numero,
      m.nombre,
      m.nombreOem,
      m.sistema,
      m.posicion,
      m.cantidad === null ? null : `${m.cantidad}${m.unidad ? ` ${m.unidad}` : ""}`,
    ]),
  );

  return new Uint8Array(await libro.xlsx.writeBuffer());
}
