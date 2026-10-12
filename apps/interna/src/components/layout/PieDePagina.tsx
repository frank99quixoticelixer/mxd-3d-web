import Link from "next/link";

import { MARCA } from "@/config/marca";

export function PieDePagina() {
  const anio = new Date().getFullYear();

  return (
    <footer className="border-t border-mxd-borde bg-mxd-hueso">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold tracking-tight text-mxd-tinta">
            {MARCA.nombreLargo}
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-mxd-gris">
            {MARCA.descripcion}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-mxd-gris">
            Navegación
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/explorador" className="text-mxd-tinta hover:text-mxd-verde">
                Explorador 3D
              </Link>
            </li>
            <li>
              <Link href="/catalogo" className="text-mxd-tinta hover:text-mxd-verde">
                Catálogo de componentes
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-mxd-gris">
            Contacto
          </p>
          <ul className="mt-3 space-y-2 text-sm text-mxd-tinta">
            <li>{MARCA.contacto.representante}</li>
            <li>
              <a
                href={`tel:${MARCA.contacto.telefono.replace(/\s/g, "")}`}
                className="hover:text-mxd-verde"
              >
                {MARCA.contacto.telefono}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${MARCA.contacto.correo}`}
                className="hover:text-mxd-verde"
              >
                {MARCA.contacto.correo}
              </a>
            </li>
            <li className="flex gap-4 pt-1">
              <a
                href={`https://www.facebook.com/search/top?q=${encodeURIComponent(MARCA.contacto.facebook)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mxd-gris hover:text-mxd-verde"
              >
                Facebook
              </a>
              <a
                href={`https://www.instagram.com/${MARCA.contacto.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mxd-gris hover:text-mxd-verde"
              >
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mxd-divisor" />

      <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-mxd-gris sm:px-6">
        <p>
          © {anio} {MARCA.nombreLargo}. Catálogo técnico de referencia. Las
          especificaciones marcadas como pendientes aún no han sido verificadas.
        </p>
      </div>
    </footer>
  );
}
