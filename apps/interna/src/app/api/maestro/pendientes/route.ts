import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { conBomTodas, obtenerTodas } from "@/lib/catalogo";
import { numerosEnUso } from "@/lib/numeros-en-uso";
import { generarExcelPendientes } from "@/lib/pendientes-excel";

/** Lee el BOM y arma el Excel con exceljs (Buffer de Node): no corre en el runtime Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo que falta enlazar entre el catalogo y el maestro de partes, como un Excel
 * de trabajo: una hoja por tipo de pendiente, con enlace a la ficha de cada
 * pieza, la partida que mas se parece y columnas de decision con menu.
 * Mismas listas que la pagina /maestro (ver lib/pendientes-maestro.ts).
 *   GET /api/maestro/pendientes
 */
export async function GET(peticion: Request) {
  const piezas = await conBomTodas(obtenerTodas(MODELO_PREDETERMINADO));
  const duenos = await numerosEnUso().catch(() => new Map<string, string>());
  // Los enlaces del archivo apuntan al sitio publico (BETTER_AUTH_URL), no al
  // origen interno con el que Hostinger entrega la peticion a la app.
  const origen = (process.env.BETTER_AUTH_URL ?? new URL(peticion.url).origin).replace(/\/+$/, "");

  const bytes = await generarExcelPendientes(piezas, duenos, origen);
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pendientes_maestro_MX80_${fecha}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
