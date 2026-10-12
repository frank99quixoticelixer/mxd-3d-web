import Link from "next/link";

import { TarjetaPieza } from "@/components/catalogo/TarjetaPieza";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { VisorFrame } from "@/features/viewer/VisorFrame";
import { obtenerPiezas } from "@/lib/catalogo";

export default function PaginaInicio() {
  const piezas = obtenerPiezas(MODELO_PREDETERMINADO);

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
              componente para ver su ficha técnica al instante.
          </p>
        </div>

        <div className="mt-8">
          <VisorFrame className="h-[78dvh] min-h-[460px] w-full sm:h-[72dvh] lg:h-[62vh]" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/explorador"
            className="rounded-lg bg-mxd-verde px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Explorar en 3D
          </Link>
          <Link
            href="/catalogo"
            className="rounded-lg border border-mxd-borde px-5 py-2.5 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
          >
            Ver todas las piezas
          </Link>
        </div>
      </section>

      <div className="mxd-divisor" />

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
            href="/explorador"
            className="shrink-0 rounded-lg bg-mxd-verde px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Abrir el explorador
          </Link>
        </div>
      </section>
    </>
  );
}
