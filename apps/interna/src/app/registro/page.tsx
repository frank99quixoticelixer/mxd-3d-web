import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CampoClave, ScriptVerClave } from "@/components/acceso/CampoClave";
import { BotonEnviar, ScriptCarga } from "@/components/acceso/BotonEnviar";
import { CAMPO_TEXTO } from "@/components/acceso/estilos";
import { sesionActual } from "@/lib/sesion";

import { solicitarAcceso } from "./acciones";

export const metadata: Metadata = {
  title: "Solicitar acceso",
  robots: { index: false, follow: false },
};

/** Mensajes por codigo de error. Ninguno revela si un correo ya tiene cuenta. */
const MENSAJES: Record<string, string> = {
  datos: "Revisa tus datos: nombre, empresa y un correo válido.",
  clave: "La contraseña debe tener entre 12 y 128 caracteres.",
  coinciden: "Las contraseñas no coinciden.",
  limite: "Demasiadas solicitudes desde esta conexión. Inténtalo más tarde.",
  lleno: "Por ahora no estamos recibiendo más solicitudes. Avisa al equipo.",
  config: "El acceso no está configurado en este servidor. Avisa al equipo.",
  servicio: "No pudimos guardar tu solicitud en este momento. Inténtalo de nuevo en unos minutos.",
};

const CAMPO = CAMPO_TEXTO;

export default async function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  // Quien ya tiene sesion no necesita pedir acceso.
  if (await sesionActual()) redirect("/");

  if (enviado) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold text-mxd-tinta">Solicitud recibida</h1>
        <p className="text-sm text-mxd-gris">
          Un administrador la revisará. Cuando la apruebe podrás entrar con tu
          correo y la contraseña que elegiste. Si todavía no te deja entrar, aún
          no ha sido aprobada.
        </p>
        <Link href="/login" className="text-sm font-medium text-mxd-verde-oscuro underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  const mensaje = error ? (MENSAJES[error] ?? MENSAJES.servicio) : null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-mxd-tinta">Solicitar acceso</h1>
        <p className="mt-1 text-sm text-mxd-gris">
          Panel interno MXD. Un administrador revisa cada solicitud antes de dar
          acceso.
        </p>
      </div>

      {/* Formulario HTML normal: no necesita JavaScript para enviarse. */}
      <form action={solicitarAcceso} data-con-carga className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-mxd-tinta">
          Nombre completo
          <input name="nombre" type="text" autoComplete="name" required maxLength={100} autoFocus className={CAMPO} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-mxd-tinta">
          Empresa
          <input name="empresa" type="text" autoComplete="organization" required maxLength={120} className={CAMPO} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-mxd-tinta">
          Correo
          <input name="correo" type="email" autoComplete="username" required maxLength={254} className={CAMPO} />
        </label>

        <CampoClave
          id="clave"
          name="clave"
          etiqueta="Contraseña"
          autoComplete="new-password"
          minLength={12}
          ayuda="12 caracteres o más."
        />

        <CampoClave
          id="repite"
          name="repite"
          etiqueta="Repite la contraseña"
          autoComplete="new-password"
          minLength={12}
        />

        {/* Campo trampa: una persona no lo ve ni lo llena; un bot si. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            No llenes este campo
            <input name="sitio_web" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {mensaje && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {mensaje}
          </p>
        )}

        <BotonEnviar texto="Enviar solicitud" textoCargando="Enviando…" />

        <p className="text-xs text-mxd-gris">
          Usamos tus datos solo para decidir si te damos acceso al panel. Si tu
          solicitud se rechaza, puedes volver a enviarla. Para que borremos tus
          datos, pídeselo a un administrador.
        </p>
      </form>
      <ScriptVerClave />
      <ScriptCarga />

      <p className="text-sm text-mxd-gris">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-mxd-verde-oscuro underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
