import { headers } from "next/headers";

import { obtenerAuth } from "@/lib/auth";

/**
 * La sesion de quien hace la peticion, o null.
 *
 * proxy.ts ya cierra todo el sitio, pero las acciones que escriben (editar el
 * BOM) vuelven a comprobar aqui: si algun dia se cambia el matcher del proxy o
 * se llama a una accion por otro camino, la escritura sigue sin pasar sin
 * cuenta. Es la segunda puerta.
 */
export async function sesionActual() {
  const auth = obtenerAuth();
  if (!auth) return null;
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion || sesion.user.activo === false) return null;
  return sesion;
}

/** Como sesionActual, pero lanza si no hay sesion. Para acciones que escriben. */
export async function exigirSesion() {
  const sesion = await sesionActual();
  if (!sesion) throw new Error("Se requiere iniciar sesion.");
  return sesion;
}
