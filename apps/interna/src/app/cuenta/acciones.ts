"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenerAuth } from "@/lib/auth";
import { accesoBloqueado, registrarAcierto, registrarFallo } from "@/lib/limite-acceso";
import { ipDelCliente } from "@/lib/protegido";
import { exigirSesion } from "@/lib/sesion";

/**
 * Cambia la contrasena de quien tiene la sesion abierta.
 *
 * Pide la contrasena ACTUAL aunque ya haya sesion: asi quien se encuentre un
 * navegador abierto no puede quedarse con la cuenta. Esa comprobacion cuenta
 * contra el mismo limite de intentos que el inicio de sesion (5 por cuenta, 20
 * por IP en 15 minutos), porque de otro modo seria otro lugar donde probar
 * contrasenas sin freno.
 *
 * Al cambiarla se cierran las demas sesiones de la cuenta (revokeOtherSessions):
 * si alguien mas la tenia abierta en otro lado, ya no entra. La de esta
 * persona sigue abierta.
 */
export async function cambiarClave(formData: FormData): Promise<void> {
  const volver = (error: string): never => redirect(`/cuenta?error=${error}`);

  const sesion = await exigirSesion();
  const auth = obtenerAuth();
  if (!auth) return volver("config");

  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repite = String(formData.get("repite") ?? "");

  // Largos acotados antes de gastar un hash de contrasena en una entrada absurda.
  if (!actual || actual.length > 128) return volver("actual");
  if (nueva.length < 12 || nueva.length > 128) return volver("corta");
  if (nueva !== repite) return volver("coinciden");
  if (nueva === actual) return volver("igual");

  const peticion = { headers: await headers() };
  const ip = ipDelCliente(peticion);
  const correo = sesion.user.email.toLowerCase();
  if (accesoBloqueado(ip, correo)) return volver("limite");

  let resultado: "ok" | "actual" | "servicio" = "ok";
  try {
    await auth.api.changePassword({
      body: { currentPassword: actual, newPassword: nueva, revokeOtherSessions: true },
      headers: peticion.headers,
    });
  } catch (e) {
    if (e instanceof APIError) {
      // La contrasena actual no coincide (los largos ya se validaron arriba).
      registrarFallo(ip, correo);
      resultado = "actual";
    } else {
      console.error("Fallo al cambiar la contrasena:", e);
      resultado = "servicio";
    }
  }

  // redirect() lanza una excepcion interna de Next: tiene que quedar fuera del try.
  if (resultado !== "ok") return volver(resultado);
  registrarAcierto(correo);
  redirect("/cuenta?ok=1");
}
