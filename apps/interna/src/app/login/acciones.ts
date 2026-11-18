"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenerAuth } from "@/lib/auth";
import { accesoBloqueado, registrarAcierto, registrarFallo } from "@/lib/limite-acceso";
import { ipDelCliente } from "@/lib/protegido";
import { rutaSegura } from "@/lib/ruta-segura";

/**
 * Inicia sesion con correo y contrasena.
 *
 * Es un formulario HTML normal que apunta a esta accion: funciona aunque el
 * JavaScript de la pagina no haya cargado, que es el caso de /login (el proxy
 * deja pasar el CSS y nada de los chunks JS, ver proxy.ts).
 *
 * Un correo inexistente y una contrasena incorrecta dan el MISMO mensaje: no se
 * dice si el correo existe. La cuenta inactiva (pendiente de aprobacion o dada
 * de baja) y la falla del servidor tienen mensaje propio, y ninguna de las dos
 * cuenta contra el limite de intentos. La inactiva solo se muestra cuando la
 * contrasena fue correcta.
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

  const peticion = { headers: await headers() };
  const ip = ipDelCliente(peticion);
  if (accesoBloqueado(ip, correo)) return volver("limite");

  let resultado: "entro" | "credenciales" | "inactiva" | "servicio" = "entro";
  try {
    await auth.api.signInEmail({
      body: { email: correo, password: clave },
      headers: peticion.headers,
    });
  } catch (e) {
    if (e instanceof APIError && e.status === "FORBIDDEN") {
      // Solo llega aqui si la contrasena era correcta: el hook de sesion de
      // lib/auth.ts rechaza la cuenta con activo = 0 despues de verificarla.
      // Decirlo no revela si un correo existe a quien no tiene su contrasena.
      resultado = "inactiva";
    } else if (e instanceof APIError) {
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

/** Cierra la sesion de este navegador y vuelve al formulario. */
export async function cerrarSesion(): Promise<void> {
  const auth = obtenerAuth();
  if (auth) {
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // Sin sesion valida no hay nada que cerrar.
    }
  }
  redirect("/login");
}
