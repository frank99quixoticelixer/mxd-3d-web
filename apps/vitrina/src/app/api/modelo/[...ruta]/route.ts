import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

/**
 * Sirve los GLB directamente desde contenido/piezas_MX80/.
 *
 * POR QUE EXISTE: Next solo publica archivos que esten dentro de public/, y
 * copiar cada GLB ahi significaba mantener dos versiones del mismo modelo. Con
 * esta ruta el archivo vive en un solo lugar —la carpeta donde se trabaja— y la
 * aplicacion solo elige cual cargar (GLB_ACTIVO en src/config/modelos3d.ts).
 *
 *   GET /api/modelo/brazo/MX80_brazo_CW_web.glb
 *
 * DOS CANDADOS, los dos necesarios:
 *
 *  1. Solo .glb. La carpeta piezas_MX80 tambien guarda .blend, .stp y .step,
 *     que son la geometria exacta de fabricacion. Sin este filtro, esta ruta
 *     publicaria el CAD completo del dron a cualquiera que adivine un nombre.
 *  2. La ruta resuelta tiene que quedar dentro de piezas_MX80. Sin esta
 *     comprobacion, un "../../" en la URL lee cualquier archivo del servidor.
 */

/**
 * Carpeta de trabajo de los modelos, un nivel arriba de web/. Se define aqui y
 * no en src/config/modelos3d.ts porque ese archivo lo importan componentes de
 * cliente, y node:path no existe en el navegador.
 */
const RAIZ_CONTENIDO = path.join(process.cwd(), "contenido", "piezas_MX80");

const EXTENSIONES = new Set([".glb"]);

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  const { ruta } = await params;
  const relativa = ruta.join("/");

  if (!EXTENSIONES.has(path.extname(relativa).toLowerCase())) {
    return new Response("Solo se sirven archivos .glb", { status: 403 });
  }

  const base = path.resolve(RAIZ_CONTENIDO);
  const absoluta = path.resolve(base, relativa);

  if (absoluta !== base && !absoluta.startsWith(base + path.sep)) {
    return new Response("Ruta fuera de contenido/piezas_MX80", { status: 403 });
  }

  let tamano: number;
  let modificado: Date;
  try {
    const info = await stat(absoluta);
    if (!info.isFile()) throw new Error("no es un archivo");
    tamano = info.size;
    modificado = info.mtime;
  } catch {
    return new Response(`No existe el modelo ${relativa}`, { status: 404 });
  }

  // Se transmite en trozos en lugar de cargarlo entero en memoria: un ensamble
  // sin optimizar pasa de 50 MB y leerlo completo por cada peticion no escala.
  const flujo = Readable.toWeb(
    createReadStream(absoluta),
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(flujo, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(tamano),
      // El nombre del archivo no lleva version, asi que no se puede cachear
      // como inmutable: se revalida contra la fecha de modificacion. Al
      // reexportar desde Blender, el navegador lo nota sin borrar cache.
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Last-Modified": modificado.toUTCString(),
    },
  });
}
