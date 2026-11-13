import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { rutaSegura } from "@/lib/ruta-segura";
import { sesionActual } from "@/lib/sesion";

import { iniciarSesion } from "./acciones";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

/**
 * Mensajes por codigo de error. A proposito no distinguen entre "el correo no
 * existe", "la cuenta esta inactiva" y "la contrasena es incorrecta".
 */
const MENSAJES: Record<string, string> = {
  credenciales: "Correo o contraseña incorrectos.",
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
      <form action={iniciarSesion} className="flex flex-col gap-4">
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

        <label className="flex flex-col gap-1 text-sm font-medium text-mxd-tinta">
          Contraseña
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            className="rounded-lg border border-mxd-borde bg-mxd-fondo px-3 py-2 text-base font-normal text-mxd-tinta"
          />
        </label>

        {mensaje && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {mensaje}
          </p>
        )}

        <button
          type="submit"
          className="rounded-lg bg-mxd-verde-acento px-4 py-2 text-base font-semibold text-mxd-tinta transition-opacity hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
