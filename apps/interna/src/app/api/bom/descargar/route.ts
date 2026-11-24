import { leerBom } from "@/lib/bom";
import { generarExcelMaestro } from "@/lib/bom-maestro-excel";
import { leerCamposEditados, leerMaestro } from "@/lib/maestro-base";

/** Genera el Excel con exceljs (usa Buffer de Node): no corre en el runtime Edge. */
export const runtime = "nodejs";

/**
 * Descarga el BOM como Excel en el formato del maestro de partes (numero de
 * parte MXD como llave, orden y filtro en todas las columnas), generado en el
 * momento a partir de la base de datos: lo que se baja es lo que todos ven en
 * ese instante.
 *   GET /api/bom/descargar
 *
 * La sesion la exige proxy.ts (cubre todo el sitio, /api incluido).
 */
export async function GET() {
  const [maestro, bom, editados] = await Promise.all([leerMaestro(), leerBom(), leerCamposEditados()]);
  const filas = [...bom.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  if (filas.length === 0 && maestro.length === 0) {
    return new Response(
      "El BOM esta vacio. Carga el maestro con: npm run maestro:a-base y el BOM con: npm run bom:importar",
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const bytes = await generarExcelMaestro(maestro, filas, editados);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="BOM_MX80.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
