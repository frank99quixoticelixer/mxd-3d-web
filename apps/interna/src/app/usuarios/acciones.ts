"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { obtenerPool } from "@/lib/db";
import { exigirAdmin } from "@/lib/sesion";

/**
 * Gestion de cuentas (ADR 0007). Solo administradores.
 *
 * Cada accion vuelve a comprobar en la base que quien la llama es un
 * administrador activo (exigirAdmin), sin fiarse de la cookie. Terminan con un
 * redirect a /usuarios?aviso=<codigo> para que funcionen sin JavaScript.
 *
 * Salvaguardas para que el sitio no se quede sin nadie que lo administre:
 * - nadie se desactiva, rechaza, borra ni quita la marca a si mismo;
 * - no se puede desactivar ni quitar la marca al ultimo administrador activo.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

function terminar(aviso: string): never {
  revalidatePath("/usuarios");
  redirect(`/usuarios?aviso=${aviso}`);
}

async function contexto(formData: FormData) {
  const sesion = await exigirAdmin();
  const pool = obtenerPool();
  if (!pool) throw new Error("Falta configuracion de la base de datos.");
  const id = String(formData.get("id") ?? "");
  if (!ID_VALIDO.test(id)) terminar("invalido");
  return { pool, id, yo: sesion.user.id };
}

async function administradoresActivos(pool: NonNullable<ReturnType<typeof obtenerPool>>) {
  const [f] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM `user` WHERE activo = 1 AND esAdmin = 1",
  );
  return Number(f[0]?.n ?? 0);
}

async function esAdminActivo(pool: NonNullable<ReturnType<typeof obtenerPool>>, id: string) {
  const [f] = await pool.query<RowDataPacket[]>(
    "SELECT activo, esAdmin FROM `user` WHERE id = ? LIMIT 1",
    [id],
  );
  return Boolean(f[0]?.activo && f[0]?.esAdmin);
}

/** Activa una cuenta inactiva: aprueba una solicitud o repone a alguien dado de baja. */
export async function activarCuenta(formData: FormData): Promise<void> {
  const { pool, id } = await contexto(formData);
  await pool.query("UPDATE `user` SET activo = 1, estado = 'activa' WHERE id = ?", [id]);
  terminar("activada");
}

/** Desactiva una cuenta y cierra sus sesiones abiertas. */
export async function desactivarCuenta(formData: FormData): Promise<void> {
  const { pool, id, yo } = await contexto(formData);
  if (id === yo) terminar("ti-mismo");
  if ((await esAdminActivo(pool, id)) && (await administradoresActivos(pool)) <= 1) {
    terminar("ultimo-admin");
  }
  await pool.query("UPDATE `user` SET activo = 0, estado = 'baja' WHERE id = ?", [id]);
  await pool.query("DELETE FROM `session` WHERE userId = ?", [id]);
  terminar("desactivada");
}

/**
 * Rechaza una solicitud PENDIENTE: la cuenta se queda, marcada "rechazada". Asi,
 * cuando la persona intente entrar, el login le dice que fue rechazada y que
 * puede volver a solicitar (registro/acciones.ts la reabre). Solo aplica a
 * solicitudes pendientes de quien no es administrador.
 */
export async function rechazarSolicitud(formData: FormData): Promise<void> {
  const { pool, id, yo } = await contexto(formData);
  if (id === yo) terminar("ti-mismo");
  const [r] = await pool.query(
    "UPDATE `user` SET estado = 'rechazada' WHERE id = ? AND activo = 0 AND esAdmin = 0 AND (estado IS NULL OR estado = 'pendiente')",
    [id],
  );
  if (!("affectedRows" in r) || r.affectedRows === 0) terminar("no-aplica");
  terminar("rechazada");
}

/**
 * Borra una cuenta INACTIVA que no sea de administrador (una solicitud rechazada
 * o una baja): sus datos desaparecen. Para quien pide que se borren sus datos.
 */
export async function borrarCuenta(formData: FormData): Promise<void> {
  const { pool, id, yo } = await contexto(formData);
  if (id === yo) terminar("ti-mismo");
  const [f] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM `user` WHERE id = ? AND activo = 0 AND esAdmin = 0 LIMIT 1",
    [id],
  );
  if (!f[0]) terminar("no-aplica");
  await pool.query("DELETE FROM `session` WHERE userId = ?", [id]);
  await pool.query("DELETE FROM `account` WHERE userId = ?", [id]);
  await pool.query("DELETE FROM `user` WHERE id = ? AND activo = 0 AND esAdmin = 0", [id]);
  terminar("borrada");
}

/** Da o quita la marca de administrador. */
export async function cambiarAdministrador(formData: FormData): Promise<void> {
  const { pool, id, yo } = await contexto(formData);
  const hacer = String(formData.get("admin") ?? "") === "1";
  if (!hacer) {
    if (id === yo) terminar("ti-mismo");
    if ((await esAdminActivo(pool, id)) && (await administradoresActivos(pool)) <= 1) {
      terminar("ultimo-admin");
    }
  }
  await pool.query("UPDATE `user` SET esAdmin = ? WHERE id = ?", [hacer ? 1 : 0, id]);
  terminar(hacer ? "admin-dado" : "admin-quitado");
}
