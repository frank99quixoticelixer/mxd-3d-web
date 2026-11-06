"use client";

import { useState } from "react";

import { IconoAccesorio } from "./IconoAccesorio";

export interface ItemPanelAccesorios {
  /** null = el MX80 completo (no es un accesorio). */
  id: string | null;
  nombre: string;
}

/**
 * Riel debajo del visor: un boton "Equipo adicional" que al hacer clic
 * despliega las opciones (el MX80 completo y cada accesorio que se vende
 * con el), cada una con su icono (ver IconoAccesorio.tsx) y resaltada al
 * pasar el mouse encima.
 */
export function PanelAccesorios({
  items,
  activo,
  onSeleccionar,
}: {
  items: ItemPanelAccesorios[];
  activo: string | null;
  onSeleccionar: (id: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-mxd-borde bg-mxd-fondo px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-mxd-gris transition-colors hover:border-mxd-verde hover:text-mxd-verde sm:w-auto"
      >
        Equipo adicional
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            abierto ? "rotate-180" : ""
          }`}
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className={`grid overflow-hidden transition-all duration-200 ${
          abierto ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <nav
          aria-label="Accesorios del MX80"
          className="flex min-h-0 flex-wrap gap-1.5 overflow-hidden"
        >
          {items.map((item) => {
            const seleccionado = item.id === activo;
            return (
              <button
                key={item.id ?? "mx80"}
                type="button"
                aria-current={seleccionado ? "true" : undefined}
                onClick={() => onSeleccionar(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  seleccionado
                    ? "bg-mxd-verde text-white"
                    : "border border-mxd-borde bg-mxd-fondo text-mxd-tinta hover:border-mxd-verde hover:bg-mxd-verde-claro hover:text-mxd-verde-oscuro"
                }`}
              >
                <IconoAccesorio id={item.id} className="h-5 w-5 shrink-0" />
                {item.nombre}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
