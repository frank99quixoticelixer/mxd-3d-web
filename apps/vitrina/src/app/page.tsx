import Link from "next/link";

import { TarjetaPieza } from "@/components/catalogo/TarjetaPieza";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import {
  CARACTERISTICAS_MX80,
  CIFRAS_MX80,
  ESPECIFICACIONES_MX80,
  MANUAL_MX80,
} from "@/data/manual-mx80";
import { VisorFrame } from "@/features/viewer/VisorFrame";
import { obtenerPiezas, obtenerTodas } from "@/lib/catalogo";

export default function PaginaInicio() {
  const piezas = obtenerPiezas(MODELO_PREDETERMINADO);
  // Solo lo que el visor necesita para enlazar a cada ficha. Las subpiezas
  // entran porque dentro de una zona se aisla, por ejemplo, un agarrador del
  // marco, que tiene su propia ficha.
  const fichas = obtenerTodas(MODELO_PREDETERMINADO).map(
    ({ sku, slug, nombre }) => ({ sku, slug, nombre }),
  );

  return (
    <>
      {/* ---------------- Portada con visor ---------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <div className="mxd-aparecer">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mxd-verde">
            Ingeniería que puedes ver
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-mxd-tinta sm:text-5xl">
            Cada pieza del{" "}
            <span className="text-mxd-verde">MX80</span>, a tu alcance.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-mxd-gris">
            Conoce tu dron por dentro antes de tocar una herramienta.
            Despliega los brazos, enciende los motores y toca cualquier
            componente para verlo por separado.
          </p>
        </div>

        <div className="mt-8">
          <VisorFrame
            fichas={fichas}
            className="h-[78dvh] min-h-[460px] w-full sm:h-[72dvh] lg:h-[62vh]"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/catalogo"
            className="rounded-lg bg-mxd-verde px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Ver todas las piezas
          </Link>
        </div>
      </section>

      {/* ---------------- Cifras (del manual de usuario) ---------------- */}
      <section className="border-y border-mxd-borde bg-mxd-fondo">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-mxd-borde sm:grid-cols-3 lg:grid-cols-6">
          {CIFRAS_MX80.map((cifra) => (
            <div key={cifra.etiqueta} className="bg-mxd-fondo px-4 py-6 sm:px-6">
              <dt className="text-[11px] font-bold uppercase tracking-widest text-mxd-gris">
                {cifra.etiqueta}
              </dt>
              <dd className="mt-1.5 text-2xl font-bold tracking-tight text-mxd-tinta">
                {cifra.valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- Caracteristicas ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-mxd-tinta">
          Hecho para el campo
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-mxd-gris">
          Aspersión, siembra y fertilización con un dron que se lava, se pliega
          y se ubica al centímetro.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARACTERISTICAS_MX80.map((c) => (
            <li
              key={c.titulo}
              className="rounded-xl border border-mxd-borde bg-mxd-fondo p-5"
            >
              <h3 className="text-sm font-bold text-mxd-tinta">{c.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mxd-gris">{c.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Especificaciones ---------------- */}
      <section className="bg-mxd-hueso">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-mxd-tinta">
              Especificaciones
            </h2>
            {MANUAL_MX80.archivo && (
              <a
                href={MANUAL_MX80.archivo}
                className="text-sm font-semibold text-mxd-verde hover:text-mxd-verde-oscuro"
              >
                Manual de usuario {MANUAL_MX80.version} (PDF, {MANUAL_MX80.tamano}) →
              </a>
            )}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ESPECIFICACIONES_MX80.map((g) => (
              <section
                key={g.grupo}
                className="rounded-xl border border-mxd-borde bg-mxd-fondo px-4"
              >
                <h3 className="pt-4 text-[11px] font-bold uppercase tracking-widest text-mxd-gris">
                  {g.grupo}
                </h3>
                <dl>
                  {g.datos.map((d) => (
                    <div
                      key={d.etiqueta}
                      className="flex items-baseline justify-between gap-4 border-b border-mxd-borde py-2.5 last:border-0"
                    >
                      <dt className="text-sm text-mxd-gris">{d.etiqueta}</dt>
                      <dd className="text-right text-sm font-medium text-mxd-tinta">
                        {d.valor}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <p className="mt-4 text-xs text-mxd-gris">
            Fuente: Manual de Usuario MX80 {MANUAL_MX80.version}. El tiempo de
            vuelo estacionario se midió cerca del nivel del mar, con viento
            menor a 3 m/s y 25 °C.
          </p>
        </div>
      </section>

      {/* ---------------- Piezas ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-mxd-tinta">
              Todo lo que mueve al MX80
            </h2>
            <p className="mt-1.5 text-sm text-mxd-gris">
              {piezas.length} componentes clave, identificados y listos para
              consultar.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="hidden text-sm font-semibold text-mxd-verde hover:text-mxd-verde-oscuro sm:block"
          >
            Ver todo →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {piezas.map((pieza) => (
            <TarjetaPieza key={pieza.sku} pieza={pieza} />
          ))}
        </div>
      </section>

      {/* ---------------- Llamado final ---------------- */}
      <section className="bg-mxd-hueso">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-mxd-tinta">
              Encuentra la pieza exacta, sin adivinar.
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-mxd-gris">
              Identifica cada componente por su forma, su ubicación en el
              ensamble y su código. Menos dudas, menos tiempo en tierra.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="shrink-0 rounded-lg bg-mxd-verde px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Buscar en el catálogo
          </Link>
        </div>
      </section>
    </>
  );
}
