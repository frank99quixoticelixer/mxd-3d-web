"use client";

import { create } from "zustand";

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
  | "frente";

export const ETIQUETAS_ZONA: Record<ZonaVisor, string> = {
  "brazo-cw": "Brazo CW",
  "brazo-ccw": "Brazo CCW",
  frame: "Frame",
  tanque: "Tanque",
  "tren-aterrizaje": "Tren de aterrizaje",
  frente: "Frente del dron",
};

export const ZONAS = Object.keys(ETIQUETAS_ZONA) as ZonaVisor[];

export function esZona(valor: string | null): valor is ZonaVisor {
  return valor !== null && valor in ETIQUETAS_ZONA;
}

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
   * Lo aislado en la capa 3: la clave del componente en un brazo ("motor") o
   * el nombre del nodo en las demas zonas. Es una clave y no la lista de nodos
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
}

/** Mandos en reposo: lo que se aplica al cambiar de vista. */
const REPOSO = {
  explosion: 0,
  despieceAtomico: 0,
  despliegue: 0,
  encendido: 0,
  senalada: null,
} as const;

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
      return { despieceAtomico, explosion: 0, despliegue: 0, encendido: 0 };
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
  entrarEnZona: (zona) => set({ ...REPOSO, capa: 2, zona, pieza: null }),

  entrarEnPieza: (pieza) =>
    set((s) =>
      s.capa === 2 && pieza ? { ...REPOSO, capa: 3, pieza } : {},
    ),

  volver: () =>
    set((s) => {
      if (s.capa === 3) return { ...REPOSO, capa: 2, pieza: null };
      if (s.capa === 2) return { ...REPOSO, capa: 1, zona: null, pieza: null };
      return {};
    }),

  irA: (zona, pieza) =>
    set({
      ...REPOSO,
      capa: zona ? (pieza ? 3 : 2) : 1,
      zona,
      pieza: zona ? pieza : null,
    }),

  setSenalada: (senalada) => set({ senalada }),

  reiniciarVista: () =>
    set({ ...REPOSO, capa: 1, zona: null, pieza: null }),
}));
