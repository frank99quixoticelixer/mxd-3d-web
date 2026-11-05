import Image from "next/image";
import Link from "next/link";

import { MARCA } from "@/config/marca";
import { NavegacionPrincipal } from "./NavegacionPrincipal";
import { SelectorTema } from "./SelectorTema";

export function Encabezado() {
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
          <NavegacionPrincipal />
          <SelectorTema />
        </div>
      </div>
    </header>
  );
}
