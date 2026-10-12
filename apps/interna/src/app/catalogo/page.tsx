import type { Metadata } from "next";

import { TarjetaPieza } from "@/components/catalogo/TarjetaPieza";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { contarPorSeccion, obtenerPiezas } from "@/lib/catalogo";
import {
  ETIQUETAS_SECCION,
  ETIQUETAS_SUBSISTEMA,
  ORDEN_SECCIONES,
  type Subsistema,
} from "@/lib/esquema";

export const metadata: Metadata = {
  title: "Catálogo de componentes",
  description:
    "Todas las piezas del dron agrícola MX80, con ficha técnica y modelo 3D.",
};

export default function PaginaCatalogo() {
  const piezas = obtenerPiezas(MODELO_PREDETERMINADO);
  const porSeccion = contarPorSeccion(MODELO_PREDETERMINADO);

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
          sistema y listos para consultar. Las especificaciones marcadas como
          pendientes se están verificando para darte datos exactos.
        </p>
      </header>

      <section className="mt-10 rounded-2xl border border-mxd-borde bg-mxd-hueso p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
              Especificaciones por sección
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-mxd-gris">
              Documento técnico con una ficha por componente: cotas, material,
              acabado y cantidad por dron. Las secciones sin piezas todavía no
              tienen componentes documentados.
            </p>
          </div>
          <a
            href="/api/ficha/completo"
            className="rounded-lg bg-mxd-verde px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Catálogo completo en PDF
          </a>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDEN_SECCIONES.map((seccion) => {
            const total = porSeccion[seccion];
            return (
              <li key={seccion}>
                {total > 0 ? (
                  <a
                    href={`/api/ficha/seccion/${seccion}`}
                    className="flex h-full flex-col justify-between rounded-xl border border-mxd-borde bg-white px-4 py-3 transition-colors hover:border-mxd-verde"
                  >
                    <span className="text-sm font-semibold text-mxd-tinta">
                      {ETIQUETAS_SECCION[seccion]}
                    </span>
                    <span className="mt-1 text-xs text-mxd-verde">
                      Descargar PDF · {total} componentes
                    </span>
                  </a>
                ) : (
                  <div className="flex h-full flex-col justify-between rounded-xl border border-dashed border-mxd-borde px-4 py-3">
                    <span className="text-sm font-semibold text-mxd-gris">
                      {ETIQUETAS_SECCION[seccion]}
                    </span>
                    <span className="mt-1 text-xs italic text-mxd-gris/70">
                      Sin piezas documentadas
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

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
