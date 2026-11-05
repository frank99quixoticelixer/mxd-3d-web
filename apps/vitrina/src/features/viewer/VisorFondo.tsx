"use client";

import dynamic from "next/dynamic";

const EscenaFondo = dynamic(
  () => import("./EscenaFondo").then((m) => m.EscenaFondo),
  { ssr: false },
);

/**
 * Fondo decorativo del hero de /mx80: el mismo GLB del visor de la portada
 * girando solo, atenuado, detras del texto y la tarjeta del render — una
 * insinuacion de "aqui hay un visor 3D de verdad", no el visor en si (ese
 * vive en "/", ver el comentario al inicio de app/mx80/page.tsx).
 *
 * pointer-events-none: el lienzo WebGL nunca debe interceptar clicks ni
 * arrastres de la pagina — aqui nada gira con el mouse, solo con el tiempo.
 */
export function VisorFondo() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden>
      <EscenaFondo />
    </div>
  );
}
