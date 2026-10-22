import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { MARCA } from "@/config/marca";
import {
  CARACTERISTICAS_MX80,
  CIFRAS_MX80,
} from "@/data/manual-mx80";
import { VisorFondo } from "@/features/viewer/VisorFondo";

/**
 * Portada de vitrina: gancho corto para cualquiera que entre al dominio,
 * desde un link compartido (campaña, anuncio, mensaje) o buscando directo.
 *
 * Antes esta pagina SI era el catalogo tecnico completo (visor interactivo,
 * cifras, especificaciones, todas las piezas); ese contenido se movio a
 * "/explorar" sin tocarse, porque exige aprender a interactuar con el visor
 * y carga mas — no es lo primero que alguien nuevo deberia ver. Aqui el
 * hero es solo texto centrado, sin VisorFrame; el VisorFondo de atras es
 * ambiente decorativo — gira solo, sin estado ni controles, ver su
 * comentario en features/viewer/VisorFondo.tsx. Carga en segundo plano
 * (dynamic ssr:false + Suspense) y no bloquea el primer render, pero SI
 * agrega la descarga del GLB completo del dron en CADA visita a "/": si el
 * peso de esa descarga llega a importar mas que el efecto visual, es
 * candidato a quitarse primero.
 *
 * El CTA relleno (el de mas peso visual) dice "Explorar en 3D" y manda a
 * "/explorar" — ahi esta el dron armable y el visor interactivo, que es lo
 * que convence. "Cotizar" queda como opcion secundaria para quien ya
 * decidio sin necesitar ver el visor.
 */

const urlSitio = process.env.NEXT_PUBLIC_SITIO_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "MX80 — Dron agrícola de aspersión",
  description: MARCA.descripcion,
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: MARCA.nombreLargo,
    title: `${MARCA.nombreLargo} MX80`,
    description: MARCA.descripcion,
    images: [`${urlSitio}/renders/mx80-hero.jpg`],
  },
};

const correoCotizacion = `mailto:${MARCA.contacto.correo}?subject=${encodeURIComponent(
  "Cotización MX80",
)}&body=${encodeURIComponent(
  "Hola, quiero información y cotización del MX80.\n\nNombre:\nCiudad:\nHectáreas que trabajo:\nTeléfono:\n",
)}`;

export default function PaginaInicio() {
  return (
    <div className="bg-mxd-fondo">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <VisorFondo />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:pb-24 lg:pt-28">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mxd-verde">
              {MARCA.nombreLargo}
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-mxd-tinta sm:text-5xl lg:text-6xl">
              El MX80 cubre tu campo{" "}
              <span className="text-mxd-verde">sin que tú lo hagas.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-mxd-gris lg:text-lg">
              {MARCA.descripcion}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/explorar"
                className="rounded-lg bg-mxd-verde px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
              >
                Explorar el MX80 en 3D
              </Link>
              <a
                href={correoCotizacion}
                className="rounded-lg border border-mxd-borde px-6 py-3 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
              >
                Cotizar el MX80
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Cifras ---------------- */}
      <section className="border-y border-mxd-borde bg-mxd-hueso">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-mxd-borde sm:grid-cols-3 lg:grid-cols-6">
          {CIFRAS_MX80.map((cifra) => (
            <div key={cifra.etiqueta} className="bg-mxd-hueso px-4 py-6 text-center sm:px-6">
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
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-mxd-tinta sm:text-3xl">
          Hecho para el campo
        </h2>

        <div className="relative mt-8 aspect-[7/3] w-full overflow-hidden rounded-2xl bg-black">
          <Image
            src="/renders/mx80-banner-caracteristicas.png"
            alt={`${MARCA.nombreLargo} MX80`}
            fill
            unoptimized
            className="object-cover"
          />
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ---------------- Llamado final ---------------- */}
      <section className="bg-mxd-hueso">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-mxd-tinta sm:text-3xl">
            ¿Listo para tener tu MX80?
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-mxd-gris">
            Cuéntanos tu operación y te armamos una cotización del equipo que
            necesitas.
          </p>
          <a
            href={correoCotizacion}
            className="rounded-lg bg-mxd-verde px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Cotizar el MX80
          </a>
        </div>
      </section>
    </div>
  );
}
