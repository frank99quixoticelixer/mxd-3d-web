import type { Metadata } from "next";
import Link from "next/link";

import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import MAESTRO from "@/data/maestro-mx80.json";
import { conBomTodas, obtenerTodas } from "@/lib/catalogo";
import type { Pieza } from "@/lib/esquema";
import { pendientesMaestro } from "@/lib/pendientes-maestro";

import { EditorCruces, type Disponible, type Enlace } from "./EditorCruces";

// Lee el BOM editable en cada visita: un numero capturado en una ficha deja
// de salir como pendiente sin reconstruir el sitio.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maestro de partes",
  description: "Cada partida del maestro de partes del MX80 y la pieza del catálogo que le corresponde.",
};

/** Nombre de cada sistema del maestro, por su codigo (columna "Sistema"). */
const SISTEMAS: Record<string, string> = {
  PRD: "Producto terminado",
  AGR: "Sistema agrícola",
  ASP: "Aspersión",
  AVI: "Aviónica",
  BAT: "Batería",
  BOM: "Bombeo",
  CAB: "Cableado",
  CAR: "Carga",
  COM: "Comunicaciones",
  ELE: "Electrónica de potencia",
  EST: "Estructura y chasis",
  NAV: "Navegación",
  PLA: "Plásticos",
  PRO: "Propulsión",
  SEG: "Seguridad e iluminación",
  TOR: "Tornillería",
};

interface Partida {
  numero: string;
  nombre: string | null;
  nombreOem: string | null;
  sistema: string | null;
  cantidad: number | null;
  unidad: string | null;
  posicion: string | null;
}

/** Que piezas del catalogo (y que version de cada una) llevan cada numero. */
function piezasPorNumero(piezas: Pieza[]): Map<string, { pieza: Pieza; version: string | null }[]> {
  const mapa = new Map<string, { pieza: Pieza; version: string | null }[]>();
  const agregar = (numero: string, pieza: Pieza, version: string | null) => {
    const lista = mapa.get(numero) ?? [];
    if (!lista.some((x) => x.pieza.sku === pieza.sku && x.version === version)) {
      lista.push({ pieza, version });
    }
    mapa.set(numero, lista);
  };
  for (const pieza of piezas) {
    if (pieza.variantes.some((v) => v.numeroBom)) {
      for (const v of pieza.variantes) if (v.numeroBom) agregar(v.numeroBom, pieza, v.etiqueta);
    } else if (pieza.numeroBom) {
      for (const n of pieza.numeroBom.split(" / ")) agregar(n, pieza, null);
    }
  }
  return mapa;
}

/**
 * El maestro de partes contra el catalogo: que partida es que pieza del 3D.
 *
 * El maestro lista lo que se compra y el catalogo lo que se ve, asi que no son
 * uno a uno: aqui se ve que partidas ya tienen pieza en el modelo, cuales no
 * (la aviónica de la bahía, casi todo el cableado) y si el cruce esta
 * confirmado o solo propuesto. El cruce vive en data/cruce-maestro.ts.
 */
/** Una lista plegable de pendientes. */
function Pendiente({
  titulo,
  explicacion,
  total,
  abierto = false,
  children,
}: {
  titulo: string;
  explicacion: string;
  total: number;
  abierto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={abierto && total > 0} className="rounded-xl border border-mxd-borde bg-mxd-fondo">
      <summary className="cursor-pointer select-none px-4 py-3">
        <span className="text-sm font-semibold text-mxd-tinta">{titulo}</span>
        <span className="ml-2 rounded-full bg-mxd-verde-claro px-2 py-0.5 text-xs font-semibold text-mxd-verde-oscuro">
          {total}
        </span>
        <span className="mt-0.5 block text-xs font-normal text-mxd-gris">{explicacion}</span>
      </summary>
      <div className="border-t border-mxd-borde px-4 py-3">
        {total === 0 ? <p className="text-xs italic text-mxd-gris">Nada pendiente.</p> : children}
      </div>
    </details>
  );
}

/** Lista de piezas del catalogo con su enlace a la ficha. */
function ListaPiezas({ piezas, detalle }: { piezas: Pieza[]; detalle: (p: Pieza) => React.ReactNode }) {
  return (
    <ul className="flex flex-col divide-y divide-mxd-borde text-xs">
      {piezas.map((p) => (
        <li key={p.sku} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
          <span className="font-mono text-[10px] text-mxd-gris">{p.sku}</span>
          <Link href={`/catalogo/${p.slug}`} className="font-medium text-mxd-tinta hover:text-mxd-verde">
            {p.nombre}
          </Link>
          <span className="basis-full text-mxd-gris sm:basis-auto">{detalle(p)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaMaestro() {
  const piezas = await conBomTodas(obtenerTodas(MODELO_PREDETERMINADO));
  const pendientes = pendientesMaestro(piezas);
  const porNumero = piezasPorNumero(piezas);
  const partidas = (MAESTRO.partidas as Partida[]).filter((p) => p.sistema !== "PRD");
  const ligadas = partidas.filter((p) => porNumero.has(p.numero)).length;
  // Lo que el editor necesita, armado aqui en el servidor: que pieza (o
  // version) lleva cada numero, y cuales aun no llevan ninguno.
  const enlaces: Record<string, Enlace[]> = {};
  for (const [numero, lista] of porNumero) {
    enlaces[numero] = lista.map(({ pieza, version }) => ({
      sku: pieza.sku,
      slug: pieza.slug,
      nombre: pieza.nombre,
      variante: pieza.variantes.find((v) => v.etiqueta === version)?.clave ?? null,
      etiquetaVariante: version,
      estado: pieza.cruceBom?.estado ?? null,
    }));
  }
  const disponibles: Disponible[] = piezas
    .filter((p) => !p.surtidaEnConjunto)
    .flatMap((p): Disponible[] =>
      p.variantes.length > 0
        ? p.variantes
            .filter((v) => !v.numeroBom)
            .map((v) => ({ sku: p.sku, nombre: p.nombre, variante: v.clave, etiquetaVariante: v.etiqueta }))
        : p.numeroBom
          ? []
          : [{ sku: p.sku, nombre: p.nombre, variante: null, etiquetaVariante: null }],
    );

  const porSistema = partidas.reduce<Record<string, Partida[]>>((acc, p) => {
    (acc[p.sistema ?? "?"] ??= []).push(p);
    return acc;
  }, {});
  const propuestas = piezas.filter((p) => p.cruceBom?.estado === "propuesto");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mxd-verde">MX80</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-mxd-tinta">Maestro de partes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mxd-gris">
          Cada partida del maestro (el BOM con el que compran los
          administrativos) y la pieza del catálogo que le corresponde. El
          maestro lista lo que se compra y el catálogo lo que se ve en el 3D:
          la PDB, el motor o la batería son una partida aunque en el modelo se
          desarmen en varias piezas.
        </p>
        <dl className="mt-5 flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-mxd-borde px-4 py-2">
            <dt className="text-xs text-mxd-gris">Partidas con pieza en el 3D</dt>
            <dd className="font-semibold text-mxd-tinta">
              {ligadas} de {partidas.length}
            </dd>
          </div>
          <div className="rounded-xl border border-mxd-borde px-4 py-2">
            <dt className="text-xs text-mxd-gris">Cruces por confirmar</dt>
            <dd className="font-semibold text-mxd-tinta">{propuestas.length}</dd>
          </div>
        </dl>
      </header>

      {/* Lo que falta enlazar, arriba: es lo que hay que trabajar. */}
      <section className="mt-8 rounded-2xl border border-mxd-borde bg-mxd-hueso p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
              Pendientes de enlazar
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-mxd-gris">
              Lo que falta para que cada pieza del 3D tenga su número del
              maestro y cada partida su pieza. Un número se captura en la ficha
              de la pieza («Número de parte (BOM)»); el cruce por omisión vive
              en <code>data/cruce-maestro.ts</code>.
            </p>
          </div>
          <a
            href="/api/maestro/pendientes"
            className="rounded-lg bg-mxd-verde px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
          >
            Descargar pendientes (CSV)
          </a>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Pendiente
            titulo="Cruces por confirmar"
            explicacion="Tienen número propuesto, o varios candidatos, y alguien que conozca el BOM debe confirmarlo."
            total={pendientes.porConfirmar.length}
            abierto
          >
            <ListaPiezas
              piezas={pendientes.porConfirmar}
              detalle={(p) => (
                <>
                  {p.numeroBom && (
                    <span className="mr-1 font-mono text-[10px] text-mxd-verde">
                      {p.numeroBom.replace(/MXD-MX80-|-R00/g, "")}
                    </span>
                  )}
                  {p.cruceBom?.nota}
                </>
              )}
            />
          </Pendiente>

          <Pendiente
            titulo="Piezas sin número: dar de alta o enlazar"
            explicacion="Piezas del 3D que se compran o se fabrican y no tienen partida en el maestro (diseño MXD nuevo o piezas que el maestro no separa)."
            total={pendientes.porDarDeAlta.length}
            abierto
          >
            <ListaPiezas piezas={pendientes.porDarDeAlta} detalle={(p) => p.categoria} />
          </Pendiente>

          <Pendiente
            titulo="Tornillería sin número"
            explicacion="El maestro casi no desglosa tornillos, arandelas ni tuercas. Decidir si se dan de alta o se compran como consumible."
            total={pendientes.tornilleria.length}
          >
            <ListaPiezas piezas={pendientes.tornilleria} detalle={(p) => p.categoria} />
          </Pendiente>

          <Pendiente
            titulo="Partidas del maestro sin pieza en el 3D"
            explicacion="Están en el BOM pero no en el modelo (aviónica de la bahía, la mayoría del cableado, partes del tanque). Se enlazan cuando se modelen."
            total={pendientes.partidasSinPieza.length}
          >
            <ul className="flex flex-col divide-y divide-mxd-borde text-xs">
              {pendientes.partidasSinPieza.map((m) => (
                <li key={m.numero} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                  <span className="font-mono text-[10px] text-mxd-verde">
                    {m.numero.replace(/MXD-MX80-|-R00/g, "")}
                  </span>
                  <span className="font-medium text-mxd-tinta">{m.nombre}</span>
                  <span className="text-mxd-gris">
                    {m.cantidad ?? "—"} {m.unidad} · {m.posicion}
                  </span>
                </li>
              ))}
            </ul>
          </Pendiente>
        </div>
      </section>

      <EditorCruces
        sistemas={Object.entries(porSistema)}
        enlaces={enlaces}
        disponibles={disponibles}
        nombresSistema={SISTEMAS}
      />
    </div>
  );
}
