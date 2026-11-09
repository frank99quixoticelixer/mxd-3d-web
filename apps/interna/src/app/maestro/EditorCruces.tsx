"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { guardarCruces, type CambioCruce } from "./acciones";

/** Una partida del maestro, lista para mostrar. */
export interface PartidaEditable {
  numero: string;
  nombre: string | null;
  nombreOem: string | null;
  sistema: string | null;
  cantidad: number | null;
  unidad: string | null;
  posicion: string | null;
}

/** Una pieza (o una version de ella) asociada a una partida. */
export interface Enlace {
  sku: string;
  slug: string;
  nombre: string;
  variante: string | null;
  etiquetaVariante: string | null;
  estado: "confirmado" | "propuesto" | "sin-numero" | null;
}

/** Una pieza (o version) que aun no tiene numero y se puede asociar. */
export interface Disponible {
  sku: string;
  nombre: string;
  variante: string | null;
  etiquetaVariante: string | null;
}

const clave = (sku: string, variante: string | null) => `${sku}|${variante ?? ""}`;
const corto = (numero: string) => numero.replace(/^MXD-MX80-/, "").replace(/-R00$/, "");

/** Lo que el usuario cambio y todavia no guarda, por partida y pieza. */
type Pendiente =
  | { tipo: "asociar"; numero: string; sku: string; variante: string | null }
  | { tipo: "confirmar"; numero: string; sku: string; variante: string | null }
  | { tipo: "quitar"; numero: string; sku: string; variante: string | null };

/**
 * Editor del cruce maestro <-> catalogo de la pagina /maestro.
 *
 * Cada partida muestra sus piezas asociadas (con Confirmar si el cruce es
 * propuesto, y Quitar) y un boton para asociar una pieza de las que aun no
 * tienen numero. Nada se escribe hasta "Guardar", que pide confirmacion con el
 * resumen de lo que va a cambiar.
 */
export function EditorCruces({
  sistemas,
  enlaces,
  disponibles,
  nombresSistema,
}: {
  sistemas: [string, PartidaEditable[]][];
  enlaces: Record<string, Enlace[]>;
  disponibles: Disponible[];
  nombresSistema: Record<string, string>;
}) {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [guardando, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const nombrePorSku = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const d of disponibles) mapa.set(d.sku, d.nombre);
    for (const lista of Object.values(enlaces)) for (const e of lista) mapa.set(e.sku, e.nombre);
    return mapa;
  }, [disponibles, enlaces]);

  // Lo que ya se eligio en otra partida deja de estar disponible.
  const tomadas = new Set(
    pendientes.filter((p) => p.tipo === "asociar").map((p) => clave(p.sku, p.variante)),
  );
  // Y lo que se quito vuelve a estarlo.
  const liberadas: Disponible[] = pendientes
    .filter((p) => p.tipo === "quitar")
    .flatMap((p) => {
      const e = enlaces[p.numero]?.find((x) => x.sku === p.sku && x.variante === p.variante);
      return e ? [{ sku: e.sku, nombre: e.nombre, variante: e.variante, etiquetaVariante: e.etiquetaVariante }] : [];
    });
  const opciones = [...disponibles, ...liberadas].filter((d) => !tomadas.has(clave(d.sku, d.variante)));

  const etiqueta = (sku: string, variante: string | null, etiquetaVariante: string | null) =>
    `${sku} · ${nombrePorSku.get(sku) ?? ""}${variante ? ` · ${etiquetaVariante ?? variante}` : ""}`;

  const quitarPendiente = (p: Pendiente) =>
    setPendientes((lista) => lista.filter((x) => x !== p));

  const alternar = (nuevo: Pendiente) =>
    setPendientes((lista) => {
      const igual = lista.find(
        (x) => x.tipo === nuevo.tipo && x.numero === nuevo.numero && x.sku === nuevo.sku && x.variante === nuevo.variante,
      );
      return igual ? lista.filter((x) => x !== igual) : [...lista, nuevo];
    });

  const guardar = () =>
    iniciar(async () => {
      const cambios: CambioCruce[] = pendientes.map((p) => ({
        sku: p.sku,
        variante: p.variante,
        numero: p.tipo === "quitar" ? null : p.numero,
        estado: "confirmado",
      }));
      try {
        const { piezas } = await guardarCruces(cambios);
        setPendientes([]);
        setRevisando(false);
        setMensaje({ tipo: "ok", texto: `Guardado: ${piezas} pieza(s) actualizadas en el BOM.` });
        router.refresh();
      } catch (error) {
        setMensaje({
          tipo: "error",
          texto: error instanceof Error ? error.message : "No se pudo guardar.",
        });
      }
    });

  const describir = (p: Pendiente) => {
    const pieza = etiqueta(p.sku, p.variante, null);
    if (p.tipo === "asociar") return `Asociar ${corto(p.numero)} a ${pieza}`;
    if (p.tipo === "confirmar") return `Confirmar ${corto(p.numero)} = ${pieza}`;
    return `Quitar ${corto(p.numero)} de ${pieza}`;
  };

  return (
    <>
      {sistemas.map(([sistema, lista]) => (
        <section key={sistema} className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            {nombresSistema[sistema] ?? sistema}
            <span className="ml-2 font-normal normal-case tracking-normal text-mxd-gris/70">
              ({lista.length})
            </span>
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-mxd-borde">
            <table className="w-full min-w-[760px] text-left text-xs">
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
                {lista.map((partida) => {
                  const actuales = enlaces[partida.numero] ?? [];
                  const nuevas = pendientes.filter(
                    (p): p is Extract<Pendiente, { tipo: "asociar" }> =>
                      p.tipo === "asociar" && p.numero === partida.numero,
                  );
                  return (
                    <tr key={partida.numero} className="border-t border-mxd-borde align-top">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-mxd-verde">
                        {corto(partida.numero)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-mxd-tinta">{partida.nombre}</p>
                        <p className="text-[11px] text-mxd-gris">{partida.nombreOem}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-mxd-tinta">
                        {partida.cantidad ?? "—"} {partida.unidad}
                      </td>
                      <td className="px-3 py-2 text-mxd-gris">{partida.posicion}</td>
                      <td className="px-3 py-2">
                        <ul className="flex flex-col gap-1.5">
                          {actuales.map((e) => {
                            const quitada = pendientes.some(
                              (p) => p.tipo === "quitar" && p.numero === partida.numero && p.sku === e.sku && p.variante === e.variante,
                            );
                            const confirmada = pendientes.some(
                              (p) => p.tipo === "confirmar" && p.numero === partida.numero && p.sku === e.sku && p.variante === e.variante,
                            );
                            const estado = confirmada ? "confirmado" : e.estado;
                            return (
                              <li key={clave(e.sku, e.variante)} className={`flex flex-wrap items-center gap-1.5 ${quitada ? "opacity-40 line-through" : ""}`}>
                                <Link href={`/catalogo/${e.slug}`} className="font-medium text-mxd-tinta hover:text-mxd-verde">
                                  {e.nombre}
                                </Link>
                                <span className="font-mono text-[10px] text-mxd-gris">{e.sku}</span>
                                {e.etiquetaVariante && (
                                  <span className="rounded-full bg-mxd-verde-claro px-1.5 text-[10px] font-semibold text-mxd-verde-oscuro">
                                    {e.etiquetaVariante.replace("Versión ", "")}
                                  </span>
                                )}
                                <span
                                  className={`rounded-full px-1.5 text-[10px] font-semibold ${
                                    estado === "confirmado"
                                      ? "bg-mxd-verde text-white"
                                      : "border border-mxd-borde text-mxd-gris"
                                  }`}
                                >
                                  {estado === "confirmado" ? "Confirmado" : "Por confirmar"}
                                </span>
                                {e.estado === "propuesto" && !quitada && (
                                  <button
                                    type="button"
                                    aria-pressed={confirmada}
                                    onClick={() => alternar({ tipo: "confirmar", numero: partida.numero, sku: e.sku, variante: e.variante })}
                                    className="rounded-md border border-mxd-verde px-1.5 py-0.5 text-[10px] font-semibold text-mxd-verde hover:bg-mxd-verde-claro"
                                  >
                                    {confirmada ? "Deshacer" : "Confirmar"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-pressed={quitada}
                                  onClick={() => alternar({ tipo: "quitar", numero: partida.numero, sku: e.sku, variante: e.variante })}
                                  className="rounded-md border border-mxd-borde px-1.5 py-0.5 text-[10px] font-semibold text-mxd-gris hover:border-mxd-verde hover:text-mxd-verde"
                                >
                                  {quitada ? "Deshacer" : "Quitar"}
                                </button>
                              </li>
                            );
                          })}
                          {nuevas.map((p) => (
                            <li key={`nueva-${clave(p.sku, p.variante)}`} className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-mxd-verde-oscuro">
                                {etiqueta(p.sku, p.variante, null)}
                              </span>
                              <span className="rounded-full bg-mxd-verde-claro px-1.5 text-[10px] font-semibold text-mxd-verde-oscuro">
                                Nueva, sin guardar
                              </span>
                              <button
                                type="button"
                                onClick={() => quitarPendiente(p)}
                                className="rounded-md border border-mxd-borde px-1.5 py-0.5 text-[10px] font-semibold text-mxd-gris hover:border-mxd-verde hover:text-mxd-verde"
                              >
                                Deshacer
                              </button>
                            </li>
                          ))}
                          {actuales.length === 0 && nuevas.length === 0 && (
                            <li className="italic text-mxd-gris/70">Sin pieza asociada</li>
                          )}
                        </ul>

                        {/* La lista se monta solo en la partida que se esta
                            editando: con cien opciones por partida, montarla en
                            las ciento trece haria la pagina pesada. */}
                        {eligiendo === partida.numero ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onBlur={() => setEligiendo(null)}
                            onChange={(e) => {
                              const [sku, variante] = e.target.value.split("|");
                              if (sku) {
                                setPendientes((lista) => [
                                  ...lista,
                                  { tipo: "asociar", numero: partida.numero, sku, variante: variante || null },
                                ]);
                              }
                              setEligiendo(null);
                            }}
                            className="mt-1.5 w-full max-w-md rounded-md border border-mxd-verde bg-mxd-fondo px-2 py-1 text-xs text-mxd-tinta"
                          >
                            <option value="">Elige la pieza que corresponde…</option>
                            {opciones.map((d) => (
                              <option key={clave(d.sku, d.variante)} value={clave(d.sku, d.variante)}>
                                {etiqueta(d.sku, d.variante, d.etiquetaVariante)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEligiendo(partida.numero)}
                            className="mt-1.5 text-[11px] font-semibold text-mxd-verde hover:text-mxd-verde-oscuro"
                          >
                            + Asociar pieza
                          </button>
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

      {/* Barra de guardado: siempre a la vista mientras haya cambios. */}
      {(pendientes.length > 0 || mensaje) && (
        <div className="sticky bottom-3 z-20 mt-8 rounded-2xl border border-mxd-borde bg-mxd-fondo/95 p-4 shadow-lg backdrop-blur">
          {mensaje && (
            <p
              role="status"
              className={`mb-2 text-sm ${mensaje.tipo === "ok" ? "text-mxd-verde-oscuro" : "text-red-600"}`}
            >
              {mensaje.texto}
            </p>
          )}
          {pendientes.length > 0 && !revisando && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-mxd-tinta">
                {pendientes.length} cambio(s) sin guardar
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendientes([])}
                  className="rounded-lg border border-mxd-borde px-3 py-2 text-sm font-semibold text-mxd-gris hover:border-mxd-verde"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMensaje(null);
                    setRevisando(true);
                  }}
                  className="rounded-lg bg-mxd-verde px-4 py-2 text-sm font-semibold text-white hover:bg-mxd-verde-oscuro"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
          {pendientes.length > 0 && revisando && (
            <div>
              <p className="text-sm font-semibold text-mxd-tinta">¿Guardar estos cambios en el BOM?</p>
              <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 text-xs text-mxd-gris">
                {pendientes.map((p, i) => (
                  <li key={i}>{describir(p)}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setRevisando(false)}
                  className="rounded-lg border border-mxd-borde px-3 py-2 text-sm font-semibold text-mxd-gris hover:border-mxd-verde disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={guardar}
                  className="rounded-lg bg-mxd-verde px-4 py-2 text-sm font-semibold text-white hover:bg-mxd-verde-oscuro disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Confirmar y guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
