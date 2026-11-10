"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CAUDAL_VISUAL, RPM_VISUAL } from "./aspersion/config";
import {
  ALTURA_FOLLAJE,
  ALTURA_VUELO,
  COMBINACIONES,
  FORMATOS,
  HORAS,
  type Hora,
} from "./config";
import { ESCENA_INICIAL, useEstudio, type Toma } from "./estado";
import { COLORES_LOTE, descargar, exportarActual, exportarLote } from "./exportar";

/** Donde el navegador guarda las tomas (comodidad local; el respaldo es el JSON). */
const CLAVE_TOMAS = "estudio-mx80-tomas";

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  unidad = "",
  alCambiar,
  deshabilitado = false,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  unidad?: string;
  alCambiar: (v: number) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  return (
    <div className={deshabilitado ? "opacity-40" : ""}>
      <div className="flex items-baseline justify-between text-[11px]">
        <label htmlFor={id} className="font-semibold text-mxd-gris">
          {etiqueta}
        </label>
        <span className="font-mono text-mxd-verde-acento">
          {Number.isInteger(paso) ? valor : valor.toFixed(2)} {unidad}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        disabled={deshabilitado}
        onChange={(e) => alCambiar(Number(e.target.value))}
        className="w-full accent-[#22c55e]"
      />
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-mxd-borde px-4 py-3">
      <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-mxd-gris">{titulo}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

const claseBoton = (activo: boolean) =>
  `rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
    activo
      ? "bg-mxd-verde text-white"
      : "border border-mxd-borde text-mxd-tinta hover:border-mxd-verde-acento hover:text-mxd-verde-acento"
  } disabled:cursor-not-allowed disabled:opacity-40`;

export function Panel() {
  const escena = useEstudio((s) => s.escena);
  const ajustar = useEstudio((s) => s.ajustar);
  const tomas = useEstudio((s) => s.tomas);
  const setTomas = useEstudio((s) => s.setTomas);
  const capturador = useEstudio((s) => s.capturador);
  const aviso = useEstudio((s) => s.aviso);
  const setAviso = useEstudio((s) => s.setAviso);
  const [nombreToma, setNombreToma] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [loteColores, setLoteColores] = useState<(string | null)[]>(COLORES_LOTE);
  const [loteFormatos, setLoteFormatos] = useState<string[]>(FORMATOS.map((f) => f.clave));
  const archivoTomas = useRef<HTMLInputElement>(null);

  // Tomas guardadas en este navegador (si el almacenamiento no esta
  // disponible, simplemente se empieza sin tomas).
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(CLAVE_TOMAS);
      if (crudo) setTomas(JSON.parse(crudo) as Toma[]);
    } catch {
      /* sin almacenamiento */
    }
  }, [setTomas]);
  const guardarTomas = (lista: Toma[]) => {
    setTomas(lista);
    try {
      localStorage.setItem(CLAVE_TOMAS, JSON.stringify(lista));
    } catch {
      /* sin almacenamiento: quedan en memoria y en el JSON */
    }
  };

  const ejecutar = async (tarea: () => Promise<void>) => {
    setOcupado(true);
    setAviso(null);
    try {
      await tarea();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "Algo salió mal al exportar.");
    } finally {
      setOcupado(false);
    }
  };

  const listo = escena.despliegue >= 1 && escena.despiece === 0;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-mxd-borde bg-mxd-panel lg:w-80">
      <header className="px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mxd-verde-acento">MXD</p>
        <h1 className="text-lg font-bold">Estudio MX80</h1>
        <p className="text-[11px] text-mxd-gris">Renders y tomas para publicidad</p>
      </header>

      <Seccion titulo="Dron">
        <Deslizador etiqueta="Despliegue" valor={escena.despliegue} min={0} max={1} paso={0.01}
          alCambiar={(despliegue) => ajustar({ despliegue })} deshabilitado={escena.despiece > 0} />
        <Deslizador etiqueta="Rotores" valor={escena.encendido} min={0} max={1} paso={0.01}
          alCambiar={(encendido) => ajustar({ encendido })} deshabilitado={!listo} />
        <Deslizador etiqueta="Despiece vertical" valor={escena.despiece} min={0} max={1} paso={0.01}
          alCambiar={(despiece) => ajustar({ despiece })} />
      </Seccion>

      <Seccion titulo="Aspersión">
        <button type="button" aria-pressed={escena.aspersion} disabled={escena.despiece > 0}
          onClick={() => ajustar({ aspersion: !escena.aspersion })} className={claseBoton(escena.aspersion)}>
          {escena.aspersion ? "Aspersión encendida" : "Encender aspersión"}
        </button>
        {!listo && escena.aspersion && (
          <p className="text-[11px] text-mxd-gris">Sale agua cuando los brazos están desplegados al 100 %.</p>
        )}
        <Deslizador etiqueta="RPM visual" valor={escena.rpm} min={RPM_VISUAL.min} max={RPM_VISUAL.max} paso={10}
          unidad="rpm" alCambiar={(rpm) => ajustar({ rpm })} />
        <Deslizador etiqueta="Caudal visual" valor={escena.caudal} min={CAUDAL_VISUAL.min} max={CAUDAL_VISUAL.max}
          paso={50} unidad="gotas/s" alCambiar={(caudal) => ajustar({ caudal })} />
      </Seccion>

      <Seccion titulo="Vuelo y campo">
        <Deslizador etiqueta="Altura de vuelo" valor={escena.altura} min={ALTURA_VUELO.min} max={ALTURA_VUELO.max}
          paso={0.05} unidad="m" alCambiar={(altura) => ajustar({ altura })} />
        <Deslizador etiqueta="Altura del follaje" valor={escena.follaje} min={ALTURA_FOLLAJE.min}
          max={ALTURA_FOLLAJE.max} paso={0.05} unidad="m" alCambiar={(follaje) => ajustar({ follaje })} />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(HORAS) as Hora[]).map((h) => (
            <button key={h} type="button" aria-pressed={escena.hora === h}
              onClick={() => ajustar({ hora: h })} className={claseBoton(escena.hora === h)}>
              {HORAS[h].etiqueta}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Personaliza tu dron">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={escena.color === null} onClick={() => ajustar({ color: null })}
            className={claseBoton(escena.color === null)}>
            Original
          </button>
          {COMBINACIONES.map((c) => (
            <button key={c.clave} type="button" aria-pressed={escena.color === c.clave}
              onClick={() => ajustar({ color: c.clave })}
              className={`flex items-center gap-1.5 ${claseBoton(escena.color === c.clave)}`}>
              <span className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ background: c.carroceria.color }} />
              {c.nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Etiquetas">
        <button type="button" aria-pressed={escena.etiquetas} onClick={() => ajustar({ etiquetas: !escena.etiquetas })}
          className={claseBoton(escena.etiquetas)}>
          {escena.etiquetas ? "Ocultar etiquetas" : "Mostrar etiquetas con datos"}
        </button>
      </Seccion>

      <Seccion titulo="Exportar imagen">
        <div className="grid grid-cols-2 gap-1.5">
          {FORMATOS.map((f) => (
            <button key={f.clave} type="button" disabled={!capturador || ocupado}
              onClick={() => ejecutar(() => exportarActual(f))} className={claseBoton(false)}>
              {f.nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Tomas guardadas">
        <div className="flex gap-1.5">
          <input value={nombreToma} onChange={(e) => setNombreToma(e.target.value)} placeholder="Nombre de la toma"
            className="min-w-0 flex-1 rounded-md border border-mxd-borde bg-mxd-fondo px-2 py-1.5 text-xs" />
          <button type="button" disabled={!capturador || !nombreToma.trim()} className={claseBoton(false)}
            onClick={() => {
              if (!capturador) return;
              guardarTomas([
                ...tomas,
                { id: crypto.randomUUID(), nombre: nombreToma.trim(), camara: capturador.leerCamara(), escena },
              ]);
              setNombreToma("");
            }}>
            Guardar
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {tomas.map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 text-xs">
              <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-mxd-verde-acento"
                onClick={() => {
                  ajustar(t.escena);
                  capturador?.aplicarCamara(t.camara);
                }}>
                {t.nombre}
              </button>
              <button type="button" aria-label={`Borrar ${t.nombre}`} className="text-mxd-gris hover:text-red-400"
                onClick={() => guardarTomas(tomas.filter((x) => x.id !== t.id))}>
                Borrar
              </button>
            </li>
          ))}
          {tomas.length === 0 && <li className="text-[11px] italic text-mxd-gris">Todavía no hay tomas.</li>}
        </ul>
        <div className="flex gap-1.5">
          <button type="button" disabled={tomas.length === 0} className={claseBoton(false)}
            onClick={() => descargar(new Blob([JSON.stringify(tomas, null, 2)], { type: "application/json" }), "tomas_mx80.json")}>
            Exportar JSON
          </button>
          <button type="button" className={claseBoton(false)} onClick={() => archivoTomas.current?.click()}>
            Importar JSON
          </button>
          <input ref={archivoTomas} type="file" accept="application/json" className="hidden"
            onChange={async (e) => {
              const archivo = e.target.files?.[0];
              if (!archivo) return;
              try {
                const lista = JSON.parse(await archivo.text()) as Toma[];
                // Lo que falte en una toma vieja se completa con los valores iniciales.
                guardarTomas(lista.map((t) => ({ ...t, escena: { ...ESCENA_INICIAL, ...t.escena } })));
              } catch {
                setAviso("Ese archivo no es un JSON de tomas válido.");
              }
              e.target.value = "";
            }} />
        </div>
      </Seccion>

      <Seccion titulo="Exportación por lote">
        <p className="text-[11px] text-mxd-gris">
          Cada toma guardada, en cada color y formato marcado, en un zip.
        </p>
        <div className="flex flex-wrap gap-1">
          {COLORES_LOTE.map((c) => {
            const activo = loteColores.includes(c);
            return (
              <button key={c ?? "original"} type="button" aria-pressed={activo} className={claseBoton(activo)}
                onClick={() => setLoteColores(activo ? loteColores.filter((x) => x !== c) : [...loteColores, c])}>
                {COMBINACIONES.find((x) => x.clave === c)?.nombre ?? "Original"}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          {FORMATOS.map((f) => {
            const activo = loteFormatos.includes(f.clave);
            return (
              <button key={f.clave} type="button" aria-pressed={activo} className={claseBoton(activo)}
                onClick={() => setLoteFormatos(activo ? loteFormatos.filter((x) => x !== f.clave) : [...loteFormatos, f.clave])}>
                {f.nombre}
              </button>
            );
          })}
        </div>
        <button type="button" className={claseBoton(true)}
          disabled={!capturador || ocupado || tomas.length === 0 || loteColores.length === 0 || loteFormatos.length === 0}
          onClick={() =>
            ejecutar(() =>
              exportarLote(tomas, loteColores, FORMATOS.filter((f) => loteFormatos.includes(f.clave)), setAviso),
            )
          }>
          Exportar {tomas.length * loteColores.length * loteFormatos.length} imágenes (zip)
        </button>
      </Seccion>

      {aviso && (
        <p role="status" className="mx-4 mb-4 rounded-md bg-mxd-fondo px-3 py-2 text-[11px] text-mxd-tinta">
          {aviso}
        </p>
      )}
    </aside>
  );
}
