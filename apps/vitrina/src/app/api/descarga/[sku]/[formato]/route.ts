import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

/**
 * Descarga de la malla de una pieza: GET /api/descarga/MX80-007-03/stl
 *
 * Sirve contenido/piezas_MX80/descargas/<SKU>/<SKU>.<formato>. Es una ruta
 * aparte de /api/modelo (que solo publica .glb del ensamble) porque aqui si se
 * entregan STL, y solo de la lista cerrada de formatos de abajo: los .blend,
 * .stp y .step siguen sin salir por ninguna ruta.
 *
 * CANDADOS: el SKU debe cumplir el formato MX80-001 / MX80-001-02 y el formato
 * estar en la lista, asi que el nombre del archivo se construye aqui y nunca
 * se toma tal cual de la URL (no hay forma de meter "../").
 */

const RAIZ = path.join(process.cwd(), "contenido", "piezas_MX80", "descargas");

const FORMATOS: Record<string, string> = {
  glb: "model/gltf-binary",
  stl: "model/stl",
};

const FORMATO_SKU = /^MX\d{2}-\d{3}(-\d{2})?$/;

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ sku: string; formato: string }> },
) {
  const { sku, formato } = await params;

  if (!FORMATO_SKU.test(sku) || !(formato in FORMATOS)) {
    return new Response("Descarga no valida", { status: 400 });
  }

  const verEnLinea = new URL(peticion.url).searchParams.get("ver") === "1";
  const nombre = `${sku}.${formato}`;

  // Ruta principal: contenido/ (en produccion puede no existir si no fue desplegado por FTP)
  let absoluta = path.join(RAIZ, sku, nombre);
  let tamano: number | null = null;

  try {
    const info = await stat(absoluta);
    if (info.isFile()) tamano = info.size;
  } catch { /* no existe, se intenta fallback */ }

  // Fallback GLB: los archivos de pieza ya estan en public/models/mx80/piezas/
  // con nombre {SKU}_v{n}.glb; se busca el primero que coincida.
  if (tamano === null && formato === "glb") {
    const dirPublico = path.join(process.cwd(), "public", "models", "mx80", "piezas");
    try {
      const entradas = await readdir(dirPublico);
      const coincidencia = entradas.find(
        (e) => e.startsWith(sku + "_v") && e.endsWith(".glb"),
      );
      if (coincidencia) {
        absoluta = path.join(dirPublico, coincidencia);
        const info = await stat(absoluta);
        if (info.isFile()) tamano = info.size;
      }
    } catch { /* directorio no encontrado */ }
  }

  if (tamano === null) {
    return new Response(`No hay ${formato.toUpperCase()} para ${sku}`, {
      status: 404,
    });
  }

  const flujo = Readable.toWeb(
    createReadStream(absoluta),
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(flujo, {
    headers: {
      "Content-Type": FORMATOS[formato],
      "Content-Length": String(tamano),
      // Con ?ver=1 se entrega para mostrarse en el visor (sin forzar la
      // descarga); es el mismo archivo y la misma lista cerrada de arriba.
      "Content-Disposition": `${verEnLinea ? "inline" : "attachment"}; filename="${nombre}"`,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
