"use client";

import { useFormStatus } from "react-dom";

import { BOTON_PRINCIPAL, GIRANDO } from "./estilos";

/**
 * Boton de envio con circulo que gira mientras la accion de servidor responde,
 * para paginas CON sesion (que si cargan React), como /cuenta. Para /login y
 * /registro, que no cargan JavaScript, esta BotonEnviar.
 */
export function BotonEnviarEstado({
  texto,
  textoCargando,
}: {
  texto: string;
  textoCargando: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${BOTON_PRINCIPAL} inline-flex items-center justify-center gap-2 disabled:cursor-progress disabled:opacity-85`}
    >
      {pending && <span aria-hidden="true" className={GIRANDO} />}
      {pending ? textoCargando : texto}
    </button>
  );
}
