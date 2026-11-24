/**
 * Reconoce un error que Better Auth lanza a proposito (contrasena incorrecta,
 * cuenta inactiva...), distinto de una falla de la base de datos o del servidor.
 *
 * NO usar `instanceof APIError`: en el build de produccion el paquete queda
 * cargado en dos copias y la clase que lanza Better Auth no es la que se importa
 * aqui, asi que `instanceof` da false. Se vio en el log de interna el 2026-11-23:
 * "Fallo al iniciar sesion (no es de credenciales): APIError: Invalid email or
 * password". Toda contrasena mala caia en "falla del servidor", no contaba para
 * el limite de intentos y la cuenta inactiva salia con el mensaje equivocado.
 * En desarrollo hay una sola copia y funcionaba, por eso no se noto antes.
 */
export interface ErrorDeApi {
  name: "APIError";
  /** "UNAUTHORIZED", "FORBIDDEN", "BAD_REQUEST"... */
  status: string;
  message: string;
  body?: { message?: string };
}

export function esErrorDeApi(e: unknown): e is ErrorDeApi {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: unknown }).name === "APIError" &&
    typeof (e as { status?: unknown }).status === "string"
  );
}
