"use client";

import { create } from "zustand";

import { ARRASTRE, CAUDAL_VISUAL, DOWNWASH, RPM_VISUAL } from "./aspersion/config";
import type { GrupoMaterial } from "./materiales";

/** Recorta a 0..1 sin arrastrar three.js a un archivo de estado. */
const recortar01 = (v: number) => Math.min(1, Math.max(0, v));

/** Valor maximo del despiece (2 = 200%, piezas en filas y columnas). */
export const DESPIECE_MAXIMO = 2;

/**
 * Despiece a partir del cual los motores se apagan solos, como FRACCION del
 * recorrido total del mando (0..1), que es lo que muestra la barra.
 *
 * Ojo: el estado guarda "explosion" en 0..DESPIECE_MAXIMO, asi que siempre hay
 * que normalizar antes de comparar. Comparar crudo hacia que la regla saltara
 * al 15% de la barra en vez del 30%.
 *
 * A partir de aqui las piezas empiezan a separarse del chasis, y unas helices
 * girando sobre un dron a medio desarmar no representan nada real. Es una
 * regla del modelo, no del boton: se aplica venga de donde venga el cambio.
 */
export const DESPIECE_APAGA_MOTORES = 0.3;

/**
 * Encendido a partir del cual el despliegue queda bloqueado. Es 1% y no 0 para
 * que el deslizador se pueda devolver a cero sin quedarse trabado por un resto
 * de decimales.
 */
export const BLOQUEA_DESPLIEGUE = 0.01;

/**
 * Zonas del dron en las que se puede entrar desde la vista completa.
 * Son los grupos que el GLB del chasis ya trae nombrados.
 */
export type ZonaVisor =
  | "brazo-cw"
  | "brazo-ccw"
  | "frame"
  | "tanque"
  | "tren-aterrizaje"
  | "frente"
  | "energia"
  | "radar";

export const ETIQUETAS_ZONA: Record<ZonaVisor, string> = {
  "brazo-cw": "Brazo CW",
  "brazo-ccw": "Brazo CCW",
  frame: "Frame",
  tanque: "Tanque",
  "tren-aterrizaje": "Tren de aterrizaje",
  frente: "Frente del dron",
  energia: "Batería y PDB",
  radar: "Radar y luces",
};

export const ZONAS = Object.keys(ETIQUETAS_ZONA) as ZonaVisor[];

export function esZona(valor: string | null): valor is ZonaVisor {
  return valor !== null && valor in ETIQUETAS_ZONA;
}

/**
 * Mandos de la visualizacion de aspersion. Los valores son los que el usuario
 * pide; las rampas de arranque y paro las aplica la escena.
 */
export interface Aspersion {
  activa: boolean;
  rpm: number;
  /** Gotas por segundo por disco. */
  caudal: number;
  arrastre: number;
  downwash: number;
  /** Cada brazo con aspersor se puede apagar por separado. */
  brazos: { cw: boolean; ccw: boolean };
}

export const ASPERSION_INICIAL: Aspersion = {
  activa: false,
  rpm: RPM_VISUAL.inicial,
  caudal: CAUDAL_VISUAL.inicial,
  arrastre: ARRASTRE.inicial,
  downwash: DOWNWASH.inicial,
  brazos: { cw: true, ccw: true },
};

/**
 * Estado compartido del visor 3D.
 *
 * Se usa Zustand (y no React Context) porque el bucle de render de
 * react-three-fiber lee este estado 60 veces por segundo: Zustand permite
 * leerlo sin provocar re-renders de React en cada cuadro.
 */
export interface EstadoVisor {
  /**
   * Grado de despiece:
   *   0 = ensamblado, 1 = totalmente explotado,
   *   2 = piezas organizadas en filas y columnas.
   */
  explosion: number;
  /** Radio de la esfera envolvente del modelo cargado (escala luces y sombra). */
  radio: number;

  /**
   * Despliegue de los brazos, 0 = plegados, 1 = abiertos del todo.
   * Es continuo, no un interruptor: la coreografia se reparte en este rango.
   */
  despliegue: number;
  /** Aceleracion de los rotores, 0 = parados, 1 = a maximas vueltas. */
  encendido: number;
  /**
   * Capa de navegacion, dentro del MISMO visor:
   *   1  el MX80 completo
   *   2  una zona sola (un brazo, el frame, el tanque)
   *   3  una pieza sola, aislada
   *
   * Es una pila, no paginas distintas: el modelo se queda cargado y solo
   * cambia que se ve. Por eso "volver" no recarga nada.
   */
  capa: 1 | 2 | 3;
  /** Zona abierta en la capa 2 y 3. */
  zona: ZonaVisor | null;
  /**
   * Lo aislado en la capa 3: la clave del componente en un brazo ("motor"),
   * una pieza de ese componente ("aspersor/disco") o el nombre del nodo en
   * las demas zonas. Es una clave y no la lista de nodos
   * para que quepa en la URL y se pueda restaurar desde un enlace; la escena
   * la traduce a nodos.
   */
  pieza: string | null;
  /**
   * Pieza senalada desde fuera del lienzo (la lista de piezas de la zona):
   * la escena la ilumina como si tuviera el cursor encima.
   */
  senalada: string | null;

  /**
   * Despiece ATOMICO, 0..1: cada componente por separado en su propia celda.
   *
   * Es otro modo, no una continuacion del deslizador: ese separa conjuntos
   * (brazo, marco, tanque) y este baja a pieza suelta. Los dos mueven los
   * mismos objetos, asi que son excluyentes — activar uno pone el otro en 0.
   */
  despieceAtomico: number;

  /**
   * Visualizacion de aspersion. Como los motores, solo existe con el dron
   * entero y los brazos abiertos: un aspersor plegado o a medio desarmar no
   * representa nada real.
   */
  aspersion: Aspersion;

  /**
   * Filtro por material: solo se ven las piezas de ese grupo (ver
   * materiales.ts). null = todo. Se conserva al cambiar de zona: es una forma
   * de ver, no un estado de la animacion.
   */
  filtroMaterial: GrupoMaterial | null;

  setExplosion: (valor: number) => void;
  setDespliegue: (valor: number) => void;
  setDespieceAtomico: (valor: number) => void;
  setEncendido: (valor: number) => void;
  entrarEnZona: (zona: ZonaVisor) => void;
  entrarEnPieza: (pieza: string) => void;
  volver: () => void;
  /** Salta directo a una vista (desde la URL o un enlace). */
  irA: (zona: ZonaVisor | null, pieza: string | null) => void;
  setSenalada: (pieza: string | null) => void;
  reiniciarVista: () => void;
  /** Enciende o apaga la aspersion. Encenderla abre los brazos si hace falta. */
  setAspersionActiva: (activa: boolean) => void;
  setFiltroMaterial: (grupo: GrupoMaterial | null) => void;
  /** Ajusta los mandos de la aspersion (rpm, caudal, arrastre, downwash, brazos). */
  ajustarAspersion: (cambio: Partial<Omit<Aspersion, "activa">>) => void;
}

/** Mandos en reposo: lo que se aplica al cambiar de vista. */
const REPOSO = {
  explosion: 0,
  despieceAtomico: 0,
  despliegue: 0,
  encendido: 0,
  senalada: null,
} as const;

/** La aspersion apagada conservando los ajustes que el usuario ya movio. */
const sinAspersion = (s: EstadoVisor) => ({
  aspersion: { ...s.aspersion, activa: false },
});

export const useVisor = create<EstadoVisor>((set) => ({
  explosion: 0,
  radio: 1,
  despliegue: 0,
  encendido: 0,
  despieceAtomico: 0,
  capa: 1,
  zona: null,
  pieza: null,
  senalada: null,
  aspersion: ASPERSION_INICIAL,
  filtroMaterial: null,

  setExplosion: (valor) =>
    set((s) => {
      // Con el despiece atomico activo no se toca nada: los dos despieces
      // mueven los mismos objetos y la unica salida es ensamblar.
      if (s.despieceAtomico > 0) return {};
      const explosion = Math.min(DESPIECE_MAXIMO, Math.max(0, valor));
      const pasoUmbral = explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES;
      return {
        explosion,
        // Pasado el umbral el dron se considera desarmado: los motores se
        // apagan y los brazos vuelven a plegados. Deja de tener sentido
        // sostener un despliegue sobre un dron que ya se esta separando.
        encendido: pasoUmbral ? 0 : s.encendido,
        despliegue: pasoUmbral ? 0 : s.despliegue,
        ...(pasoUmbral ? sinAspersion(s) : {}),
      };
    }),

  setDespliegue: (valor) =>
    set((s) => {
      // Solo en la vista completa: dentro de una zona no hay dron que plegar.
      if (s.capa !== 1) return {};
      // Con el dron desarmado pieza por pieza no hay brazos que plegar.
      if (s.despieceAtomico > 0) return {};
      // Con los motores en marcha el despliegue se congela: plegar un brazo
      // con su rotor girando no es una maniobra que exista.
      if (s.encendido > BLOQUEA_DESPLIEGUE) return {};
      // Igual con la aspersion: los discos van montados en los brazos.
      if (s.aspersion.activa) return {};
      // Con el dron a medio desarmar tampoco: los brazos ya no estan en su
      // sitio, asi que plegarlos no representa nada real.
      if (s.explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES) return {};
      return { despliegue: recortar01(valor) };
    }),

  setDespieceAtomico: (valor) =>
    set((s) => {
      const despieceAtomico = recortar01(valor);
      if (despieceAtomico === 0) return { despieceAtomico };
      // El despiece atomico es de la vista completa: dentro de una zona ya se
      // esta viendo un subconjunto y el despiece normal basta.
      if (s.capa !== 1) return {};
      // Al bajar a pieza suelta el dron queda desarmado: ni brazos abiertos,
      // ni motores, ni el otro despiece encima.
      return {
        despieceAtomico,
        explosion: 0,
        despliegue: 0,
        encendido: 0,
        ...sinAspersion(s),
      };
    }),

  setEncendido: (valor) =>
    set((s) => {
      // Los motores solo se mueven con los brazos abiertos del todo y con el
      // dron entero. Bajar a cero siempre se puede.
      const objetivo = recortar01(valor);
      if (objetivo <= s.encendido) return { encendido: objetivo };
      if (s.capa !== 1 || s.despieceAtomico > 0) return {};
      if (
        s.despliegue < 1 ||
        s.explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES
      )
        return {};
      return { encendido: objetivo };
    }),

  /**
   * Al bajar de capa se dejan los mandos en reposo. En una zona o en una pieza
   * suelta no hay brazos que desplegar ni motores que acelerar, y arrastrar el
   * estado de la capa anterior dejaria el modelo a medio animar.
   */
  entrarEnZona: (zona) =>
    set((s) => ({ ...REPOSO, ...sinAspersion(s), capa: 2, zona, pieza: null })),

  entrarEnPieza: (pieza) =>
    set((s) => {
      if (!pieza) return {};
      if (s.capa === 2) return { ...REPOSO, ...sinAspersion(s), capa: 3, pieza };
      // Dentro de un componente aislado se baja a una de sus piezas
      // ("aspersor" -> "aspersor/disco"): sigue siendo la capa 3, un nivel
      // mas adentro.
      if (s.capa === 3 && s.pieza && !s.pieza.includes("/") && pieza.startsWith(`${s.pieza}/`)) {
        return { ...REPOSO, ...sinAspersion(s), pieza };
      }
      return {};
    }),

  volver: () =>
    set((s) => {
      // De una pieza del componente se vuelve al componente entero.
      if (s.capa === 3 && s.pieza?.includes("/")) {
        return { ...REPOSO, ...sinAspersion(s), pieza: s.pieza.slice(0, s.pieza.indexOf("/")) };
      }
      if (s.capa === 3) return { ...REPOSO, ...sinAspersion(s), capa: 2, pieza: null };
      if (s.capa === 2) return { ...REPOSO, ...sinAspersion(s), capa: 1, zona: null, pieza: null };
      return {};
    }),

  irA: (zona, pieza) =>
    set((s) => ({
      ...REPOSO,
      ...sinAspersion(s),
      capa: zona ? (pieza ? 3 : 2) : 1,
      zona,
      pieza: zona ? pieza : null,
    })),

  setSenalada: (senalada) => set({ senalada }),

  reiniciarVista: () =>
    set({
      ...REPOSO,
      aspersion: ASPERSION_INICIAL,
      filtroMaterial: null,
      capa: 1,
      zona: null,
      pieza: null,
    }),

  setFiltroMaterial: (filtroMaterial) => set({ filtroMaterial }),

  setAspersionActiva: (activa) =>
    set((s) => {
      if (!activa) return sinAspersion(s);
      // Mismas condiciones que los motores, salvo el despliegue: encender la
      // aspersion abre los brazos, porque es lo que cualquiera haria primero.
      if (s.capa !== 1 || s.despieceAtomico > 0) return {};
      if (s.explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES) return {};
      return { aspersion: { ...s.aspersion, activa: true }, despliegue: 1 };
    }),

  ajustarAspersion: (cambio) =>
    set((s) => ({ aspersion: { ...s.aspersion, ...cambio } })),
}));
