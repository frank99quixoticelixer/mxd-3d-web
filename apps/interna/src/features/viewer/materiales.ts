/**
 * Filtro por material del visor: que grupo es cada malla del GLB.
 *
 * El GLB no dice de que esta hecha cada pieza (sus materiales se llaman
 * "GRAY63" o "mat_2"), asi que se clasifica por el nombre del nodo. Sale de:
 *   - el material que ya tiene la ficha (soporte de motor y balanceador de
 *     aluminio, cubierta de motor de TPE, base del ESC de PC/ABS...)
 *   - el maestro de partes (sistema PLA = plasticos)
 *   - lo que confirmo el equipo: soportes y retenedores del marco, agarres y
 *     coples del tren, y rieles de bateria son de plastico
 *
 * La electronica va aparte y no entra ni en plasticas ni en metalicas: un
 * tornillo dentro del ESC es parte del ESC, no "una pieza de metal".
 * Lo que no es plastico ni metal (fibra de carbono, hules, mangueras) va en
 * "otros".
 *
 * MODIFICABLE: estas reglas son solo el valor por omision. En interna, cada
 * ficha tiene el campo "Tipo de material (filtro del visor)" y lo que se
 * escriba ahi manda sobre las reglas, para esa pieza y lo que cuelga de ella
 * (ver gruposPorNombre en lib/catalogo.ts).
 *
 * Este archivo no importa three.js: lo usa tambien la interfaz del visor.
 */

import { normalizarNombre } from "@/lib/texto";

export type GrupoMaterial = "plastico" | "metal" | "electronica" | "otros";

export const ETIQUETAS_GRUPO: Record<GrupoMaterial, string> = {
  plastico: "Plásticas",
  metal: "Metálicas",
  electronica: "Electrónica",
  otros: "Otros",
};

export const GRUPOS: GrupoMaterial[] = ["plastico", "metal", "electronica", "otros"];

/** Para la interfaz: que entra en cada filtro. */
export const DESCRIPCION_GRUPO: Record<GrupoMaterial, string> = {
  plastico: "Piezas inyectadas o impresas: cubiertas, carcasa, tanque, soportes y aspersor",
  metal: "Aluminio y tornillería: soportes de motor, balanceador, perfiles, tubos del tren",
  electronica: "Sensores, PDB, ESC, motores, batería, cables y conectores",
  otros: "Fibra de carbono, hules y mangueras",
};

/**
 * Unidades que se clasifican enteras por el grupo de su nodo padre: todo lo
 * que cuelga de ellas es de ese grupo, sin importar como se llame cada pieza.
 */
const UNIDADES: readonly { re: RegExp; grupo: GrupoMaterial }[] = [
  { re: /^ESC_300A/i, grupo: "electronica" },
  { re: /^estatico/i, grupo: "electronica" }, // mitad fija del motor
  { re: /^motor_giratorio/i, grupo: "electronica" }, // mitad que gira del motor
  { re: /^cables/i, grupo: "electronica" }, // cableado del brazo
  { re: /^conector_senal_JR3P/i, grupo: "electronica" },
  { re: /^helices/i, grupo: "otros" }, // palas de fibra de carbono
];

/** Una pieza por su propio nombre. La primera regla que coincide gana. */
const PIEZAS: readonly { re: RegExp; grupo: GrupoMaterial }[] = [
  // Electronica: bateria, PDB, sensores, luces, motores de cabezal y bomba
  { re: /^(BAT_|PDB_)/i, grupo: "electronica" },
  { re: /^(sensor_lidar|camara_|radar_|luz_)/i, grupo: "electronica" },
  { re: /^((der|izq)_motor|bomba_)/i, grupo: "electronica" },
  { re: /^(cable_cabezal|conector_(der|izq)|arnes_(com|conector))/i, grupo: "electronica" },
  // Otros: fibra de carbono, hules, mangueras, protecciones de cable
  { re: /^(tubo_fibra|Propela_)/i, grupo: "otros" },
  { re: /^(goma_|arnes_pasamuros|manguera_|arnes_(malla|termo))/i, grupo: "otros" },
  // Metal: tornilleria (antes que cualquier regla de pieza, porque los
  // tornillos del marco se llaman "M4x7_agarrador")
  {
    re: /(^M\d+(\.\d+)?x\d+|tornillo|arandela|tuerca|inserto|perno|pasador|separador)/i,
    grupo: "metal",
  },
  // Metal: aluminio
  { re: /^(sujetador_motor|sujetador_balanceador|balanceador_helice)/i, grupo: "metal" },
  { re: /^(frame_tubo|patin_|travesano_)/i, grupo: "metal" },
  // Plastico
  {
    re: /^(cubierta_motor|base_ESC|tapa_trasera_ESC|carcasa_drone|DRONE_CLEAN_TOPOLOGY|ModeloAvantiv|Tanque)/i,
    grupo: "plastico",
  },
  {
    re: /^(pieza_A_cuerpo_Y|pieza_B_conector|tapa_(der|izq)|seguro_manguera|arnes_abrazadera|(der|izq)_disco)/i,
    grupo: "plastico",
  },
  { re: /^(agarrador_|retenedor_|agarre_|cople_|RIEL_)/i, grupo: "plastico" },
  { re: /^(cuna|copa_tapa|abrazadera_)/i, grupo: "plastico" },
];

/**
 * Lo que el equipo escribio en las fichas, listo para el visor: grupo por
 * nombre de nodo normalizado. Se arma en el servidor y viaja por props (solo
 * nombres de nodo y grupo, nada interno).
 */
export function gruposMaterialPorNombre(
  piezas: readonly { nombresBlender: string[]; especificaciones: { grupo_material?: string | null } }[],
): Record<string, GrupoMaterial> {
  const mapa: Record<string, GrupoMaterial> = {};
  for (const p of piezas) {
    const grupo = p.especificaciones.grupo_material;
    if (!esGrupoMaterial(grupo)) continue;
    for (const n of p.nombresBlender) mapa[normalizarNombre(n)] = grupo;
  }
  return mapa;
}

/** true si el texto es un grupo valido (lo que llega de la ficha es texto). */
export function esGrupoMaterial(valor: unknown): valor is GrupoMaterial {
  return typeof valor === "string" && (GRUPOS as string[]).includes(valor);
}

/**
 * Grupo de una malla, dado su nombre y los de sus ancestros (del padre hacia
 * arriba). null si nada la conoce: se queda fuera de todo filtro.
 *
 * Orden: primero lo que el equipo escribio en la ficha (`explicitos`, por
 * nombre de nodo normalizado), de la propia malla hacia arriba, asi que lo
 * escrito en una pieza gana sobre lo escrito en su conjunto. Despues, las
 * reglas de este archivo.
 */
export function grupoDeMalla(
  nombre: string,
  ancestros: readonly string[],
  explicitos: Readonly<Record<string, GrupoMaterial>> = {},
): GrupoMaterial | null {
  for (const n of [nombre, ...ancestros]) {
    const escrito = explicitos[normalizarNombre(n)];
    if (escrito) return escrito;
  }
  for (const a of ancestros) {
    const unidad = UNIDADES.find((u) => u.re.test(a));
    if (unidad) return unidad.grupo;
  }
  return PIEZAS.find((p) => p.re.test(nombre))?.grupo ?? null;
}
