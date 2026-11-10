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
};

interface Estado {
  escena: EstadoEscena;
  tomas: Toma[];
  capturador: Capturador | null;
  /** Mensaje de la ultima exportacion (progreso o error). */
  aviso: string | null;
  ajustar: (cambio: Partial<EstadoEscena>) => void;
  setTomas: (tomas: Toma[]) => void;
  setCapturador: (c: Capturador | null) => void;
  setAviso: (aviso: string | null) => void;
}

export const useEstudio = create<Estado>((set) => ({
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
  setTomas: (tomas) => set({ tomas }),
  setCapturador: (capturador) => set({ capturador }),
  setAviso: (aviso) => set({ aviso }),
}));
