/**
 * Importa el maestro de partes (Maestro_Partes_MX80.xlsx, el BOM que manejan
 * los administrativos) a src/data/maestro-mx80.json.
 *
 * El Excel es la fuente: el JSON es generado y no se edita a mano. Solo trae
 * lo que interna necesita para cruzar cada partida con el catalogo (numero,
 * nombre, cantidad, posicion); el resto del maestro se queda en el Excel.
 *
 * El cruce (que partida es que pieza del catalogo) NO sale de aqui: esta
 * escrito a mano en src/data/cruce-maestro.ts, porque es una decision, no un
 * dato del Excel.
 *
 * Uso:  npm run maestro:importar [-- ruta/al/Maestro_Partes_MX80.xlsx]
 * Por omision lee el Excel de la raiz del repo.
 */
import ExcelJS from "exceljs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const ENTRADA = process.argv[2] ?? join(process.cwd(), "..", "..", "Maestro_Partes_MX80.xlsx");
const SALIDA = join(process.cwd(), "src", "data", "maestro-mx80.json");
const HOJA = "Maestro Partes MX80";

/** Encabezados que se leen, tal como estan en la fila 3 del maestro. */
const COLUMNAS = {
  partida: "Partida",
  numero: "No. parte MXD",
  nombreOem: "Nombre técnico (OEM)",
  nombre: "Nombre corto",
  sistema: "Sistema",
  tipo: "Tipo",
  cantidad: "Cant.",
  unidad: "Unidad",
  posicion: "Lado o posición",
  nivel: "Nivel",
  padre: "Ensamble padre",
} as const;

function texto(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in v) return texto(v.result as ExcelJS.CellValue);
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  const libro = new ExcelJS.Workbook();
  // tableParts se ignora: el maestro trae tablas de Excel que exceljs no sabe
  // cargar (falla en worksheet.js con "reading 'name'") y aqui solo se leen
  // celdas.
  await libro.xlsx.readFile(ENTRADA, { ignoreNodes: ["tableParts"] } as unknown as Parameters<
    typeof libro.xlsx.readFile
  >[1]);
  const hoja = libro.getWorksheet(HOJA);
  if (!hoja) throw new Error(`El Excel no tiene la hoja "${HOJA}"`);

  const encabezados = (hoja.getRow(3).values as ExcelJS.CellValue[]).map((v) => texto(v));
  const indice = Object.fromEntries(
    Object.entries(COLUMNAS).map(([clave, titulo]) => {
      const i = encabezados.indexOf(titulo);
      if (i < 0) throw new Error(`Falta la columna "${titulo}" en la fila 3 del maestro`);
      return [clave, i];
    }),
  ) as Record<keyof typeof COLUMNAS, number>;

  const partidas: Record<string, string | number | null>[] = [];
  hoja.eachRow((fila, n) => {
    if (n <= 3) return;
    const celda = (clave: keyof typeof COLUMNAS) => texto(fila.getCell(indice[clave]).value);
    const numero = celda("numero");
    if (!numero || !numero.startsWith("MXD-")) return;
    const cantidad = Number(celda("cantidad"));
    partidas.push({
      partida: Number(celda("partida")) || null,
      numero,
      nombreOem: celda("nombreOem"),
      nombre: celda("nombre"),
      // "EST – Estructura y chasis" -> "EST"
      sistema: celda("sistema")?.split(/\s/)[0] ?? null,
      tipo: celda("tipo")?.split(/\s/)[0] ?? null,
      cantidad: Number.isFinite(cantidad) ? cantidad : null,
      unidad: celda("unidad"),
      posicion: celda("posicion"),
      nivel: Number(celda("nivel")),
      padre: celda("padre"),
    });
  });
  partidas.sort((a, b) => String(a.numero).localeCompare(String(b.numero)));

  await writeFile(
    SALIDA,
    JSON.stringify(
      {
        _generado_por: "scripts/importar-maestro.ts a partir de Maestro_Partes_MX80.xlsx. No editar a mano.",
        partidas,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Maestro importado: ${partidas.length} partidas -> ${SALIDA}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
