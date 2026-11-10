/**
 * Configuracion del Estudio MX80: todo lo que se ajusta para publicidad vive
 * aqui (modelo, colores, etiquetas, formatos, despiece, vuelo).
 *
 * No importa three.js: lo lee tambien la interfaz.
 */

/** El mismo dron del sitio. Lo espeja scripts/sincronizar-modelo.mjs. */
export const GLB_DRON = "/models/mx80/MX80_completo_v6_web.glb";

/**
 * Campo de maiz: ruta del GLB exportado de Blender (en public/campo/), o null
 * mientras no exista. Con null se ve un piso de tierra liso.
 */
export const GLB_CAMPO: string | null = null;

// ---------------------------------------------------------------------------
// Coreografia del dron (la misma del visor de la vitrina, EscenaFrame.tsx)
// ---------------------------------------------------------------------------

/** Tramos del despliegue sobre un progreso 0..1. */
export const FASES = {
  giratorios: [0.0, 0.25],
  brazosPar: [0.25, 0.5],
  brazosImpar: [0.5, 0.75],
  palas: [0.75, 1.0],
} as const;
export const ANGULO_PLEGADO_BRAZO = 135;
export const ANGULO_APERTURA_GIRATORIO = 180;
export const ANGULO_APERTURA_PALA = 80;
/** Vueltas por segundo del rotor con el encendido al 100 %. */
export const VELOCIDAD_ROTOR = 5;

// ---------------------------------------------------------------------------
// Vuelo y campo
// ---------------------------------------------------------------------------

/** Altura de la panza del dron sobre el piso, en metros. */
export const ALTURA_VUELO = { min: 0, max: 4, inicial: 2.5 } as const;
/** Altura del follaje, en metros: ahi se reciclan las gotas. */
export const ALTURA_FOLLAJE = { min: 0, max: 2.5, inicial: 1.8 } as const;

/** Hora del dia: posicion del sol (elevacion, azimut en grados). */
export const HORAS = {
  amanecer: { etiqueta: "Amanecer", elevacion: 8, azimut: 100, intensidad: 1.6, cielo: "#f2c79a" },
  mediodia: { etiqueta: "Mediodía", elevacion: 62, azimut: 160, intensidad: 2.6, cielo: "#bcd8ef" },
  atardecer: { etiqueta: "Atardecer", elevacion: 10, azimut: 255, intensidad: 1.8, cielo: "#f0a777" },
} as const;
export type Hora = keyof typeof HORAS;

// ---------------------------------------------------------------------------
// Despiece vertical
// ---------------------------------------------------------------------------

/**
 * Los conjuntos se apilan de abajo hacia arriba, cada uno en su nivel, y
 * dentro de cada nivel sus piezas se abren hacia arriba por altura.
 */
export const DESPIECE_VERTICAL = {
  /** Metros entre un nivel y el siguiente con el despiece al 100 %. */
  separacionNivel: 0.42,
  /** Metros que se abren las piezas dentro de su nivel. */
  separacionInterna: 0.3,
} as const;

// ---------------------------------------------------------------------------
// Personaliza tu dron
// ---------------------------------------------------------------------------

/**
 * Piezas que se pintan (carroceria) y acento. Nunca tornilleria, electronica ni
 * fibra de carbono: el cliente elige el color de lo que ve por fuera.
 */
export const CARROCERIA = /^(carcasa_drone|DRONE_CLEAN_TOPOLOGY|cubierta_motor)/i;
export const ACENTO = /_pala_punta/i;

export interface Acabado {
  color: string;
  rugosidad: number;
  metalicidad: number;
  /** Barniz transparente (0..1): da el brillo de pintura automotriz. */
  barniz: number;
}

export interface Combinacion {
  clave: string;
  nombre: string;
  carroceria: Acabado;
  acento: Acabado;
}

export const COMBINACIONES: Combinacion[] = [
  {
    clave: "verde-campo",
    nombre: "Verde campo",
    carroceria: { color: "#0f8a4c", rugosidad: 0.35, metalicidad: 0.1, barniz: 0.6 },
    acento: { color: "#f2f2f2", rugosidad: 0.4, metalicidad: 0, barniz: 0.3 },
  },
  {
    clave: "negro-carbon",
    nombre: "Negro carbón",
    carroceria: { color: "#1b1f22", rugosidad: 0.3, metalicidad: 0.2, barniz: 0.8 },
    acento: { color: "#22c55e", rugosidad: 0.35, metalicidad: 0, barniz: 0.4 },
  },
  {
    clave: "blanco-artico",
    nombre: "Blanco ártico",
    carroceria: { color: "#eef1f3", rugosidad: 0.32, metalicidad: 0.05, barniz: 0.7 },
    acento: { color: "#f59e0b", rugosidad: 0.4, metalicidad: 0, barniz: 0.3 },
  },
];

// ---------------------------------------------------------------------------
// Etiquetas con datos (para presentaciones y redes)
// ---------------------------------------------------------------------------

/**
 * Cada etiqueta apunta al centro de los nodos que coinciden. Solo datos
 * publicos (son material de venta), los mismos que muestra la vitrina.
 */
export const ETIQUETAS: { nodos: RegExp; texto: string }[] = [
  { nodos: /^Tanque_spline/i, texto: "Tanque de 80 L" },
  { nodos: /^pieza_A_cuerpo_Y/i, texto: "Aspersor centrífugo doble" },
  { nodos: /^BAT_Carcasa/i, texto: "Batería 18S · 2 052 Wh" },
  { nodos: /^sensor_lidar/i, texto: "LiDAR frontal" },
  { nodos: /^radar_cuerpo/i, texto: "Radar" },
];

// ---------------------------------------------------------------------------
// Exportacion
// ---------------------------------------------------------------------------

export interface Formato {
  clave: string;
  nombre: string;
  ancho: number;
  alto: number;
  /** Sin cielo ni piso: el dron solo, sobre transparencia. */
  transparente: boolean;
}

export const FORMATOS: Formato[] = [
  { clave: "16x9-4k", nombre: "16:9 · 4K", ancho: 3840, alto: 2160, transparente: false },
  { clave: "9x16", nombre: "9:16 · Reels", ancho: 1080, alto: 1920, transparente: false },
  { clave: "1x1", nombre: "1:1 · Feed", ancho: 2160, alto: 2160, transparente: false },
  { clave: "png-transparente", nombre: "PNG transparente", ancho: 3840, alto: 2160, transparente: true },
];

/**
 * Segundos que se deja correr la escena antes de capturar una toma con la
 * aspersion encendida: sin esto la foto saldria sin gotas (el pool arranca
 * vacio).
 */
export const PRECALENTAR_ASPERSION_S = 2.6;
