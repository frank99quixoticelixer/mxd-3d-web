"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const EscenaAccesorio = dynamic(
  () => import("./EscenaAccesorio").then((m) => m.EscenaAccesorio),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-mxd-borde border-t-mxd-verde" />
      </div>
    ),
  },
);

/** Visor de un accesorio suelto (bateria, generador...): aparece solo, girando. */
export function VisorAccesorio({
  url,
  nombre,
  className = "",
}: {
  /** URL publica del GLB, o null si el accesorio todavia no tiene modelo 3D. */
  url: string | null;
  nombre: string;
  className?: string;
}) {
  const [girando, setGirando] = useState(true);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-mxd-borde mxd-fondo-visor ${className}`}
      role="img"
      aria-label={`Modelo 3D de ${nombre}`}
    >
      <div className="absolute inset-0 mxd-reticula opacity-60" />
      <EscenaAccesorio url={url} girando={girando} />
      <button
        type="button"
        onClick={() => setGirando((v) => !v)}
        aria-pressed={girando}
        className="absolute left-3 top-3 rounded-lg border border-mxd-borde bg-mxd-fondo/90 px-3 py-1.5 text-xs font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde"
      >
        {girando ? "Detener giro" : "Girar"}
      </button>
      {!url && (
        <span className="absolute right-3 top-3 rounded-lg border border-mxd-borde bg-mxd-fondo/90 px-3 py-1.5 text-xs font-semibold text-mxd-gris shadow-sm backdrop-blur">
          Modelo en proceso
        </span>
      )}
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] text-mxd-gris">
        Arrastra para girarlo · Rueda para acercar
      </p>
    </div>
  );
}
