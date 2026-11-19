"use client";

import dynamic from "next/dynamic";

import { Panel } from "@/estudio/Panel";

// three.js solo en el navegador: el lienzo no se renderiza en el servidor.
const Escena = dynamic(() => import("@/estudio/Escena").then((m) => m.Escena), {
  ssr: false,
  loading: () => (
    <div className="rotulo flex h-full items-center justify-center text-sm text-white/50">Cargando estudio…</div>
  ),
});

/** El 3D a pantalla completa y la interfaz flotando encima. */
export default function PaginaEstudio() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <Escena />
      </div>
      <div className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_aside]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
        <Panel />
      </div>
    </main>
  );
}
