"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restaurarCambioBom } from "./acciones";

/**
 * "Restaurar" de una fila del historial: pide confirmacion, deshace el cambio y
 * muestra aqui mismo el motivo si no se pudo (por ejemplo, que alguien lo cambio
 * despues).
 */
export function BotonRestaurar({ idCambio }: { idCambio: number }) {
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function restaurar() {
    startTransition(async () => {
      const resultado = await restaurarCambioBom(idCambio);
      if (!resultado.ok) {
        setError(resultado.error);
        setConfirmando(false);
        return;
      }
      setError(null);
      setConfirmando(false);
      router.refresh();
    });
  }

  if (confirmando) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          disabled={trabajando}
          onClick={restaurar}
          className="rounded-md bg-mxd-verde px-2 py-1 font-semibold text-white hover:bg-mxd-verde-oscuro disabled:opacity-60"
        >
          {trabajando ? "Restaurando…" : "Sí, restaurar"}
        </button>
        <button
          type="button"
          disabled={trabajando}
          onClick={() => setConfirmando(false)}
          className="rounded-md border border-mxd-borde px-2 py-1 font-semibold text-mxd-tinta hover:border-mxd-verde"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmando(true);
        }}
        className="w-fit rounded-md border border-mxd-borde px-2 py-1 text-xs font-semibold text-mxd-tinta hover:border-mxd-verde hover:text-mxd-verde"
      >
        Restaurar
      </button>
      {error && (
        <span role="alert" className="max-w-56 text-xs text-red-800">
          {error}
        </span>
      )}
    </span>
  );
}
