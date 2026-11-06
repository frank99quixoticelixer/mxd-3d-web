"use client";

import { useId } from "react";

import { DESPIECE_APAGA_MOTORES, DESPIECE_MAXIMO, useVisor } from "../estado";
import {
  ARRASTRE,
  AVISO_ILUSTRATIVO,
  CAUDAL_VISUAL,
  DOWNWASH,
  RPM_REAL,
  RPM_VISUAL,
} from "./config";

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  unidad,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  unidad: string;
  onChange: (valor: number) => void;
}) {
  const id = useId();
  const relleno = ((valor - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[10px] font-semibold text-mxd-gris">
          {etiqueta}
        </label>
        <span className="font-mono text-[10px] font-semibold text-mxd-verde">
          {Number.isInteger(paso) ? valor : valor.toFixed(1)} {unidad}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mxd-deslizador mt-0.5 w-full"
        style={{
          background: `linear-gradient(to right, var(--color-mxd-verde-acento) ${relleno}%, var(--color-mxd-borde) ${relleno}%)`,
        }}
        aria-valuetext={`${valor} ${unidad}`}
      />
    </div>
  );
}

/**
 * Mandos de la visualizacion de aspersion: encendido con rampa, rpm visual,
 * caudal visual, arrastre, downwash y cada brazo por separado.
 *
 * Las reglas (cuando se puede encender, que la apaga) viven en estado.ts, como
 * las de los motores; aqui solo se muestran.
 */
export function PanelAspersion() {
  const aspersion = useVisor((s) => s.aspersion);
  const setActiva = useVisor((s) => s.setAspersionActiva);
  const ajustar = useVisor((s) => s.ajustarAspersion);
  const capa = useVisor((s) => s.capa);
  const atomico = useVisor((s) => s.despieceAtomico > 0);
  const despiezado = useVisor(
    (s) => s.explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES,
  );
  const encendido = useVisor((s) => s.encendido);

  const bloqueada = capa !== 1 || atomico || despiezado;
  const motivo = capa !== 1
      ? "Solo disponible en la vista del dron completo"
      : atomico
        ? "Bloqueado: el despiece atómico está activo"
        : despiezado
          ? "Bloqueado: el dron está despiezado"
          : aspersion.activa
            ? "Discos girando y lanzando gotas"
            : "Abre los brazos y enciende los dos aspersores";

  return (
    <section className="rounded-lg border border-mxd-borde bg-mxd-fondo px-2.5 py-1.5 lg:px-3 lg:py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-mxd-gris">
          Aspersión
        </h3>
        <button
          type="button"
          aria-pressed={aspersion.activa}
          disabled={bloqueada}
          onClick={() => setActiva(!aspersion.activa)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            aspersion.activa
              ? "bg-mxd-verde text-white hover:bg-mxd-verde-oscuro"
              : "border border-mxd-borde text-mxd-tinta hover:border-mxd-verde hover:text-mxd-verde"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {aspersion.activa ? "Apagar" : "Encender"}
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-mxd-gris">{motivo}</p>

      <div className="mt-2 flex flex-col gap-1.5">
        <Deslizador
          etiqueta="RPM visual"
          valor={aspersion.rpm}
          min={RPM_VISUAL.min}
          max={RPM_VISUAL.max}
          paso={10}
          unidad="rpm"
          onChange={(rpm) => ajustar({ rpm })}
        />
        <Deslizador
          etiqueta="Caudal visual"
          valor={aspersion.caudal}
          min={CAUDAL_VISUAL.min}
          max={CAUDAL_VISUAL.max}
          paso={50}
          unidad="gotas/s"
          onChange={(caudal) => ajustar({ caudal })}
        />
        <Deslizador
          etiqueta="Arrastre"
          valor={aspersion.arrastre}
          min={ARRASTRE.min}
          max={ARRASTRE.max}
          paso={0.1}
          unidad="1/s"
          onChange={(arrastre) => ajustar({ arrastre })}
        />
        <Deslizador
          etiqueta={encendido > 0 ? "Downwash" : "Downwash (con motores)"}
          valor={aspersion.downwash}
          min={DOWNWASH.min}
          max={DOWNWASH.max}
          paso={0.5}
          unidad="m/s²"
          onChange={(downwash) => ajustar({ downwash })}
        />
      </div>

      <fieldset className="mt-2">
        <legend className="text-[10px] font-semibold text-mxd-gris">Brazos con aspersor</legend>
        <div className="mt-1 flex gap-1.5">
          {(["cw", "ccw"] as const).map((lado) => (
            <button
              key={lado}
              type="button"
              aria-pressed={aspersion.brazos[lado]}
              onClick={() =>
                ajustar({ brazos: { ...aspersion.brazos, [lado]: !aspersion.brazos[lado] } })
              }
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                aspersion.brazos[lado]
                  ? "bg-mxd-verde-claro text-mxd-verde-oscuro"
                  : "border border-mxd-borde text-mxd-gris"
              } disabled:opacity-50`}
            >
              {lado.toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="mt-2 text-[10px] leading-snug text-mxd-gris">
        {AVISO_ILUSTRATIVO}.
        {RPM_REAL !== null && ` RPM real del cabezal: ${RPM_REAL}.`}
      </p>
    </section>
  );
}
