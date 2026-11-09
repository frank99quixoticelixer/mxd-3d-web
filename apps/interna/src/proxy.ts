import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { igualSeguro, leerConfiguracion, verificarCuenta } from "@/lib/cuentas";
import { ipDelCliente } from "@/lib/protegido";

/**
 * Puerta de entrada de la app interna.
 *
 * POR QUE EXISTE: interno.mxddrone.com es un dominio publico. Antes de esto
 * respondia 200 a cualquiera, y la app esta pensada para guardar proveedores,
 * numeros de parte, costos y existencias. Sin esta puerta, el primero que
 * adivine el subdominio se lleva el BOM.
 *
 * Es autenticacion HTTP basica: el navegador pide usuario y contrasena y los
 * reenvia solo en las siguientes peticiones al mismo origen. Cada persona del
 * equipo tiene su cuenta en INTERNA_USUARIOS (usuario:sal:hash, ver
 * lib/cuentas.ts y docs/plan-usuarios-vitrina.md, fase 1), asi que se sabe QUIEN
 * entra y se le puede quitar el acceso a una sin cambiar la contrasena de todos.
 *
 * Todavia no es un sistema de sesiones: no hay roles, ni cierre de sesion, ni
 * autoservicio. Eso es la fase 2 del plan.
 *
 * COMPATIBILIDAD: si INTERNA_USUARIOS no esta definida se sigue usando el par
 * INTERNA_USUARIO / INTERNA_CLAVE de antes, para que un despliegue de este
 * codigo no cierre el sitio. Si INTERNA_USUARIOS esta definida, el par antiguo
 * se IGNORA: asi quitar a alguien de la lista le quita el acceso de verdad.
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
 * El archivo se llama proxy.ts y no middleware.ts porque Next 16 renombro la
 * convencion; el export tiene que llamarse igual que el archivo. Corre en el
 * runtime de Node (es el de Next 16 por omision), por eso puede usar node:crypto.
 */

/** Lo que el navegador manda en Authorization para el metodo Basic. */
const PREFIJO = "Basic ";

/** Cabecera con la que el proxy le dice al resto de la app quien entro. */
const CABECERA_USUARIO = "x-mxd-usuario";

/* ------------------------------------------------------------------ */
/* Cache de credenciales ya verificadas                                */
/* ------------------------------------------------------------------ */

/**
 * Basic manda las credenciales en CADA peticion (cada chunk, cada GLB), y
 * verificar con scrypt cuesta ~50 ms de CPU a proposito. Sin cache, cargar una
 * pagina serian decenas de scrypt. Aqui se recuerda, por 10 minutos, que esa
 * cabecera Authorization concreta ya se comprobo.
 *
 * La clave es un SHA-256 de la cabecera mezclada con un secreto que nace con el
 * proceso: en memoria no queda la contrasena ni nada con lo que probarla por
 * fuera. La cache solo acelera; si falla o se vacia (reinicio) se vuelve a
 * verificar con scrypt y el resultado es el mismo. Reiniciar el sitio tras
 * quitar a alguien de INTERNA_USUARIOS la vacia, y eso es lo que corta su
 * acceso, cosa que ya exige cualquier cambio de variables en hPanel.
 */
const VIGENCIA_CACHE_MS = 10 * 60_000;
const MAXIMO_CACHE = 500;
const SECRETO_CACHE = randomBytes(32);
const verificadas = new Map<string, { usuario: string; expira: number }>();

function claveDeCache(encabezado: string): string {
  return createHash("sha256").update(SECRETO_CACHE).update(encabezado).digest("hex");
}

function podarCache(ahora: number): void {
  if (verificadas.size <= MAXIMO_CACHE) return;
  for (const [clave, entrada] of verificadas) {
    if (entrada.expira <= ahora) verificadas.delete(clave);
  }
  // Si siguen sobrando (muchas cuentas activas a la vez), se descarta lo mas viejo.
  while (verificadas.size > MAXIMO_CACHE) {
    const primera = verificadas.keys().next().value;
    if (primera === undefined) break;
    verificadas.delete(primera);
  }
}

/* ------------------------------------------------------------------ */
/* Limite de intentos fallidos                                         */
/* ------------------------------------------------------------------ */

/**
 * Probar contrasenas a ciegas y, ademas, hacer que el servidor gaste scrypt en
 * cada intento, es el ataque obvio contra esta puerta. Por IP se aceptan 10
 * intentos fallidos cada 5 minutos; pasado eso se responde 429 SIN calcular nada.
 *
 * Solo cuentan los intentos fallidos con credenciales, no los pedidos sin
 * cabecera (esos son el primer paso normal del navegador). Y una persona que ya
 * entro no se ve afectada: su cabecera esta en la cache, que se revisa antes.
 *
 * Limite conocido: es en memoria y por proceso, y se reinicia con cada
 * despliegue. Si Hostinger entregara siempre la misma IP, 10 fallos de alguien
 * bloquearian los inicios de sesion nuevos de todos hasta por 5 minutos.
 */
const VENTANA_FALLOS_MS = 5 * 60_000;
const MAXIMO_FALLOS = 10;
const fallos = new Map<string, { inicio: number; cuenta: number }>();

/**
 * Cabeceras ya rechazadas. Una pagina dispara decenas de peticiones a la vez y
 * un navegador con una contrasena vieja las manda todas con la MISMA cabecera:
 * sin esto, cada una contaria como un intento y la persona se bloquearia a si
 * misma antes de poder escribir la contrasena buena. Una cabecera rechazada se
 * recuerda por la misma ventana, se contesta 401 sin calcular scrypt y cuenta
 * UN solo fallo. Quien teclea otra contrasena manda otra cabecera y se evalua.
 */
const rechazadas = new Map<string, number>();

function fallosActivos(ip: string, ahora: number): number {
  const registro = fallos.get(ip);
  if (!registro || ahora - registro.inicio >= VENTANA_FALLOS_MS) return 0;
  return registro.cuenta;
}

function anotarFallo(ip: string, ahora: number): void {
  const registro = fallos.get(ip);
  if (!registro || ahora - registro.inicio >= VENTANA_FALLOS_MS) {
    fallos.set(ip, { inicio: ahora, cuenta: 1 });
  } else {
    registro.cuenta += 1;
  }
  if (fallos.size > 5_000) {
    for (const [clave, r] of fallos) {
      if (ahora - r.inicio >= VENTANA_FALLOS_MS) fallos.delete(clave);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Respuestas                                                          */
/* ------------------------------------------------------------------ */

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

/** Deja pasar la peticion diciendole al resto de la app quien es. */
function dejarPasar(peticion: NextRequest, usuario: string): NextResponse {
  // Siempre se SOBRESCRIBE: si no, quien mande esta cabecera por su cuenta
  // podria hacerse pasar por otra persona ante el codigo que la lea.
  const cabeceras = new Headers(peticion.headers);
  cabeceras.set(CABECERA_USUARIO, usuario);
  return NextResponse.next({ request: { headers: cabeceras } });
}

/* ------------------------------------------------------------------ */

export async function proxy(peticion: NextRequest) {
  const configuracion = leerConfiguracion();

  /**
   * Sin credenciales configuradas se cierra, no se abre.
   *
   * Es la decision importante de este archivo. Si faltan las variables en
   * Hostinger, la alternativa seria dejar pasar a todos, y entonces un olvido
   * de configuracion publica el panel sin que nadie se entere. Asi el olvido
   * se nota de inmediato: el sitio no abre. Tambien aplica si INTERNA_USUARIOS
   * existe pero ninguna de sus entradas es valida.
   */
  if (configuracion.modo === "sin-configurar") {
    const detalle = configuracion.errores.length
      ? ` INTERNA_USUARIOS no tiene ninguna cuenta valida (${configuracion.errores.join("; ")}).`
      : "";
    return new NextResponse(
      "La app interna no tiene credenciales configuradas. Define INTERNA_USUARIOS " +
        "(o, en su defecto, INTERNA_USUARIO e INTERNA_CLAVE)." +
        detalle,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const encabezado = peticion.headers.get("authorization");
  if (!encabezado?.startsWith(PREFIJO)) return pedirCredenciales();

  const ahora = Date.now();

  // Camino rapido: esta misma cabecera ya se verifico hace poco.
  const clave = claveDeCache(encabezado);
  const recordada = verificadas.get(clave);
  if (recordada && recordada.expira > ahora) {
    return dejarPasar(peticion, recordada.usuario);
  }
  if (recordada) verificadas.delete(clave);

  // Basic va en base64 de bytes UTF-8 (el realm declara charset="UTF-8").
  let descifrado: string;
  try {
    descifrado = Buffer.from(encabezado.slice(PREFIJO.length), "base64").toString("utf8");
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

  // Esta misma cabecera ya se rechazo hace poco: no se vuelve a calcular ni a contar.
  const rechazadaHasta = rechazadas.get(clave);
  if (rechazadaHasta && rechazadaHasta > ahora) return pedirCredenciales();
  if (rechazadaHasta) rechazadas.delete(clave);

  const ip = ipDelCliente(peticion);
  if (fallosActivos(ip, ahora) >= MAXIMO_FALLOS) {
    console.warn(`[interna] acceso bloqueado por demasiados intentos fallidos ip=${ip}`);
    return new NextResponse("Demasiados intentos. Espera unos minutos.", {
      status: 429,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }

  let valido: boolean;
  let usuario = usuarioRecibido;
  if (configuracion.modo === "cuentas") {
    valido = await verificarCuenta(configuracion.cuentas, usuarioRecibido, claveRecibida);
  } else {
    // Par unico de antes. Se evaluan los dos siempre, sin cortocircuito, para no
    // revelar por el tiempo de respuesta si fallo el usuario o la contrasena.
    const { usuario: esperado, clave: claveEsperada } = configuracion.unica!;
    const usuarioOk = igualSeguro(usuarioRecibido, esperado);
    const claveOk = igualSeguro(claveRecibida, claveEsperada);
    valido = usuarioOk && claveOk;
    usuario = esperado;
  }

  if (!valido) {
    anotarFallo(ip, ahora);
    rechazadas.set(clave, ahora + VENTANA_FALLOS_MS);
    if (rechazadas.size > 1_000) {
      for (const [k, hasta] of rechazadas) if (hasta <= ahora) rechazadas.delete(k);
    }
    // Se anota quien lo intento solo si ese usuario existe: lo que alguien teclea
    // en "usuario" a veces es una contrasena, y esa no debe quedar en el log.
    const conocido =
      configuracion.modo === "cuentas" && configuracion.cuentas.has(usuarioRecibido);
    console.warn(
      `[interna] intento fallido ${conocido ? `usuario=${usuarioRecibido}` : "usuario desconocido"} ip=${ip}`,
    );
    return pedirCredenciales();
  }

  verificadas.set(clave, { usuario, expira: ahora + VIGENCIA_CACHE_MS });
  podarCache(ahora);
  // Una linea por inicio de sesion (no por peticion): es el registro de quien entra.
  console.log(`[interna] acceso usuario=${usuario} ip=${ip} ruta=${peticion.nextUrl.pathname}`);
  return dejarPasar(peticion, usuario);
}

export const config = {
  /**
   * Todas las rutas: paginas, /api, /models, /renders y /_next/static.
   *
   * Lo normal en un sitio publico es excluir los estaticos para ahorrar
   * trabajo. Aqui no se excluyen porque son justamente lo que hay que
   * proteger. El costo es bajo porque, despues de verificar una vez con scrypt,
   * las demas peticiones de esa misma sesion salen de la cache de arriba.
   */
  matcher: ["/:path*"],
};
