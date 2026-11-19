"use client";

import { create } from "zustand";

import { CAUDAL_VISUAL, RPM_VISUAL } from "./aspersion/config";
import { ALTURA_FOLLAJE, ALTURA_VUELO, type Formato, type Hora } from "./config";

/** Lo que define como se ve el dron en un instante: lo que guarda una toma. */
export interface EstadoEscena {
  /** 0 = brazos plegados, 1 = desplegados con palas abiertas. */
  despliegue: number;
  /** Aceleracion de los rotores, 0..1 (solo con despliegue completo). */
  encendido: number;
  aspersion: boolean;
  rpm: number;
  caudal: number;
  /** Despiece vertical, 0..1. */
  despiece: number;
  altura: number;
  follaje: number;
  hora: Hora;
  /** Clave de la combinacion de color, o null = colores originales del modelo. */
  color: string | null;
  etiquetas: boolean;
  /** Estilo lineas: solo contornos y aristas, como el programa de diseno. */
  lineas: boolean;
}

export interface Camara {
  posicion: [number, number, number];
  objetivo: [number, number, number];
  fov: number;
}

export interface Toma {
  id: string;
  nombre: string;
  camara: Camara;
  escena: EstadoEscena;
}

/**
 * Lo que la escena le presta a la interfaz para exportar. Lo registra el
 * componente que vive dentro del Canvas (necesita el renderer y la camara).
 */
export interface Capturador {
  capturar: (formato: Formato) => Promise<Blob>;
  leerCamara: () => Camara;
  aplicarCamara: (camara: Camara) => void;
}

/** Modos de vuelo del simulador (drone_sim_pkg): Acro, Angulo, Posicion. */
export type ModoVuelo = "acro" | "angle" | "pos";

/** Lo que muestra el tablero de vuelo. Se actualiza a 10 Hz, no cada cuadro. */
export interface Telemetria {
  armado: boolean;
  enTierra: boolean;
  chocado: boolean;
  modo: ModoVuelo;
  /** Altura sobre el suelo [m]. */
  altura: number;
  /** Velocidad horizontal [m/s]. */
  velocidad: number;
  /** Velocidad vertical, + hacia arriba [m/s]. */
  vertical: number;
  /** Empuje medio de los rotores, 0..1 del maximo. */
  empuje: number;
  /** Rumbo [grados, 0 = norte]. */
  rumbo: number;
  /** Masa de despegue con la carga actual [kg]. */
  masa: number;
}

/** Ordenes de la interfaz al simulador. Las registra el componente Piloto. */
export interface ControlPiloto {
  armar: () => boolean;
  desarmar: () => void;
  reiniciar: () => void;
  setModo: (modo: ModoVuelo) => void;
}

/** Taller: se personaliza el dron. Campo: se carga el mapa y se hacen las tomas. */
export type Modo = "taller" | "campo";

export const ESCENA_INICIAL: EstadoEscena = {
  despliegue: 1,
  encendido: 0.6,
  aspersion: true,
  rpm: RPM_VISUAL.inicial,
  caudal: CAUDAL_VISUAL.inicial,
  despiece: 0,
  altura: ALTURA_VUELO.inicial,
  follaje: ALTURA_FOLLAJE.inicial,
  hora: "mediodia",
  color: null,
  etiquetas: false,
  lineas: false,
};

interface Estado {
  modo: Modo;
  /** Clave del mapa elegido (config.ts, ENTORNOS). */
  entorno: string;
  /** La plataforma del taller gira sola. */
  mesaGirando: boolean;
  /** En el campo: el dron lo mueve el simulador y se pilota con el teclado. */
  pilotando: boolean;
  /** Camara que sigue al dron por detras (si no, camara libre que lo sigue). */
  persecucion: boolean;
  /** Litros en el tanque (0..80): definen la masa de despegue. */
  litros: number;
  telemetria: Telemetria | null;
  /** Ultimo aviso del simulador (despegue, aterrizaje, choque...). */
  avisoVuelo: string | null;
  piloto: ControlPiloto | null;
  escena: EstadoEscena;
  tomas: Toma[];
  capturador: Capturador | null;
  /** Mensaje de la ultima exportacion (progreso o error). */
  aviso: string | null;
  ajustar: (cambio: Partial<EstadoEscena>) => void;
  setModo: (modo: Modo) => void;
  setEntorno: (clave: string) => void;
  setPilotando: (pilotando: boolean) => void;
  setPersecucion: (persecucion: boolean) => void;
  setLitros: (litros: number) => void;
  setTelemetria: (t: Telemetria | null) => void;
  setAvisoVuelo: (aviso: string | null) => void;
  setPiloto: (p: ControlPiloto | null) => void;
  setMesaGirando: (gira: boolean) => void;
  setTomas: (tomas: Toma[]) => void;
  setCapturador: (c: Capturador | null) => void;
  setAviso: (aviso: string | null) => void;
}

export const useEstudio = create<Estado>((set) => ({
  modo: "taller",
  entorno: "agricola",
  mesaGirando: true,
  pilotando: false,
  persecucion: true,
  litros: 80,
  telemetria: null,
  avisoVuelo: null,
  piloto: null,
  escena: ESCENA_INICIAL,
  tomas: [],
  capturador: null,
  aviso: null,
  ajustar: (cambio) =>
    set((s) => {
      const escena = { ...s.escena, ...cambio };
      // Mismas reglas que el visor: los rotores solo giran con los brazos
      // abiertos del todo, y desarmado no hay vuelo ni aspersion.
      if (escena.despliegue < 1) escena.encendido = 0;
      if (escena.despiece > 0) {
        escena.encendido = 0;
        escena.aspersion = false;
      }
      return { escena };
    }),
  // Volver al taller apaga el simulador.
  setModo: (modo) => set(modo === "taller" ? { modo, pilotando: false } : { modo }),
  setEntorno: (entorno) => set({ entorno }),
  setPilotando: (pilotando) => set({ pilotando, ...(pilotando ? {} : { telemetria: null, avisoVuelo: null }) }),
  setPersecucion: (persecucion) => set({ persecucion }),
  setLitros: (litros) => set({ litros }),
  setTelemetria: (telemetria) => set({ telemetria }),
  setAvisoVuelo: (avisoVuelo) => set({ avisoVuelo }),
  setPiloto: (piloto) => set({ piloto }),
  setMesaGirando: (mesaGirando) => set({ mesaGirando }),
  setTomas: (tomas) => set({ tomas }),
  setCapturador: (capturador) => set({ capturador }),
  setAviso: (aviso) => set({ aviso }),
}));
