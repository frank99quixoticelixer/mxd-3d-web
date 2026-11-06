import type { Metadata } from "next";

import { TarjetaPieza } from "@/components/catalogo/TarjetaPieza";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { obtenerPiezas, obtenerSubpiezas } from "@/lib/catalogo";
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
  // El sistema de aspersion va primero: es lo que distingue al MX80 y antes
  // quedaba al final, como una sola tarjeta entre los conjuntos.
  const secciones = Object.entries(grupos).sort(
    ([a], [b]) => Number(b === "aspercion") - Number(a === "aspercion"),
  );

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

      {secciones.map(([subsistema, lista]) => (
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
          {/* Las piezas de cada conjunto, sin tener que abrir su ficha. Las del
              aspersor se ven abiertas; las demas, plegadas para no alargar la
              pagina con cien tornillos. */}
          {lista.map((pieza) => {
            const subpiezas = obtenerSubpiezas(pieza.sku);
            if (subpiezas.length === 0) return null;
            return (
              <details
                key={`${pieza.sku}-piezas`}
                open={subsistema === "aspercion"}
                className="mt-4 rounded-xl border border-mxd-borde bg-mxd-fondo"
              >
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-mxd-tinta hover:text-mxd-verde">
                  Piezas de {pieza.nombre}
                  <span className="ml-2 font-normal text-mxd-gris">({subpiezas.length})</span>
                </summary>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
                  {subpiezas.map((sub) => (
                    <TarjetaPieza key={sub.sku} pieza={sub} />
                  ))}
                </div>
              </details>
            );
          })}
        </section>
      ))}
    </div>
  );
}
