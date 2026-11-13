import { NextResponse, type NextRequest } from "next/server";

import { obtenerAuth } from "@/lib/auth";

/**
 * Puerta de entrada de la app interna (ADR 0006).
 *
 * POR QUE EXISTE: interno.mxddrone.com es un dominio publico y la app guarda
 * proveedores, numeros de parte, costos y existencias. Sin esta puerta, el
 * primero que adivine el subdominio se lleva el BOM.
 *
 * Cada persona entra con su cuenta (correo y contrasena, Better Auth) y recibe
 * una cookie de sesion. Antes era autenticacion HTTP basica con una contrasena
 * compartida; con eso no se sabia quien cambiaba que ni se podia dar de baja a
 * una sola persona.
 *
 * CUBRE TODO lo que pasa por la app: paginas, rutas de API, las rutas que
 * entregan los GLB y renders (/models, /renders) y los chunks de JavaScript de
 * /_next/static. Los chunks importan porque son archivos estaticos que
 * cualquiera puede pedir por su URL, y en esta app pueden llevar dentro el
 * catalogo interno.
 *
 * NO VE lo que hay en public/: en Hostinger esos archivos los entrega su
 * servidor estatico sin pasar por la app. Por eso los GLB y renders viven en
 * protegido/ y los sirven /api/modelos y /api/renders (ADR 0005).
 *
 * Sin configuracion de base de datos o de sesion responde 503 a todo, a
 * proposito: un olvido en hPanel no debe publicar el panel.
 *
 * El archivo se llama proxy.ts y no middleware.ts porque Next 16 renombro la
 * convencion; el export tiene que llamarse igual que el archivo.
 */

/**
 * Archivos de marca que ve quien aun no entra: el logo del encabezado y el
 * icono. En produccion los entrega el servidor estatico de Hostinger sin pasar
 * por aqui; en desarrollo si pasan, y sin esto /login sale sin logo. Se listan
 * uno por uno: public/brand/ tambien guarda herramientas internas.
 */
const ARCHIVOS_DE_MARCA = new Set(["/brand/logo-mxd.svg", "/icon.svg"]);

/**
 * Lo unico que se sirve sin sesion: la pagina de acceso, su CSS y la marca. La
 * pagina es un formulario HTML que funciona sin JavaScript, asi que ningun
 * chunk .js se abre. El CSS no lleva datos del catalogo.
 *
 * El CSS vive en /_next/static/css/ en el build de produccion (webpack) y en
 * /_next/static/chunks/ en desarrollo (Turbopack), por eso se acepta cualquier
 * .css de /_next/static/ y no una sola carpeta.
 */
function esRutaAbierta(ruta: string, metodo: string): boolean {
  const lectura = metodo === "GET" || metodo === "HEAD";
  if (ruta === "/login") return lectura || metodo === "POST";
  if (ruta.startsWith("/_next/static/") && ruta.endsWith(".css")) return lectura;
  if (ARCHIVOS_DE_MARCA.has(ruta)) return lectura;
  return false;
}

/** true si el navegador pide una pagina (y por lo tanto se le puede mandar a /login). */
function pideDocumento(peticion: NextRequest): boolean {
  return (
    peticion.method === "GET" &&
    (peticion.headers.get("accept") ?? "").includes("text/html")
  );
}

function sinSesion(peticion: NextRequest): NextResponse {
  if (pideDocumento(peticion)) {
    const { pathname, search } = peticion.nextUrl;
    const siguiente = encodeURIComponent(`${pathname}${search}`);
    // Next 16 parsea el Location de una respuesta del proxy con new URL(), asi
    // que una ruta relativa lanza "Invalid URL" y la pagina responde 404.
    // Tampoco sirve peticion.url: detras del proxy de Hostinger el host que ve
    // Node puede no ser el publico. Se arma con BETTER_AUTH_URL, que es la URL
    // publica del sitio y ya es obligatoria (sin ella el proxy responde 503).
    const base = process.env.BETTER_AUTH_URL ?? peticion.url;
    return new NextResponse(null, {
      status: 307,
      headers: {
        Location: new URL(`/login?siguiente=${siguiente}`, base).toString(),
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse("Se requiere iniciar sesion.", {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function proxy(peticion: NextRequest) {
  const ruta = peticion.nextUrl.pathname;
  const abierta = esRutaAbierta(ruta, peticion.method);

  const auth = obtenerAuth();
  if (!auth) {
    // /login tambien se cierra: sin configuracion no hay con que validar.
    return new NextResponse(
      "La app interna no esta configurada. Faltan las variables de la base de datos o de la sesion (DB_*, BETTER_AUTH_*).",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (abierta) return NextResponse.next();

  let resultado;
  try {
    resultado = await auth.api.getSession({
      headers: peticion.headers,
      returnHeaders: true,
    });
  } catch {
    // Base de datos caida o sesion ilegible: se cierra, no se abre.
    return new NextResponse("No se pudo validar la sesion.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const sesion = resultado.response;
  if (!sesion || sesion.user.activo === false) return sinSesion(peticion);

  const respuesta = NextResponse.next();
  // Si Better Auth renovo la cookie de sesion, se entrega en esta misma respuesta.
  for (const cookie of resultado.headers.getSetCookie()) {
    respuesta.headers.append("Set-Cookie", cookie);
  }
  return respuesta;
}

export const config = {
  /**
   * Todas las rutas: paginas, /api, /models, /renders y /_next/static.
   *
   * Lo normal en un sitio publico es excluir los estaticos para ahorrar
   * trabajo. Aqui no se excluyen porque son justamente lo que hay que
   * proteger. La sesion firmada en la cookie se valida sin consultar la base
   * durante 60 segundos (ver lib/auth.ts), asi que el costo es bajo.
   */
  matcher: ["/:path*"],
};
