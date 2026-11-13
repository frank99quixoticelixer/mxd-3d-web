import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Entrega de los archivos de apps/vitrina/protegido/ (GLB y renders).
 *
 * POR QUE NO SON ESTATICOS DE public/: en Hostinger los archivos de public/ los
 * entrega su servidor estatico sin pasar por la app, asi que proxy.ts no los
 * protege. Aqui los sirve una ruta de la app, que si pasa por proxy.ts (la
 * contrasena), y sobre ella se montan el limite de peticiones y la cache.
 *
 * Solo corre en servidor (rutas /api). No importar desde componentes de cliente.
 */

export const RAIZ_PROTEGIDO = path.join(process.cwd(), "protegido");

/** Un nombre de archivo o de carpeta: sin "..", sin separadores, sin ocultos. */
const SEGMENTO_VALIDO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Resuelve una ruta relativa dentro de `carpeta` (hija de protegido/) o devuelve
 * null si no es valida. Lista cerrada: cada segmento con formato exacto y la
 * extension permitida, y el resultado tiene que quedar dentro de la carpeta.
 * No hay forma de pedir otra ruta del servidor.
 */
export function resolverRuta(
  carpeta: string,
  segmentos: string[],
  extension: string,
): string | null {
  if (segmentos.length === 0 || segmentos.length > 4) return null;
  if (!segmentos.every((s) => SEGMENTO_VALIDO.test(s))) return null;
  if (!segmentos[segmentos.length - 1].toLowerCase().endsWith(extension)) return null;

  const base = path.join(RAIZ_PROTEGIDO, carpeta);
  const ruta = path.join(base, ...segmentos);
  return ruta.startsWith(base + path.sep) ? ruta : null;
}

/* ------------------------------------------------------------------ */
/* Limite de peticiones                                               */
/* ------------------------------------------------------------------ */

interface Ventana {
  inicio: number;
  cuenta: number;
}

const VENTANA_MS = 60_000;
const MAXIMO_ENTRADAS = 5_000;

/**
 * Contadores en memoria, uno por (cubeta, IP). Limites que hay que conocer:
 * se reinician con cada despliegue o reinicio del sitio, y cada proceso lleva
 * los suyos. Para un solo proceso en Hostinger alcanza; frena descargas masivas,
 * no a alguien con paciencia.
 */
const ventanas = new Map<string, Ventana>();

/**
 * IP del cliente. Se toma la ULTIMA entrada de x-forwarded-for: es la que
 * agrego el proxy de Hostinger. La primera la manda el propio cliente, y
 * usarla permitiria saltarse el limite rotando una cabecera inventada.
 * Si despues se pone un CDN delante, esta funcion hay que revisarla.
 */
export function ipDelCliente(peticion: Pick<Request, "headers">): string {
  const reenviada = peticion.headers.get("x-forwarded-for");
  if (reenviada) {
    const entradas = reenviada.split(",");
    const ultima = entradas[entradas.length - 1].trim();
    if (ultima) return ultima;
  }
  return peticion.headers.get("x-real-ip")?.trim() || "desconocida";
}

/**
 * Cuenta la peticion y devuelve una respuesta 429 si `ip` ya paso `maximo`
 * peticiones en el ultimo minuto dentro de `cubeta`; null si puede seguir.
 */
export function limitarPeticiones(
  peticion: Request,
  cubeta: string,
  maximo: number,
): Response | null {
  const ahora = Date.now();

  if (ventanas.size > MAXIMO_ENTRADAS) {
    for (const [clave, v] of ventanas) {
      if (ahora - v.inicio >= VENTANA_MS) ventanas.delete(clave);
    }
  }

  const clave = `${cubeta}:${ipDelCliente(peticion)}`;
  const actual = ventanas.get(clave);
  if (!actual || ahora - actual.inicio >= VENTANA_MS) {
    ventanas.set(clave, { inicio: ahora, cuenta: 1 });
    return null;
  }

  actual.cuenta += 1;
  if (actual.cuenta <= maximo) return null;

  const espera = Math.max(1, Math.ceil((VENTANA_MS - (ahora - actual.inicio)) / 1000));
  return new Response("Demasiadas peticiones. Intenta de nuevo en un momento.", {
    status: 429,
    headers: { "Retry-After": String(espera), "Cache-Control": "no-store" },
  });
}

/* ------------------------------------------------------------------ */
/* Entrega                                                            */
/* ------------------------------------------------------------------ */

/**
 * true si la peticion es una navegacion directa del navegador (alguien pego la
 * URL del archivo en la barra de direcciones). El visor y las imagenes piden
 * con fetch o <img>, que mandan otro Sec-Fetch-Dest. Es solo friccion: con curl
 * esa cabecera se falsea. Sin la cabecera (curl, navegadores viejos) no se
 * bloquea.
 */
export function esNavegacionDirecta(peticion: Request): boolean {
  const destino = peticion.headers.get("sec-fetch-dest");
  return destino === "document" || destino === "iframe";
}

interface OpcionesEntrega {
  ruta: string;
  tipo: string;
  /** Cache-Control. Siempre "private": es contenido detras de contrasena. */
  cache: string;
}

/**
 * Tamano de cada trozo al transmitir. Node lee de 64 KB en 64 KB por omision: un
 * GLB de 27 MB son ~416 escrituras, y detras del proxy de Hostinger cada una
 * parece esperar al otro lado (el GLB v5 tardo mas de 3 minutos en producion;
 * servido como estatico no pasaba). Con 2 MB son ~13 escrituras y la
 * memoria por peticion sigue acotada (a diferencia de leer el archivo entero).
 */
const TROZO_BYTES = 2 * 1024 * 1024;

/**
 * Entrega el archivo con ETag (tamano + fecha): el navegador revalida y recibe
 * 304 en vez de volver a bajar los MB del GLB. Se transmite en trozos.
 */
export async function entregarArchivo(
  peticion: Request,
  { ruta, tipo, cache }: OpcionesEntrega,
): Promise<Response> {
  let info;
  try {
    info = await stat(ruta);
    if (!info.isFile()) throw new Error("no es un archivo");
  } catch {
    return new Response("No existe", { status: 404 });
  }

  const etag = `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
  const cabeceras = {
    ETag: etag,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  };

  if (peticion.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: cabeceras });
  }

  const flujo = Readable.toWeb(
    createReadStream(ruta, { highWaterMark: TROZO_BYTES }),
  ) as unknown as ReadableStream<Uint8Array>;
  return new Response(flujo, {
    headers: {
      ...cabeceras,
      "Content-Type": tipo,
      "Content-Length": String(info.size),
      "Content-Disposition": "inline",
    },
  });
}
