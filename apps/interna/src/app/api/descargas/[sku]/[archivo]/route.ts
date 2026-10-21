import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

/**
 * Descarga del GLB o STL de una pieza:  GET /api/descargas/MX80-007/MX80-007.stl
 *
 * POR QUE NO ES UN ESTATICO DE public/: en Hostinger los archivos de public/
 * los entrega su servidor estatico sin pasar por la app, asi que proxy.ts no
 * los protege y quedaban abiertos sin contrasena. Esta ruta si pasa por
 * proxy.ts. Los archivos viven en apps/interna/descargas/ (en git, fuera de
 * public/).
 *
 * La entrada se valida con listas cerradas: el SKU con su formato exacto y el
 * archivo solo puede ser <SKU>.glb o <SKU>.stl, asi que no hay forma de pedir
 * otra ruta del servidor.
 */
const RAIZ = path.join(process.cwd(), "descargas");
const FORMATO_SKU = /^MX\d{2}-\d{3}(-\d{2})?$/;
const TIPOS: Record<string, string> = {
  glb: "model/gltf-binary",
  stl: "model/stl",
};

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ sku: string; archivo: string }> },
) {
  const { sku, archivo } = await params;
  const formato = archivo.slice(sku.length + 1);
  if (!FORMATO_SKU.test(sku) || archivo !== `${sku}.${formato}` || !(formato in TIPOS)) {
    return new Response("Descarga no valida", { status: 400 });
  }

  const ruta = path.join(RAIZ, sku, archivo);
  let tamano: number;
  try {
    const info = await stat(ruta);
    if (!info.isFile()) throw new Error("no es un archivo");
    tamano = info.size;
  } catch {
    return new Response("No existe esa descarga", { status: 404 });
  }

  // Se transmite en trozos: hay STL de varios MB.
  const flujo = Readable.toWeb(createReadStream(ruta)) as unknown as ReadableStream<Uint8Array>;
  return new Response(flujo, {
    headers: {
      "Content-Type": TIPOS[formato],
      "Content-Length": String(tamano),
      "Content-Disposition": `attachment; filename="${archivo}"`,
      // Detras de contrasena: ningun cache compartido debe guardarla.
      "Cache-Control": "private, no-store",
    },
  });
}
