"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  NOMBRE_COMPONENTE,
  SKU_ZONA,
  nombreDeNodo,
  skuDePieza,
  ubicacionDeSku,
  type FichaEnlace,
} from "./componentes";
import type { ObjetivoHover, PiezaDeZona } from "./EscenaFrame";
import {
  BLOQUEA_DESPLIEGUE,
  ETIQUETAS_ZONA,
  DESPIECE_APAGA_MOTORES,
  DESPIECE_MAXIMO,
  ZONAS,
  esZona,
  useVisor,
} from "./estado";
import { LimiteError } from "./LimiteError";

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
  // La etiqueta puede llevar espacios y acentos, que no valen en un id.
  const id = useId();
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 lg:px-3 lg:py-2.5 ${
        bloqueada ? "border-mxd-borde bg-mxd-hueso" : "border-mxd-borde bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
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
        id={id}
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
export function VisorFrame({
  fichas,
  className = "",
}: {
  /**
   * Piezas del catalogo a las que puede llevar el visor. Las arma la pagina en
   * el servidor: este componente no importa lib/catalogo.
   */
  fichas: FichaEnlace[];
  className?: string;
}) {
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
  const pieza = useVisor((s) => s.pieza);
  const senalada = useVisor((s) => s.senalada);
  const setSenalada = useVisor((s) => s.setSenalada);
  const entrarEnZona = useVisor((s) => s.entrarEnZona);
  const entrarEnPieza = useVisor((s) => s.entrarEnPieza);
  const volver = useVisor((s) => s.volver);
  const irA = useVisor((s) => s.irA);

  const [hover, setHover] = useState<ObjetivoHover | null>(null);
  const [piezasZona, setPiezasZona] = useState<PiezaDeZona[]>([]);
  const fichaPorSku = useMemo(
    () => new Map(fichas.map((f) => [f.sku, f])),
    [fichas],
  );

  /** Nombre para mostrar de una pieza de la zona: su ficha, o su nodo. */
  const nombreDe = useCallback(
    (p: { clave: string; sku: string | null }) =>
      (p.sku ? fichaPorSku.get(p.sku)?.nombre : undefined) ??
      NOMBRE_COMPONENTE[p.clave] ??
      nombreDeNodo(p.clave),
    [fichaPorSku],
  );

  // Lo que se esta viendo: en la capa 3 la pieza aislada; en la capa 2 la
  // zona, si la zona entera es una pieza del catalogo (el marco, el tanque).
  const skuActual =
    capa === 3 && pieza
      ? skuDePieza(zona, pieza)
      : capa === 2 && zona
        ? (SKU_ZONA[zona] ?? null)
        : null;
  const fichaActual = skuActual ? fichaPorSku.get(skuActual) : undefined;
  const nombreActual =
    capa === 3 && pieza ? nombreDe({ clave: pieza, sku: skuActual }) : null;
  const nombreHover = hover
    ? hover.zona
      ? ETIQUETAS_ZONA[hover.zona]
      : nombreDe(hover)
    : null;

  /**
   * La vista vive tambien en la URL (?zona=brazo-cw&pieza=motor), por tres
   * razones: el boton Atras del navegador vuelve a la vista anterior, una
   * vista se puede compartir, y al regresar de una ficha del catalogo el
   * visor aparece donde se dejo.
   *
   * El estado manda y la URL lo sigue: cada cambio de vista agrega una
   * entrada al historial, salvo cuando el cambio viene de la propia URL.
   */
  const modoHistorial = useRef<"agregar" | "reemplazar" | "ninguno">("reemplazar");

  useEffect(() => {
    const aplicarUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const sku = params.get("sku");
      const desdeSku = sku ? ubicacionDeSku(sku) : null;
      const zonaUrl = desdeSku?.zona ?? params.get("zona");
      const piezaUrl = desdeSku ? desdeSku.pieza : params.get("pieza");
      if (esZona(zonaUrl)) irA(zonaUrl, piezaUrl);
      else reiniciarVista();
    };

    // Al montar: la vista que pida la URL. Un enlace con ?sku= se reescribe
    // a su forma de zona y pieza sin agregar una entrada al historial.
    modoHistorial.current = "reemplazar";
    aplicarUrl();
    modoHistorial.current = "agregar";

    const alRetroceder = () => {
      modoHistorial.current = "ninguno";
      aplicarUrl();
      modoHistorial.current = "agregar";
    };
    window.addEventListener("popstate", alRetroceder);

    const cancelar = useVisor.subscribe((s, previo) => {
      if (s.capa === previo.capa && s.zona === previo.zona && s.pieza === previo.pieza) {
        return;
      }
      const params = new URLSearchParams();
      if (s.zona) params.set("zona", s.zona);
      if (s.zona && s.pieza) params.set("pieza", s.pieza);
      const consulta = params.toString();
      const url = `${window.location.pathname}${consulta ? `?${consulta}` : ""}`;
      if (modoHistorial.current === "ninguno") return;
      const profundidad = (window.history.state?.mxdVisor ?? 0) as number;
      if (modoHistorial.current === "agregar") {
        window.history.pushState(
          { ...window.history.state, mxdVisor: profundidad + 1 },
          "",
          url,
        );
      } else {
        window.history.replaceState(
          { ...window.history.state, mxdVisor: profundidad },
          "",
          url,
        );
      }
    });

    // El cambio de URL de arriba ya ocurrio antes de suscribirse; se
    // sincroniza a mano la primera vez.
    const s = useVisor.getState();
    const params = new URLSearchParams();
    if (s.zona) params.set("zona", s.zona);
    if (s.zona && s.pieza) params.set("pieza", s.pieza);
    const consulta = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${consulta ? `?${consulta}` : ""}`,
    );

    return () => {
      window.removeEventListener("popstate", alRetroceder);
      cancelar();
    };
  }, [irA, reiniciarVista]);

  /**
   * Atras: si la vista anterior la puso este visor, se retrocede en el
   * historial (asi el boton del navegador y este hacen lo mismo). Si se llego
   * directo por un enlace, no hay a donde retroceder sin salir del sitio, y se
   * sube una capa reemplazando la entrada.
   */
  const atras = useCallback(() => {
    if ((window.history.state?.mxdVisor ?? 0) > 0) {
      window.history.back();
      return;
    }
    modoHistorial.current = "reemplazar";
    volver();
    modoHistorial.current = "agregar";
  }, [volver]);

  const umbral = Math.round(DESPIECE_APAGA_MOTORES * 100);
  // Normalizado: explosion va de 0 a DESPIECE_MAXIMO y la barra muestra la
  // fraccion, asi que el umbral se compara contra la fraccion.
  const despiezado = explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES;
  // Bloqueo mutuo: el encendido necesita el despliegue al 100, y en cuanto hay
  // motor en marcha el despliegue se congela.
  // El despiece atomico deja el dron desarmado: congela los tres mandos y la
  // unica salida es ensamblar.
  const atomico = despieceAtomico > 0;
  // Desplegar, encender y el despiece atomico son de la vista completa.
  // Dentro de una zona o de una pieza ya no hay dron que plegar.
  const enCompleto = capa === 1;
  const MOTIVO_CAPA = "Solo disponible en la vista del dron completo";
  const MOTIVO_ATOMICO = "Bloqueado: el despiece atómico está activo";
  const encendidoBloqueado = !enCompleto || atomico || despliegue < 1 || despiezado;
  const despliegueBloqueado = !enCompleto || atomico || encendido > BLOQUEA_DESPLIEGUE || despiezado;
  const motivoDespliegue = !enCompleto
    ? MOTIVO_CAPA
    : atomico
      ? MOTIVO_ATOMICO
    : despiezado
    ? `Bloqueado arriba del ${umbral}% de despiece`
    : encendido > BLOQUEA_DESPLIEGUE
      ? "Bloqueado: apaga los motores para mover los brazos"
      : "Abre los cuatro brazos del dron";

  // Piezas con el mismo nombre (los cuatro agarradores del marco) se numeran
  // para que la lista no repita etiquetas identicas.
  const listaZona = useMemo(() => {
    const total = new Map<string, number>();
    for (const p of piezasZona) {
      const n = nombreDe(p);
      total.set(n, (total.get(n) ?? 0) + 1);
    }
    const vistos = new Map<string, number>();
    return piezasZona.map((p) => {
      const n = nombreDe(p);
      const i = (vistos.get(n) ?? 0) + 1;
      vistos.set(n, i);
      const etiqueta = (total.get(n) ?? 0) > 1 ? `${n} ${i}` : n;
      // Las piezas identicas agrupadas (tornillos) dicen cuantas son.
      return { ...p, nombre: p.cantidad > 1 ? `${etiqueta} (${p.cantidad})` : etiqueta };
    });
  }, [piezasZona, nombreDe]);

  const claseBotonLista = (activo: boolean) =>
    `w-full rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors lg:text-xs ${
      activo
        ? "bg-mxd-verde text-white"
        : "text-mxd-tinta hover:bg-mxd-verde-claro hover:text-mxd-verde-oscuro focus-visible:bg-mxd-verde-claro"
    }`;

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
        <LimiteError
          respaldo={
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-mxd-gris">
              Este navegador no pudo mostrar el modelo 3D. El catálogo sigue
              disponible abajo.
            </div>
          }
        >
          <EscenaFrame
            despliegue={despliegue}
            encendido={encendido}
            explosion={explosion}
            despieceAtomico={despieceAtomico}
            capa={capa}
            zona={zona}
            pieza={pieza}
            senalada={senalada}
            alEntrarZona={entrarEnZona}
            alAislar={entrarEnPieza}
            alPasarSobre={setHover}
            alListarPiezas={setPiezasZona}
          />
        </LimiteError>

        {/* Atras y ruta: solo al haber bajado de capa. Cada tramo de la ruta
            lleva a esa vista. */}
        {capa > 1 && (
          <nav
            aria-label="Ruta en el visor"
            className="absolute left-2 top-2 z-10 flex items-center gap-2 lg:left-3 lg:top-3"
          >
            <button
              type="button"
              onClick={atras}
              title="Volver a la vista anterior"
              className="rounded-lg border border-mxd-borde bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-mxd-tinta shadow-sm backdrop-blur transition-colors hover:border-mxd-verde hover:text-mxd-verde lg:text-xs"
            >
              ← Atrás
            </button>
            <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-medium text-mxd-gris backdrop-blur lg:text-[11px]">
              <button type="button" onClick={() => irA(null, null)} className="hover:text-mxd-verde">
                MX80
              </button>
              {zona && (
                <>
                  <span aria-hidden>·</span>
                  {capa === 3 ? (
                    <button type="button" onClick={() => irA(zona, null)} className="hover:text-mxd-verde">
                      {ETIQUETAS_ZONA[zona]}
                    </button>
                  ) : (
                    <span className="text-mxd-tinta">{ETIQUETAS_ZONA[zona]}</span>
                  )}
                </>
              )}
              {nombreActual && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-mxd-tinta">{nombreActual}</span>
                </>
              )}
            </span>
          </nav>
        )}

        {/* Tarjeta de lo que se esta viendo, con la puerta a su ficha. El
            visor ensena donde va la pieza; la ficha dice que es. */}
        {fichaActual && (
          <div className="absolute inset-x-2 bottom-8 z-10 flex items-center justify-between gap-3 rounded-xl border border-mxd-borde bg-white/95 px-3 py-2 shadow-sm backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-sm">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-widest text-mxd-verde">
                {fichaActual.sku}
              </p>
              <p className="truncate text-sm font-semibold text-mxd-tinta">
                {fichaActual.nombre}
              </p>
            </div>
            <Link
              href={`/catalogo/${fichaActual.slug}`}
              className="shrink-0 rounded-lg bg-mxd-verde px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
            >
              Ver ficha
            </Link>
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
          {nombreHover ? (
            <span className="font-semibold text-mxd-tinta">
              {nombreHover} · {capa === 1 ? "clic para entrar" : "clic para aislar"}
            </span>
          ) : (
            <>
              <span className="lg:hidden">
                Un dedo gira · dos dedos acercan y desplazan · toca una pieza
              </span>
              <span className="hidden lg:inline">
                Arrastra para girar · botón derecho desplaza · clic en una pieza
              </span>
            </>
          )}
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
                : explosion > 1.5
                  ? "Piezas acomodadas en cuadrícula"
                  : explosion > 0
                    ? "Separa las piezas de lo que ves"
                    : "Arrastra para separar las piezas"
            }
          />

          {/* Otro despiece, no un atajo del deslizador de arriba: aquel
              separa lo que se ve y este baja a cada pieza del dron. A la
              mitad se ve el dron explotado; al final, en cuadricula. */}
          <BarraLateral
            etiqueta="Despiece atómico"
            valor={despieceAtomico}
            onChange={setDespieceAtomico}
            bloqueada={!enCompleto}
            motivo={
              !enCompleto
                ? MOTIVO_CAPA
                : despieceAtomico === 0
                  ? "Separa cada pieza del dron"
                  : despieceAtomico <= 0.5
                    ? "Vista explotada: cada pieza fuera de su conjunto"
                    : "Piezas acomodadas en cuadrícula"
            }
          />

          <button
            type="button"
            title="Volver al estado inicial"
            onClick={reiniciarVista}
            className="rounded-lg border border-mxd-borde bg-white px-2 py-1.5 text-[11px] font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde lg:px-3 lg:py-2 lg:text-xs"
          >
            Reiniciar
          </button>
        </div>

        {/* Lo mismo que se puede tocar en el lienzo, como lista: se recorre
            con teclado y con lector de pantalla, y en el celular evita tener
            que atinarle a una pieza chica con el dedo. */}
        <section className="mt-3 border-t border-mxd-borde pt-2 lg:mt-4 lg:pt-3">
          <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-mxd-gris">
            {capa === 1 ? "Zonas del dron" : `Piezas · ${zona ? ETIQUETAS_ZONA[zona] : ""}`}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {capa === 1
              ? ZONAS.map((z) => (
                  <li key={z}>
                    <button
                      type="button"
                      onClick={() => entrarEnZona(z)}
                      className={claseBotonLista(false)}
                    >
                      {ETIQUETAS_ZONA[z]}
                    </button>
                  </li>
                ))
              : listaZona.map((p) => (
                  <li key={p.clave}>
                    <button
                      type="button"
                      aria-current={p.clave === pieza ? "true" : undefined}
                      onClick={() =>
                        capa === 2 ? entrarEnPieza(p.clave) : irA(zona, p.clave)
                      }
                      onMouseEnter={() => setSenalada(p.clave)}
                      onMouseLeave={() => setSenalada(null)}
                      onFocus={() => setSenalada(p.clave)}
                      onBlur={() => setSenalada(null)}
                      className={claseBotonLista(p.clave === pieza)}
                    >
                      {p.nombre}
                    </button>
                  </li>
                ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
