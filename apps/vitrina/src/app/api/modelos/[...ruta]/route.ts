import {
  entregarArchivo,
  esNavegacionDirecta,
  limitarPeticiones,
  resolverRuta,
} from "@/lib/protegido";

export const runtime = "nodejs";

/**
 * GLB del visor:  GET /models/mx80/MX80_completo_v4_web.glb
 *
 * La URL publica no cambia: next.config.mjs reescribe /models/* hacia esta
 * ruta. Los archivos viven en apps/vitrina/protegido/models/ y no en public/,
 * porque Hostinger entrega los de public/ sin pasar por proxy.ts (ver
 * lib/protegido.ts).
 *
 * Por IP: 30 GLB por minuto. Una visita normal pide de 1 a 3.
 */
const MAXIMO_POR_MINUTO = 30;

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  const limite = limitarPeticiones(peticion, "modelos", MAXIMO_POR_MINUTO);
  if (limite) return limite;

  // Pegar la URL en la barra del navegador no es como se usa el visor.
  if (esNavegacionDirecta(peticion)) {
    return new Response("No disponible.", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const { ruta } = await params;
  const archivo = resolverRuta("models", ruta, ".glb");
  if (!archivo) return new Response("Archivo no valido", { status: 400 });

  return entregarArchivo(peticion, {
    ruta: archivo,
    tipo: "model/gltf-binary",
    // private: nunca en una cache compartida (CDN, proxy). Los GLB llevan la
    // version en el nombre (MX80_completo_v5_web.glb) y no se sobrescriben, asi
    // que el navegador puede guardarlo un dia sin preguntar; pasado ese plazo
    // revalida y el ETag responde 304. Sin esto, cada visita nueva de una
    // persona vuelve a bajar los 27 MB desde el servidor.
    cache: "private, max-age=86400",
  });
}
