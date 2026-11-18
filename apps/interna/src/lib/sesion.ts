import { headers } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";

import { obtenerAuth } from "@/lib/auth";
import { obtenerPool } from "@/lib/db";

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

/**
 * Como exigirSesion, pero solo deja pasar a un administrador activo (ADR 0007).
 *
 * A diferencia de la sesion, que viaja firmada en la cookie y se valida hasta 60
 * segundos sin ir a la base, esto SI consulta la base: quitarle la marca a un
 * administrador o desactivarlo debe surtir efecto en la siguiente accion, no un
 * minuto despues. Las acciones de /usuarios son poco frecuentes, asi que la
 * consulta no pesa.
 */
export async function exigirAdmin() {
  const sesion = await exigirSesion();
  const pool = obtenerPool();
  if (!pool) throw new Error("Falta configuracion de la base de datos.");
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT activo, esAdmin FROM `user` WHERE id = ? LIMIT 1",
    [sesion.user.id],
  );
  if (!filas[0] || !filas[0].activo || !filas[0].esAdmin) {
    throw new Error("Se requiere ser administrador.");
  }
  return sesion;
}
