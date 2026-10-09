"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  BLOQUEA_DESPLIEGUE,
  ETIQUETAS_ZONA,
  DESPIECE_APAGA_MOTORES,
  DESPIECE_MAXIMO,
  useVisor,
} from "./estado";

const EscenaFrame = dynamic(
  () => import("./EscenaFrame").then((m) => m.EscenaFrame),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-mxd-borde border-t-mxd-verde" />
      </div>
    ),
  },
);

function BarraLateral({
  etiqueta,
  valor,
  onChange,
  bloqueada = false,
  motivo,
}: {
  etiqueta: string;
  /** Valor 0..1. Se muestra y se edita como porcentaje entero. */
  valor: number;
  onChange: (valor: number) => void;
  bloqueada?: boolean;
  /** Linea de apoyo: que hace, o por que esta bloqueada. */
  motivo: string;
}) {
  const porcentaje = Math.round(valor * 100);
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 lg:px-3 lg:py-2.5 ${
        bloqueada ? "border-mxd-borde bg-mxd-hueso" : "border-mxd-borde bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={`barra-${etiqueta}`}
          className={`text-[11px] font-bold uppercase tracking-widest ${
            bloqueada ? "text-mxd-gris/50" : "text-mxd-gris"
          }`}
        >
          {etiqueta}
        </label>
        <span
          className={`font-mono text-[11px] font-semibold ${
            bloqueada ? "text-mxd-gris/50" : "text-mxd-verde"
          }`}
        >
          {porcentaje}%
        </span>
      </div>
      <input
        id={`barra-${etiqueta}`}
        type="range"
        min={0}
        max={100}
        step={1}
        value={porcentaje}
        disabled={bloqueada}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={`mxd-deslizador mt-1 w-full lg:mt-1.5 ${bloqueada ? "cursor-not-allowed opacity-50" : ""}`}
        style={{
          background: `linear-gradient(to right, var(--color-mxd-verde-acento) ${porcentaje}%, var(--color-mxd-borde) ${porcentaje}%)`,
        }}
        aria-valuetext={`${porcentaje} por ciento`}
      />
      <p
        className={`mt-1 text-[10px] leading-snug ${
          bloqueada ? "block text-mxd-gris/60" : "hidden text-mxd-gris lg:block"
        }`}
      >
        {motivo}
      </p>
    </div>
  );
}

/**
 * Visor del dron completo: los 4 brazos plegables, el marco y el tanque.
 *
 * Los mandos van en una barra lateral a la derecha, cada uno de ida y vuelta
 * con el mismo boton:
 *   Desplegar / Contraer       abre o pliega los brazos
 *   Encender / Apagar motores  pone a girar los rotores
 *
 * Las reglas que los relacionan NO viven aqui sino en estado.ts, para que
 * valgan venga de donde venga el cambio y no solo al pulsar un boton:
 *   - los motores no se encienden con los brazos plegados
 *   - al contraer, los motores se apagan
 *   - pasado el umbral de despiece, los motores se apagan solos
 */
export function VisorFrame({ className = "" }: { className?: string }) {
  const router = useRouter();
  const contenedor = useRef<HTMLDivElement>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  /**
   * Pantalla completa.
   *
   * Se hace con una capa fija (inset-0) y NO con la API de pantalla completa
   * del navegador, porque Safari en iPhone no la soporta para nada que no sea
   * un video: ahi el boton no haria nada. La capa funciona igual en los tres
   * sitios. Donde la API si existe se pide ademas, para ganar el ocultado de
   * la barra del navegador en escritorio.
   */
  const alternarPantallaCompleta = useCallback(() => {
    setPantallaCompleta((previo) => {
      const siguiente = !previo;
      const elemento = contenedor.current;
      if (siguiente) {
        elemento?.requestFullscreen?.().catch(() => {
          // Sin API nativa la capa fija ya basta; no hay nada que reportar.
        });
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return siguiente;
    });
  }, []);

  // Salir con Escape, o cuando el navegador cierra la pantalla completa por su
  // cuenta, deja el estado en su sitio en vez de una capa fija sin salida.
  useEffect(() => {
    const alCambiar = () => {
      if (!document.fullscreenElement) setPantallaCompleta(false);
    };
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  const despliegue = useVisor((s) => s.despliegue);
  const setDespliegue = useVisor((s) => s.setDespliegue);
  const encendido = useVisor((s) => s.encendido);
  const setEncendido = useVisor((s) => s.setEncendido);
  const explosion = useVisor((s) => s.explosion);
  const setExplosion = useVisor((s) => s.setExplosion);
  const despieceAtomico = useVisor((s) => s.despieceAtomico);
  const setDespieceAtomico = useVisor((s) => s.setDespieceAtomico);
  const reiniciarVista = useVisor((s) => s.reiniciarVista);
  const capa = useVisor((s) => s.capa);
  const zona = useVisor((s) => s.zona);
  const piezaAislada = useVisor((s) => s.piezaAislada);
  const entrarEnZona = useVisor((s) => s.entrarEnZona);
  const entrarEnPieza = useVisor((s) => s.entrarEnPieza);
  const volver = useVisor((s) => s.volver);

  // Estado limpio al entrar: brazos plegados, motores apagados, sin despiece.
  useEffect(() => {
    reiniciarVista();
  }, [reiniciarVista]);

  const umbral = Math.round(DESPIECE_APAGA_MOTORES * 100);
  // Normalizado: explosion va de 0 a DESPIECE_MAXIMO y la barra muestra la
  // fraccion, asi que el umbral se compara contra la fraccion.
  const despiezado = explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES;
  // Bloqueo mutuo: el encendido necesita el despliegue al 100, y en cuanto hay
  // motor en marcha el despliegue se congela.
  // El despiece atomico deja el dron desarmado: congela los tres mandos y la
  // unica salida es ensamblar.
  const atomico = despieceAtomico > 0;
  const enCompleto = capa === 1;
  const MOTIVO_CAPA = "Solo disponible en la vista del dron completo";
  const MOTIVO_ATOMICO = "Bloqueado: el despiece atómico está activo";
  const encendidoBloqueado = !enCompleto || atomico || despliegue < 1 || despiezado;
  const despliegueBloqueado = !enCompleto || atomico || encendido > BLOQUEA_DESPLIEGUE || despiezado;
  // Despiece atomico: disponible en capa 1 (dron completo) y capa 2 (zona activa).
  const atomicoBloqueado = capa === 3;
  const motivoDespliegue = !enCompleto
    ? MOTIVO_CAPA
    : atomico
      ? MOTIVO_ATOMICO
    : despiezado
    ? `Bloqueado arriba del ${umbral}% de despiece`
    : encendido > BLOQUEA_DESPLIEGUE
      ? "Bloqueado: apaga los motores para mover los brazos"
      : "Abre los cuatro brazos del dron";
  const porcentaje = Math.round(explosion * 100);
  const maximoDespiece = DESPIECE_MAXIMO * 100;
  const relleno = (porcentaje / maximoDespiece) * 100;


  return (
    <div
      ref={contenedor}
      className={`flex flex-col overflow-hidden border-mxd-borde mxd-fondo-visor lg:flex-row ${
        pantallaCompleta
          ? "fixed inset-0 z-50 h-[100dvh] w-screen rounded-none border-0"
          : `rounded-2xl border ${className}`
      }`}
    >
      {/* Lienzo 3D: ocupa lo que le deja la barra, nunca queda debajo de ella. */}
      <div className="mxd-lienzo-3d relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 mxd-reticula opacity-60" />
        <EscenaFrame
          despliegue={despliegue}
          encendido={encendido}
          explosion={explosion}
          despieceAtomico={despieceAtomico}
          capa={capa}
          zona={zona}
          piezaAislada={piezaAislada}
          alClicBrazo={(nombreBrazo) => {
            // En la vista completa un clic ENTRA en la zona; dentro de una
            // zona, aisla la pieza. Antes mandaba siempre a /catalogo/motor,
            // sin importar en que brazo o en que pieza se hubiera hecho clic.
            if (capa === 1) {
              entrarEnZona(
                nombreBrazo === "brazo" || nombreBrazo === "brazo_4"
                  ? "brazo-ccw"
                  : "brazo-cw",
              );
            }
          }}
          alClicMarco={() => {
            if (capa === 1) entrarEnZona("frame");
          }}
          alClicTanque={() => {
            if (capa === 1) entrarEnZona("tanque");
          }}
          alClicTren={() => {
            if (capa === 1) entrarEnZona("tren-aterrizaje");
          }}
          alClicFrente={() => {
            if (capa === 1) entrarEnZona("frente");
          }}
          alClicPieza={(nombre) => {
            if (capa === 2) entrarEnPieza(nombre);
          }}
        />
        {/* Rastro de migas y vuelta atras: solo aparecen al haber bajado de
            capa, para no ocupar el lienzo en la vista completa. */}
        {capa > 1 && (
          <div className="absolute left-2 top-2 z-10 flex items-center gap-2 lg:left-3 lg:top-3">
            <button
              type="button"
              onClick={volver}
              title="Volver a la vista anterior"
              className="rounded-lg border border-mxd-borde bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde lg:text-xs"
            >
              ← Atrás
            </button>
            <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] font-medium text-mxd-gris backdrop-blur lg:text-[11px]">
              {capa === 2
                ? `MX80 · ${zona ? ETIQUETAS_ZONA[zona] : ""}`
                : `MX80 · ${zona ? ETIQUETAS_ZONA[zona] : ""} · pieza`}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={alternarPantallaCompleta}
          title={
            pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"
          }
          aria-pressed={pantallaCompleta}
          className="absolute right-2 top-2 z-10 rounded-lg border border-mxd-borde bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde lg:right-3 lg:top-3 lg:text-xs"
        >
          {pantallaCompleta ? "Salir" : "Expandir"}
        </button>

        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] text-mxd-gris">
          <span className="lg:hidden">
            Un dedo gira · dos dedos acercan y desplazan · toca una pieza
          </span>
          <span className="hidden lg:inline">
            Arrastra para girar · botón derecho desplaza · clic en una pieza
          </span>
        </p>

      </div>

      {/* Barra de mandos: abajo en movil, a la derecha en escritorio. */}
      <aside className="max-h-[38dvh] shrink-0 overflow-y-auto border-t border-mxd-borde bg-white/95 p-2 backdrop-blur lg:max-h-none lg:w-56 lg:border-l lg:border-t-0 lg:p-3">
        <h2 className="mb-1.5 hidden text-[10px] font-bold uppercase tracking-widest text-mxd-gris lg:mb-2 lg:block">
          Controles
        </h2>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <BarraLateral
            etiqueta="Despliegue"
            valor={despliegue}
            onChange={setDespliegue}
            bloqueada={despliegueBloqueado}
            motivo={motivoDespliegue}
          />

          <BarraLateral
            etiqueta="Encendido"
            valor={encendido}
            onChange={setEncendido}
            bloqueada={encendidoBloqueado}
            motivo={
              !enCompleto
                ? MOTIVO_CAPA
                : atomico
                ? MOTIVO_ATOMICO
                : despiezado
                  ? `Bloqueado arriba del ${umbral}% de despiece`
                  : despliegue < 1
                    ? "Bloqueado: despliega los brazos al 100%"
                    : "Acelera los cuatro rotores"
            }
          />

          <BarraLateral
            etiqueta="Despiece"
            valor={explosion / DESPIECE_MAXIMO}
            onChange={(v) => setExplosion(v * DESPIECE_MAXIMO)}
            bloqueada={atomico}
            motivo={
              atomico
                ? MOTIVO_ATOMICO
                :
              explosion > 1.5
                ? "Conjuntos acomodados en cuadrícula"
                : explosion > 0
                  ? "Separa los conjuntos del dron"
                  : "Arrastra para separar el dron"
            }
          />

          {/* Otro despiece, no un atajo del deslizador: aquel separa
              conjuntos (brazo, marco, tanque) y este baja a componente. */}
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1 lg:gap-2">
          <button
            type="button"
            title={
              atomicoBloqueado
                ? "No disponible en vista de pieza individual"
                : "Separar cada componente por separado, en cuadrícula"
            }
            aria-pressed={despieceAtomico > 0}
            disabled={atomicoBloqueado}
            onClick={() => !atomicoBloqueado && setDespieceAtomico(despieceAtomico > 0 ? 0 : 1)}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors lg:px-3 lg:py-2 lg:text-xs ${
              atomicoBloqueado
                ? "cursor-not-allowed border-mxd-borde bg-mxd-hueso text-mxd-gris/50"
                : despieceAtomico > 0
                  ? "border-mxd-verde bg-mxd-verde text-white hover:bg-mxd-verde-oscuro"
                  : "border-mxd-borde bg-white text-mxd-tinta hover:border-mxd-verde hover:text-mxd-verde"
            }`}
          >
            {despieceAtomico > 0 ? "Ensamblar" : "Despiece"}
          </button>

          <button
            type="button"
            title="Volver al estado inicial"
            onClick={reiniciarVista}
            className="rounded-lg border border-mxd-borde bg-white px-2 py-1.5 text-[11px] font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde lg:px-3 lg:py-2 lg:text-xs"
          >
            Reiniciar
          </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
