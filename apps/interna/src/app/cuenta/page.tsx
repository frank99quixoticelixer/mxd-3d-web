import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampoClave, ScriptVerClave } from "@/components/acceso/CampoClave";
import { BotonEnviarEstado } from "@/components/acceso/BotonEnviarEstado";
import { sesionActual } from "@/lib/sesion";

import { cambiarClave } from "./acciones";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

// Depende de quien mira: nunca se prerenderiza.
export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  actual: "La contraseña actual no es correcta.",
  corta: "La contraseña nueva debe tener entre 12 y 128 caracteres.",
  coinciden: "Las contraseñas nuevas no coinciden.",
  igual: "La contraseña nueva debe ser distinta de la actual.",
  limite: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  config: "El acceso no está configurado en este servidor. Avisa al equipo.",
  servicio: "No pudimos cambiar tu contraseña en este momento. Inténtalo de nuevo en unos minutos.",
};

export default async function PaginaCuenta({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sesion = await sesionActual();
  if (!sesion) notFound();

  const { error, ok } = await searchParams;
  const mensaje = error ? (MENSAJES[error] ?? MENSAJES.servicio) : null;
  const { name, email } = sesion.user;
  const empresa = (sesion.user as { empresa?: string | null }).empresa;
  const esAdmin = Boolean(sesion.user.esAdmin);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-mxd-tinta">Mi cuenta</h1>
        <dl className="mt-4 rounded-xl border border-mxd-borde bg-mxd-fondo px-4 text-sm">
          <div className="flex justify-between gap-4 border-b border-mxd-borde py-2.5">
            <dt className="text-mxd-gris">Nombre</dt>
            <dd className="text-right font-medium text-mxd-tinta">{name}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-mxd-borde py-2.5">
            <dt className="text-mxd-gris">Correo</dt>
            <dd className="break-all text-right font-medium text-mxd-tinta">{email}</dd>
          </div>
          {empresa && (
            <div className="flex justify-between gap-4 border-b border-mxd-borde py-2.5">
              <dt className="text-mxd-gris">Empresa</dt>
              <dd className="text-right font-medium text-mxd-tinta">{empresa}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-mxd-gris">Rol</dt>
            <dd className="font-medium text-mxd-tinta">{esAdmin ? "Administrador" : "Usuario"}</dd>
          </div>
        </dl>
      </div>

      <section aria-labelledby="cambiar-clave">
        <h2 id="cambiar-clave" className="text-lg font-semibold text-mxd-tinta">
          Cambiar contraseña
        </h2>
        <p className="mt-1 text-sm text-mxd-gris">
          Al cambiarla se cierran tus sesiones en otros dispositivos; esta sigue abierta.
        </p>

        {ok && (
          <p role="status" className="mt-4 rounded-lg border border-mxd-borde bg-mxd-verde-claro px-3 py-2 text-sm font-medium text-mxd-verde-oscuro">
            Contraseña actualizada.
          </p>
        )}

        {/* Formulario HTML normal: no necesita JavaScript para enviarse. */}
        <form action={cambiarClave} className="mt-4 flex flex-col gap-4">
          <CampoClave id="actual" name="actual" etiqueta="Contraseña actual" autoComplete="current-password" />
          <CampoClave
            id="nueva"
            name="nueva"
            etiqueta="Contraseña nueva"
            autoComplete="new-password"
            minLength={12}
            ayuda="12 caracteres o más."
          />
          <CampoClave
            id="repite"
            name="repite"
            etiqueta="Repite la contraseña nueva"
            autoComplete="new-password"
            minLength={12}
          />

          {mensaje && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {mensaje}
            </p>
          )}

          <BotonEnviarEstado texto="Cambiar contraseña" textoCargando="Cambiando…" />
        </form>
        <ScriptVerClave />
      </section>
    </div>
  );
}
