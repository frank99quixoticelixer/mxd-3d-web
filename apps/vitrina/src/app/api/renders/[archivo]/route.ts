import { entregarArchivo, limitarPeticiones, resolverRuta } from "@/lib/protegido";

export const runtime = "nodejs";

/**
 * Renders de piezas:  GET /renders/MX80-001.jpg
 *
 * La URL publica no cambia: next.config.mjs reescribe /renders/* hacia esta
 * ruta. Los archivos viven en apps/vitrina/protegido/renders/ y no en public/
 * (ver lib/protegido.ts).
 *
 * Por IP: 300 por minuto, mucho mas que los GLB porque el catalogo carga muchas
 * miniaturas a la vez. A diferencia de los GLB, una imagen si se puede abrir
 * suelta en una pestana, asi que aqui no se bloquea la navegacion directa.
 */
const MAXIMO_POR_MINUTO = 300;

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ archivo: string }> },
) {
  const limite = limitarPeticiones(peticion, "renders", MAXIMO_POR_MINUTO);
  if (limite) return limite;

  const { archivo } = await params;
  const ruta = resolverRuta("renders", [archivo], ".jpg");
  if (!ruta) return new Response("Archivo no valido", { status: 400 });

  return entregarArchivo(peticion, {
    ruta,
    tipo: "image/jpeg",
    // Las paginas piden el render con ?v=<fecha del archivo> (lib/imagenes.ts),
    // asi que una regeneracion cambia la URL y esta cache no sirve nada viejo.
    cache: "private, max-age=3600",
  });
}
