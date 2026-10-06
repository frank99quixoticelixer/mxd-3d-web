import Image from "next/image";
import Link from "next/link";

import { MARCA } from "@/config/marca";
import { NavegacionPrincipal } from "./NavegacionPrincipal";

export function Encabezado() {
  return (
    <header className="sticky top-0 z-50 border-b border-mxd-borde bg-white/85 backdrop-blur">
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

        <NavegacionPrincipal />
      </div>
    </header>
  );
}
