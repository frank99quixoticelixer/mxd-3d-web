"use client";

import { usePathname } from "next/navigation";

import { cerrarSesion } from "@/app/login/acciones";

/**
 * Cierra la sesion. Se oculta en /login, donde no hay sesion que cerrar.
 *
 * Es componente de cliente solo para leer la ruta; no recibe ni importa datos
 * del catalogo.
 */
export function BotonSalir() {
  const ruta = usePathname();
  if (ruta === "/login") return null;

  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className="rounded-lg border border-mxd-borde px-2 py-2 text-[13px] font-medium text-mxd-gris transition-colors hover:border-mxd-verde hover:text-mxd-verde-oscuro sm:px-3 sm:text-sm"
      >
        Salir
      </button>
    </form>
  );
}
