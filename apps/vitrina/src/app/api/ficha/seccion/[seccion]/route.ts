import { respuestaPdf } from "@/features/ficha-pdf/generar";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { obtenerPiezasPorSeccion } from "@/lib/catalogo";
import { SeccionEsquema } from "@/lib/esquema";

export const runtime = "nodejs";

/**
 * Especificaciones de una seccion completa: portada, indice y una ficha por
 * componente. Es el documento que se le manda a un proveedor cuando cotiza un
 * subconjunto, por ejemplo un brazo entero.
 *
 *   GET /api/ficha/seccion/brazo-cw-1
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ seccion: string }> },
) {
  const { seccion: cruda } = await params;
  const resultado = SeccionEsquema.safeParse(cruda);

  if (!resultado.success) {
    return new Response(
      `Seccion desconocida: ${cruda}. Secciones validas: ${SeccionEsquema.options.join(", ")}`,
      { status: 404 },
    );
  }

  const seccion = resultado.data;
  const piezas = obtenerPiezasPorSeccion(seccion, MODELO_PREDETERMINADO);

  if (piezas.length === 0) {
    return new Response(
      `La seccion ${seccion} todavia no tiene piezas en el catalogo.`,
      { status: 404 },
    );
  }

  return respuestaPdf(
    { tipo: "seccion", seccion, piezas },
    new URL(peticion.url).origin,
    `MX80_${seccion}`,
  );
}
