import { respuestaPdf } from "@/features/ficha-pdf/generar";
import { obtenerPiezaPorSku } from "@/lib/catalogo";
import { aSlug } from "@/lib/texto";

/** react-pdf usa APIs de Node (streams, Buffer): no corre en el runtime Edge. */
export const runtime = "nodejs";

/**
 * Ficha tecnica de una pieza.
 *   GET /api/ficha/pieza/MX80-007
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;
  const pieza = obtenerPiezaPorSku(sku.toUpperCase());

  if (!pieza) {
    return new Response(`No existe la pieza ${sku}`, { status: 404 });
  }

  return respuestaPdf(
    { tipo: "pieza", pieza },
    new URL(peticion.url).origin,
    `${pieza.sku}_${aSlug(pieza.nombre)}`,
  );
}
