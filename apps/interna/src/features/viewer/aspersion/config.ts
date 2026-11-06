/**
 * Configuracion de la visualizacion de aspersion: todo lo ajustable vive aqui.
 *
 * ES UNA ILUSTRACION. No es CFD ni un modelo de deriva: las gotas siguen una
 * balistica simple (gravedad + arrastre lineal) para que se entienda de donde
 * sale el liquido y hacia donde va. La interfaz lo dice con AVISO_ILUSTRATIVO.
 *
 * Este archivo no importa three.js: lo lee tambien el estado del visor
 * (estado.ts), que no debe arrastrar three.js al resto de la pagina.
 */

export const AVISO_ILUSTRATIVO =
  "Visualización ilustrativa – no representa el patrón real de aplicación";

// ---------------------------------------------------------------------------
// Giro de los discos atomizadores
// ---------------------------------------------------------------------------

/**
 * Vueltas por minuto del disco EN PANTALLA. A la velocidad real no se ve girar
 * (a 60 cuadros por segundo un disco de miles de rpm parece quieto o girando
 * al reves), por eso el valor visual es otro y se ajusta con un deslizador.
 */
export const RPM_VISUAL = { min: 60, max: 300, inicial: 150 } as const;

/**
 * RPM real del cabezal. Vacio a proposito: no se pone un numero que no venga
 * de la ficha tecnica del fabricante. Cuando se tenga, va aqui y la interfaz
 * puede mostrarlo como referencia; la animacion sigue usando RPM_VISUAL.
 */
export const RPM_REAL: number | null = null;

/** Segundos que tarda el disco en llegar a su velocidad (y en detenerse). */
export const RAMPA_GIRO_S = 1.2;

// ---------------------------------------------------------------------------
// Gotas
// ---------------------------------------------------------------------------

/** Gotas por segundo POR DISCO a caudal visual maximo. */
export const CAUDAL_VISUAL = { min: 100, max: 2000, inicial: 900 } as const;

/** Segundos que tarda el caudal en abrir o cerrar. Va detras del giro. */
export const RAMPA_CAUDAL_S = 0.8;

/**
 * Tope de gotas vivas a la vez, entre los cuatro discos. Es el tamano del
 * pool: se reserva una vez y se recicla, nunca se crea ni se destruye nada por
 * cuadro. En pantallas tactiles (casi siempre telefonos) se usa la mitad.
 */
export const PARTICULAS_MAX = 20000;
export const PARTICULAS_MAX_MOVIL = 9000;

/**
 * Escala de la velocidad de salida respecto a la tangencial visual (w * r).
 * Con RPM_VISUAL y un disco de ~36 mm de radio, w * r ronda 1 m/s; sin escalar
 * las gotas apenas se separarian del disco.
 */
export const ESCALA_VELOCIDAD_SALIDA = 6;

/** Componente radial de la salida, como fraccion de la tangencial. */
export const FRACCION_RADIAL = 0.25;

/**
 * Apertura del abanico fuera del plano del disco, en grados (+- este valor).
 * Con 0 las gotas salen en una lamina perfecta y se ve plana; con unos grados
 * la cortina tiene espesor y se lee como un cono en 3D.
 */
export const APERTURA_ABANICO_GRADOS = 7;

/**
 * Fraccion de las particulas que son niebla: gotas finas que frenan rapido,
 * se quedan flotando junto al disco y se ven como un halo. Las demas son
 * gotas que salen lejos y caen.
 */
export const FRACCION_NIEBLA = 0.35;
/** La niebla frena este multiplo del arrastre de las gotas. */
export const ARRASTRE_NIEBLA_FACTOR = 3.5;
/** La niebla cae esta fraccion de la gravedad (flota). */
export const GRAVEDAD_NIEBLA_FACTOR = 0.25;

/** Variacion aleatoria de la velocidad de salida (0.2 = +-20 %). */
export const DISPERSION_VELOCIDAD = 0.2;

/** Arrastre lineal: v -= k * v * dt, en 1/s. */
export const ARRASTRE = { min: 0, max: 4, inicial: 1.6 } as const;

/**
 * Empuje hacia abajo del aire de las helices, en m/s^2. Solo actua con los
 * motores encendidos y escala con el mando de encendido: sin rotores no hay
 * downwash.
 */
export const DOWNWASH = { min: 0, max: 20, inicial: 8 } as const;

/** Gravedad en m/s^2. El GLB esta en metros con Y hacia arriba. */
export const GRAVEDAD = 9.81;

/** Vida maxima de una gota, en segundos. */
export const VIDA_MAX_S = 3;

/**
 * Cuanto bajan las gotas por debajo de la sombra del dron antes de reciclarse,
 * en metros. El visor no dibuja piso (solo la sombra de contacto), asi que la
 * cortina puede seguir cayendo como si el dron volara: si se cortara en la
 * sombra, con el dron a 25 cm del suelo el cono no alcanza a formarse.
 * Las gotas se desvanecen en el ultimo tramo.
 */
export const CAIDA_BAJO_SUELO_M = 1.4;

/**
 * Paso maximo de integracion, en segundos. Un cuadro lento (pestana en segundo
 * plano, telefono saturado) se integra en varios pasos de este tamano, asi que
 * la trayectoria no depende de los FPS.
 */
export const PASO_MAX_S = 1 / 60;
/** Tope de pasos por cuadro: un cuadro de 2 s no debe congelar la pagina. */
export const PASOS_MAX_POR_CUADRO = 4;

// ---------------------------------------------------------------------------
// Apariencia
// ---------------------------------------------------------------------------

export const COLOR_GOTA = "#7cc8f2";
export const COLOR_NIEBLA = "#d6efff";
export const OPACIDAD_GOTA = 0.75;
export const OPACIDAD_NIEBLA = 0.18;

/**
 * Tamano EN PANTALLA de la gota, en metros de escena. No es el diametro real
 * de la gota (no esta documentado para este cabezal): es lo que se lee bien.
 */
export const TAMANO_GOTA_M = { base: 0.006, variacion: 0.5 } as const;
/** La niebla se ve mas grande y se expande al envejecer. */
export const TAMANO_NIEBLA_M = { base: 0.014, crecimiento: 2.5 } as const;
