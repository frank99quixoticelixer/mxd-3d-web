"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Inicio", textoCorto: "Inicio" },
  { href: "/explorador", texto: "Explorador 3D", textoCorto: "3D" },
  { href: "/catalogo", texto: "Catálogo", textoCorto: "Catálogo" },
];

/** true si la ruta actual pertenece a la seccion del enlace (incluye subpaginas como /catalogo/slug). */
function esActivo(ruta: string, href: string): boolean {
  if (href === "/") return ruta === "/";
  return ruta === href || ruta.startsWith(`${href}/`);
}

/**
 * Menu del encabezado. La seccion en la que esta el usuario se resalta
 * en verde brillante con un resplandor, para que sepa donde se encuentra.
 */
export function NavegacionPrincipal() {
  const ruta = usePathname() ?? "/";

  return (
    <nav aria-label="Navegación principal">
      <ul className="flex items-center gap-1 sm:gap-2">
        {ENLACES.map((enlace) => {
          const activo = esActivo(ruta, enlace.href);
          return (
            <li key={enlace.href}>
              <Link
                href={enlace.href}
                aria-current={activo ? "page" : undefined}
                className={[
                  "block whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-medium transition-all sm:px-3 sm:text-sm",
                  activo
                    ? "bg-mxd-verde-acento font-semibold text-mxd-tinta shadow-[0_0_14px_rgba(34,197,94,0.65)]"
                    : "text-mxd-gris hover:bg-mxd-verde-claro hover:text-mxd-verde-oscuro",
                ].join(" ")}
              >
                <span className="sm:hidden">{enlace.textoCorto}</span>
                <span className="hidden sm:inline">{enlace.texto}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
