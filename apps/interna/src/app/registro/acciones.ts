"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { obtenerAuth } from "@/lib/auth";
import { obtenerPool } from "@/lib/db";
import { registrarSolicitud, solicitudesAgotadas } from "@/lib/limite-acceso";
import { ipDelCliente } from "@/lib/protegido";

/**
 * Solicitud de acceso (ADR 0007). Es la UNICA accion que escribe en la base sin
 * sesion, asi que va acotada por todos lados:
 *
 * - campo trampa: un bot llena "sitio_web"; una persona no lo ve;
 * - 5 solicitudes por IP por hora (lib/limite-acceso.ts);
 * - tope de solicitudes pendientes, para que nadie llene la tabla;
 * - largos maximos en todos los campos, antes de gastar un hash.
 *
 * La cuenta nace INACTIVA (activo = false) y sin marca de administrador. Se crea
 * con el adaptador interno, igual que scripts/usuarios.ts, y no con la ruta de
 * registro de Better Auth, que sigue cerrada: asi ningun campo del formulario
 * puede fijar `activo` ni `esAdmin`.
 *
 * La respuesta es la misma exista o no el correo. Con un correo ya registrado no
 * cambia nada (ni la contrasena, ni el estado), SALVO que su solicitud anterior
 * haya sido rechazada: entonces se vuelve a abrir con los datos nuevos, que es
 * lo que el login le invita a hacer. Una cuenta activa, pendiente o dada de baja
 * no se toca desde aqui.
 */

const MAXIMO_PENDIENTES = 100;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function solicitarAcceso(formData: FormData): Promise<void> {
  const volver = (error: string): never => redirect(`/registro?error=${error}`);

  // Campo trampa: se finge exito para no darle pistas al bot.
  if (String(formData.get("sitio_web") ?? "") !== "") redirect("/registro?enviado=1");

  const auth = obtenerAuth();
  const pool = obtenerPool();
  if (!auth || !pool) return volver("config");

  const ip = ipDelCliente({ headers: await headers() });
  if (solicitudesAgotadas(ip)) return volver("limite");
  registrarSolicitud(ip);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const empresa = String(formData.get("empresa") ?? "").trim();
  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  const clave = String(formData.get("clave") ?? "");
  const repite = String(formData.get("repite") ?? "");

  if (
    !nombre || nombre.length > 100 ||
    !empresa || empresa.length > 120 ||
    !correo || correo.length > 254 || !CORREO_VALIDO.test(correo)
  ) {
    return volver("datos");
  }
  if (clave.length < 12 || clave.length > 128) return volver("clave");
  if (clave !== repite) return volver("coinciden");

  try {
    const [pendientes] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM `user` WHERE activo = 0 AND (estado IS NULL OR estado = 'pendiente')",
    );
    if (Number(pendientes[0]?.n ?? 0) >= MAXIMO_PENDIENTES) return volver("lleno");

    const ctx = await auth.$context;
    // Se hace el hash siempre, exista o no el correo, para que el tiempo de
    // respuesta no delate que correos tienen cuenta.
    const hash = await ctx.password.hash(clave);

    const existente = await ctx.internalAdapter.findUserByEmail(correo);
    if (existente) {
      const u = existente.user as { id: string; activo?: boolean; estado?: string | null };
      if (!u.activo && u.estado === "rechazada") {
        // Segunda oportunidad: vuelve a "pendiente" con los datos y la
        // contrasena nuevos.
        await pool.query(
          "UPDATE `user` SET name = ?, empresa = ?, estado = 'pendiente', updatedAt = NOW(3) WHERE id = ? AND activo = 0 AND estado = 'rechazada'",
          [nombre, empresa, u.id],
        );
        await pool.query(
          "UPDATE `account` SET password = ?, updatedAt = NOW(3) WHERE userId = ? AND providerId = 'credential'",
          [hash, u.id],
        );
      }
    } else {
      const usuario = await ctx.internalAdapter.createUser(
        {
          email: correo,
          name: nombre,
          emailVerified: false,
          activo: false,
          esAdmin: false,
          empresa,
          estado: "pendiente",
        },
        { method: "email-password" },
      );
      await ctx.internalAdapter.linkAccount({
        userId: usuario.id,
        providerId: "credential",
        accountId: usuario.id,
        password: hash,
      });
    }
  } catch (e) {
    // Un volver("lleno") de arriba lanza la excepcion interna de redirect():
    // se deja pasar, no es una falla.
    unstable_rethrow(e);
    console.error("Fallo al guardar una solicitud de acceso:", e);
    return volver("servicio");
  }

  redirect("/registro?enviado=1");
}
