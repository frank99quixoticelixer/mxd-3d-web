import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BotonAtras } from "@/components/layout/BotonAtras";
import { MARCA } from "@/config/marca";
import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import { MANUAL_MX80, MANUAL_POR_PIEZA } from "@/data/manual-mx80";
import { ubicacionDeSku } from "@/features/viewer/componentes";
import { VisorPieza } from "@/features/viewer/VisorPieza";
import {
  obtenerPiezaPorSlug,
  obtenerTodas,
  obtenerSlugs,
} from "@/lib/catalogo";
import {
  cantidadPorDron,
  ETIQUETAS_ESTADO,
  ETIQUETAS_SECCION,
  ETIQUETAS_SUBSISTEMA,
  ORDEN_SECCIONES,
  type Pieza,
} from "@/lib/esquema";
import { conVersion } from "@/lib/imagenes";

/** Genera una ruta estatica por pieza: carga instantanea y SEO correcto. */
export function generateStaticParams() {
  return obtenerSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pieza = obtenerPiezaPorSlug(slug);
  if (!pieza) return { title: "Pieza no encontrada" };

  return {
    title: `${pieza.nombre} (${pieza.sku})`,
    description: pieza.descripcion,
  };
}

function FilaEspecificacion({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  const pendiente = valor === "Pendiente";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-mxd-borde py-2.5 last:border-0">
      <dt className="text-sm text-mxd-gris">{etiqueta}</dt>
      <dd
        className={
          pendiente
            ? "text-sm italic text-mxd-gris/70"
            : "text-sm font-medium text-mxd-tinta"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

/**
 * Secciones del dron donde se monta la pieza, en el orden de presentacion.
 * Sin secciones asignadas devuelve "Pendiente": no se infiere una ubicacion.
 */
function seccionesTexto(pieza: Pieza): string {
  if (pieza.secciones.length === 0) return "Pendiente";
  return ORDEN_SECCIONES.filter((s) => pieza.secciones.includes(s))
    .map((s) => ETIQUETAS_SECCION[s])
    .join(", ");
}

/**
 * Unidades por dron. Es el dato que pide un proveedor para cotizar, asi que
 * mientras la pieza no tenga secciones se muestra como pendiente en lugar
 * de un numero derivado de una suposicion.
 */
function cantidadTexto(pieza: Pieza): string {
  const total = cantidadPorDron(pieza);
  return total > 0 ? String(total) : "Pendiente";
}

/**
 * Cadena de piezas de catalogo hasta llegar a `pieza`, de la mas general a
 * la mas especifica (sin incluir a `pieza` misma). Con el despiece de la
 * tuerca del balanceador el catalogo ya tiene 3 niveles (Balanceador >
 * Tuerca > Espaciador), asi que la ruta de navegacion y el boton de
 * "volver" no pueden asumir un solo padre: hay que subir hasta el final.
 */
function cadenaAncestros(pieza: Pieza, catalogo: Pieza[]): Pieza[] {
  const cadena: Pieza[] = [];
  let sku = pieza.parteDe;
  while (sku) {
    const actual = catalogo.find((p) => p.sku === sku);
    if (!actual) break;
    cadena.unshift(actual);
    sku = actual.parteDe;
  }
  return cadena;
}

export default async function PaginaPieza({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pieza = obtenerPiezaPorSlug(slug);
  if (!pieza) notFound();

  // El visor recibe tambien las subpiezas: son los objetos que trae el GLB.
  const catalogo = obtenerTodas(MODELO_PREDETERMINADO);
  const relacionadas = catalogo
    .filter((p) => p.subsistema === pieza.subsistema && p.sku !== pieza.sku)
    .slice(0, 4);
  // De lo general a lo especifico: Catalogo > Balanceador > Tuerca > Espaciador.
  const ancestros = cadenaAncestros(pieza, catalogo);
  // El inmediato anterior en la cadena: a donde lleva el boton de "volver".
  const padre = ancestros[ancestros.length - 1];
  // Se resuelven aqui, en el servidor, y bajan por props al visor.
  const subpiezas = catalogo.filter((p) => p.parteDe === pieza.sku);
  // A donde lleva "Ver en el dron": la pieza misma si el visor la tiene
  // ubicada, si no la mas cercana de sus ancestros (un tornillo del motor
  // abre el motor). Sin ninguna, la vista completa.
  const enVisor = [pieza, ...[...ancestros].reverse()].find((p) =>
    ubicacionDeSku(p.sku),
  );
  // Lo que dice el manual de usuario de esta pieza, si la describe.
  const delManual = MANUAL_POR_PIEZA[pieza.sku];
  const urlVisor = enVisor ? `/?sku=${encodeURIComponent(enVisor.sku)}` : "/";
  const correoPedido = `mailto:${MARCA.contacto.correo}?subject=${encodeURIComponent(
    `Solicitud de pieza ${pieza.sku} - ${pieza.nombre}`,
  )}&body=${encodeURIComponent(
    `Hola, necesito la pieza ${pieza.sku} (${pieza.nombre}) para mi MX80.\n\n` +
      "Cantidad:\nNúmero de serie del dron:\nNombre y teléfono:\n",
  )}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <BotonAtras
        respaldo="/catalogo"
        className="mb-3 rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
      />
      <nav aria-label="Ruta de navegación" className="text-xs text-mxd-gris">
        <Link href="/catalogo" className="hover:text-mxd-verde">
          Catálogo
        </Link>
        {ancestros.map((ancestro) => (
          <span key={ancestro.sku}>
            <span className="mx-2">/</span>
            <Link
              href={`/catalogo/${ancestro.slug}`}
              className="hover:text-mxd-verde"
            >
              {ancestro.nombre}
            </Link>
          </span>
        ))}
        <span className="mx-2">/</span>
        <span className="text-mxd-tinta">{pieza.nombre}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* Solo la pieza, girando. Sin GLB propio se muestra un aviso: el
            ensamble completo vive en la portada. */}
        {pieza.glb ? (
          <VisorPieza
            glb={pieza.glb}
            subpiezas={subpiezas.map(({ sku, slug, nombre, nombresBlender }) => ({
              sku,
              slug,
              nombre,
              nombresBlender,
            }))}
            nombre={pieza.nombre}
            sinDespiece={pieza.sinDespiece}
            className="h-[46vh] min-h-[360px] w-full lg:h-[62vh]"
          />
        ) : (
          <div className="flex h-[46vh] min-h-[360px] w-full items-center justify-center rounded-2xl border border-mxd-borde bg-mxd-hueso p-6 text-center text-sm text-mxd-gris lg:h-[62vh]">
            Esta pieza todavía no tiene modelo 3D propio.
          </div>
        )}

        {/* Ficha tecnica */}
        <div>
          <p className="font-mono text-xs tracking-widest text-mxd-verde">
            {pieza.sku}
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-mxd-tinta">
            {pieza.nombre}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-mxd-verde-claro px-3 py-1 text-xs font-semibold text-mxd-verde-oscuro">
              {ETIQUETAS_SUBSISTEMA[pieza.subsistema]}
            </span>
            <span className="rounded-full border border-mxd-borde px-3 py-1 text-xs font-medium text-mxd-gris">
              {ETIQUETAS_ESTADO[pieza.estado]}
            </span>
            <span className="rounded-full border border-mxd-borde px-3 py-1 text-xs font-medium text-mxd-gris">
              Modelo {pieza.modelo}
            </span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-mxd-gris">
            {pieza.descripcion}
          </p>

          {pieza.imagen && (
            <div className="mt-6">
              <p className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
                Render de referencia
              </p>
              <div className="relative mt-3 h-56 w-full overflow-hidden rounded-xl border border-mxd-borde bg-mxd-hueso">
                <Image
                  src={conVersion(pieza.imagen) ?? pieza.imagen}
                  alt={`Render de ${pieza.nombre}`}
                  fill
                  // Ver nota en TarjetaPieza.tsx: el optimizador rechaza
                  // rutas locales con query string (cache-busting por version).
                  unoptimized
                  className="object-contain"
                />
              </div>
            </div>
          )}

          {/* Donde va la pieza y cuantas lleva el dron. Las cotas, el
              material y los requisitos de proveedor NO salen aqui: son datos
              internos y viven en la app interna (ver lib/publico.ts). */}
          <section className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
              En el dron
            </h2>
            <dl className="mt-3 rounded-xl border border-mxd-borde bg-white px-4">
              <FilaEspecificacion
                etiqueta="Se monta en"
                valor={seccionesTexto(pieza)}
              />
              <FilaEspecificacion
                etiqueta="Cantidad por dron"
                valor={cantidadTexto(pieza)}
              />
              {delManual?.datos.map((d) => (
                <FilaEspecificacion key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
              ))}
            </dl>
          </section>

          {delManual && delManual.cuidados.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
                Cuidados
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-mxd-tinta marker:text-mxd-verde">
                {delManual.cuidados.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-mxd-gris">
                Del{" "}
                {MANUAL_MX80.archivo ? (
                  <a href={MANUAL_MX80.archivo} className="underline hover:text-mxd-verde">
                    Manual de Usuario MX80 {MANUAL_MX80.version}
                  </a>
                ) : (
                  <>Manual de Usuario MX80 {MANUAL_MX80.version}</>
                )}
                , págs. {delManual.paginas}.
              </p>
            </section>
          )}

          {/* Siguiente paso de quien llego hasta aqui: pedirla. Mientras no
              exista el portal de pedidos, el pedido es un correo ya armado. */}
          <a
            href={correoPedido}
            className="mt-6 inline-block rounded-lg bg-mxd-verde px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Pedir esta pieza
          </a>

          <div className="mt-6 flex flex-wrap gap-3">
            {padre && (
              // El boton para "subir" un nivel: de la pieza especifica de
              // vuelta a la mas general de la que forma parte (p. ej. de un
              // espaciador a la tuerca, o de la tuerca al balanceador).
              <Link
                href={`/catalogo/${padre.slug}`}
                className="rounded-lg border border-mxd-borde px-5 py-2.5 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
              >
                &larr; Volver a {padre.nombre}
              </Link>
            )}
            <Link
              href={urlVisor}
              className="rounded-lg border border-mxd-borde px-5 py-2.5 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
            >
              Ver en el dron
            </Link>
            <Link
              href="/catalogo"
              className="rounded-lg border border-mxd-borde px-5 py-2.5 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
            >
              Volver al catálogo
            </Link>
          </div>
        </div>
      </div>

      {/* Lo que compone esta pieza. En un GLB con nodos clicables (el
          balanceador, p. ej.) esto ya se descubre tocando el visor 3D, pero
          mientras una pieza no tenga modelo propio (todo el tren de
          aterrizaje, hoy) el visor no existe y esta lista es la UNICA forma
          de llegar a sus subpiezas: por eso va fuera del "if" del visor, no
          como complemento opcional. */}
      {subpiezas.length > 0 && (
        <section className="mt-14">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            Piezas que la componen
            <span className="ml-2 font-normal normal-case tracking-normal text-mxd-gris/70">
              ({subpiezas.length})
            </span>
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subpiezas.map((p) => (
              <li key={p.sku}>
                <Link
                  href={`/catalogo/${p.slug}`}
                  className="flex flex-col rounded-lg border border-mxd-borde bg-white px-4 py-3 transition-colors hover:border-mxd-verde"
                >
                  <span className="font-mono text-[10px] tracking-widest text-mxd-verde">
                    {p.sku}
                  </span>
                  <span className="mt-0.5 text-sm font-medium text-mxd-tinta">
                    {p.nombre}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relacionadas.length > 0 && (
        <section className="mt-14">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            Piezas del mismo subsistema
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {relacionadas.map((p) => (
              <li key={p.sku}>
                <Link
                  href={`/catalogo/${p.slug}`}
                  className="flex flex-col rounded-lg border border-mxd-borde bg-white px-4 py-3 transition-colors hover:border-mxd-verde"
                >
                  <span className="font-mono text-[10px] tracking-widest text-mxd-verde">
                    {p.sku}
                  </span>
                  <span className="mt-0.5 text-sm font-medium text-mxd-tinta">
                    {p.nombre}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
