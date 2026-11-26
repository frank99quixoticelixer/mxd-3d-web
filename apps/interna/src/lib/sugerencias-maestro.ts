/**
 * Que partidas del maestro de partes se parecen a una pieza del catalogo.
 *
 * Existe para que asociar una pieza con su numero de parte MXD no dependa de
 * adivinar por el nombre: la ficha muestra las partidas mas probables, con la
 * razon de cada una ("el nombre comparte soporte y brazo", "el maestro dice 4 y
 * el dron lleva 4"), y la persona solo confirma.
 *
 * Es codigo puro (sin base de datos ni servidor) para poder probarlo suelto.
 * Quien lo llama le pasa quien tiene ya cada numero.
 */
import MAESTRO from "@/data/maestro-mx80.json";

import { CRUCE_MAESTRO } from "@/data/cruce-maestro";

import { cantidadPorDron, type Pieza, type Subsistema } from "./esquema";
import { sinAcentos } from "./texto";

/** Una partida del maestro tal como la necesita la interfaz de asociar. */
export interface CandidataMaestro {
  numero: string;
  nombre: string;
  nombreOem: string | null;
  sistema: string | null;
  posicion: string | null;
  /** "4 pza" */
  cantidad: string | null;
  /** SKU de otra pieza que ya lleva este numero (informativo: el maestro junta, p. ej., izquierda y derecha). */
  tambienLaUsa: string | null;
}

export interface SugerenciaMaestro extends CandidataMaestro {
  puntos: number;
  /** Que tanto se parece, para que la ficha diga "muy probable" o "posible" sin mostrar puntos. */
  parecido: "alto" | "medio" | "bajo";
  /** Por que se sugiere, en palabras de quien la revisa. */
  razones: string[];
  /** El equipo ya la propuso en data/cruce-maestro.ts. */
  propuestaPorElEquipo: boolean;
}

type PartidaCruda = {
  numero: string;
  nombre: string | null;
  nombreOem: string | null;
  sistema: string | null;
  cantidad: number | null;
  unidad: string | null;
  posicion: string | null;
};

const PARTIDAS = MAESTRO.partidas as PartidaCruda[];

/** Palabras que no distinguen una pieza de otra. */
const SIN_VALOR = new Set([
  "de", "del", "la", "el", "los", "las", "para", "y", "e", "con", "en", "a", "al", "por", "un", "una",
  "the", "of", "and", "for", "with", "x", "8x", "assembly", "ens", "pza", "pieza", "part",
  // Lado y mitad: distinguen una version de otra, no una pieza de otra.
  "derecho", "derecha", "izquierdo", "izquierda", "izq", "der", "delantero", "delantera", "trasero",
  "trasera", "superior", "inferior", "mitad", "left", "right", "front", "rear", "upper", "lower",
]);

/**
 * Grupos de palabras que en el taller y en el maestro (que mezcla espanol e
 * ingles) quieren decir lo mismo. La primera de cada grupo es la "idea".
 * Las ideas muy comunes valen menos al puntuar (ver PESO_FLOJO).
 */
const SINONIMOS: string[][] = [
  ["soporte", "clamp", "bracket", "mount", "base", "herraje", "abrazadera", "holder"],
  ["patin", "tren", "landing", "gear", "skid", "aterrizaje"],
  ["tubo", "tube", "perfil", "profile", "barra"],
  ["brazo", "arm"],
  ["travesano", "cross", "bar", "crossbar"],
  ["retenedor", "reten", "locking", "latch", "pestillo", "seguro"],
  ["plegado", "folding", "pliegue"],
  ["helice", "propeller", "blade", "pala", "propela"],
  ["motor"],
  ["bomba", "pump", "motobomba"],
  ["tornillo", "screw", "bolt", "perno"],
  ["tuerca", "nut"],
  ["arandela", "washer", "rondana"],
  ["cable", "cableado", "wire", "cord", "arnes", "harness"],
  ["bateria", "battery"],
  ["luz", "luces", "light", "lighting", "iluminacion", "led"],
  ["radar"],
  ["conector", "connector", "tee", "union", "joint", "junta"],
  ["cubierta", "cover", "tapa", "protectora", "carcasa", "housing", "funda", "sleeve"],
  ["tanque", "tank"],
  ["camara", "camera", "fpv"],
  ["antena", "antenna"],
  ["goma", "hule", "rubber", "amortiguador"],
  ["sensor"],
  ["placa", "plate"],
  ["esc", "controlador"],
  ["disco", "disc", "atomizador", "atomizer", "aspersor", "spray"],
  ["manguera", "hose", "silicon", "tubing"],
];

/**
 * Un tornillo, una tuerca o una arandela solo se parece a otro tornillo, tuerca
 * o arandela: el maestro casi no desglosa tornilleria, y sugerirle "Brazo
 * auxiliar" a una arandela porque dice "brazo" confunde mas que ayuda.
 */
const FIJADORES = new Set(["tornillo", "tuerca", "arandela", "inserto"]);

/** Ideas tan comunes que coincidir en ellas solas casi no dice nada. */
const PESO_FLOJO = new Set(["soporte", "tubo", "motor", "cable", "conector", "tornillo", "base"]);

const IDEA_DE = new Map<string, string>();
for (const grupo of SINONIMOS) for (const palabra of grupo) IDEA_DE.set(palabra, grupo[0]);

/** Palabras sueltas de un texto, sin acentos, sin plurales simples y ya convertidas a su "idea". */
function ideas(texto: string | null | undefined): Set<string> {
  const salida = new Set<string>();
  if (!texto) return salida;
  for (let palabra of sinAcentos(texto).toLowerCase().split(/[^a-z0-9]+/)) {
    if (palabra.length < 2 || SIN_VALOR.has(palabra)) continue;
    // Plurales simples: "baterias" -> "bateria", "tornillos" -> "tornillo".
    if (palabra.length > 4 && palabra.endsWith("es") && IDEA_DE.has(palabra.slice(0, -2))) palabra = palabra.slice(0, -2);
    else if (palabra.length > 3 && palabra.endsWith("s") && IDEA_DE.has(palabra.slice(0, -1))) palabra = palabra.slice(0, -1);
    salida.add(IDEA_DE.get(palabra) ?? palabra);
  }
  return salida;
}

/** Sistema del maestro (3 letras) que corresponde a cada subsistema del catalogo. */
const SISTEMAS_DEL_SUBSISTEMA: Record<Subsistema, string[]> = {
  propulsion: ["PRO"],
  estructura: ["EST", "PLA"],
  liquidos: ["BOM", "AGR", "ASP"],
  electronica: ["ELE", "AVI", "CAB", "BAT", "NAV", "COM", "SEG"],
  "tren-aterrizaje": ["EST"],
  aspercion: ["ASP", "AGR", "BOM"],
  otros: [],
};

/** "M1", "M3"... mencionados en un texto: sirve para casar la posicion de una version con la de la partida. */
function motores(texto: string | null | undefined): Set<string> {
  return new Set((texto ?? "").toUpperCase().match(/M[1-4]/g) ?? []);
}

function textoCantidad(p: PartidaCruda): string | null {
  return p.cantidad === null ? null : `${p.cantidad}${p.unidad ? ` ${p.unidad}` : ""}`;
}

function comoCandidata(p: PartidaCruda, duenos: ReadonlyMap<string, string>, sku: string): CandidataMaestro {
  const dueno = duenos.get(p.numero);
  return {
    numero: p.numero,
    nombre: p.nombre ?? p.nombreOem ?? p.numero,
    nombreOem: p.nombreOem,
    sistema: p.sistema,
    posicion: p.posicion && !/^pendiente$/i.test(p.posicion) ? p.posicion : null,
    cantidad: textoCantidad(p),
    tambienLaUsa: dueno && dueno !== sku ? dueno : null,
  };
}

/** Todas las partidas que se pueden asociar (el sistema PRD es el producto terminado, no una pieza). */
export function todasLasCandidatas(duenos: ReadonlyMap<string, string>, sku: string): CandidataMaestro[] {
  return PARTIDAS.filter((p) => p.sistema !== "PRD").map((p) => comoCandidata(p, duenos, sku));
}

/**
 * Las partidas mas parecidas a la pieza, de la mas probable a la menos.
 *
 * Puntos: ideas en comun del nombre (lo que mas pesa), sistema, cantidad por
 * dron, motores de la version y, sobre todo, que el equipo ya la haya propuesto.
 * Sin ninguna idea en comun no se sugiere nada: mejor menos opciones que
 * opciones al azar.
 *
 * `duenos` es numero -> SKU de la pieza que ya lo lleva, para avisar cuando una
 * partida ya esta tomada (solo informativo).
 */
export function sugerirPartidas(
  pieza: Pieza,
  duenos: ReadonlyMap<string, string>,
  maximo = 5,
): SugerenciaMaestro[] {
  const propuestas = new Set<string>([
    ...(CRUCE_MAESTRO[pieza.sku]?.numero ? [CRUCE_MAESTRO[pieza.sku].numero as string] : []),
    ...Object.values(CRUCE_MAESTRO[pieza.sku]?.porVariante ?? {}),
  ]);
  const ideasPieza = ideas(`${pieza.nombre} ${pieza.categoria ?? ""}`);
  // Lo primero que dice el nombre es lo que la pieza ES ("Tornillo del soporte...").
  const primera = [...ideas(pieza.nombre)][0];
  const fijadorPieza = primera && FIJADORES.has(primera) ? primera : null;
  const sistemas = SISTEMAS_DEL_SUBSISTEMA[pieza.subsistema];
  const porDron = cantidadPorDron(pieza);
  const motoresPieza = new Set(pieza.variantes.flatMap((v) => [...motores(v.posicion), ...motores(v.etiqueta)]));

  const resultado: SugerenciaMaestro[] = [];
  for (const p of PARTIDAS) {
    if (p.sistema === "PRD") continue;
    const razones: string[] = [];
    let puntos = 0;

    const comunes = [...ideas(`${p.nombre ?? ""} ${p.nombreOem ?? ""}`)].filter((i) => ideasPieza.has(i));
    for (const idea of comunes) puntos += PESO_FLOJO.has(idea) ? 1.5 : 3;
    if (comunes.length > 0) razones.push(`El nombre coincide en: ${comunes.join(", ")}`);

    const propuesta = propuestas.has(p.numero);
    if (propuesta) {
      puntos += 10;
      razones.unshift("Ya la propuso el equipo");
    }

    // Sin nada en el nombre ni propuesta, lo demas solo no basta.
    if (comunes.length === 0 && !propuesta) continue;
    if (fijadorPieza && !comunes.includes(fijadorPieza) && !propuesta) continue;

    if (p.sistema && sistemas.includes(p.sistema)) {
      puntos += 1;
      razones.push(`Mismo sistema (${p.sistema})`);
    }
    if (porDron > 0 && p.cantidad === porDron) {
      puntos += 2;
      razones.push(`El maestro dice ${p.cantidad} y el dron lleva ${porDron}`);
    }
    const motoresPartida = motores(p.posicion);
    if (motoresPieza.size > 0 && [...motoresPartida].some((m) => motoresPieza.has(m))) {
      puntos += 1.5;
      razones.push(`Misma posición (${[...motoresPartida].join(", ")})`);
    }

    resultado.push({
      ...comoCandidata(p, duenos, pieza.sku),
      puntos,
      parecido: puntos >= 10 ? "alto" : puntos >= 5.5 ? "medio" : "bajo",
      razones,
      propuestaPorElEquipo: propuesta,
    });
  }

  return resultado.sort((a, b) => b.puntos - a.puntos || a.numero.localeCompare(b.numero)).slice(0, maximo);
}
