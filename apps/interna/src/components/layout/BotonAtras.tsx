"use client";

import { useRouter } from "next/navigation";

/**
 * Vuelve a la pagina anterior, y con ella a la vista del visor en que se
 * estaba: la portada guarda la zona y la pieza en la URL.
 *
 * Si la pagina se abrio sola (pestania nueva, enlace compartido) no hay a
 * donde volver dentro del sitio, y se va a `respaldo`.
 */
export function BotonAtras({
  respaldo,
  className = "",
}: {
  respaldo: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(respaldo);
      }}
      className={className}
    >
      &larr; Atrás
    </button>
  );
}
