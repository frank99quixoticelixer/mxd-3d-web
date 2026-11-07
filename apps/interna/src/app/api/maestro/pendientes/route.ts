import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { conBomTodas, obtenerTodas } from "@/lib/catalogo";
import { pendientesMaestro } from "@/lib/pendientes-maestro";

/** Lee el BOM editable del disco: usa fs de Node, no corre en el runtime Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Una celda CSV: entre comillas, con las comillas internas dobladas. */
const celda = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * Lo que falta enlazar entre el catalogo y el maestro de partes, en CSV para
 * abrirlo en Excel y darle seguimiento en el BOM. Mismas listas que la pagina
 * /maestro (ver lib/pendientes-maestro.ts).
 *   GET /api/maestro/pendientes
 */
export async function GET() {
  const piezas = await conBomTodas(obtenerTodas(MODELO_PREDETERMINADO));
  const p = pendientesMaestro(piezas);

  const filas: (string | number | null)[][] = [
    ["Pendiente", "SKU", "Pieza", "No. parte MXD", "Detalle"],
    ...p.porConfirmar.map((x) => [
      "Cruce por confirmar",
      x.sku,
      x.nombre,
      x.numeroBom,
      x.cruceBom?.nota ?? null,
    ]),
    ...p.porDarDeAlta.map((x) => [
      "Pieza sin número: dar de alta o enlazar",
      x.sku,
      x.nombre,
      null,
      x.categoria,
    ]),
    ...p.tornilleria.map((x) => [
      "Tornillería sin número",
      x.sku,
      x.nombre,
      null,
      x.categoria,
    ]),
    ...p.partidasSinPieza.map((m) => [
      "Partida del maestro sin pieza en el 3D",
      null,
      m.nombre,
      m.numero,
      [m.nombreOem, m.posicion].filter(Boolean).join(" · "),
    ]),
  ];

  // El BOM UTF-8 al inicio hace que Excel lea bien los acentos.
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pendientes_maestro_MX80_${fecha}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
