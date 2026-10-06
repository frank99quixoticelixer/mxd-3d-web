import { respuestaPdf } from "@/features/ficha-pdf/generar";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { obtenerPiezas } from "@/lib/catalogo";

export const runtime = "nodejs";

/**
 * Catalogo tecnico completo del MX80.
 *   GET /api/ficha/completo
 *
 * ATENCION antes de publicar: este documento es el BOM entero con materiales y
 * cotas. Mientras la ruta sea abierta, cualquiera que tenga la URL se lleva el
 * despiece completo. Antes del deploy publico hay que decidir si esta descarga
 * y la de seccion quedan detras de autenticacion; la ficha individual puede
 * quedarse abierta sin el mismo riesgo.
 */
export async function GET(peticion: Request) {
  const piezas = obtenerPiezas(MODELO_PREDETERMINADO);

  if (piezas.length === 0) {
    return new Response("El catalogo no tiene piezas publicadas.", {
      status: 404,
    });
  }

  return respuestaPdf(
    { tipo: "completo", piezas },
    new URL(peticion.url).origin,
    "MX80_catalogo-completo",
  );
}
