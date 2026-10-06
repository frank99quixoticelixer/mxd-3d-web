"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import type { ModeloDron } from "@/config/modelos3d";
import type { Pieza } from "@/lib/esquema";
import { descargasDe } from "@/lib/descargas";
import { ControlesVisor, FichaRapida } from "./ControlesVisor";
import { useVisor } from "./estado";
import { VisorPieza } from "./VisorPieza";

/**
 * Punto de entrada del visor 3D.
 *
 * El canvas se carga con importacion dinamica y ssr: false porque three.js
 * no puede renderizarse en el servidor. Esto ademas saca a three.js del
 * paquete inicial: quien no abre el visor no descarga la libreria.
 */
const Escena = dynamic(() => import("./Escena").then((m) => m.Escena), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-mxd-borde border-t-mxd-verde" />
        <p className="text-xs text-mxd-gris">Preparando visor 3D…</p>
      </div>
    </div>
  ),
});

export function VisorMXD({
  catalogo,
  modelo,
  className = "",
  conControles = true,
  compacto = false,
  sinFicha = false,
  skuInicial = null,
  aislarInicial = false,
}: {
  catalogo: Pieza[];
  modelo: ModeloDron;
  className?: string;
  conControles?: boolean;
  /** Oculta la lista lateral de piezas (visor pequenio). */
  compacto?: boolean;
  /** Oculta la ficha flotante (cuando la pagina ya muestra la ficha completa). */
  sinFicha?: boolean;
  /** Preselecciona una pieza al abrir (se usa en la ficha de producto). */
  skuInicial?: string | null;
  /** Ademas de preseleccionar, atenua el resto del ensamble. */
  aislarInicial?: boolean;
}) {
  const reiniciarVista = useVisor((s) => s.reiniciarVista);
  const seleccion = useVisor((s) => s.seleccion);
  const mostrarFicha = !sinFicha && seleccion !== null;
  const verSola = useVisor((s) => s.verSola);
  const alternarVerSola = useVisor((s) => s.alternarVerSola);
  // La pieza sola solo se puede mostrar si hay un GLB suyo para cargar.
  const piezaSola =
    verSola && seleccion !== null && descargasDe(seleccion).glb
      ? catalogo.find((p) => p.sku === seleccion)
      : undefined;

  // Estado limpio cada vez que se monta el visor (por ejemplo al navegar
  // entre la portada y el explorador), y preseleccion si se pidio.
  useEffect(() => {
    reiniciarVista();
    if (!skuInicial) return;
    // Se espera a que la escena registre sus piezas antes de seleccionar.
    const cancelar = useVisor.subscribe((estado) => {
      if (
        estado.seleccion === null &&
        estado.skusEnEscena.includes(skuInicial)
      ) {
        useVisor.setState({ seleccion: skuInicial, aislar: aislarInicial });
      }
    });
    return cancelar;
  }, [reiniciarVista, skuInicial, aislarInicial]);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-mxd-borde mxd-fondo-visor lg:flex-row ${className}`}
    >
      {/* Lienzo 3D: ocupa el espacio que le deja la ficha, nunca queda debajo de ella. */}
      <div className="mxd-lienzo-3d relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 mxd-reticula opacity-60" />
        <Escena catalogo={catalogo} modelo={modelo} />
        {conControles && (
          <ControlesVisor catalogo={catalogo} compacto={compacto} />
        )}
        {/* Pieza sola: el mismo visor de la ficha del catalogo, encima del
            ensamble (que sigue montado, asi que al volver no se recarga). */}
        {piezaSola && (
          <div className="absolute inset-0 z-20 bg-white">
            <VisorPieza
              key={piezaSola.sku}
              url={`/downloads/${piezaSola.sku}/${piezaSola.sku}.glb`}
              nombre={piezaSola.nombre}
              sinDespiece
              className="h-full w-full rounded-none border-0"
            />
            <button
              type="button"
              onClick={alternarVerSola}
              className="absolute left-3 top-3 z-30 rounded-lg border border-mxd-borde bg-white/90 px-3 py-1.5 text-xs font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde"
            >
              Volver al ensamble
            </button>
          </div>
        )}
      </div>

      {/* Ficha de la pieza seleccionada: panel anclado, no overlay. Reduce
          el lienzo en vez de taparlo (abajo en movil, a la derecha en escritorio). */}
      {mostrarFicha && (
        <div className="max-h-64 shrink-0 overflow-y-auto border-t border-mxd-borde bg-white/95 backdrop-blur lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
          <FichaRapida catalogo={catalogo} />
        </div>
      )}
    </div>
  );
}
