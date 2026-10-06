"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { urlModelo } from "@/config/modelos3d";
import type { Pieza } from "@/lib/esquema";

const EscenaPieza = dynamic(
  () => import("./EscenaPieza").then((m) => m.EscenaPieza),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-mxd-borde border-t-mxd-verde" />
      </div>
    ),
  },
);

/** Visor de una sola pieza: aparece sola, girando. Arrastra para verla desde otro angulo. */
export function VisorPieza({
  glb,
  url,
  sku,
  nombre,
  className = "",
  sinDespiece = false,
}: {
  /** GLB relativo a public/. Se ignora si se pasa "url". */
  glb?: string;
  /** URL completa del GLB (p. ej. una subpieza servida por /api/descarga). */
  url?: string;
  /** SKU de catalogo de esta pieza: si tiene subpiezas, se pueden clickear
   * en el visor para ir directo a su ficha (render + 3D propios). */
  sku?: string;
  nombre: string;
  className?: string;
  /** Oculta el boton de despiece aunque el GLB tenga varias sub-piezas. */
  sinDespiece?: boolean;
}) {
  const [despiece, setDespiece] = useState(false);
  const [girando, setGirando] = useState(true);
  // null mientras el GLB no ha cargado: el boton solo aparece si de verdad
  // hay mas de una sub-pieza que separar (y la pieza no lo tiene deshabilitado).
  const [numPartes, setNumPartes] = useState<number | null>(null);
  const [subpiezaActiva, setSubpiezaActiva] = useState<Pieza | null>(null);
  const puedeExplotar = !sinDespiece && (numPartes ?? 0) > 1;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-mxd-borde mxd-fondo-visor ${className}`}
      role="img"
      aria-label={`Modelo 3D de ${nombre}`}
    >
      <div className="absolute inset-0 mxd-reticula opacity-60" />
      <EscenaPieza
        url={url ?? urlModelo(glb ?? "")}
        sku={sku}
        despiece={despiece}
        girando={girando}
        alDetectarPartes={setNumPartes}
        alPasarSobreSubpieza={setSubpiezaActiva}
      />
      <button
        type="button"
        onClick={() => setGirando((v) => !v)}
        aria-pressed={girando}
        className="absolute left-3 top-3 rounded-lg border border-mxd-borde bg-white/90 px-3 py-1.5 text-xs font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde"
      >
        {girando ? "Detener giro" : "Girar"}
      </button>
      {puedeExplotar && (
        <button
          type="button"
          onClick={() => setDespiece((v) => !v)}
          className="absolute right-3 top-3 rounded-lg border border-mxd-borde bg-white/90 px-3 py-1.5 text-xs font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde"
        >
          {despiece ? "Ver ensamblada" : "Ver despiece"}
        </button>
      )}
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] text-mxd-gris">
        {subpiezaActiva
          ? `Clic para ver: ${subpiezaActiva.nombre}`
          : despiece
            ? "Despiece de la pieza · Arrastra para girarla"
            : "Arrastra para girarla · Rueda para acercar"}
      </p>
    </div>
  );
}
