/**
 * Cruce entre el catalogo (SKU) y el maestro de partes (numero MXD).
 *
 * El maestro (Maestro_Partes_MX80.xlsx, importado en maestro-mx80.json) es el
 * BOM que manejan los administrativos: lista lo que se COMPRA. El catalogo
 * lista lo que se VE en el 3D. No son uno a uno, y este archivo dice como se
 * corresponden:
 *
 *   - Un conjunto que se compra completo (la PDB, el motor, la bateria) es UNA
 *     partida; sus subpiezas del catalogo se surten dentro de el y no tienen
 *     numero propio (ver CONJUNTOS_SURTIDOS_COMPLETOS en variantes-mx80.ts).
 *   - Una pieza con version CW y CCW (o derecha e izquierda) puede tener un
 *     numero por version (el soporte de motor: EST-PZA-021 y 022).
 *   - Lo que el maestro no desglosa (casi toda la tornilleria) y las piezas de
 *     diseno MXD que aun no estan dadas de alta quedan "sin-numero".
 *
 * Estado de cada cruce:
 *   confirmado  el numero es de esta pieza sin duda (nombre y posicion iguales,
 *               o ya lo habia cruzado el equipo a mano con Eduardo)
 *   propuesto   razonable, pero alguien que conozca el BOM debe confirmarlo
 *
 * Solo interna: los numeros de parte no salen en la vitrina.
 */

export interface CruceMaestro {
  /** Numero del maestro para la pieza entera (si tiene uno solo). */
  numero?: string;
  /** Numero del maestro de cada version, por su clave (ver variantes-mx80.ts). */
  porVariante?: Record<string, string>;
  estado: "confirmado" | "propuesto";
  nota?: string;
}

const N = (s: string) => `MXD-MX80-${s}-R00`;

export const CRUCE_MAESTRO: Record<string, CruceMaestro> = {
  // -- Propulsion ------------------------------------------------------------
  "MX80-001": { numero: N("PRO-ENS-001"), estado: "confirmado" },
  "MX80-001-03": { numero: N("PRO-ENS-002"), estado: "confirmado" },
  "MX80-001-04": { numero: N("PRO-PZA-002"), estado: "confirmado" },
  "MX80-001-05": { numero: N("PRO-PZA-003"), estado: "confirmado" },
  "MX80-001-06": { numero: N("PRO-PZA-004"), estado: "confirmado" },
  "MX80-001-07": { numero: N("PRO-PZA-007"), estado: "confirmado" },
  "MX80-004-01": { numero: N("PRO-PZA-005"), estado: "confirmado" },
  "MX80-004-02": { numero: N("PRO-PZA-006"), estado: "confirmado" },
  "MX80-005": {
    porVariante: { cw: N("EST-PZA-021"), ccw: N("EST-PZA-022") },
    estado: "confirmado",
    nota: "El maestro tiene una base de motor para M1/M3 y otra para M2/M4, y en el modelo son espejo. Antes solo estaba cruzada la 021.",
  },
  "MX80-006": {
    porVariante: { cw: N("PLA-PZA-001"), ccw: N("PLA-PZA-001") },
    estado: "propuesto",
    nota: "El maestro tiene un solo número para las 4 cubiertas, pero en el modelo la del brazo CW y la del CCW son espejo. Confirmar si en realidad son dos piezas.",
  },
  "MX80-007": { numero: N("PRO-SUB-001"), estado: "confirmado" },
  "MX80-008": {
    porVariante: { cw: N("EST-PZA-008"), ccw: N("EST-PZA-009") },
    estado: "propuesto",
    nota: "Por posición (M1/M3 y M2/M4) y porque en el modelo el tubo CW y el CCW son espejo. Confirmar que el «brazo auxiliar» del maestro es este tubo.",
  },
  "MX80-009-01": { numero: N("PRO-SUB-002"), estado: "confirmado" },
  "MX80-009-02": {
    porVariante: { cw: N("PLA-PZA-002"), ccw: N("PLA-PZA-002") },
    estado: "propuesto",
    nota: "El maestro tiene un solo número para los 4 soportes de ESC, pero en el modelo el CW y el CCW son espejo. Confirmar si son dos piezas.",
  },
  "MX80-009-03": {
    numero: N("PLA-PZA-003"),
    estado: "propuesto",
    nota: "El maestro lista un «retén de soporte de ESC», 2 por brazo; en el modelo hay una tapa trasera por brazo. Confirmar si es la misma pieza.",
  },

  // -- Estructura --------------------------------------------------------------
  "MX80-011-01": {
    numero: N("EST-PZA-010"),
    estado: "propuesto",
    nota: "«Clamp de brazo», 4 por dron: uno por brazo, como los soportes del modelo.",
  },
  "MX80-011-02": {
    porVariante: { der: N("EST-PZA-001"), izq: N("EST-PZA-002") },
    estado: "propuesto",
    nota: "El maestro separa el herraje de plegado de M1/M4 (lado derecho) del de M2/M3 (izquierdo), y en el modelo el retenedor derecho es espejo del izquierdo.",
  },
  "MX80-011-03": {
    estado: "propuesto",
    nota: "El maestro numera los 4 perfiles por posición (EST-PZA-003 a 006, perfiles #0 a #3). Falta saber qué posición es cada tubo para asignarlos.",
  },
  "MX80-011-04": {
    estado: "propuesto",
    nota: "El maestro numera los 4 perfiles por posición (EST-PZA-003 a 006, perfiles #0 a #3). Falta saber qué posición es cada tubo para asignarlos.",
  },
  "MX80-014": { numero: N("EST-ENS-001"), estado: "confirmado" },

  // -- Tren ------------------------------------------------------------------
  "MX80-013-01": { numero: N("EST-PZA-015"), estado: "propuesto", nota: "Tubo de tren de aluminio, izquierdo y derecho con el mismo número." },
  "MX80-013-02": { numero: N("EST-PZA-015"), estado: "propuesto", nota: "Tubo de tren de aluminio, izquierdo y derecho con el mismo número." },
  "MX80-013-03": { numero: N("EST-PZA-020"), estado: "propuesto", nota: "«Base de conexión de tren», 4 por dron." },
  "MX80-013-04": { numero: N("EST-PZA-020"), estado: "propuesto", nota: "«Base de conexión de tren», 4 por dron." },
  "MX80-013-09": { numero: N("EST-PZA-014"), estado: "propuesto" },
  "MX80-013-10": { numero: N("EST-PZA-014"), estado: "propuesto" },
  ...Object.fromEntries(
    ["MX80-013-05", "MX80-013-06", "MX80-013-07", "MX80-013-08"].map((sku) => [
      sku,
      {
        estado: "propuesto" as const,
        nota: "El maestro tiene un conector T macho (EST-PZA-011) y otro hembra (EST-PZA-012), 2 de cada uno. Falta saber cuál cople es cuál.",
      },
    ]),
  ),

  // -- Liquidos y aspersion ------------------------------------------------------
  "MX80-012": { numero: N("AGR-PZA-001"), estado: "confirmado" },
  "MX80-021": {
    numero: N("BOM-SUB-003"),
    estado: "propuesto",
    nota: "La única motobomba central del maestro es la «de impulsor». Las motobombas A80 izquierda y derecha (BOM-SUB-001 y 002) no están en el modelo.",
  },
  "MX80-016-05": {
    numero: N("ASP-ENS-001"),
    estado: "propuesto",
    nota: "«Ensamble de boquilla centrífuga», 4 por dron: uno por cabezal. El aspersor del modelo es diseño MXD; confirmar que monta el mismo cabezal.",
  },
  "MX80-016-06": {
    numero: N("ASP-PZA-002"),
    estado: "propuesto",
    nota: "El maestro separa el disco atomizador superior (ASP-PZA-002) del inferior (ASP-PZA-003); en el modelo el disco es una sola malla.",
  },
  "MX80-016-09": { numero: N("ASP-MAT-001"), estado: "propuesto", nota: "Tubo de silicón blanco, se compra por metro." },
  "MX80-016-10": { numero: N("ASP-MAT-001"), estado: "propuesto", nota: "Tubo de silicón blanco, se compra por metro." },
  "MX80-016-14": { numero: N("CAB-SUB-014"), estado: "propuesto", nota: "«Cable de HUB de aspersor centrífugo», 4 por dron." },

  // -- Electronica -------------------------------------------------------------
  "MX80-015-01": {
    porVariante: { m12: N("CAB-SUB-010"), m34: N("CAB-SUB-011") },
    estado: "propuesto",
    nota: "El maestro pide el cable de potencia del motor por par de brazos: 1-2 y 3-4.",
  },
  "MX80-015-02": {
    porVariante: { m12: N("CAB-SUB-010"), m34: N("CAB-SUB-011") },
    estado: "propuesto",
    nota: "El maestro pide el cable de potencia del motor por par de brazos: 1-2 y 3-4.",
  },
  "MX80-015-07": {
    numero: N("CAB-SUB-012"),
    estado: "propuesto",
    nota: "En el maestro es un solo arnés de señal para los 4 ESC; cada brazo lleva una rama.",
  },
  "MX80-017": { numero: N("BAT-SUB-001"), estado: "confirmado", nota: "El maestro cuenta 3 baterías por dron (kit para operar); el modelo trae una." },
  "MX80-018": { numero: N("ELE-ENS-001"), estado: "confirmado", nota: "La PDB se maneja como una sola parte." },
  "MX80-019": {
    porVariante: { izq: N("BAT-ENS-001"), der: N("BAT-ENS-002") },
    estado: "propuesto",
    nota: "Soporte de batería izquierdo y derecho; cada uno es el riel ranurado más su ménsula.",
  },
  "MX80-020-01": {
    numero: N("AVI-SUB-003"),
    estado: "propuesto",
    nota: "Radar rotativo. El maestro lo ubica arriba y en el modelo está bajo el frente: confirmar.",
  },
  "MX80-020-02": { numero: N("SEG-SUB-001"), estado: "propuesto", nota: "En el maestro las dos luces (frontal e inferior) son un solo módulo." },
  "MX80-020-03": { numero: N("SEG-SUB-001"), estado: "propuesto", nota: "En el maestro las dos luces (frontal e inferior) son un solo módulo." },
  "MX80-020-04": { numero: N("EST-PZA-016"), estado: "propuesto", nota: "Soporte del radar rotativo." },
  "MX80-020-06": { numero: N("EST-PZA-017"), estado: "propuesto", nota: "Soporte del módulo de iluminación." },
  "MX80-022": { numero: N("AVI-SUB-002"), estado: "confirmado" },
  // -- Tanque del GLB v6: motobombas, PMU ------------------------------------
  "MX80-025-01": {
    porVariante: { izq: N("BOM-SUB-001"), der: N("BOM-SUB-002") },
    estado: "propuesto",
    nota: "Motobomba izquierda y derecha A80 del maestro; en el modelo son espejo. Confirmar el modelo de bomba. El maestro tambien lista el cabezal (BOM-ENS-001) y su tuberia (BOM-ENS-002).",
  },
  "MX80-026": { numero: N("ELE-SUB-001"), estado: "confirmado", nota: "Módulo PMU; se maneja como una sola parte." },
  "MX80-023": { numero: N("AVI-ENS-001"), estado: "propuesto", nota: "Ensamble FPV frontal." },
  "MX80-024": { numero: N("AVI-ENS-002"), estado: "propuesto", nota: "Ensamble de cámara FPV de mapeo (inferior)." },
};
