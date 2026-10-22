"use client";

import { useSyncExternalStore, type ReactElement } from "react";

import {
  cambiarTema,
  leerTemaGuardado,
  leerTemaServidor,
  suscribirseATema,
  type Tema,
} from "@/lib/tema";

function IconoSol(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconoLuna(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
}

function IconoAutomatico(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </svg>
  );
}

const OPCIONES: ReadonlyArray<{ valor: Tema; etiqueta: string; Icono: () => ReactElement }> = [
  { valor: "claro", etiqueta: "Claro", Icono: IconoSol },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: IconoLuna },
  { valor: "automatico", etiqueta: "Automático", Icono: IconoAutomatico },
];

/**
 * Selector de tema. El atributo data-theme ya se aplico antes de hidratar
 * (scriptTemaInline en layout.tsx); este componente solo refleja la
 * preferencia guardada y la cambia al hacer click.
 */
export function SelectorTema() {
  const temaActivo = useSyncExternalStore(
    suscribirseATema,
    leerTemaGuardado,
    leerTemaServidor,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la página"
      className="flex items-center gap-0.5 rounded-lg border border-mxd-borde bg-mxd-hueso p-0.5"
    >
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activo = temaActivo === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={etiqueta}
            title={etiqueta}
            onClick={() => cambiarTema(valor)}
            className={[
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors sm:h-8 sm:w-8",
              activo
                ? "bg-mxd-verde-acento text-mxd-tinta shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                : "text-mxd-gris hover:bg-mxd-verde-claro hover:text-mxd-verde-oscuro",
            ].join(" ")}
          >
            <Icono />
          </button>
        );
      })}
    </div>
  );
}
