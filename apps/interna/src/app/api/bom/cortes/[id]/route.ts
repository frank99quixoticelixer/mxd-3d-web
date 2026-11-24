import { generarExcel } from "@/lib/bom-excel";
import { leerCorte } from "@/lib/bom-cortes";

/** Genera el Excel con exceljs (usa Buffer de Node): no corre en el runtime Edge. */
export const runtime = "nodejs";

/**
 * Descarga un corte del BOM como Excel, con el mismo formato que la descarga
 * del BOM vivo.
 *   GET /api/bom/cortes/<id>
 *
 * La sesion la exige proxy.ts (cubre todo el sitio, /api incluido).
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corte = /^\d{1,9}$/.test(id) ? await leerCorte(Number(id)) : null;
  if (!corte) {
    return new Response("No existe ese corte.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const bytes = await generarExcel(corte.filas);
  const dia = (corte.fecha instanceof Date ? corte.fecha : new Date(corte.fecha)).toISOString().slice(0, 10);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // Solo el id y la fecha en el nombre del archivo: el nombre del corte lo
      // escribe una persona y no va a una cabecera.
      "Content-Disposition": `attachment; filename="BOM_MX80_corte-${corte.id}_${dia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
