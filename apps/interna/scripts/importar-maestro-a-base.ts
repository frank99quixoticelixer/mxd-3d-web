/**
 * Importa el maestro de partes completo (todas las columnas de la hoja
 * "Maestro Partes MX80") a la base de datos, tabla maestro_partidas.
 *
 *   npm run maestro:a-base -- ruta/al/Maestro_Partes_MX80.xlsx             muestra que haria
 *   npm run maestro:a-base -- ruta/al/Maestro_Partes_MX80.xlsx --aplicar   lo aplica
 *
 * REEMPLAZA el contenido de la tabla (el Excel es la fuente), en una
 * transaccion. No toca bom_piezas ni el historial del BOM. Antes hay que crear
 * la tabla: npm run db:migrar -- --aplicar
 *
 * El Excel NO va al repo (es publico): se pasa la ruta en la maquina de quien
 * lo corre. Lee la conexion de .env.local; para la base de produccion, usar
 * --env-file=../../.env.produccion.local (ver docs/plan-usuarios-interna.md).
 */
import ExcelJS from "exceljs";

import { obtenerPool } from "../src/lib/db";
import { reemplazarMaestro, type PartidaMaestro, type ValorMaestro } from "../src/lib/maestro-base";

const HOJA = "Maestro Partes MX80";
const FILA_ENCABEZADOS = 3;
const TITULO_NUMERO = "No. parte MXD";
/** Se calcula en el Excel con una formula (cantidad x peso unitario): no se guarda. */
const TITULOS_CALCULADOS = new Set(["Peso total (kg)"]);

function valor(v: ExcelJS.CellValue): ValorMaestro {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in v) return valor(v.result as ExcelJS.CellValue);
  if (typeof v === "object" && "richText" in v) return valor(v.richText.map((r) => r.text).join(""));
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

async function main() {
  const ruta = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const aplicar = process.argv.includes("--aplicar");
  if (!ruta) {
    console.error("Uso: npm run maestro:a-base -- ruta/al/Maestro_Partes_MX80.xlsx [--aplicar]");
    process.exit(1);
  }
  if (!obtenerPool()) {
    console.error("Falta configuracion de la base de datos (DB_*).");
    process.exit(1);
  }

  const libro = new ExcelJS.Workbook();
  // El maestro trae tablas de Excel que exceljs no sabe cargar; aqui solo se leen celdas.
  await libro.xlsx.readFile(ruta, { ignoreNodes: ["tableParts"] } as unknown as Parameters<
    typeof libro.xlsx.readFile
  >[1]);
  const hoja = libro.getWorksheet(HOJA);
  if (!hoja) throw new Error(`El Excel no tiene la hoja "${HOJA}".`);

  const titulos = (hoja.getRow(FILA_ENCABEZADOS).values as ExcelJS.CellValue[]).map((v) => {
    const t = valor(v);
    return typeof t === "string" ? t : null;
  });
  const columnaNumero = titulos.indexOf(TITULO_NUMERO);
  if (columnaNumero < 1) throw new Error(`No encontre la columna "${TITULO_NUMERO}" en la fila ${FILA_ENCABEZADOS}.`);

  const partidas: PartidaMaestro[] = [];
  const vistos = new Set<string>();
  for (let r = FILA_ENCABEZADOS + 1; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const numero = valor(fila.getCell(columnaNumero).value);
    if (typeof numero !== "string") continue;
    if (vistos.has(numero)) throw new Error(`Numero de parte repetido en el Excel: ${numero}`);
    vistos.add(numero);

    const datos: Record<string, ValorMaestro> = {};
    titulos.forEach((titulo, c) => {
      if (!titulo || TITULOS_CALCULADOS.has(titulo)) return;
      datos[titulo] = valor(fila.getCell(c).value);
    });
    partidas.push({ numero, orden: partidas.length + 1, datos });
  }

  const columnas = titulos.filter((t): t is string => Boolean(t) && !TITULOS_CALCULADOS.has(t as string));
  console.log(`${ruta}`);
  console.log(`  hoja "${HOJA}": ${partidas.length} partidas, ${columnas.length} columnas guardadas.`);
  console.log(`  primera: ${partidas[0]?.numero}   ultima: ${partidas[partidas.length - 1]?.numero}`);

  if (partidas.length === 0) throw new Error("No se leyo ninguna partida: no se cambia nada.");
  if (!aplicar) {
    console.log("\nNo se cambio nada. Repite con --aplicar para ejecutarlo.");
    return;
  }
  await reemplazarMaestro(partidas);
  console.log("\nListo: maestro_partidas reemplazada.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
