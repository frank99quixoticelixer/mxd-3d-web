import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CampoClave, ScriptVerClave } from "@/components/acceso/CampoClave";
import { BotonEnviar, ScriptCarga } from "@/components/acceso/BotonEnviar";
import { rutaSegura } from "@/lib/ruta-segura";
import { sesionActual } from "@/lib/sesion";

import { iniciarSesion } from "./acciones";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

/**
 * Mensajes por codigo de error. A proposito "el correo no existe" y "la
 * contrasena es incorrecta" dan el mismo mensaje. pendiente, rechazada y baja
 * solo salen cuando la contrasena fue correcta (ver acciones.ts).
 */
const MENSAJES: Record<string, string> = {
  credenciales: "Correo o contraseña incorrectos.",
  pendiente:
    "Tu solicitud de acceso sigue en revisión. Cuando un administrador la apruebe podrás entrar con esta misma contraseña.",
  rechazada:
    "Tu solicitud de acceso fue rechazada. Si crees que fue un error, o quieres intentarlo de nuevo, vuelve a solicitar acceso.",
  baja: "Tu cuenta fue dada de baja. Si necesitas volver a entrar, avisa a un administrador.",
  servicio: "No pudimos comprobar tu acceso en este momento. Inténtalo de nuevo en unos minutos.",
  "otra-sesion":
    "Ya hay una sesión abierta con otra cuenta en este navegador. Pulsa Salir antes de entrar con otra.",
  limite: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  config: "El acceso no está configurado en este servidor. Avisa al equipo.",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; siguiente?: string }>;
}) {
  const { error, siguiente } = await searchParams;
  const destino = rutaSegura(siguiente);

  // Quien ya tiene sesion no necesita el formulario.
  if (await sesionActual()) redirect(destino);

  const mensaje = error ? (MENSAJES[error] ?? MENSAJES.credenciales) : null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-mxd-tinta">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-mxd-gris">
          Panel interno MXD. Entra con tu cuenta del equipo.
        </p>
      </div>

      {/* Formulario HTML normal: no necesita JavaScript para enviarse. */}
      <form action={iniciarSesion} data-con-carga className="flex flex-col gap-4">
        <input type="hidden" name="siguiente" value={destino} />

        <label className="flex flex-col gap-1 text-sm font-medium text-mxd-tinta">
          Correo
          <input
            name="correo"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            autoFocus
            className="rounded-lg border border-mxd-borde bg-mxd-fondo px-3 py-2 text-base font-normal text-mxd-tinta"
          />
        </label>

        <CampoClave
          id="clave"
          name="clave"
          etiqueta="Contraseña"
          autoComplete="current-password"
        />

        {mensaje && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {mensaje}
          </p>
        )}

        <BotonEnviar texto="Entrar" textoCargando="Entrando…" />
      </form>
      <ScriptVerClave />
      <ScriptCarga />

      <p className="text-sm text-mxd-gris">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-mxd-verde-oscuro underline">
          Solicita acceso
        </Link>
      </p>
    </div>
  );
}
