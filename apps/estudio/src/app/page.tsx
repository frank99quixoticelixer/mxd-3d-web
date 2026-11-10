"use client";

import dynamic from "next/dynamic";

import { Panel } from "@/estudio/Panel";

// three.js solo en el navegador: el lienzo no se renderiza en el servidor.
const Escena = dynamic(() => import("@/estudio/Escena").then((m) => m.Escena), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-mxd-gris">Cargando estudio…</div>
  ),
});

export default function PaginaEstudio() {
  return (
    <main className="flex h-dvh flex-col lg:flex-row">
      <div className="min-h-0 flex-1">
        <Escena />
      </div>
      <div className="max-h-[45dvh] lg:max-h-none">
        <Panel />
      </div>
    </main>
  );
}
