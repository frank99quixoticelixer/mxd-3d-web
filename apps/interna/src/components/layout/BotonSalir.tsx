"use client";

import { usePathname } from "next/navigation";

/**
 * Cierra la sesion. Se oculta en /login y /registro, donde no hay sesion que cerrar.
 *
 * Es un formulario HTML hacia /salir (recarga de pagina completa), no una
 * accion de servidor: ver app/salir/route.ts.
 *
 * Es componente de cliente solo para leer la ruta; no recibe ni importa datos
 * del catalogo.
 */
export function BotonSalir() {
  const ruta = usePathname();
  if (ruta === "/login" || ruta === "/registro") return null;

  return (
    <form method="post" action="/salir">
      <button
        type="submit"
        className="rounded-lg border border-mxd-borde px-2 py-2 text-[13px] font-medium text-mxd-gris transition-colors hover:border-mxd-verde hover:text-mxd-verde-oscuro sm:px-3 sm:text-sm"
      >
        Salir
      </button>
    </form>
  );
}
