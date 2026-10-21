import { NextResponse, type NextRequest } from "next/server";

/**
 * Puerta de entrada de la app interna.
 *
 * POR QUE EXISTE: interno.mxddrone.com es un dominio publico. Antes de esto
 * respondia 200 a cualquiera, y la app esta pensada para guardar proveedores,
 * numeros de parte, costos y existencias. Sin esta puerta, el primero que
 * adivine el subdominio se lleva el BOM.
 *
 * Es autenticacion HTTP basica: el navegador pide usuario y contrasena y los
 * reenvia solo en las siguientes peticiones al mismo origen. No es un sistema
 * de cuentas —no hay usuarios, ni sesiones, ni roles— y a proposito: para un
 * panel de tres personas detras de HTTPS, una contrasena compartida es la
 * proteccion correcta por el esfuerzo que cuesta. Cuando haya que saber QUIEN
 * hizo cada cambio, esto se cambia por cuentas de verdad.
 *
 * CUBRE TODO, no solo las paginas: tambien las rutas de API, los GLB de
 * /public y los chunks de JavaScript de /_next/static. Los chunks importan
 * porque son archivos estaticos que cualquiera puede pedir por su URL, y en
 * esta app pueden llevar dentro el catalogo interno.
 *
 * El archivo se llama proxy.ts y no middleware.ts porque Next 16 renombro la
 * convencion; el export tiene que llamarse igual que el archivo. Con el nombre
 * viejo funciona pero avisa en cada build que esta deprecado.
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
      "WWW-Authenticate": 'Basic realm="MXD interna", charset="UTF-8"',
      // Sin esto, un proxy intermedio podria guardar la respuesta negada.
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(peticion: NextRequest) {
  const usuario = process.env.INTERNA_USUARIO;
  const clave = process.env.INTERNA_CLAVE;

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
      "La app interna no tiene credenciales configuradas. Define INTERNA_USUARIO e INTERNA_CLAVE.",
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
   * Todas las rutas: paginas, /api, los GLB de /public y /_next/static.
   *
   * Lo normal en un sitio publico es excluir los estaticos para ahorrar
   * trabajo. Aqui no se excluyen porque son justamente lo que hay que
   * proteger. El costo es despreciable: el navegador reenvia las credenciales
   * solo, sin volver a preguntar.
   */
  matcher: ["/:path*"],
};
