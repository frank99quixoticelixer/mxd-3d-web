import type { Metadata } from "next";

import { VisorFrame } from "@/features/viewer/VisorFrame";

export const metadata: Metadata = {
  title: "Explorador 3D",
  description:
    "Recorre el MX80 completo: despliégalo, enciende los motores y entra en cada parte para verla por dentro.",
};

export default function PaginaExplorador() {
  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-mxd-tinta">
          El MX80 completo
        </h1>
        <p className="text-xs text-mxd-gris">
          Despliega, enciende y elige una parte para explorarla a fondo
        </p>
      </div>

      <VisorFrame className="h-[calc(100dvh-11rem)] min-h-[460px] w-full sm:h-[calc(100dvh-13rem)]" />
    </div>
  );
}
