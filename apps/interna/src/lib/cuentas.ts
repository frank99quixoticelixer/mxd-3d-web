import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Cuentas de la app interna: varias personas, cada una con su contrasena.
 *
 * Es la fase 1 de docs/plan-usuarios-vitrina.md. Sin base de datos y sin
 * sesiones: el navegador sigue usando el cuadro de autenticacion basica y el
 * proxy (src/proxy.ts) comprueba cada cuenta contra INTERNA_USUARIOS.
 *
 * Solo corre en servidor (proxy y script). Depende unicamente de node:crypto
 * para que `npm run hash-clave` lo importe sin arrastrar nada de Next.
 *
 * FORMATO de INTERNA_USUARIOS: entradas separadas por coma, cada una
 * `usuario:sal:hash` (sal y hash en hexadecimal). Nunca la contrasena en claro:
 * el hash es scrypt, asi que quien lea la variable no obtiene las contrasenas.
 *
 *   INTERNA_USUARIOS="ana:9f3a...:c41b...,luis:5d02...:e7aa..."
 *
 * Las entradas las genera `npm run hash-clave -- <usuario>`.
 */

/**
 * Costo de scrypt. N=16384, r=8 es el minimo que recomienda OWASP y necesita
 * ~16 MB: ~50 ms por verificacion en un servidor normal. Si se cambia, TODOS los
 * hashes existentes dejan de servir y hay que regenerarlos.
 */
const N = 16384;
const R = 8;
const P = 1;
const LARGO_HASH = 32;
const LARGO_SAL = 16;
const MEMORIA_MAX = 64 * 1024 * 1024;

const FORMATO_USUARIO = /^[a-z0-9._-]{1,32}$/;
const FORMATO_SAL = /^[0-9a-f]{32}$/;
const FORMATO_HASH = /^[0-9a-f]{64}$/;

export interface Cuenta {
  usuario: string;
  sal: Buffer;
  hash: Buffer;
}

/** Lo que dice la variable de entorno, ya interpretado. */
export interface Configuracion {
  /**
   * "cuentas": INTERNA_USUARIOS con al menos una entrada valida.
   * "unica": el par INTERNA_USUARIO / INTERNA_CLAVE de antes (se conserva para
   *   no cerrar el sitio en el despliegue; ver CLAUDE.md).
   * "sin-configurar": no hay nada utilizable, el proxy responde 503.
   */
  modo: "cuentas" | "unica" | "sin-configurar";
  cuentas: Map<string, Cuenta>;
  /** Entradas de INTERNA_USUARIOS que se descartaron, para el mensaje del 503. */
  errores: string[];
  /** Solo en modo "unica". */
  unica?: { usuario: string; clave: string };
}

/** La contrasena se normaliza para que "e" + acento y "e con acento" sean la misma. */
function normalizar(clave: string): string {
  return clave.normalize("NFKC");
}

/** Deriva el hash de una contrasena con la sal dada. No bloquea el hilo principal. */
export function derivar(clave: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(
      normalizar(clave),
      sal,
      LARGO_HASH,
      { N, r: R, p: P, maxmem: MEMORIA_MAX },
      (error, llave) => (error ? rechazar(error) : resolver(llave)),
    );
  });
}

/** Crea la entrada `usuario:sal:hash` que se agrega a INTERNA_USUARIOS. */
export async function crearEntrada(usuario: string, clave: string): Promise<string> {
  if (!FORMATO_USUARIO.test(usuario)) {
    throw new Error(
      "El usuario solo puede llevar minusculas, numeros, punto, guion y guion bajo (1 a 32 caracteres).",
    );
  }
  const sal = randomBytes(LARGO_SAL);
  const hash = await derivar(clave, sal);
  return `${usuario}:${sal.toString("hex")}:${hash.toString("hex")}`;
}

/** Compara dos cadenas sin que el tiempo delate cuantos caracteres acerto. */
export function igualSeguro(a: string, b: string): boolean {
  // Se comparan los SHA-256: siempre miden lo mismo, que es lo que exige
  // timingSafeEqual, y no se filtra el largo de la contrasena real.
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

/** Interpreta INTERNA_USUARIOS. Las entradas mal formadas se descartan y se reportan. */
export function leerCuentas(texto: string): { cuentas: Map<string, Cuenta>; errores: string[] } {
  const cuentas = new Map<string, Cuenta>();
  const errores: string[] = [];

  for (const [indice, crudo] of texto.split(",").entries()) {
    const entrada = crudo.trim();
    if (!entrada) continue;
    const partes = entrada.split(":");
    const [usuario, sal, hash] = partes;

    // En el mensaje solo va la posicion y el usuario, nunca la sal ni el hash.
    const etiqueta = `entrada ${indice + 1}${usuario ? ` (${usuario.slice(0, 32)})` : ""}`;
    if (partes.length !== 3) {
      errores.push(`${etiqueta}: debe ser usuario:sal:hash`);
    } else if (!FORMATO_USUARIO.test(usuario)) {
      errores.push(`${etiqueta}: usuario no valido`);
    } else if (!FORMATO_SAL.test(sal) || !FORMATO_HASH.test(hash)) {
      errores.push(`${etiqueta}: sal o hash no son hexadecimal del largo esperado`);
    } else if (cuentas.has(usuario)) {
      errores.push(`${etiqueta}: usuario repetido`);
    } else {
      cuentas.set(usuario, {
        usuario,
        sal: Buffer.from(sal, "hex"),
        hash: Buffer.from(hash, "hex"),
      });
    }
  }
  return { cuentas, errores };
}

/** Sal y hash de relleno para gastar el mismo tiempo cuando el usuario no existe. */
const RELLENO = { sal: randomBytes(LARGO_SAL), hash: randomBytes(LARGO_HASH) };

/**
 * true si `clave` es la de `usuario`. Si el usuario no existe se hace igual el
 * calculo de scrypt: sin eso, responder mas rapido delataria cuales usuarios
 * existen.
 */
export async function verificarCuenta(
  cuentas: Map<string, Cuenta>,
  usuario: string,
  clave: string,
): Promise<boolean> {
  const cuenta = cuentas.get(usuario);
  const calculado = await derivar(clave, cuenta?.sal ?? RELLENO.sal);
  const esperado = cuenta?.hash ?? RELLENO.hash;
  return timingSafeEqual(calculado, esperado) && cuenta !== undefined;
}

/* ------------------------------------------------------------------ */
/* Configuracion desde el entorno                                      */
/* ------------------------------------------------------------------ */

let ultimaLectura: { texto: string; cuentas: ReturnType<typeof leerCuentas> } | null = null;

/**
 * Lee la configuracion en cada peticion (las variables de hPanel no se hornean
 * en el bundle: cambiarlas solo pide reiniciar). La lista interpretada se
 * recuerda mientras el texto no cambie, para no repetir el trabajo ni los avisos.
 */
export function leerConfiguracion(): Configuracion {
  const lista = process.env.INTERNA_USUARIOS?.trim();

  if (lista) {
    if (ultimaLectura?.texto !== lista) {
      ultimaLectura = { texto: lista, cuentas: leerCuentas(lista) };
      for (const error of ultimaLectura.cuentas.errores) {
        console.error(`[interna] INTERNA_USUARIOS, ${error}`);
      }
    }
    const { cuentas, errores } = ultimaLectura.cuentas;
    // Si la variable existe se usa SOLA: no se mezcla con el par antiguo, para
    // que quitar a alguien de la lista realmente le quite el acceso.
    return { modo: cuentas.size > 0 ? "cuentas" : "sin-configurar", cuentas, errores };
  }

  const usuario = process.env.INTERNA_USUARIO;
  const clave = process.env.INTERNA_CLAVE;
  if (usuario && clave) {
    return { modo: "unica", cuentas: new Map(), errores: [], unica: { usuario, clave } };
  }
  return { modo: "sin-configurar", cuentas: new Map(), errores: [] };
}
