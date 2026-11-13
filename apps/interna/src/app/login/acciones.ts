"use server";

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
 * Cualquier falla vuelve a /login con el mismo mensaje generico: no se dice si
 * el correo existe, si la cuenta esta inactiva o si la contrasena fallo.
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

  let entro = false;
  try {
    await auth.api.signInEmail({
      body: { email: correo, password: clave },
      headers: peticion.headers,
    });
    entro = true;
  } catch {
    registrarFallo(ip, correo);
  }

  // redirect() lanza una excepcion interna de Next: tiene que quedar fuera del try.
  if (!entro) return volver("credenciales");
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
