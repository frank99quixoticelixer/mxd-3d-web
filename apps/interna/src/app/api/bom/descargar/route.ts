import { readFile } from "node:fs/promises";

import { RUTA_BOM } from "@/lib/bom";

/** Lee el Excel del disco: usa fs de Node, no corre en el runtime Edge. */
export const runtime = "nodejs";

/**
 * Descarga directa del BOM_MX80.xlsx tal como esta en el servidor en este
 * momento -- el mismo archivo que edita el formulario de cada ficha.
 *   GET /api/bom/descargar
 */
export async function GET() {
  let bytes: Buffer;
  try {
    bytes = await readFile(RUTA_BOM);
  } catch {
    return new Response(
      "Todavia no existe BOM_MX80.xlsx. Corre: npm run bom:migrar",
      { status: 404 },
    );
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="BOM_MX80.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
