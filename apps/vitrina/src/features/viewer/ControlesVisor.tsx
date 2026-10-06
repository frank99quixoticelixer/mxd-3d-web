"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ETIQUETAS_SUBSISTEMA, type Pieza } from "@/lib/esquema";
import { valorOPendiente } from "@/lib/texto";
import { DIAGNOSTICO_ACTIVO } from "@/config/modelos3d";
import {
  FORMATOS,
  descargasDe,
  tamanoLegible,
  urlDescarga,
} from "@/lib/descargas";
import { DESPIECE_MAXIMO, useVisor } from "./estado";

/* ---------------------------------------------------------------
   Piezas de interfaz reutilizables dentro del visor
   --------------------------------------------------------------- */

function BotonIcono({
  activo,
  titulo,
  onClick,
  children,
}: {
  activo?: boolean;
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium",
        "backdrop-blur transition-colors",
        activo
          ? "border-mxd-verde bg-mxd-verde text-white"
          : "border-mxd-borde bg-white/85 text-mxd-tinta hover:border-mxd-verde hover:text-mxd-verde",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-mxd-borde bg-white/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-mxd-gris backdrop-blur">
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------
   Lista de piezas (columna izquierda en escritorio)
   --------------------------------------------------------------- */

function ListaPiezas({ catalogo }: { catalogo: Pieza[] }) {
  // Renglones de primer nivel: solo piezas de catalogo. Las subpiezas cuelgan de
  // su padre y se despliegan cuando ese padre (o una de ellas) esta seleccionado,
  // para elegir una por separado y bajar sus archivos.
  const piezas = catalogo.filter((p) => p.parteDe === null);
  const skusEnEscena = useVisor((s) => s.skusEnEscena);
  const seleccion = useVisor((s) => s.seleccion);
  const seleccionar = useVisor((s) => s.seleccionar);
  const setHover = useVisor((s) => s.setHover);

  const presentes = useMemo(
    () => new Set(skusEnEscena),
    [skusEnEscena],
  );

  /** Elegir una subpieza la selecciona; "Ver sola" en su ficha abre su visor propio. */
  function elegirSubpieza(sku: string, activa: boolean) {
    seleccionar(activa ? null : sku);
  }

  return (
    <div className="pointer-events-auto hidden max-h-[calc(100%-7rem)] w-60 flex-col overflow-hidden rounded-xl border border-mxd-borde bg-white/90 backdrop-blur lg:flex">
      <div className="border-b border-mxd-borde px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-mxd-gris">
          Piezas del ensamble
        </p>
      </div>
      <ul className="overflow-y-auto">
        {piezas.map((pieza) => {
          const enEscena = presentes.has(pieza.sku);
          const activa = seleccion === pieza.sku;
          const subpiezas = catalogo
            .filter((p) => p.parteDe === pieza.sku)
            .sort((a, b) => a.orden - b.orden);
          const abierta =
            activa || subpiezas.some((sub) => sub.sku === seleccion);
          return (
            <li key={pieza.sku}>
              <button
                type="button"
                disabled={!enEscena}
                onClick={() => seleccionar(activa ? null : pieza.sku)}
                onMouseEnter={() => enEscena && setHover(pieza.sku)}
                onMouseLeave={() => setHover(null)}
                aria-expanded={subpiezas.length > 0 ? abierta : undefined}
                className={[
                  "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-xs transition-colors",
                  activa
                    ? "border-mxd-verde bg-mxd-verde-claro text-mxd-verde-oscuro"
                    : "border-transparent hover:bg-mxd-hueso",
                  !enEscena && "cursor-not-allowed opacity-40",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="font-mono text-[10px] text-mxd-gris">
                  {pieza.sku.replace("MX80-", "")}
                </span>
                <span className="flex-1 leading-tight">{pieza.nombre}</span>
                {subpiezas.length > 0 && (
                  <span className="text-[10px] text-mxd-gris">
                    {abierta ? "−" : `+${subpiezas.length}`}
                  </span>
                )}
              </button>
              {abierta && subpiezas.length > 0 && (
                <ul className="bg-mxd-hueso/60">
                  {subpiezas.map((sub) => {
                    const subActiva = seleccion === sub.sku;
                    const subEnEscena = presentes.has(sub.sku);
                    return (
                      <li key={sub.sku}>
                        <button
                          type="button"
                          disabled={!subEnEscena}
                          onClick={() => elegirSubpieza(sub.sku, subActiva)}
                          onMouseEnter={() => subEnEscena && setHover(sub.sku)}
                          onMouseLeave={() => setHover(null)}
                          className={[
                            "flex w-full items-center gap-2 border-l-2 py-1.5 pl-6 pr-3 text-left text-[11px] transition-colors",
                            subActiva
                              ? "border-mxd-verde bg-mxd-verde-claro text-mxd-verde-oscuro"
                              : "border-transparent hover:bg-mxd-hueso",
                            !subEnEscena && "cursor-not-allowed opacity-40",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span className="font-mono text-[9px] text-mxd-gris">
                            {sub.sku.slice(-2)}
                          </span>
                          <span className="flex-1 leading-tight">
                            {sub.nombre}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------
   Ficha rapida de la pieza seleccionada
   --------------------------------------------------------------- */

export function FichaRapida({ catalogo }: { catalogo: Pieza[] }) {
  const seleccion = useVisor((s) => s.seleccion);
  const seleccionar = useVisor((s) => s.seleccionar);
  const verSola = useVisor((s) => s.verSola);
  const alternarVerSola = useVisor((s) => s.alternarVerSola);

  const pieza = catalogo.find((p) => p.sku === seleccion);
  if (!pieza) return null;
  const padre = pieza.parteDe
    ? catalogo.find((p) => p.sku === pieza.parteDe)
    : undefined;
  const descargas = descargasDe(pieza.sku);

  const specs: Array<[string, string]> = [
    ["Masa", valorOPendiente(pieza.especificaciones.masa_g, "g")],
    ["Material", valorOPendiente(pieza.especificaciones.material)],
    [
      "Dimensiones",
      pieza.especificaciones.largo_mm &&
      pieza.especificaciones.ancho_mm &&
      pieza.especificaciones.alto_mm
        ? `${pieza.especificaciones.largo_mm} x ${pieza.especificaciones.ancho_mm} x ${pieza.especificaciones.alto_mm} mm`
        : "Pendiente",
    ],
  ];

  return (
    <div className="w-full p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-mxd-verde">
            {pieza.sku}
          </p>
          {padre && (
            <p className="text-[10px] text-mxd-gris">Parte de: {padre.nombre}</p>
          )}
          <h3 className="mt-0.5 text-sm font-semibold leading-tight text-mxd-tinta">
            {pieza.nombre}
          </h3>
          <p className="mt-1 text-[11px] text-mxd-gris">
            {ETIQUETAS_SUBSISTEMA[pieza.subsistema]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => seleccionar(null)}
          aria-label="Cerrar ficha"
          className="rounded-md p-1 text-mxd-gris transition-colors hover:bg-mxd-hueso hover:text-mxd-tinta"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-mxd-borde pt-3">
        {specs.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex justify-between gap-3 text-[11px]">
            <dt className="text-mxd-gris">{etiqueta}</dt>
            <dd
              className={
                valor === "Pendiente"
                  ? "italic text-mxd-gris/70"
                  : "font-medium text-mxd-tinta"
              }
            >
              {valor}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 border-t border-mxd-borde pt-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-mxd-gris">
          Descargar malla
        </p>
        {FORMATOS.some((f) => descargas[f]) ? (
          <div className="mt-1.5 flex gap-2">
            {FORMATOS.map((formato) => {
              const bytes = descargas[formato];
              if (!bytes) return null;
              return (
                <a
                  key={formato}
                  href={urlDescarga(pieza.sku, formato)}
                  download
                  className="flex-1 rounded-lg border border-mxd-borde px-2 py-1.5 text-center text-[11px] font-medium text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
                >
                  {formato.toUpperCase()}
                  <span className="block text-[9px] font-normal text-mxd-gris">
                    {tamanoLegible(bytes)}
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[11px] italic text-mxd-gris/70">
            Sin archivos disponibles todavía
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={alternarVerSola}
          disabled={!descargas.glb}
          aria-pressed={verSola}
          title={
            descargas.glb
              ? "Ver la pieza sola en 3D"
              : "Esta pieza todavia no tiene modelo individual"
          }
          className={[
            "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-40",
            verSola
              ? "border-mxd-verde bg-mxd-verde text-white"
              : "border-mxd-borde text-mxd-tinta hover:border-mxd-verde hover:text-mxd-verde",
          ].join(" ")}
        >
          {verSola ? "Ver ensamble" : "Ver sola"}
        </button>
        <Link
          href={`/catalogo/${pieza.slug}`}
          className="flex-1 rounded-lg bg-mxd-tinta px-2 py-1.5 text-center text-[11px] font-medium text-white transition-colors hover:bg-mxd-verde-oscuro"
        >
          Ver ficha
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Barra inferior: explosionado y acciones
   --------------------------------------------------------------- */

function BarraInferior() {
  const explosion = useVisor((s) => s.explosion);
  const setExplosion = useVisor((s) => s.setExplosion);
  const autoRotar = useVisor((s) => s.autoRotar);
  const alternarAutoRotar = useVisor((s) => s.alternarAutoRotar);
  const reiniciarVista = useVisor((s) => s.reiniciarVista);

  const porcentaje = Math.round(explosion * 100);
  const maximo = DESPIECE_MAXIMO * 100;
  const relleno = (porcentaje / maximo) * 100;

  return (
    <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-xl border border-mxd-borde bg-white/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <label
          htmlFor="control-explosion"
          className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-mxd-gris"
        >
          Despiece
        </label>
        <div className="w-full">
          <input
            id="control-explosion"
            type="range"
            min={0}
            max={maximo}
            step={1}
            value={porcentaje}
            onChange={(e) => setExplosion(Number(e.target.value) / 100)}
            className="mxd-deslizador w-full"
            // Tramo recorrido en verde brillante, el resto en gris.
            style={{
              background: `linear-gradient(to right, var(--color-mxd-verde-acento) ${relleno}%, var(--color-mxd-borde) ${relleno}%)`,
            }}
            aria-valuetext={`${porcentaje} por ciento`}
          />
          <div className="mt-1 flex justify-between text-[9px] font-medium uppercase tracking-wider text-mxd-gris">
            <span>Ensamblado</span>
            <span>Explotado</span>
            <span>Organizado</span>
          </div>
        </div>
        <span className="w-11 shrink-0 text-right font-mono text-[11px] font-semibold text-mxd-verde">
          {porcentaje}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BotonIcono
          titulo="Explotar por completo"
          activo={explosion > 0.5 && explosion <= 1.5}
          onClick={() =>
            setExplosion(explosion > 0.5 && explosion <= 1.5 ? 0 : 1)
          }
        >
          {explosion > 0.5 && explosion <= 1.5 ? "Ensamblar" : "Explotar"}
        </BotonIcono>
        <BotonIcono
          titulo="Organizar las piezas en filas y columnas"
          activo={explosion > 1.5}
          onClick={() => setExplosion(explosion > 1.5 ? 0 : DESPIECE_MAXIMO)}
        >
          {explosion > 1.5 ? "Ensamblar" : "Organizar"}
        </BotonIcono>
        <BotonIcono
          titulo="Rotación automática"
          activo={autoRotar}
          onClick={alternarAutoRotar}
        >
          Girar
        </BotonIcono>
        <BotonIcono titulo="Reiniciar la vista" onClick={reiniciarVista}>
          Reiniciar
        </BotonIcono>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Panel de diagnostico (solo desarrollo)
   --------------------------------------------------------------- */

function PanelDiagnostico() {
  const nodos = useVisor((s) => s.nodosSinCoincidencia);
  const skus = useVisor((s) => s.skusEnEscena);
  const modoDemo = useVisor((s) => s.modoDemo);

  if (!DIAGNOSTICO_ACTIVO || modoDemo || nodos.length === 0) return null;

  return (
    <div className="pointer-events-auto max-w-xs rounded-lg border border-amber-300 bg-amber-50/95 p-3 text-[11px] backdrop-blur">
      <p className="font-semibold text-amber-900">
        {nodos.length} objeto(s) del GLB sin pieza asociada
      </p>
      <p className="mt-1 text-amber-800">
        Se reconocieron {skus.length}. Agrega estos nombres al campo
        <code className="mx-1 rounded bg-amber-100 px-1">nombresBlender</code>
        en src/data/mx80.ts:
      </p>
      <ul className="mt-1.5 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-amber-900">
        {nodos.slice(0, 20).map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------
   Capa completa de controles
   --------------------------------------------------------------- */

export function ControlesVisor({
  catalogo,
  compacto = false,
}: {
  catalogo: Pieza[];
  /** Oculta la lista lateral de piezas. Se usa en la portada, donde el visor es mas pequenio. */
  compacto?: boolean;
}) {
  const modoDemo = useVisor((s) => s.modoDemo);
  const seleccion = useVisor((s) => s.seleccion);
  const hover = useVisor((s) => s.hover);

  const piezaHover = catalogo.find((p) => p.sku === hover);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
      {/* Fila superior */}
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Chip>MX80</Chip>
          {modoDemo && (
            <span className="rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1 text-[11px] font-semibold text-amber-900 backdrop-blur">
              Modo demostración — sin GLB cargado
            </span>
          )}
          {piezaHover && !seleccion && (
            <Chip>{piezaHover.nombre}</Chip>
          )}
        </div>
        <PanelDiagnostico />
      </div>

      {/* Fila central: lista de piezas (la ficha vive fuera del overlay, ver VisorMXD) */}
      <div className="flex flex-1 items-center justify-between gap-3 py-3">
        {compacto ? <span /> : <ListaPiezas catalogo={catalogo} />}
        <span />
      </div>

      {/* Fila inferior */}
      <div className="flex flex-col items-center gap-2">
        <BarraInferior />
        <p className="pointer-events-none hidden text-[10px] text-mxd-gris sm:block">
          Arrastra para girar · Rueda para acercar · Clic en una pieza para
          inspeccionarla
        </p>
      </div>
    </div>
  );
}
