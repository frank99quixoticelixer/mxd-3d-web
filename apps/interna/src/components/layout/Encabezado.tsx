import Image from "next/image";
import Link from "next/link";

import { MARCA } from "@/config/marca";
import { sesionActual } from "@/lib/sesion";
import { BotonSalir } from "./BotonSalir";
import { NavegacionPrincipal } from "./NavegacionPrincipal";
import { OcultarEnRutaPublica } from "./OcultarEnRutaPublica";
import { SelectorTema } from "./SelectorTema";

type UsuarioEncabezado = { nombre: string; correo: string; esAdmin: boolean };

/** Quien mira, o null si no hay sesion o no se puede leer. */
async function usuarioActual(): Promise<UsuarioEncabezado | null> {
  try {
    const sesion = await sesionActual();
    if (!sesion) return null;
    return {
      nombre: sesion.user.name,
      correo: sesion.user.email,
      esAdmin: Boolean(sesion.user.esAdmin),
    };
  } catch {
    return null;
  }
}

export async function Encabezado() {
  const usuario = await usuarioActual();
  const esAdmin = usuario?.esAdmin ?? false;
  return (
    // "sticky" + desenfoque es de lo mas caro para el navegador: tiene que
    // recalcular el blur en cada cuadro de scroll, porque lo que hay DEBAJO
    // del header cambia todo el tiempo. backdrop-blur-sm (mitad del radio
    // de "backdrop-blur") corta buena parte de ese costo, y en una franja
    // tan delgada como el header casi no se nota la diferencia.
    <header className="sticky top-0 z-50 border-b border-mxd-borde bg-mxd-fondo/85 backdrop-blur-sm">
      {/* Ancho completo: el logo queda pegado al borde izquierdo de la pagina. */}
      <div className="flex h-20 w-full items-center justify-between gap-4 pl-2 pr-4 sm:h-24 sm:pl-4 sm:pr-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label={`${MARCA.nombreLargo} — inicio`}
        >
          {/*
            El logo se lee de public/brand/logo-mxd.svg.
            Sustituye ese archivo por el oficial y no hace falta tocar codigo.
          */}
          <Image
            src={MARCA.logo.src}
            alt={MARCA.logo.alt}
            width={220}
            height={MARCA.logo.altoHeader}
            priority
            unoptimized
            className="h-16 w-auto sm:h-20"
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* En /login y /registro no hay sesion: el menu y el BOM no sirven. */}
          <OcultarEnRutaPublica>
            <NavegacionPrincipal esAdmin={esAdmin} />
          </OcultarEnRutaPublica>
          {/* Descarga el BOM_MX80.xlsx tal como esta en el servidor en este
              momento -- el mismo archivo que edita el formulario de cada
              ficha. Va en el encabezado, no dentro de una pieza especifica,
              porque es un archivo del catalogo entero. */}
          <OcultarEnRutaPublica>
            <a
              href="/api/bom/descargar"
              className="rounded-lg border border-mxd-borde px-2 py-2 text-[13px] font-medium text-mxd-gris transition-colors hover:border-mxd-verde hover:text-mxd-verde-oscuro sm:px-3 sm:text-sm"
            >
              <span className="sm:hidden">BOM</span>
              <span className="hidden sm:inline">Descargar BOM</span>
            </a>
          </OcultarEnRutaPublica>
          <SelectorTema />
          {usuario && (
            <OcultarEnRutaPublica>
              {/* Quien esta dentro, y la puerta a su cuenta (cambiar contrasena). */}
              <Link
                href="/cuenta"
                title={usuario.correo}
                aria-label={`Mi cuenta: ${usuario.nombre}`}
                className="flex items-center gap-2 rounded-lg border border-mxd-borde px-1.5 py-1.5 transition-colors hover:border-mxd-verde sm:px-2"
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-full bg-mxd-verde-acento text-xs font-bold uppercase text-mxd-tinta"
                >
                  {usuario.nombre.trim().charAt(0) || "?"}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-mxd-tinta lg:inline">
                  {usuario.nombre}
                </span>
              </Link>
            </OcultarEnRutaPublica>
          )}
          <BotonSalir />
        </div>
      </div>
    </header>
  );
}
