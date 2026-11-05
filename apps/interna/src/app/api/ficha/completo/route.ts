import { respuestaPdf } from "@/features/ficha-pdf/generar";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { conBomTodas, obtenerPiezas } from "@/lib/catalogo";

export const runtime = "nodejs";

/**
 * Catalogo tecnico completo del MX80.
 *   GET /api/ficha/completo
 *
 * Este documento es el BOM entero con materiales y cotas. La proteccion no
 * vive aqui: src/proxy.ts cierra TODA la app (paginas, API y estaticos)
 * detras de autenticacion basica, matcher "/:path*", asi que esta ruta ya
 * esta cubierta igual que cualquier otra.
 */
export async function GET(peticion: Request) {
  const piezas = obtenerPiezas(MODELO_PREDETERMINADO);

  if (piezas.length === 0) {
    return new Response("El catalogo no tiene piezas publicadas.", {
      status: 404,
    });
  }

  return respuestaPdf(
    { tipo: "completo", piezas: await conBomTodas(piezas) },
    new URL(peticion.url).origin,
    "MX80_catalogo-completo",
  );
}
