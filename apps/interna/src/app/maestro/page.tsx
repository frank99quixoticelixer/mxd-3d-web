import type { Metadata } from "next";
import Link from "next/link";

import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import MAESTRO from "@/data/maestro-mx80.json";
import { obtenerTodas } from "@/lib/catalogo";
import type { Pieza } from "@/lib/esquema";

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
export default function PaginaMaestro() {
  const piezas = obtenerTodas(MODELO_PREDETERMINADO);
  const porNumero = piezasPorNumero(piezas);
  const partidas = (MAESTRO.partidas as Partida[]).filter((p) => p.sistema !== "PRD");
  const ligadas = partidas.filter((p) => porNumero.has(p.numero)).length;
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

      {Object.entries(porSistema).map(([sistema, lista]) => (
        <section key={sistema} className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            {SISTEMAS[sistema] ?? sistema}
            <span className="ml-2 font-normal normal-case tracking-normal text-mxd-gris/70">
              ({lista.length})
            </span>
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-mxd-borde">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-mxd-hueso text-[11px] uppercase tracking-wider text-mxd-gris">
                <tr>
                  <th className="px-3 py-2 font-semibold">No. parte</th>
                  <th className="px-3 py-2 font-semibold">Partida</th>
                  <th className="px-3 py-2 font-semibold">Cant.</th>
                  <th className="px-3 py-2 font-semibold">Posición</th>
                  <th className="px-3 py-2 font-semibold">Pieza del catálogo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const enCatalogo = porNumero.get(p.numero) ?? [];
                  return (
                    <tr key={p.numero} className="border-t border-mxd-borde align-top">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-mxd-verde">
                        {p.numero.replace(/^MXD-MX80-/, "").replace(/-R00$/, "")}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-mxd-tinta">{p.nombre}</p>
                        <p className="text-[11px] text-mxd-gris">{p.nombreOem}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-mxd-tinta">
                        {p.cantidad ?? "—"} {p.unidad}
                      </td>
                      <td className="px-3 py-2 text-mxd-gris">{p.posicion}</td>
                      <td className="px-3 py-2">
                        {enCatalogo.length === 0 ? (
                          <span className="italic text-mxd-gris/70">Sin pieza en el 3D</span>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {enCatalogo.map(({ pieza, version }) => (
                              <li key={`${pieza.sku}-${version}`}>
                                <Link
                                  href={`/catalogo/${pieza.slug}`}
                                  className="font-medium text-mxd-tinta hover:text-mxd-verde"
                                >
                                  {pieza.nombre}
                                </Link>
                                <span className="ml-1 font-mono text-[10px] text-mxd-gris">{pieza.sku}</span>
                                {version && (
                                  <span className="ml-1 rounded-full bg-mxd-verde-claro px-1.5 text-[10px] font-semibold text-mxd-verde-oscuro">
                                    {version.replace("Versión ", "")}
                                  </span>
                                )}
                                {pieza.cruceBom?.estado === "propuesto" && (
                                  <span className="ml-1 text-[10px] italic text-mxd-gris">por confirmar</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
