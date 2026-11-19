/**
 * Configuracion del Estudio MX80: todo lo que se ajusta para publicidad vive
 * aqui (modelo, colores, etiquetas, formatos, despiece, vuelo).
 *
 * No importa three.js: lo lee tambien la interfaz.
 */

/** El mismo dron del sitio. Lo espeja scripts/sincronizar-modelo.mjs. */
export const GLB_DRON = "/models/mx80/MX80_completo_v6_web.glb";

// ---------------------------------------------------------------------------
// Mapas (entornos de Blender)
// ---------------------------------------------------------------------------

/**
 * Un mapa del campo. Se exporta de Blender con scripts/exportar_entorno.py y
 * se comprime con gltf-transform (ver README). El origen del mapa es la zona
 * de despegue: ahi va el dron, y en los dos mapas es plana (y = 0).
 */
export interface Entorno {
  clave: string;
  nombre: string;
  etiqueta: string;
  descripcion: string;
  datos: { etiqueta: string; valor: string }[];
  /** GLB del mapa, en public/campo/. */
  glb: string;
  /**
   * Mapa de alturas del terreno (sin extension: <base>.json y <base>.bin), o
   * null si el mapa es plano. El simulador de vuelo lo usa como suelo.
   */
  alturas: string | null;
  /** Vista de la tarjeta, dibujada con CSS (sin imagenes). */
  vista: { cielo: string; suelo: string; surco: string; angulo: number };
}

export const ENTORNOS: Entorno[] = [
  {
    clave: "agricola",
    nombre: "Valle agrícola",
    etiqueta: "Maizal",
    descripcion:
      "Plataforma de pruebas entre parcelas de maíz, alfalfa y rastrojo, con granja, pueblo, canal de riego y sierra al fondo.",
    datos: [
      { etiqueta: "Terreno", valor: "plano" },
      { etiqueta: "Altura del maíz", valor: "2.4–2.7 m" },
      { etiqueta: "Zona", valor: "2 × 2 km" },
    ],
    glb: "/campo/entorno_agricola_v2_web.glb",
    alturas: null,
    vista: { cielo: "linear-gradient(#93b6d4, #d8e6ee)", suelo: "#2f4a1c", surco: "#3b5a22", angulo: 115 },
  },
  {
    clave: "montana",
    nombre: "Claro de montaña",
    etiqueta: "Bosque",
    descripcion:
      "Claro de 76 × 76 m entre pinos y encinos, con cabaña y una ladera de casi 400 m de desnivel.",
    datos: [
      { etiqueta: "Claro", valor: "76 × 76 m" },
      { etiqueta: "Desnivel", valor: "−177 a +205 m" },
      { etiqueta: "Árboles", valor: "hasta 21 m" },
    ],
    glb: "/campo/entorno_montana_v2_web.glb",
    alturas: "/campo/entorno_montana_v2_web_alturas",
    vista: { cielo: "linear-gradient(#7fa3c2, #cfdde6)", suelo: "#1f3324", surco: "#2a4430", angulo: 160 },
  },
];

export const entornoPorClave = (clave: string): Entorno =>
  ENTORNOS.find((e) => e.clave === clave) ?? ENTORNOS[0];

/** Hasta donde se ve (m): las sierras de los mapas miden decenas de km. */
export const DISTANCIA_VISIBLE = 10000;
/** Neblina por distancia (m): empieza y se cierra. Da profundidad al horizonte. */
export const NEBLINA = { desde: 250, hasta: 4500 } as const;

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

/**
 * Hora del dia: SOLO mueve el sol (elevacion, azimut en grados), y con el las
 * sombras. El color de la luz, el cielo y la neblina no cambian con la hora
 * (LUZ): el dron y el campo se ven del mismo color en todas las tomas.
 */
export const HORAS = {
  amanecer: { etiqueta: "Amanecer", elevacion: 14, azimut: 100 },
  mediodia: { etiqueta: "Mediodía", elevacion: 62, azimut: 160 },
  atardecer: { etiqueta: "Atardecer", elevacion: 16, azimut: 255 },
} as const;

/** Luz fija para todas las horas. */
export const LUZ = {
  /** Intensidad del sol. */
  sol: 2.6,
  /** Luz de cielo (hemisferica): color de arriba, de abajo e intensidad. */
  cielo: "#bcd8ef",
  suelo: "#5b4a35",
  ambiente: 0.7,
  /** Posicion del sol con la que se pinta el cielo (siempre de dia). */
  solDelCielo: { elevacion: 62, azimut: 160 },
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
// Personaliza tu dron (taller)
// ---------------------------------------------------------------------------

/**
 * Que se pinta: todo lo que en el modelo es del amarillo de la carroceria
 * (cubiertas de motor, carcasa frontal, seguros de manguera). Se detecta por
 * el color del material, no por nombre, para que una pieza amarilla nueva del
 * GLB entre sola. Tono, saturacion y luminosidad en sRGB (0..1).
 *
 * Quedan fuera, a proposito, tonos parecidos que no son carroceria: las puntas
 * de las helices (ambar de seguridad, tono 41), los insertos de laton, los
 * conectores de la PDB y las micas de las luces.
 */
export const AMARILLO_CARROCERIA = {
  tono: [46 / 360, 58 / 360],
  saturacionMinima: 0.85,
  luminosidad: [0.35, 0.55],
} as const;

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
  /** Pintura de lo que hoy es amarillo. */
  pintura: Acabado;
}

/**
 * Colores del cliente. Los valores son aproximados a los de cada marca de
 * maquinaria: se ajustan aqui si el cliente da su codigo de color.
 */
export const COMBINACIONES: Combinacion[] = [
  {
    clave: "rojo-case",
    nombre: "Rojo Case",
    pintura: { color: "#b5121b", rugosidad: 0.3, metalicidad: 0.05, barniz: 0.8 },
  },
  {
    clave: "azul-new-holland",
    nombre: "Azul New Holland",
    pintura: { color: "#004c97", rugosidad: 0.3, metalicidad: 0.05, barniz: 0.8 },
  },
  {
    clave: "negro-new-holland",
    nombre: "Negro New Holland",
    pintura: { color: "#141619", rugosidad: 0.28, metalicidad: 0.1, barniz: 0.9 },
  },
];

/** Muestra del color original (el amarillo del modelo), para el boton. */
export const COLOR_ORIGINAL = "#e6b800";

// ---------------------------------------------------------------------------
// Taller
// ---------------------------------------------------------------------------

/** Vueltas por minuto de la plataforma giratoria del taller. */
export const RPM_MESA = 2.5;

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
