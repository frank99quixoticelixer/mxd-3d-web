"use client";

import { useEffect, useId, useRef, useState } from "react";

import { masaMX80 } from "../../drone_sim_pkg/src/drone-profiles.js";

import { CAUDAL_VISUAL, RPM_VISUAL } from "./aspersion/config";
import {
  ALTURA_FOLLAJE,
  ALTURA_VUELO,
  COLOR_ORIGINAL,
  COMBINACIONES,
  ENTORNOS,
  entornoPorClave,
  FORMATOS,
  HORAS,
  type Hora,
} from "./config";
import { ESCENA_INICIAL, useEstudio, type ModoVuelo, type Toma } from "./estado";
import { COLORES_LOTE, descargar, exportarActual, exportarLote } from "./exportar";

/**
 * Interfaz del estudio, encima del 3D a pantalla completa.
 *
 * Tres pantallas, como en un simulador: TALLER (se elige la pintura), MAPAS
 * (se elige donde volar) y CAMPO (tomas y exportacion). Paneles de vidrio
 * oscuro, titulos condensados en mayusculas y una accion principal abajo a la
 * derecha.
 */

/** Donde el navegador guarda las tomas (comodidad local; el respaldo es el JSON). */
const CLAVE_TOMAS = "estudio-mx80-tomas";

/** Las cuatro opciones de color, con su muestra. null = original. */
const OPCIONES_COLOR: { clave: string | null; nombre: string; muestra: string }[] = [
  { clave: null, nombre: "Original", muestra: COLOR_ORIGINAL },
  ...COMBINACIONES.map((c) => ({ clave: c.clave, nombre: c.nombre, muestra: c.pintura.color })),
];
const nombreDeColor = (clave: string | null) =>
  OPCIONES_COLOR.find((o) => o.clave === clave)?.nombre ?? "Original";

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function Marca() {
  return (
    <p className="rotulo flex items-center gap-2 text-[11px] text-white/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.7)]">
      <span className="inline-block h-2 w-2 rotate-45 bg-mxd-verde-acento" aria-hidden />
      MXD <span className="text-white/30">/</span> Estudio MX80
    </p>
  );
}

function TituloPantalla({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="aparecer">
      <Marca />
      <h1 className="mt-3 font-titulo text-6xl font-bold uppercase leading-[0.9] tracking-wide text-white [text-shadow:0_2px_18px_rgb(0_0_0/0.55)] sm:text-7xl">
        {titulo}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-white/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.7)]">{subtitulo}</p>
    </div>
  );
}

/** Accion principal: blanca, condensada, con flecha. */
function BotonPrincipal({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group pointer-events-auto flex items-center gap-4 bg-white px-7 py-4 font-titulo text-xl font-bold uppercase tracking-[0.12em] text-black transition-colors hover:bg-mxd-verde-acento disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-1">
        →
      </span>
    </button>
  );
}

/** Accion secundaria: texto con borde fino. */
function BotonSecundario({
  children,
  onClick,
  activo = false,
  disabled = false,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  activo?: boolean;
  disabled?: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activo}
      aria-label={etiqueta}
      className={`rotulo pointer-events-auto border px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        activo
          ? "border-white bg-white text-black"
          : "border-white/20 text-white/85 hover:border-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

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
  const avance = `${((valor - min) / (max - min)) * 100}%`;
  return (
    <div className={deshabilitado ? "opacity-35" : ""}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="rotulo text-[11px] text-white/80">
          {etiqueta}
        </label>
        <span className="font-titulo text-base font-semibold tabular-nums text-white">
          {Number.isInteger(paso) ? valor : valor.toFixed(2)}
          {unidad && <span className="ml-1 text-xs text-white/70">{unidad}</span>}
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
        className="deslizador"
        style={{ "--avance": avance } as React.CSSProperties}
      />
    </div>
  );
}

function Interruptor({
  etiqueta,
  activo,
  alCambiar,
  deshabilitado = false,
}: {
  etiqueta: string;
  activo: boolean;
  alCambiar: (v: boolean) => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className="flex w-full items-center justify-between py-1 disabled:opacity-35"
    >
      <span className="rotulo text-[11px] text-white/80">{etiqueta}</span>
      <span
        className={`relative h-4 w-8 rounded-full transition-colors ${activo ? "bg-mxd-verde-acento" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${activo ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

/** Ayuda de controles del raton, abajo al centro. */
function AyudaControles() {
  return (
    <p className="rotulo pointer-events-none hidden text-[10px] text-white/65 md:block">
      Arrastrar · orbitar <span className="mx-2 text-white/20">|</span> Rueda · acercar
      <span className="mx-2 text-white/20">|</span> Clic derecho · desplazar
    </p>
  );
}

function Aviso() {
  const aviso = useEstudio((s) => s.aviso);
  if (!aviso) return null;
  return (
    <p role="status" className="vidrio aparecer px-4 py-2 text-xs text-white">
      {aviso}
    </p>
  );
}

// ---------------------------------------------------------------------------
// TALLER
// ---------------------------------------------------------------------------

function PantallaTaller({ alElegirMapa }: { alElegirMapa: () => void }) {
  const color = useEstudio((s) => s.escena.color);
  const ajustar = useEstudio((s) => s.ajustar);
  const mesaGirando = useEstudio((s) => s.mesaGirando);
  const setMesaGirando = useEstudio((s) => s.setMesaGirando);

  return (
    <>
      <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
        <TituloPantalla titulo="Taller" subtitulo="Personaliza tu MX80 antes de salir al campo." />
      </div>

      <div className="absolute right-6 top-6 sm:right-10 sm:top-10">
        <BotonSecundario activo={mesaGirando} onClick={() => setMesaGirando(!mesaGirando)}>
          {mesaGirando ? "Plataforma girando" : "Girar plataforma"}
        </BotonSecundario>
      </div>

      <div className="absolute inset-x-6 bottom-6 flex flex-col gap-5 sm:inset-x-10 sm:bottom-10 lg:flex-row lg:items-end lg:justify-between">
        <section className="aparecer" aria-labelledby="titulo-pintura">
          <div className="mb-3 flex items-baseline gap-4">
            <h2 id="titulo-pintura" className="rotulo text-sm text-white">
              Pintura
            </h2>
            <p className="text-xs text-white/70">Cubiertas de motor, carcasa frontal y seguros de manguera</p>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pintura del dron">
            {OPCIONES_COLOR.map((o) => {
              const activo = color === o.clave;
              return (
                <button
                  key={o.clave ?? "original"}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => ajustar({ color: o.clave })}
                  className={`vidrio group pointer-events-auto w-28 cursor-pointer p-1.5 text-left transition-all ${
                    activo ? "!border-white" : "hover:!border-white/40"
                  }`}
                >
                  <span className="block h-9 w-full" style={{ background: o.muestra }} />
                  <span className="mt-2 flex items-center justify-between">
                    <span className="font-titulo text-sm font-semibold uppercase leading-tight tracking-wider text-white">
                      {o.nombre}
                    </span>
                  </span>
                  <span className={`rotulo mt-0.5 block text-[8px] ${activo ? "text-mxd-verde-acento" : "text-transparent"}`}>
                    Seleccionado
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="aparecer flex flex-col items-start gap-3 lg:items-end">
          <AyudaControles />
          <BotonPrincipal onClick={alElegirMapa}>Elegir mapa</BotonPrincipal>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// MAPAS
// ---------------------------------------------------------------------------

function PantallaMapas({ alVolver, alCargar }: { alVolver: () => void; alCargar: (clave: string) => void }) {
  const color = useEstudio((s) => s.escena.color);
  const elegido = useEstudio((s) => s.entorno);
  return (
    <div className="absolute inset-0 bg-black/55 backdrop-blur-sm">
      <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
        <TituloPantalla titulo="Mapas" subtitulo={`Elige dónde volar. Sales con pintura ${nombreDeColor(color)}.`} />
      </div>

      <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col gap-4 sm:left-10 sm:right-10 lg:flex-row">
        {ENTORNOS.map((e) => (
          <button
            key={e.clave}
            type="button"
            onClick={() => alCargar(e.clave)}
            className={`vidrio aparecer group pointer-events-auto block w-full max-w-md text-left transition-colors hover:!border-white ${
              elegido === e.clave ? "!border-white/50" : ""
            }`}
          >
            {/* Vista del mapa dibujada con CSS (sin imagenes). */}
            <span
              className="relative block h-40 overflow-hidden"
              style={{
                background: `repeating-linear-gradient(${e.vista.angulo}deg, ${e.vista.suelo} 0 10px, ${e.vista.surco} 10px 18px), ${e.vista.cielo}`,
                backgroundSize: "100% 62%, 100% 100%",
                backgroundPosition: "bottom, top",
                backgroundRepeat: "no-repeat",
              }}
            >
              <span className="rotulo absolute left-3 top-3 bg-black/60 px-2 py-1 text-[10px] text-white">
                {e.etiqueta}
              </span>
              {elegido === e.clave && (
                <span className="rotulo absolute right-3 top-3 bg-white px-2 py-1 text-[10px] text-black">Último</span>
              )}
            </span>
            <span className="block p-5">
              <span className="block font-titulo text-3xl font-bold uppercase tracking-wide text-white">{e.nombre}</span>
              <span className="mt-1 block text-sm text-white/80">{e.descripcion}</span>
              <span className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
                {e.datos.map((d) => (
                  <span key={d.etiqueta} className="flex flex-col">
                    <span className="rotulo text-[9px] text-white/65">{d.etiqueta}</span>
                    <span className="font-titulo text-lg font-semibold text-white">{d.valor}</span>
                  </span>
                ))}
              </span>
              <span className="rotulo mt-5 flex items-center gap-2 text-sm text-mxd-verde-acento">
                Cargar mapa <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-10">
        <BotonSecundario onClick={alVolver}>← Taller</BotonSecundario>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CAMPO
// ---------------------------------------------------------------------------

type Pestana = "pilotar" | "dron" | "aspersion" | "vuelo" | "captura" | "tomas";
const PESTANAS: { clave: Pestana; nombre: string }[] = [
  { clave: "pilotar", nombre: "Pilotar" },
  { clave: "dron", nombre: "Dron" },
  { clave: "aspersion", nombre: "Aspersión" },
  { clave: "vuelo", nombre: "Vuelo" },
  { clave: "captura", nombre: "Captura" },
  { clave: "tomas", nombre: "Tomas" },
];

function Grupo({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/10 py-4 first:border-t-0 first:pt-1">
      {titulo && <h3 className="rotulo text-[10px] text-white/65">{titulo}</h3>}
      {children}
    </div>
  );
}

const MODOS_VUELO: { clave: ModoVuelo; nombre: string; tecla: string; ayuda: string }[] = [
  { clave: "pos", nombre: "Posición", tecla: "3", ayuda: "Mantiene posición y altura al soltar los mandos." },
  { clave: "angle", nombre: "Ángulo", tecla: "2", ayuda: "Se nivela solo; el acelerador es manual (W/S)." },
  { clave: "acro", nombre: "Acro", tecla: "1", ayuda: "Sin autonivelado: para pilotos con experiencia." },
];

const TECLAS: [string, string][] = [
  ["Enter", "Armar / desarmar"],
  ["W / S", "Subir / bajar"],
  ["A / D", "Girar"],
  ["Flechas", "Avanzar y desplazarse"],
  ["S sostenida en tierra", "Apaga motores (2 s)"],
  ["Espacio", "Acelerador a vuelo estacionario"],
  ["1 / 2 / 3", "Acro / Ángulo / Posición"],
  ["R", "Reiniciar en la plataforma"],
];

/** Pestana Pilotar: el simulador 6-DOF (drone_sim_pkg) con el perfil del MX80. */
function PestanaPilotar() {
  const pilotando = useEstudio((s) => s.pilotando);
  const setPilotando = useEstudio((s) => s.setPilotando);
  const persecucion = useEstudio((s) => s.persecucion);
  const setPersecucion = useEstudio((s) => s.setPersecucion);
  const litros = useEstudio((s) => s.litros);
  const setLitros = useEstudio((s) => s.setLitros);
  const piloto = useEstudio((s) => s.piloto);
  const telemetria = useEstudio((s) => s.telemetria);
  const masa: number = masaMX80(litros);

  return (
    <>
      <Grupo>
        <Interruptor etiqueta="Pilotar el MX80" activo={pilotando} alCambiar={setPilotando} />
        <p className="text-xs leading-relaxed text-white/70">
          Simulador de vuelo 6-DOF con control tipo PX4 y los datos del MX80: 2640 mm entre ejes, hélices de 63
          in, 4 motores de 72 kg de empuje.
        </p>
      </Grupo>

      <Grupo titulo="Carga">
        <Deslizador etiqueta="Tanque" valor={litros} min={0} max={80} paso={5} unidad="L"
          alCambiar={setLitros} />
        <p className="text-xs text-white/70">
          Masa de despegue <span className="font-titulo text-sm font-semibold text-white">{masa.toFixed(1)} kg</span>
          {pilotando && " · cambiarla reinicia el vuelo"}
        </p>
      </Grupo>

      <Grupo titulo="Modo de vuelo">
        <div className="grid grid-cols-3 gap-1.5">
          {MODOS_VUELO.map((m) => (
            <BotonSecundario key={m.clave} disabled={!piloto} activo={telemetria?.modo === m.clave}
              onClick={() => piloto?.setModo(m.clave)}>
              {m.nombre}
            </BotonSecundario>
          ))}
        </div>
        <p className="text-xs text-white/70">
          {MODOS_VUELO.find((m) => m.clave === (telemetria?.modo ?? "pos"))?.ayuda}
        </p>
      </Grupo>

      <Grupo titulo="Motores">
        <div className="grid grid-cols-2 gap-1.5">
          <BotonSecundario disabled={!piloto} activo={telemetria?.armado ?? false}
            onClick={() => (telemetria?.armado ? piloto?.desarmar() : piloto?.armar())}>
            {telemetria?.armado ? "Desarmar" : "Armar"}
          </BotonSecundario>
          <BotonSecundario disabled={!piloto} onClick={() => piloto?.reiniciar()}>
            Reiniciar
          </BotonSecundario>
        </div>
        <Interruptor etiqueta="Cámara de persecución" activo={persecucion} alCambiar={setPersecucion} />
      </Grupo>

      <Grupo titulo="Teclado">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          {TECLAS.map(([tecla, accion]) => (
            <div key={tecla} className="contents">
              <dt className="rotulo text-[10px] text-white">{tecla}</dt>
              <dd className="text-white/75">{accion}</dd>
            </div>
          ))}
        </dl>
      </Grupo>
    </>
  );
}

/** Tablero de vuelo, abajo al centro mientras se pilota. */
function Tablero() {
  const t = useEstudio((s) => s.telemetria);
  const aviso = useEstudio((s) => s.avisoVuelo);
  if (!t) return null;
  const estado = t.chocado ? "Choque" : !t.armado ? "Desarmado" : t.enTierra ? "Armado · en tierra" : "En vuelo";
  const colorEstado = t.chocado ? "text-red-400" : t.armado ? "text-mxd-verde-acento" : "text-white/80";
  const datos: [string, string, string][] = [
    ["Altura", t.altura.toFixed(1), "m"],
    ["Velocidad", t.velocidad.toFixed(1), "m/s"],
    ["Vertical", (t.vertical >= 0 ? "+" : "") + t.vertical.toFixed(1), "m/s"],
    ["Empuje", Math.round(t.empuje * 100).toString(), "%"],
    ["Rumbo", Math.round(t.rumbo).toString().padStart(3, "0"), "°"],
  ];
  return (
    <div className="flex flex-col items-center gap-2">
      {aviso && (
        <p role="status" className="vidrio aparecer px-4 py-1.5 text-xs font-semibold text-white">
          {aviso}
        </p>
      )}
      <div className="vidrio flex items-stretch divide-x divide-white/10">
        <div className="flex flex-col justify-center px-4 py-2">
          <span className="rotulo text-[9px] text-white/65">
            {MODOS_VUELO.find((m) => m.clave === t.modo)?.nombre}
          </span>
          <span className={`rotulo text-xs ${colorEstado}`}>{estado}</span>
        </div>
        {datos.map(([etiqueta, valor, unidad]) => (
          <div key={etiqueta} className="flex min-w-[78px] flex-col items-center justify-center px-3 py-2">
            <span className="rotulo text-[9px] text-white/65">{etiqueta}</span>
            <span className="font-titulo text-2xl font-semibold tabular-nums leading-none text-white">
              {valor}
              <span className="ml-0.5 text-xs font-medium text-white/70">{unidad}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PantallaCampo({ alVolverTaller }: { alVolverTaller: () => void }) {
  const escena = useEstudio((s) => s.escena);
  const ajustar = useEstudio((s) => s.ajustar);
  const tomas = useEstudio((s) => s.tomas);
  const setTomas = useEstudio((s) => s.setTomas);
  const capturador = useEstudio((s) => s.capturador);
  const setAviso = useEstudio((s) => s.setAviso);
  const [pestana, setPestana] = useState<Pestana>("pilotar");
  const nombreMapa = useEstudio((s) => entornoPorClave(s.entorno).nombre);
  const pilotando = useEstudio((s) => s.pilotando);
  const [panelAbierto, setPanelAbierto] = useState(true);
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
  const total = tomas.length * loteColores.length * loteFormatos.length;

  return (
    <>
      <div className="pointer-events-none absolute left-6 top-6 sm:left-10 sm:top-10">
        <TituloPantalla titulo="Campo" subtitulo={`${nombreMapa} · pintura ${nombreDeColor(escena.color)}`} />
      </div>

      {/* Panel de mandos, a la derecha */}
      {panelAbierto ? (
        <aside className="vidrio aparecer absolute bottom-24 right-4 top-4 flex w-[min(360px,calc(100%-2rem))] flex-col sm:right-6 sm:top-6">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <nav aria-label="Mandos" className="flex flex-wrap gap-x-4 gap-y-2">
              {PESTANAS.map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  aria-current={pestana === p.clave ? "page" : undefined}
                  onClick={() => setPestana(p.clave)}
                  className={`rotulo whitespace-nowrap border-b-2 pb-1 text-[11px] transition-colors ${
                    pestana === p.clave ? "border-white text-white" : "border-transparent text-white/70 hover:text-white/80"
                  }`}
                >
                  {p.nombre}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setPanelAbierto(false)}
              aria-label="Ocultar panel"
              className="ml-2 px-1 text-lg leading-none text-white/70 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {pestana === "pilotar" && <PestanaPilotar />}

            {pestana === "dron" && (
              <>
                <Grupo>
                  <Deslizador etiqueta="Despliegue" valor={escena.despliegue} min={0} max={1} paso={0.01}
                    alCambiar={(despliegue) => ajustar({ despliegue })} deshabilitado={escena.despiece > 0} />
                  <Deslizador etiqueta="Rotores" valor={escena.encendido} min={0} max={1} paso={0.01}
                    alCambiar={(encendido) => ajustar({ encendido })} deshabilitado={!listo} />
                  <Deslizador etiqueta="Despiece vertical" valor={escena.despiece} min={0} max={1} paso={0.01}
                    alCambiar={(despiece) => ajustar({ despiece })} />
                </Grupo>
                <Grupo titulo="Presentación">
                  <Interruptor etiqueta="Etiquetas con datos" activo={escena.etiquetas}
                    alCambiar={(etiquetas) => ajustar({ etiquetas })} />
                  <Interruptor etiqueta="Estilo líneas (dibujo técnico)" activo={escena.lineas}
                    alCambiar={(lineas) => ajustar({ lineas })} />
                </Grupo>
              </>
            )}

            {pestana === "aspersion" && (
              <Grupo>
                <Interruptor etiqueta="Aspersión" activo={escena.aspersion} deshabilitado={escena.despiece > 0}
                  alCambiar={(aspersion) => ajustar({ aspersion })} />
                {!listo && escena.aspersion && (
                  <p className="text-xs text-white/70">Sale agua con los brazos desplegados al 100 %.</p>
                )}
                <Deslizador etiqueta="RPM visual" valor={escena.rpm} min={RPM_VISUAL.min} max={RPM_VISUAL.max} paso={10}
                  unidad="rpm" alCambiar={(rpm) => ajustar({ rpm })} />
                <Deslizador etiqueta="Caudal visual" valor={escena.caudal} min={CAUDAL_VISUAL.min}
                  max={CAUDAL_VISUAL.max} paso={50} unidad="gotas/s" alCambiar={(caudal) => ajustar({ caudal })} />
              </Grupo>
            )}

            {pestana === "vuelo" && (
              <>
                <Grupo>
                  <Deslizador etiqueta="Altura de vuelo" valor={escena.altura} min={ALTURA_VUELO.min}
                    max={ALTURA_VUELO.max} paso={0.05} unidad="m" alCambiar={(altura) => ajustar({ altura })} />
                  <Deslizador etiqueta="Altura del follaje" valor={escena.follaje} min={ALTURA_FOLLAJE.min}
                    max={ALTURA_FOLLAJE.max} paso={0.05} unidad="m" alCambiar={(follaje) => ajustar({ follaje })} />
                </Grupo>
                <Grupo titulo="Hora (sombras)">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(HORAS) as Hora[]).map((h) => (
                      <BotonSecundario key={h} activo={escena.hora === h} onClick={() => ajustar({ hora: h })}>
                        {HORAS[h].etiqueta}
                      </BotonSecundario>
                    ))}
                  </div>
                </Grupo>
              </>
            )}

            {pestana === "captura" && (
              <>
                <Grupo titulo="Exportar lo que se ve">
                  <div className="grid grid-cols-2 gap-1.5">
                    {FORMATOS.map((f) => (
                      <BotonSecundario key={f.clave} disabled={!capturador || ocupado}
                        onClick={() => ejecutar(() => exportarActual(f))}>
                        {f.nombre}
                      </BotonSecundario>
                    ))}
                  </div>
                </Grupo>
                <Grupo titulo="Lote: tomas × pinturas × formatos">
                  <div className="flex flex-wrap gap-1.5">
                    {COLORES_LOTE.map((c) => {
                      const activo = loteColores.includes(c);
                      return (
                        <BotonSecundario key={c ?? "original"} activo={activo}
                          onClick={() => setLoteColores(activo ? loteColores.filter((x) => x !== c) : [...loteColores, c])}>
                          {nombreDeColor(c)}
                        </BotonSecundario>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FORMATOS.map((f) => {
                      const activo = loteFormatos.includes(f.clave);
                      return (
                        <BotonSecundario key={f.clave} activo={activo}
                          onClick={() => setLoteFormatos(activo ? loteFormatos.filter((x) => x !== f.clave) : [...loteFormatos, f.clave])}>
                          {f.nombre}
                        </BotonSecundario>
                      );
                    })}
                  </div>
                  <BotonSecundario
                    disabled={!capturador || ocupado || total === 0}
                    onClick={() =>
                      ejecutar(() =>
                        exportarLote(tomas, loteColores, FORMATOS.filter((f) => loteFormatos.includes(f.clave)), setAviso),
                      )
                    }>
                    Exportar {total} imágenes (zip)
                  </BotonSecundario>
                  {tomas.length === 0 && (
                    <p className="text-xs text-white/70">Guarda al menos una toma en la pestaña Tomas.</p>
                  )}
                </Grupo>
              </>
            )}

            {pestana === "tomas" && (
              <>
                <Grupo titulo="Guardar la vista actual">
                  <div className="flex gap-1.5">
                    <input value={nombreToma} onChange={(e) => setNombreToma(e.target.value)} placeholder="Nombre de la toma"
                      aria-label="Nombre de la toma"
                      className="min-w-0 flex-1 border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none" />
                    <BotonSecundario disabled={!capturador || !nombreToma.trim()}
                      onClick={() => {
                        if (!capturador) return;
                        guardarTomas([
                          ...tomas,
                          { id: crypto.randomUUID(), nombre: nombreToma.trim(), camara: capturador.leerCamara(), escena },
                        ]);
                        setNombreToma("");
                      }}>
                      Guardar
                    </BotonSecundario>
                  </div>
                </Grupo>
                <Grupo titulo={`Tomas (${tomas.length})`}>
                  <ul className="flex flex-col">
                    {tomas.map((t) => (
                      <li key={t.id} className="group flex items-center gap-2 border-b border-white/5 py-2 last:border-0">
                        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-white/85 hover:text-white"
                          onClick={() => {
                            ajustar(t.escena);
                            capturador?.aplicarCamara(t.camara);
                          }}>
                          {t.nombre}
                        </button>
                        <span className="rotulo text-[9px] text-white/60">{nombreDeColor(t.escena.color)}</span>
                        <button type="button" aria-label={`Borrar ${t.nombre}`}
                          className="text-white/55 hover:text-red-400"
                          onClick={() => guardarTomas(tomas.filter((x) => x.id !== t.id))}>
                          ×
                        </button>
                      </li>
                    ))}
                    {tomas.length === 0 && <li className="text-xs text-white/70">Todavía no hay tomas.</li>}
                  </ul>
                  <div className="flex gap-1.5">
                    <BotonSecundario disabled={tomas.length === 0}
                      onClick={() => descargar(new Blob([JSON.stringify(tomas, null, 2)], { type: "application/json" }), "tomas_mx80.json")}>
                      Exportar JSON
                    </BotonSecundario>
                    <BotonSecundario onClick={() => archivoTomas.current?.click()}>Importar JSON</BotonSecundario>
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
                </Grupo>
              </>
            )}
          </div>
        </aside>
      ) : (
        <div className="absolute right-6 top-6">
          <BotonSecundario onClick={() => setPanelAbierto(true)}>Mandos</BotonSecundario>
        </div>
      )}

      {/* Barra inferior */}
      <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4 sm:inset-x-10">
        <BotonSecundario onClick={alVolverTaller}>← Taller</BotonSecundario>
        <div className="flex flex-col items-center gap-2">
          <Aviso />
          {pilotando ? <Tablero /> : <AyudaControles />}
        </div>
        <BotonPrincipal disabled={!capturador || ocupado} onClick={() => ejecutar(() => exportarActual(FORMATOS[0]))}>
          Foto 4K
        </BotonPrincipal>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

export function Panel() {
  const modo = useEstudio((s) => s.modo);
  const setModo = useEstudio((s) => s.setModo);
  const setEntorno = useEstudio((s) => s.setEntorno);
  const [eligiendoMapa, setEligiendoMapa] = useState(false);

  if (modo === "campo") {
    return <PantallaCampo alVolverTaller={() => setModo("taller")} />;
  }
  return eligiendoMapa ? (
    <PantallaMapas
      alVolver={() => setEligiendoMapa(false)}
      alCargar={(clave) => {
        setEntorno(clave);
        setEligiendoMapa(false);
        setModo("campo");
      }}
    />
  ) : (
    <PantallaTaller alElegirMapa={() => setEligiendoMapa(true)} />
  );
}
