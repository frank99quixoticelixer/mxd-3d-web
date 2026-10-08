"use client";

import { create } from "zustand";

/** Recorta a 0..1 sin arrastrar three.js a un archivo de estado. */
const THREE = { clamp01: (v: number) => Math.min(1, Math.max(0, v)) };

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
 * regla del modelo, no del boton: se aplica venga de donde venga el cambio
 * (el deslizador, "Explotar" o "Organizar").
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
  /** SKU de la pieza seleccionada, o null. */
  seleccion: string | null;
  /** SKU de la pieza bajo el cursor, o null. */
  hover: string | null;
  /** Atenua todas las piezas salvo la seleccionada. */
  aislar: boolean;
  /** Rotacion automatica de la camara. */
  autoRotar: boolean;
  /**
   * Muestra la pieza seleccionada SOLA en un visor propio (el de la ficha del
   * catalogo), en lugar del ensamble. Distinto de "aislar", que solo atenua.
   */
  verSola: boolean;

  /** SKUs efectivamente encontrados dentro del modelo cargado. */
  skusEnEscena: string[];
  /** Nombres de nodos del GLB que no coincidieron con ninguna pieza del catalogo. */
  nodosSinCoincidencia: string[];
  /** Centro de cada pieza en coordenadas del mundo, para enfocar la camara. */
  centros: Record<string, [number, number, number]>;
  /** Radio envolvente de cada pieza, para calcular el acercamiento. */
  radios: Record<string, number>;
  /** Radio de la esfera envolvente del ensamble (define zoom y separacion). */
  radio: number;
  /** Centro del ensamble completo. */
  centroEnsamble: [number, number, number];
  /** Dimensiones completas del ensamble (ancho, alto, profundidad). */
  tamanoEnsamble: [number, number, number];
  /** true cuando el visor esta mostrando el ensamble de demostracion. */
  modoDemo: boolean;

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
  /** Nombre del objeto del GLB aislado en la capa 3. */
  piezaAislada: string | null;

  /**
   * Despiece ATOMICO, 0..1: cada componente por separado en su propia celda.
   *
   * Es otro modo, no una continuacion del deslizador: ese separa conjuntos
   * (brazo, marco, tanque) y este baja a pieza suelta. Los dos mueven los
   * mismos objetos, asi que son excluyentes — activar uno pone el otro en 0.
   */
  despieceAtomico: number;

  /** Peticion de reencuadre: se incrementa para pedir a la camara que vuelva al inicio. */
  solicitudReencuadre: number;

  setExplosion: (valor: number) => void;
  seleccionar: (sku: string | null) => void;
  setHover: (sku: string | null) => void;
  setDespliegue: (valor: number) => void;
  setDespieceAtomico: (valor: number) => void;
  entrarEnZona: (zona: ZonaVisor) => void;
  entrarEnPieza: (nombre: string) => void;
  volver: () => void;
  setEncendido: (valor: number) => void;
  alternarAislar: () => void;
  alternarAutoRotar: () => void;
  alternarVerSola: () => void;
  reiniciarVista: () => void;
  registrarEscena: (datos: {
    skus: string[];
    sinCoincidencia: string[];
    centros: Record<string, [number, number, number]>;
    radios: Record<string, number>;
    radio: number;
    centroEnsamble: [number, number, number];
    tamanoEnsamble: [number, number, number];
    modoDemo: boolean;
  }) => void;
}

export const useVisor = create<EstadoVisor>((set) => ({
  explosion: 0,
  seleccion: null,
  hover: null,
  aislar: false,
  autoRotar: false,
  verSola: false,

  skusEnEscena: [],
  nodosSinCoincidencia: [],
  centros: {},
  radios: {},
  radio: 1,
  centroEnsamble: [0, 0, 0],
  tamanoEnsamble: [1, 1, 1],
  modoDemo: true,
  despliegue: 0,
  encendido: 0,
  despieceAtomico: 0,
  capa: 1,
  zona: null,
  piezaAislada: null,
  solicitudReencuadre: 0,

  setExplosion: (valor) =>
    set((s) => {
      // Con el despiece atomico activo no se toca nada: los dos despieces
      // mueven los mismos objetos y la unica salida es ensamblar.
      if (s.despieceAtomico > 0) return {};
      const explosion = Math.min(DESPIECE_MAXIMO, Math.max(0, valor));
      const pasoUmbral = explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES;
      return {
        explosion,
        // Pasado el umbral, los motores se apagan solos.
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
      return { despliegue: THREE.clamp01(valor) };
    }),

  setDespieceAtomico: (valor) =>
    set((s) => {
      const despieceAtomico = THREE.clamp01(valor);
      if (despieceAtomico === 0) return { despieceAtomico };
      // El despiece atomico es de la vista completa: dentro de una zona ya se
      // esta viendo un subconjunto y el despiece normal basta.
      if (s.capa !== 1) return {};
      // Al bajar a pieza suelta el dron queda desarmado: ni brazos abiertos,
      // ni motores, ni el otro despiece encima.
      return { despieceAtomico, explosion: 0, despliegue: 0, encendido: 0 };
    }),

  /**
   * Al bajar de capa se dejan los mandos en reposo. En una zona o en una pieza
   * suelta no hay brazos que desplegar ni motores que acelerar, y arrastrar el
   * estado de la capa anterior dejaria el modelo a medio animar.
   */
  entrarEnZona: (zona) =>
    set({
      capa: 2,
      zona,
      piezaAislada: null,
      explosion: 0,
      despieceAtomico: 0,
      despliegue: 0,
      encendido: 0,
      seleccion: null,
    }),

  entrarEnPieza: (nombre) =>
    set((s) => ({
      capa: 3,
      zona: s.zona,
      piezaAislada: nombre,
      explosion: 0,
      despieceAtomico: 0,
    })),

  volver: () =>
    set((s) => {
      if (s.capa === 3) {
        return { capa: 2, piezaAislada: null, explosion: 0, despieceAtomico: 0 };
      }
      if (s.capa === 2) {
        return {
          capa: 1,
          zona: null,
          piezaAislada: null,
          explosion: 0,
          despieceAtomico: 0,
        };
      }
      return {};
    }),

  setEncendido: (valor) =>
    set((s) => {
      // Los motores solo se mueven con los brazos abiertos del todo y con el
      // dron entero: a medio desplegar o a medio desarmar no hay nada que
      // acelerar. Bajar a cero siempre se puede.
      const objetivo = THREE.clamp01(valor);
      if (objetivo <= s.encendido) return { encendido: objetivo };
      if (s.capa !== 1 || s.despieceAtomico > 0) return {};
      if (
        s.despliegue < 1 ||
        s.explosion / DESPIECE_MAXIMO >= DESPIECE_APAGA_MOTORES
      )
        return {};
      return { encendido: objetivo };
    }),

  seleccionar: (sku) =>
    set((s) => ({
      seleccion: sku,
      // Salir del modo aislar si se deselecciona: evita dejar la escena en gris.
      aislar: sku === null ? false : s.aislar,
      verSola: sku === null ? false : s.verSola,
    })),

  setHover: (sku) => set({ hover: sku }),

  alternarAislar: () =>
    set((s) => ({ aislar: s.seleccion ? !s.aislar : false })),

  alternarAutoRotar: () => set((s) => ({ autoRotar: !s.autoRotar })),

  alternarVerSola: () =>
    set((s) => ({ verSola: s.seleccion ? !s.verSola : false })),

  reiniciarVista: () =>
    set((s) => ({
      explosion: 0,
      seleccion: null,
      hover: null,
      aislar: false,
      verSola: false,
      despliegue: 0,
      encendido: 0,
      despieceAtomico: 0,
      capa: 1,
      zona: null,
      piezaAislada: null,
      solicitudReencuadre: s.solicitudReencuadre + 1,
    })),

  registrarEscena: (datos) =>
    set({
      skusEnEscena: datos.skus,
      nodosSinCoincidencia: datos.sinCoincidencia,
      centros: datos.centros,
      radios: datos.radios,
      radio: datos.radio,
      centroEnsamble: datos.centroEnsamble,
      tamanoEnsamble: datos.tamanoEnsamble,
      modoDemo: datos.modoDemo,
    }),
}));
