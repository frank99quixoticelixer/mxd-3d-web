import type { Metadata } from "next";

import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { VisorMXD } from "@/features/viewer/VisorMXD";
import { obtenerTodas } from "@/lib/catalogo";

export const metadata: Metadata = {
  title: "Explorador 3D",
  description:
    "Recorre el MX80 por dentro: gíralo, despiézalo e inspecciona cada componente en 3D.",
};

export default function PaginaExplorador() {
  // El visor recibe tambien las subpiezas: son los objetos que trae el GLB.
  const piezas = obtenerTodas(MODELO_PREDETERMINADO);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-mxd-tinta">
          El MX80 por dentro
        </h1>
        <p className="text-xs text-mxd-gris">
          Gira, despieza y descubre · {piezas.length} componentes
        </p>
      </div>

      <VisorMXD
        catalogo={piezas}
        modelo={MODELO_PREDETERMINADO}
        className="h-[calc(100dvh-11rem)] min-h-[460px] w-full sm:h-[calc(100dvh-13rem)]"
      />
    </div>
  );
}
