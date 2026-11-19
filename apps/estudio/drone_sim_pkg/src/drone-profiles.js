/**
 * drone-profiles.js — Perfiles de vehículo.
 *
 * Dos modos de uso:
 *   makeConfig('custom', { vehicle: {...} })  -> parámetros libres
 *   makeConfig('mx80')                         -> MXD MX80 con Hobbywing X15
 *
 * Etiquetas en comentarios:
 *   [C]   confirmado en la fuente indicada
 *   [EST] estimado: reemplazar con el dato de tu entorno/CAD/banco
 */
import { DEFAULTS, mergeConfig } from './drone-sim-core.js';

export const PROFILES = {
  // ---------------------------------------------------------------- CONFIGURABLE
  custom: {
    name: 'Configurable',
    vehicle: {
      frame: 'quadX',      // 'quadX' | 'hexaX' | 'octoX'
      mtow: 9,             // [kg]
      wheelbase: 900,      // [mm]
      propIn: 21,          // [in]
      tmaxKgf: 6,          // [kgf] por motor
      rpmMax: 5500,        // [rpm]
      motorMass: 0.45,     // [kg] por brazo
      tau: 0,              // [s] 0 = estimar
    },
    env: { altitude: 1800, windSpd: 3, windDir: 270, gust: 1.5 },
    control: { rateMax: 150, tiltMax: 30, vMax: 12, vzUp: 4, vzDown: 3 },
  },

  // ---------------------------------------------------------------- MXD MX80
  // Fuentes: Manual de usuario MX80 V1.0 (Apendice 7.1, pag. 61-64), datasheet
  // Hobbywing X15 y datos del equipo MXD (2026-11-14), los mismos que usa el
  // sitio (apps/vitrina/src/data/manual-mx80.ts y folleto-mx80.ts).
  //
  // Orden de rotores (X simetrica del nucleo) = motores del manual y nodos del GLB:
  //   1 frente-derecha  CW  = M1 brazo_CW_1
  //   2 atras-derecha   CCW = M4 brazo_CCW_4
  //   3 atras-izquierda CW  = M3 brazo_CW_3
  //   4 frente-izquierda CCW = M2 brazo_CCW_2
  // [C] manual pag. 61: motores 1 y 3 CW, 2 y 4 CCW; la derecha del dron son M1 y M4.
  mx80: {
    name: 'MXD MX80 (Hobbywing X15)',
    vehicle: {
      frame: 'quadX',      // [C] manual pag. 61: 4 motores / 4 ESC
      mtow: 141.2,         // [C] manual pag. 63: 141.2 kg con tanque lleno (147.2 kg esparcido)
                           //     = 61.2 kg en vacio [C equipo] + 80 L de mezcla. Ver MASA_MX80.
      wheelbase: 2640,     // [C] manual pag. 61: distancia entre ejes simetrica de motores 2640 mm
      propIn: 63,          // [C] manual pag. 61: helice plegable 63 x 24 in (1608 mm)
      tmaxKgf: 72,         // [C] Hobbywing X15: 72 kg a 69 V. El manual MX80 dice aprox. 75 kg por motor;
                           //     se usa el menor (conservador).
      tmaxRefRho: 1.225,   // [EST] se asume dato de fabrica a nivel del mar
      rpmMax: 2100,        // [EST] con carga. Tope fisico: KV 45 x 68.4 V = 3078 rpm sin carga [C pag. 61].
                           //     Influye poco: solo en empuje dinamico y efecto giroscopico.
      motorMass: 5.908,    // [C] Hobbywing X15: 5908 g con cable y helice
      tau: 0.12,           // [EST] constante de tiempo motor + helice de 63"
      gearHeight: 0.6,     // [EST] altura del CG sobre el suelo. Acotada: el dron mide 873 mm de alto
                           //     en operacion [C pag. 61], asi que el CG esta por debajo de 0.87 m.
      inertia: null,       // [EST] se estima; pon [Jxx, Jyy, Jzz] del CAD cuando exista
      cdA: null,           // [EST] se estima con la distancia entre motores
    },
    // Altitud de Queretaro (~1820 m). [C pag. 63] altitud maxima de despegue: 2000 m.
    // [C] viento maximo recomendado: 8 m/s.
    env: { altitude: 1800, windSpd: 3, windDir: 270, gust: 1.5 },
    control: {
      rateMax: 90,         // [EST]
      tiltMax: 20,         // [EST]
      vMax: 10,            // [C pag. 63] velocidad maxima de operacion 10 m/s (vuelo: 13.8 m/s)
      vzUp: 5,             // [C pag. 63] velocidad maxima de ascenso 5 m/s
      vzDown: 3,           // [C pag. 63] velocidad maxima de descenso 3 m/s
    },
    // Informativo (no usado por la fisica)
    info: {
      // [C pag. 64] 18S, 68.4 V, IP56. Capacidad: el manual dice 34 Ah y 1500 ciclos; la ficha de
      // la bateria que se vende con el dron dice 30 Ah y 600 ciclos. Pendiente de aclarar.
      battery: '18S, 68.4 V nominal, 30 Ah', // [C equipo 2026-11-18]; el manual describe una de 34 Ah
      escNominalA: 100,    // [C pag. 61]
      motorKV: 45,         // [C pag. 61]
      motorPowerW: 5000,   // [C pag. 61]
      hoverTimeMin: null,  // el manual da 5.5 min con bateria de 34 Ah; falta medirlo con la de 30 Ah
      pumpsLpm: 40,        // [C pag. 61] 2 bombas x 20 L/min
      recirculationLpm: 30, // [C equipo]
    },
  },
};

/**
 * Masa del MX80 segun la carga del tanque [kg].
 * [C equipo] 61.2 kg en vacio; [C pag. 61] tanque de 80 L (agua: 1 kg/L).
 */
export const MASA_MX80 = { vacio: 61.2, tanqueLitros: 80, densidadKgL: 1.0 };

/** Masa de despegue del MX80 con `litros` en el tanque (0..80). */
export function masaMX80(litros) {
  const l = Math.min(Math.max(litros, 0), MASA_MX80.tanqueLitros);
  return MASA_MX80.vacio + l * MASA_MX80.densidadKgL;
}

/**
 * Construye la configuración completa.
 * @param {'custom'|'mx80'} profile
 * @param {object} [overrides] cualquier subconjunto de la configuración
 */
export function makeConfig(profile = 'custom', overrides = {}) {
  const p = PROFILES[profile];
  if (!p) throw new Error(`Perfil desconocido: ${profile}. Disponibles: ${Object.keys(PROFILES).join(', ')}`);
  return mergeConfig(DEFAULTS, p, overrides);
}
