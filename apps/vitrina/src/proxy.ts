import { NextResponse, type NextRequest } from "next/server";

/**
 * Puerta de entrada de la vitrina.
 *
 * POR QUE EXISTE: mientras la vitrina esta en desarrollo no debe verla
 * cualquiera. Es el mismo mecanismo que usa interna: autenticacion HTTP basica,
 * una sola cuenta compartida, configurada por variables de entorno (la
 * contrasena NO va en el codigo: este repo es publico).
 *
 * CUBRE TODO lo que pasa por la app: paginas, /api, las rutas que entregan los
 * GLB y renders (/models, /renders) y los chunks de /_next/static, que son
 * archivos que se piden por URL.
 *
 * NO VE lo que hay en public/: en Hostinger esos archivos los entrega su
 * servidor estatico sin pasar por la app. Por eso los GLB y renders viven en
 * protegido/ y los sirven /api/modelos y /api/renders (ADR 0005). Un GLB en
 * public/ queda abierto aunque este archivo exista.
 *
 * Es temporal y de una sola cuenta. Para varios usuarios ver
 * docs/plan-usuarios-interna.md.
 *
 * El archivo se llama proxy.ts y no middleware.ts porque Next 16 renombro la
 * convencion; el export tiene que llamarse igual que el archivo.
 */

/** Lo que el navegador manda en Authorization para el metodo Basic. */
const PREFIJO = "Basic ";

/**
 * Compara sin que el tiempo de respuesta delate cuantos caracteres acerto.
 *
 * Un `===` sobre cadenas corta en la primera diferencia, asi que responde un
 * poco mas rapido cuando falla al principio que cuando falla al final. Sobre
 * muchos intentos eso permite adivinar la contrasena caracter por caracter.
 * Aqui se recorre siempre el largo completo y se acumulan las diferencias con
 * OR, de modo que el trabajo no depende de donde este el error.
 */
function igualSeguro(a: string, b: string): boolean {
  const largo = Math.max(a.length, b.length);
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < largo; i += 1) {
    diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferencia === 0;
}

/** 401 con el encabezado que hace que el navegador muestre el formulario. */
function pedirCredenciales(): NextResponse {
  return new NextResponse("Se requiere autenticacion.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="MXD vitrina", charset="UTF-8"',
      // Sin esto, un proxy intermedio podria guardar la respuesta negada.
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(peticion: NextRequest) {
  const usuario = process.env.VITRINA_USUARIO;
  const clave = process.env.VITRINA_CLAVE;

  /**
   * Sin credenciales configuradas se cierra, no se abre.
   *
   * Es la decision importante de este archivo. Si faltan las variables en
   * Hostinger, la alternativa seria dejar pasar a todos, y entonces un olvido
   * de configuracion publica el panel sin que nadie se entere. Asi el olvido
   * se nota de inmediato: el sitio no abre.
   */
  if (!usuario || !clave) {
    return new NextResponse(
      "La vitrina no tiene credenciales configuradas. Define VITRINA_USUARIO y VITRINA_CLAVE.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const encabezado = peticion.headers.get("authorization");
  if (!encabezado?.startsWith(PREFIJO)) return pedirCredenciales();

  let descifrado: string;
  try {
    descifrado = atob(encabezado.slice(PREFIJO.length));
  } catch {
    // Base64 invalido: no es un intento valido, se trata como falta de credenciales.
    return pedirCredenciales();
  }

  // El formato es "usuario:clave", y la clave puede traer ":" dentro, asi que
  // se corta solo en el primer separador.
  const corte = descifrado.indexOf(":");
  if (corte === -1) return pedirCredenciales();

  const usuarioRecibido = descifrado.slice(0, corte);
  const claveRecibida = descifrado.slice(corte + 1);

  // Se evaluan los dos siempre, sin cortocircuito, para no revelar por el
  // tiempo de respuesta si lo que fallo fue el usuario o la contrasena.
  const usuarioOk = igualSeguro(usuarioRecibido, usuario);
  const claveOk = igualSeguro(claveRecibida, clave);
  if (!usuarioOk || !claveOk) return pedirCredenciales();

  return NextResponse.next();
}

export const config = {
  /**
   * Todas las rutas: paginas, /api, /models, /renders y /_next/static.
   *
   * Lo normal en un sitio publico es excluir los estaticos para ahorrar
   * trabajo. Aqui no se excluyen porque son justamente lo que hay que
   * proteger. El costo es despreciable: el navegador reenvia las credenciales
   * solo, sin volver a preguntar.
   */
  matcher: ["/:path*"],
};
