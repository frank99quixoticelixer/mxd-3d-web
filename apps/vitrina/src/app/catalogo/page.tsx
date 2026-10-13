import type { Metadata } from "next";

import { TarjetaPieza } from "@/components/catalogo/TarjetaPieza";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { obtenerPiezas } from "@/lib/catalogo";
import { ETIQUETAS_SUBSISTEMA, type Subsistema } from "@/lib/esquema";

export const metadata: Metadata = {
  title: "Catálogo de componentes",
  description:
    "Todas las piezas del dron agrícola MX80, con su modelo 3D interactivo.",
};

export default function PaginaCatalogo() {
  const piezas = obtenerPiezas(MODELO_PREDETERMINADO);

  // Agrupacion por subsistema, respetando el orden de ensamble.
  const grupos = piezas.reduce<Record<string, typeof piezas>>((acc, pieza) => {
    (acc[pieza.subsistema] ??= []).push(pieza);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mxd-verde">
          MX80
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-mxd-tinta">
          Cada pieza, en su lugar
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mxd-gris">
          Todos los componentes del dron agrícola MX80, organizados por
          sistema y listos para explorar en 3D.
        </p>
      </header>

      {Object.entries(grupos).map(([subsistema, lista]) => (
        <section key={subsistema} className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            {ETIQUETAS_SUBSISTEMA[subsistema as Subsistema]}
            <span className="ml-2 font-normal normal-case tracking-normal text-mxd-gris/70">
              ({lista.length})
            </span>
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lista.map((pieza) => (
              <TarjetaPieza key={pieza.sku} pieza={pieza} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
