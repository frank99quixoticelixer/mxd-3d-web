import type { Variante } from "@/lib/esquema";

/**
 * Piezas que cambian segun donde van montadas, y piezas que no se compran
 * sueltas.
 *
 * ESTE ARCHIVO ES IDENTICO EN VITRINA E INTERNA. No lleva numeros de parte
 * (esos son de interna: ver data/cruce-maestro.ts alla); solo dice que version
 * va en cada lugar, que es informacion que el cliente tambien necesita.
 *
 * ---------------------------------------------------------------------------
 * POR QUE HAY VERSIONES
 *
 * Los brazos CW y CCW son espejo uno del otro, y el lado derecho del marco es
 * espejo del izquierdo. Una pieza asimetrica montada en espejo es OTRA pieza:
 * el soporte de motor de un brazo CW se inclina hacia un lado y el del CCW
 * hacia el otro, y no se intercambian.
 *
 * Cuales son espejo se MIDIO en el GLB v5, no se supuso: cada pieza de un
 * brazo CW se encimo sobre la misma pieza del brazo CCW de dos maneras, solo
 * girandola y reflejandola. Las que solo encajan reflejadas son espejo. Las
 * que encajan de las dos maneras son simetricas: la misma pieza sirve en los
 * cuatro brazos y no estan aqui.
 *
 * Posiciones (las del maestro de partes, que coinciden con los nombres del
 * GLB): M1 = brazo_CW_1, M2 = brazo_CCW_2, M3 = brazo_CW_3, M4 = brazo_CCW_4.
 * El frente del dron es -X, asi que su derecha es -Z: ahi estan los nodos
 * "_der" y los brazos M1 y M4.
 * ---------------------------------------------------------------------------
 */

type VersionBase = Omit<Variante, "numeroBom">;

const CW: VersionBase = {
  clave: "cw",
  etiqueta: "Versión CW",
  posicion: "Brazos M1 y M3, los de hélice CW",
};
const CCW: VersionBase = {
  clave: "ccw",
  etiqueta: "Versión CCW",
  posicion: "Brazos M2 y M4, los de hélice CCW",
};
const DERECHA: VersionBase = {
  clave: "der",
  etiqueta: "Versión derecha",
  posicion: "Lado derecho del dron, el de los brazos M1 y M4",
};
const IZQUIERDA: VersionBase = {
  clave: "izq",
  etiqueta: "Versión izquierda",
  posicion: "Lado izquierdo del dron, el de los brazos M2 y M3",
};

/**
 * Piezas con version por posicion. Las de los brazos y el marco salen de la
 * medicion de espejo; las del cableado no son espejo (el cable es el mismo),
 * pero el maestro de partes las pide por pares de brazos.
 */
export const VARIANTES_POR_SKU: Record<string, VersionBase[]> = {
  // Brazo: espejo medido entre brazo_CW_3 y brazo_CCW_4.
  "MX80-005": [CW, CCW], // soporte de motor
  "MX80-006": [CW, CCW], // cubierta de motor
  "MX80-008": [CW, CCW], // tubo de fibra de carbono
  "MX80-009-02": [CW, CCW], // base del ESC
  // Marco: el retenedor derecho es espejo del izquierdo.
  "MX80-011-02": [DERECHA, IZQUIERDA],
  // Rieles de bateria: la mensula derecha es espejo de la izquierda, y el
  // maestro pide el soporte de bateria izquierdo y el derecho por separado.
  "MX80-019": [DERECHA, IZQUIERDA],
  "MX80-019-02": [DERECHA, IZQUIERDA],
  // Cable de potencia del motor: el maestro tiene uno para los brazos 1-2 y
  // otro para los 3-4 (largos distintos).
  "MX80-015-01": [
    { clave: "m12", etiqueta: "Brazos M1 y M2", posicion: "Cable de potencia de los brazos M1 y M2" },
    { clave: "m34", etiqueta: "Brazos M3 y M4", posicion: "Cable de potencia de los brazos M3 y M4" },
  ],
  "MX80-015-02": [
    { clave: "m12", etiqueta: "Brazos M1 y M2", posicion: "Cable de potencia de los brazos M1 y M2" },
    { clave: "m34", etiqueta: "Brazos M3 y M4", posicion: "Cable de potencia de los brazos M3 y M4" },
  ],
};

/**
 * Conjuntos que se compran como una sola parte: sus subpiezas estan en el
 * catalogo para ubicarlas en el 3D, pero no se piden por separado. Es como los
 * maneja el maestro de partes (la PDB es una partida, no ocho).
 */
export const CONJUNTOS_SURTIDOS_COMPLETOS: readonly string[] = [
  "MX80-007", // motor
  "MX80-017", // bateria
  "MX80-018", // PDB
  "MX80-019", // soporte de bateria (riel + mensula, por lado)
];
