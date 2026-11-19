/**
 * Vista tipada del simulador de drone_sim_pkg: solo lo que usa el estudio.
 *
 * El paquete es JavaScript con JSDoc y TypeScript deduce sus tipos de forma
 * muy suelta (todo puede ser undefined). Esta interfaz fija el contrato que el
 * estudio necesita; si el paquete cambia esos nombres, el error sale aqui.
 */
import { DroneSim } from "../../../drone_sim_pkg/src/drone-sim-core.js";
import { makeConfig, masaMX80 } from "../../../drone_sim_pkg/src/drone-profiles.js";

import type { ModoVuelo } from "../estado";
import type { AlturaSuelo } from "./terreno";

export interface EntradaMando {
  /** Acelerador 0..1 (Acro y Angulo). */
  thr: number;
  /** Subir/bajar -1..1 (Posicion). */
  climb: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface EstadoSimulador {
  armed: boolean;
  landed: boolean;
  crashed: boolean;
  mode: ModoVuelo;
  /** Altura sobre el suelo [m]. */
  agl: number;
  velNed: { n: number; e: number; d: number };
  euler: { roll: number; pitch: number; yaw: number };
  rotorThrustFrac: number[];
}

export interface EventoSimulador {
  type: string;
  reason?: string;
  msg?: string;
  motor?: number;
}

export interface SimuladorMX80 {
  /** Vector de estado: [n, e, d, vn, ve, vd, qw, qx, qy, qz, p, q, r, Omega_1..N]. */
  x: ArrayLike<number>;
  P: { N: number; OmMax: number; hGear: number; hoverThr: number; m: number };
  armed: boolean;
  mode: ModoVuelo;
  arm: () => boolean;
  disarm: (motivo?: string) => void;
  reset: () => void;
  setMode: (modo: ModoVuelo) => void;
  setInput: (entrada: Partial<EntradaMando>) => void;
  step: (dt: number) => unknown;
  getState: () => EstadoSimulador;
}

/**
 * Un MX80 con `litros` en el tanque. `suelo` da la altura del terreno del mapa
 * (se consulta en cada paso, asi que puede cambiar despues de crearlo).
 */
export function crearSimulador(
  litros: number,
  alEvento: (ev: EventoSimulador) => void,
  suelo: { current: AlturaSuelo },
): { sim: SimuladorMX80; crudo: DroneSim } {
  const crudo = new DroneSim(makeConfig("mx80", { vehicle: { mtow: masaMX80(litros) } }), {
    groundHeightAt: (n: number, e: number) => suelo.current(n, e),
    onEvent: (ev: object) => alEvento(ev as EventoSimulador),
  });
  const sim = crudo as unknown as SimuladorMX80;
  sim.setMode("pos");
  return { sim, crudo };
}
