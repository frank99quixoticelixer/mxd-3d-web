"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { guardarCruces, type CambioCruce } from "@/app/maestro/acciones";
import type { CandidataMaestro, SugerenciaMaestro } from "@/lib/sugerencias-maestro";
import { sinAcentos } from "@/lib/texto";

/**
 * "Número de parte MXD" de la ficha: asociar la pieza con su partida del maestro
 * sin salir de ella.
 *
 * En vez de pedir que se adivine por el nombre, ofrece las partidas mas
 * probables con la razon de cada una, deja buscar entre todas y siempre pide
 * confirmar con el nombre de la partida a la vista. Escribe por la misma accion
 * que /maestro (guardarCruces), asi que queda en el historial del BOM.
 */

type Estado = "confirmado" | "propuesto" | "sin-numero" | null;

type Version = { clave: string; etiqueta: string; posicion: string; numeroBom: string | null };

const ESTILO_PARECIDO = {
  alto: "bg-mxd-verde-claro text-mxd-verde-oscuro",
  medio: "border border-mxd-borde text-mxd-tinta",
  bajo: "border border-mxd-borde text-mxd-gris",
} as const;
const TEXTO_PARECIDO = { alto: "Muy probable", medio: "Probable", bajo: "Posible" } as const;

const ESTILO_ESTADO: Record<NonNullable<Estado>, string> = {
  confirmado: "bg-mxd-verde-claro text-mxd-verde-oscuro",
  propuesto: "bg-amber-100 text-amber-900",
  "sin-numero": "bg-mxd-hueso text-mxd-gris border border-mxd-borde",
};
const TEXTO_ESTADO: Record<NonNullable<Estado>, string> = {
  confirmado: "Confirmado",
  propuesto: "Falta confirmar",
  "sin-numero": "Sin número",
};

function Tarjeta({
  c,
  parecido,
  razones,
  onElegir,
  deshabilitada,
}: {
  c: CandidataMaestro;
  parecido?: SugerenciaMaestro["parecido"];
  razones?: string[];
  onElegir: () => void;
  deshabilitada: boolean;
}) {
  return (
    <li className="rounded-xl border border-mxd-borde bg-mxd-fondo px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-mxd-tinta">{c.nombre}</p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-mxd-verde">{c.numero}</p>
        </div>
        {parecido && (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTILO_PARECIDO[parecido]}`}>
            {TEXTO_PARECIDO[parecido]}
          </span>
        )}
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-mxd-gris sm:grid-cols-2">
        {c.nombreOem && (
          <div>
            <dt className="inline">Nombre técnico: </dt>
            <dd className="inline text-mxd-tinta">{c.nombreOem}</dd>
          </div>
        )}
        {c.posicion && (
          <div>
            <dt className="inline">Posición: </dt>
            <dd className="inline text-mxd-tinta">{c.posicion}</dd>
          </div>
        )}
        {c.cantidad && (
          <div>
            <dt className="inline">Cantidad en el maestro: </dt>
            <dd className="inline text-mxd-tinta">{c.cantidad}</dd>
          </div>
        )}
        {c.sistema && (
          <div>
            <dt className="inline">Sistema: </dt>
            <dd className="inline text-mxd-tinta">{c.sistema}</dd>
          </div>
        )}
      </dl>
      {razones && razones.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-mxd-gris marker:text-mxd-verde">
          {razones.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {c.tambienLaUsa && (
        <p className="mt-2 text-xs text-amber-800">
          Ya la lleva {c.tambienLaUsa}. El maestro a veces junta en una partida piezas parecidas (izquierda y
          derecha, por ejemplo); asóciala solo si de verdad es la misma.
        </p>
      )}
      <button
        type="button"
        disabled={deshabilitada}
        onClick={onElegir}
        className="mt-3 rounded-lg bg-mxd-verde px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro disabled:opacity-60"
      >
        Es esta
      </button>
    </li>
  );
}

export function AsociarPartida({
  sku,
  nombrePieza,
  estado,
  nota,
  numeroActual,
  variantes,
  sugeridas,
  todas,
}: {
  sku: string;
  nombrePieza: string;
  estado: Estado;
  nota: string | null;
  numeroActual: string | null;
  variantes: Version[];
  sugeridas: SugerenciaMaestro[];
  todas: CandidataMaestro[];
}) {
  const router = useRouter();
  const conVersiones = variantes.length > 0;
  const tieneNumero = conVersiones ? variantes.some((v) => v.numeroBom) : Boolean(numeroActual);
  const [trabajando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Abierta de entrada solo si falta el numero: con uno propuesto o confirmado
  // se ve primero que numero es, y buscar otro es una decision aparte.
  const [abierto, setAbierto] = useState(!tieneNumero);
  const [version, setVersion] = useState<string | null>(variantes[0]?.clave ?? null);
  const [consulta, setConsulta] = useState("");
  const [porConfirmar, setPorConfirmar] = useState<CandidataMaestro | null>(null);

  const estadoMostrado: NonNullable<Estado> = estado ?? (tieneNumero ? "propuesto" : "sin-numero");

  const resultados = useMemo(() => {
    const palabras = sinAcentos(consulta).toLowerCase().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [];
    return todas.filter((c) => {
      const texto = sinAcentos(`${c.numero} ${c.nombre} ${c.nombreOem ?? ""} ${c.posicion ?? ""} ${c.sistema ?? ""}`).toLowerCase();
      return palabras.every((p) => texto.includes(p));
    });
  }, [consulta, todas]);

  function guardar(cambios: CambioCruce[]) {
    setError(null);
    empezar(async () => {
      try {
        await guardarCruces(cambios);
        setPorConfirmar(null);
        setConsulta("");
        setAbierto(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar. Inténtalo de nuevo.");
      }
    });
  }

  /** Confirma lo que hoy esta propuesto, version por version si las hay. */
  function confirmarActual() {
    const cambios: CambioCruce[] = conVersiones
      ? variantes
          .filter((v) => v.numeroBom)
          .map((v) => ({ sku, variante: v.clave, numero: v.numeroBom, estado: "confirmado" as const }))
      : [{ sku, variante: null, numero: numeroActual, estado: "confirmado" as const }];
    guardar(cambios);
  }

  function asociar(c: CandidataMaestro) {
    guardar([{ sku, variante: conVersiones ? version : null, numero: c.numero, estado: "confirmado" }]);
  }

  function quitar() {
    guardar([{ sku, variante: conVersiones ? version : null, numero: null, estado: "confirmado" }]);
  }

  const versionElegida = variantes.find((v) => v.clave === version);
  const dondeVa = conVersiones && versionElegida ? ` (${versionElegida.etiqueta})` : "";

  return (
    <section className="mt-8" aria-labelledby="asociar-titulo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="asociar-titulo" className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
          Número de parte MXD
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTILO_ESTADO[estadoMostrado]}`}>
          {TEXTO_ESTADO[estadoMostrado]}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-hueso p-4">
        {/* Lo que tiene hoy */}
        {tieneNumero ? (
          <div className="text-sm text-mxd-tinta">
            {conVersiones ? (
              <ul className="space-y-1">
                {variantes.map((v) => (
                  <li key={v.clave}>
                    <span className="text-mxd-gris">{v.etiqueta}: </span>
                    <span className="break-all font-mono text-xs text-mxd-verde">
                      {v.numeroBom ?? "sin número"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="break-all font-mono text-xs text-mxd-verde">{numeroActual}</p>
            )}
            {nota && <p className="mt-2 text-xs leading-relaxed text-mxd-gris">{nota}</p>}
          </div>
        ) : (
          <p className="text-sm text-mxd-gris">
            Esta pieza todavía no tiene número de parte. Es lo que falta para que salga en su etiqueta y en el
            BOM.
          </p>
        )}

        {estadoMostrado === "propuesto" && tieneNumero && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-mxd-borde pt-3">
            <p className="text-xs text-mxd-gris">¿Es el número correcto para esta pieza?</p>
            <button
              type="button"
              disabled={trabajando}
              onClick={confirmarActual}
              className="rounded-lg bg-mxd-verde px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro disabled:opacity-60"
            >
              {trabajando ? "Guardando…" : "Sí, confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-semibold text-mxd-tinta hover:border-mxd-verde"
            >
              No, buscar otro
            </button>
          </div>
        )}

        {estadoMostrado === "confirmado" && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="mt-3 rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-semibold text-mxd-tinta hover:border-mxd-verde"
          >
            Cambiar número
          </button>
        )}

        {abierto && (
          <div className="mt-4 border-t border-mxd-borde pt-4">
            {conVersiones && (
              <fieldset className="mb-4">
                <legend className="text-xs font-semibold text-mxd-tinta">¿Para qué versión?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variantes.map((v) => (
                    <label
                      key={v.clave}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        version === v.clave
                          ? "border-mxd-verde bg-mxd-verde-claro text-mxd-verde-oscuro"
                          : "border-mxd-borde text-mxd-tinta"
                      }`}
                    >
                      <input
                        type="radio"
                        name="version-asociar"
                        className="sr-only"
                        checked={version === v.clave}
                        onChange={() => {
                          setVersion(v.clave);
                          setPorConfirmar(null);
                        }}
                      />
                      {v.etiqueta}
                    </label>
                  ))}
                </div>
                {versionElegida && <p className="mt-1.5 text-xs text-mxd-gris">{versionElegida.posicion}</p>}
              </fieldset>
            )}

            {porConfirmar ? (
              <div role="alertdialog" aria-label="Confirmar asociación" className="rounded-xl border border-mxd-verde bg-mxd-fondo p-4">
                <p className="text-sm text-mxd-tinta">
                  ¿Asociar <span className="font-semibold">{porConfirmar.nombre}</span>{" "}
                  <span className="break-all font-mono text-[11px] text-mxd-verde">({porConfirmar.numero})</span> con{" "}
                  <span className="font-semibold">
                    {nombrePieza}
                    {dondeVa}
                  </span>
                  ?
                </p>
                <p className="mt-1 text-xs text-mxd-gris">Queda confirmado y en el historial del BOM con tu nombre.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => asociar(porConfirmar)}
                    className="rounded-lg bg-mxd-verde px-3 py-1.5 text-xs font-semibold text-white hover:bg-mxd-verde-oscuro disabled:opacity-60"
                  >
                    {trabajando ? "Guardando…" : "Sí, asociar"}
                  </button>
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => setPorConfirmar(null)}
                    className="rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-semibold text-mxd-tinta hover:border-mxd-verde"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-mxd-tinta">Las partidas del maestro que más se parecen</p>
                {sugeridas.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {sugeridas.map((s) => (
                      <Tarjeta
                        key={s.numero}
                        c={s}
                        parecido={s.parecido}
                        razones={s.razones}
                        deshabilitada={trabajando}
                        onElegir={() => setPorConfirmar(s)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-mxd-gris">
                    Ninguna partida se parece por nombre. Busca abajo; si no está, la pieza todavía no está dada de
                    alta en el maestro.
                  </p>
                )}

                <div className="mt-4">
                  <label htmlFor="buscar-partida" className="text-xs font-semibold text-mxd-tinta">
                    ¿No es ninguna? Busca en todo el maestro
                  </label>
                  <input
                    id="buscar-partida"
                    type="search"
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    placeholder="Nombre, número, posición o sistema. Ej.: clamp, tren, M1"
                    className="mt-1.5 w-full rounded-lg border border-mxd-borde bg-mxd-fondo px-3 py-2 text-sm text-mxd-tinta placeholder:text-mxd-gris/70 focus:border-mxd-verde focus:outline-none"
                  />
                  {consulta.trim() !== "" && (
                    <>
                      <p className="mt-2 text-xs text-mxd-gris" aria-live="polite">
                        {resultados.length === 0
                          ? "Ninguna partida coincide."
                          : `${resultados.length} ${resultados.length === 1 ? "partida" : "partidas"}${
                              resultados.length > 8 ? " (se muestran 8; escribe más para acotar)" : ""
                            }`}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {resultados.slice(0, 8).map((c) => (
                          <Tarjeta key={c.numero} c={c} deshabilitada={trabajando} onElegir={() => setPorConfirmar(c)} />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="mt-3 text-xs text-red-800">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-mxd-borde pt-3">
              {estadoMostrado !== "sin-numero" && (
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={quitar}
                  className="rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-semibold text-mxd-tinta hover:border-red-700 hover:text-red-800 disabled:opacity-60"
                >
                  {conVersiones ? `Quitar el número de ${versionElegida?.etiqueta ?? "esta versión"}` : "Quitar el número"}
                </button>
              )}
              {estadoMostrado !== "propuesto" && (
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(false);
                    setPorConfirmar(null);
                  }}
                  className="rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-semibold text-mxd-tinta hover:border-mxd-verde"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
