"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenerAuth } from "@/lib/auth";
import { esErrorDeApi } from "@/lib/error-auth";
import { accesoBloqueado, registrarAcierto, registrarFallo } from "@/lib/limite-acceso";
import { ipDelCliente } from "@/lib/protegido";
import { rutaSegura } from "@/lib/ruta-segura";
import { sesionActual } from "@/lib/sesion";

/**
 * Inicia sesion con correo y contrasena.
 *
 * Es un formulario HTML normal que apunta a esta accion: funciona aunque el
 * JavaScript de la pagina no haya cargado, que es el caso de /login (el proxy
 * deja pasar el CSS y nada de los chunks JS, ver proxy.ts).
 *
 * Un correo inexistente y una contrasena incorrecta dan el MISMO mensaje: no se
 * dice si el correo existe. La cuenta inactiva (solicitud pendiente, rechazada
 * o dada de baja) y la falla del servidor tienen mensaje propio, y ninguna
 * cuenta contra el limite de intentos. Los de la cuenta solo se muestran cuando
 * la contrasena fue correcta.
 */
export async function iniciarSesion(formData: FormData): Promise<void> {
  const siguiente = rutaSegura(formData.get("siguiente"));
  const volver = (error: string): never =>
    redirect(`/login?error=${error}&siguiente=${encodeURIComponent(siguiente)}`);

  const auth = obtenerAuth();
  if (!auth) return volver("config");

  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  const clave = String(formData.get("clave") ?? "");
  // Largos acotados antes de gastar un hash de contrasena en una entrada absurda.
  if (!correo || correo.length > 254 || !clave || clave.length > 128) {
    return volver("credenciales");
  }

  // Una pestana con /login abierto desde antes sigue mostrando el formulario
  // aunque otra pestana ya haya entrado. Con sesion abierta no se crea otra:
  // la misma cuenta pasa de largo, otra cuenta debe salir primero.
  const abierta = await sesionActual();
  if (abierta) {
    if (abierta.user.email.toLowerCase() === correo) redirect(siguiente);
    return volver("otra-sesion");
  }

  const peticion = { headers: await headers() };
  const ip = ipDelCliente(peticion);
  if (accesoBloqueado(ip, correo)) return volver("limite");

  let resultado:
    | "entro"
    | "credenciales"
    | "pendiente"
    | "rechazada"
    | "baja"
    | "servicio" = "entro";
  try {
    await auth.api.signInEmail({
      body: { email: correo, password: clave },
      headers: peticion.headers,
    });
  } catch (e) {
    if (esErrorDeApi(e) && e.status === "FORBIDDEN") {
      // Solo llega aqui si la contrasena era correcta: el hook de sesion de
      // lib/auth.ts rechaza la cuenta con activo = 0 despues de verificarla.
      // Decirlo no revela si un correo existe a quien no tiene su contrasena.
      const motivo = String((e.body as { message?: string } | undefined)?.message ?? e.message);
      resultado = motivo.endsWith(":rechazada")
        ? "rechazada"
        : motivo.endsWith(":baja")
          ? "baja"
          : "pendiente";
    } else if (esErrorDeApi(e)) {
      // Correo inexistente, contrasena incorrecta o correo mal formado.
      registrarFallo(ip, correo);
      resultado = "credenciales";
    } else {
      // Falla de la base de datos u otra cosa que no es culpa de quien escribe:
      // no cuenta contra su limite de intentos.
      console.error("Fallo al iniciar sesion (no es de credenciales):", e);
      resultado = "servicio";
    }
  }

  // redirect() lanza una excepcion interna de Next: tiene que quedar fuera del try.
  if (resultado !== "entro") return volver(resultado);
  registrarAcierto(correo);
  redirect(siguiente);
}
