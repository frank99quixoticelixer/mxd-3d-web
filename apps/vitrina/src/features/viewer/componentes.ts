import type * as THREE from "three";

import type { ZonaVisor } from "./estado";

/**
 * Lo que el visor necesita de una pieza del catalogo para enlazar a su ficha.
 * Lo arma la pagina en el servidor y baja por props: este archivo no importa
 * lib/catalogo, para no arrastrar el catalogo al bundle del navegador.
 */
export interface FichaEnlace {
  sku: string;
  slug: string;
  nombre: string;
}

/**
 * Algo que se puede tocar dentro de una zona: su clave, los nodos del GLB que
 * lo forman (pueden ser varios) y la pieza del catalogo a la que corresponde.
 */
export interface Componente {
  clave: string;
  nodos: THREE.Object3D[];
  sku: string | null;
}

/** Pieza del catalogo que es cada zona entera, si la zona es una sola pieza. */
export const SKU_ZONA: Partial<Record<ZonaVisor, string>> = {
  frame: "MX80-011",
  tanque: "MX80-012",
  "tren-aterrizaje": "MX80-013",
};

/**
 * Pieza del catalogo de cada componente del brazo. Las claves salen de
 * componentesDelBrazo().
 */
const SKU_COMPONENTE_BRAZO: Record<string, string> = {
  motor: "MX80-007",
  balanceador: "MX80-001",
  helices: "MX80-004",
  cubierta: "MX80-006",
  soporte: "MX80-005",
  esc: "MX80-009",
  tubo: "MX80-008",
};

/**
 * Piezas sueltas del marco, el tanque y el tren: la expresion que reconoce sus
 * nodos en el GLB (nombres ya saneados por three.js: sin puntos, espacios a
 * guion bajo), su pieza del catalogo y, si se puede llegar a ella desde un
 * enlace, su zona y el nodo que la representa.
 *
 * El orden importa: la primera expresion que coincide gana, asi que las
 * mitades de cada cople van antes que el cople completo.
 *
 * Nombres del GLB v3. "frame_tubo69" es el tubo que el catalogo llama "tubo de
 * 60": confirmar la medida con quien modelo.
 */
const PIEZAS_SUELTAS: readonly {
  /** null: la pieza no es un nodo del GLB, solo se llega por enlace. */
  re: RegExp | null;
  sku: string;
  zona?: ZonaVisor;
  nodo?: string;
}[] = [
  // Marco (MX80-011)
  { re: /^agarrador_(del|tra)_/i, sku: "MX80-011-01", zona: "frame", nodo: "agarrador_del_der" },
  { re: /^retenedor_(del|tra)_/i, sku: "MX80-011-02", zona: "frame", nodo: "retenedor_del_der" },
  { re: /^frame_tubo42/i, sku: "MX80-011-03", zona: "frame", nodo: "frame_tubo42_del" },
  { re: /^frame_tubo69/i, sku: "MX80-011-04", zona: "frame", nodo: "frame_tubo69_der" },
  // Tanque (MX80-012)
  { re: /^tanque/i, sku: "MX80-012" },
  // Tren de aterrizaje (MX80-013), del catalogo de feature/catalogo-tren-aterrizaje
  { re: /^patin_derecho/i, sku: "MX80-013-01", zona: "tren-aterrizaje", nodo: "patin_derecho" },
  { re: /^patin_izquierdo/i, sku: "MX80-013-02", zona: "tren-aterrizaje", nodo: "patin_izquierdo" },
  { re: /^agarre_A_/i, sku: "MX80-013-03", zona: "tren-aterrizaje", nodo: "agarre_A_del_der" },
  { re: /^agarre_B_/i, sku: "MX80-013-04", zona: "tren-aterrizaje", nodo: "agarre_B_del_izq" },
  { re: /^cople_del_der_mitad_A/i, sku: "MX80-013-15", zona: "tren-aterrizaje", nodo: "cople_del_der_mitad_A" },
  { re: /^cople_del_der_mitad_B/i, sku: "MX80-013-16", zona: "tren-aterrizaje", nodo: "cople_del_der_mitad_B" },
  { re: /^cople_del_izq_mitad_A/i, sku: "MX80-013-17", zona: "tren-aterrizaje", nodo: "cople_del_izq_mitad_A" },
  { re: /^cople_del_izq_mitad_B/i, sku: "MX80-013-18", zona: "tren-aterrizaje", nodo: "cople_del_izq_mitad_B" },
  { re: /^cople_tra_der_mitad_A/i, sku: "MX80-013-19", zona: "tren-aterrizaje", nodo: "cople_tra_der_mitad_A" },
  { re: /^cople_tra_der_mitad_B/i, sku: "MX80-013-20", zona: "tren-aterrizaje", nodo: "cople_tra_der_mitad_B" },
  { re: /^cople_tra_izq_mitad_A/i, sku: "MX80-013-21", zona: "tren-aterrizaje", nodo: "cople_tra_izq_mitad_A" },
  { re: /^cople_tra_izq_mitad_B/i, sku: "MX80-013-22", zona: "tren-aterrizaje", nodo: "cople_tra_izq_mitad_B" },
  // El cople completo no es un nodo: desde un enlace se abre su mitad A.
  { re: null, sku: "MX80-013-05", zona: "tren-aterrizaje", nodo: "cople_del_der_mitad_A" },
  { re: null, sku: "MX80-013-06", zona: "tren-aterrizaje", nodo: "cople_del_izq_mitad_A" },
  { re: null, sku: "MX80-013-07", zona: "tren-aterrizaje", nodo: "cople_tra_der_mitad_A" },
  { re: null, sku: "MX80-013-08", zona: "tren-aterrizaje", nodo: "cople_tra_izq_mitad_A" },
  { re: /^travesano_delantero/i, sku: "MX80-013-09", zona: "tren-aterrizaje", nodo: "travesano_delantero" },
  { re: /^travesano_trasero/i, sku: "MX80-013-10", zona: "tren-aterrizaje", nodo: "travesano_trasero" },
  { re: /^M5x55_amarre_pata/i, sku: "MX80-013-11", zona: "tren-aterrizaje", nodo: "M5x55_amarre_pata" },
  { re: /^M5x60_agarre_tren/i, sku: "MX80-013-12", zona: "tren-aterrizaje", nodo: "M5x60_agarre_tren" },
  { re: /^M6x50_travesano/i, sku: "MX80-013-13", zona: "tren-aterrizaje", nodo: "M6x50_travesano" },
  { re: /^M5x25_cople/i, sku: "MX80-013-14", zona: "tren-aterrizaje", nodo: "M5x25_cople" },
];

/**
 * En el GLB el marco y el tren cuelgan del mismo grupo (`tren_aterrizaje`).
 * Lo que coincide con esto es marco; el resto, tren. Los tornillos van con la
 * pieza que sujetan: M4x10 a los agarradores y M6x10 a los retenedores.
 *
 * Los coples y sus tornillos M5x25 son del tren (catalogo MX80-013): unen los
 * patines a los travesanos. Antes estaban aqui y el clic en un cople abria el
 * marco.
 */
export const ES_MARCO =
  /^(agarrador_|retenedor_|frame_tubo|M4x10_agarrador|M6x10_retenedor)/i;

/** Nombre del grupo que contiene marco y tren en el GLB v2. */
export const NODO_MARCO_Y_TREN = "tren_aterrizaje";

/**
 * Nombre base de un nodo, sin los sufijos de duplicado: "M4x10_agarrador_01005"
 * y "M4x10_agarrador_01" son el mismo tornillo repetido. Sirve para agrupar
 * en una sola entrada las piezas identicas (48 tornillos M4x10 son una, no 48).
 */
export function nombreBase(nombre: string): string {
  return nombre.replace(/\d{3}$/, "").replace(/_\d{2}$/, "");
}

export function skuDeNodo(nombre: string): string | null {
  return PIEZAS_SUELTAS.find((p) => p.re?.test(nombre))?.sku ?? null;
}

const esBrazo = (zona: ZonaVisor | null) =>
  zona === "brazo-cw" || zona === "brazo-ccw";

/**
 * Pieza del catalogo de lo aislado en una zona. `pieza` es la clave del
 * componente en un brazo ("motor") o el nombre del nodo en las demas zonas.
 */
export function skuDePieza(zona: ZonaVisor | null, pieza: string): string | null {
  return esBrazo(zona) ? (SKU_COMPONENTE_BRAZO[pieza] ?? null) : skuDeNodo(pieza);
}


/**
 * Donde se ve una pieza del catalogo dentro del visor: su zona y, si hace
 * falta aislarla, la pieza. null si el visor todavia no la tiene ubicada.
 *
 * Es lo que permite que la ficha de una pieza abra el visor ya parado en ella.
 */
export function ubicacionDeSku(
  sku: string,
): { zona: ZonaVisor; pieza: string | null } | null {
  for (const [clave, s] of Object.entries(SKU_COMPONENTE_BRAZO)) {
    if (s === sku) return { zona: "brazo-cw", pieza: clave };
  }
  for (const [zona, s] of Object.entries(SKU_ZONA)) {
    if (s === sku) return { zona: zona as ZonaVisor, pieza: null };
  }
  const suelta = PIEZAS_SUELTAS.find((p) => p.sku === sku && p.zona && p.nodo);
  return suelta?.zona && suelta.nodo ? { zona: suelta.zona, pieza: suelta.nodo } : null;
}

/**
 * Nombre legible de un nodo sin pieza en el catalogo (las del tren, por
 * ejemplo): "patin_derecho" -> "Patin derecho". Sin sufijos numericos de
 * Blender ni de three.js.
 */
export function nombreDeNodo(nombre: string): string {
  const limpio = nombre
    .replace(/(_\d+)+$/g, "")
    .replace(/\d+$/g, "")
    .replace(/_/g, " ")
    .trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Nombres de los componentes del brazo que no tienen ficha propia. */
export const NOMBRE_COMPONENTE: Record<string, string> = {
  motor: "Motor",
  balanceador: "Balanceador de hélices",
  helices: "Hélices",
  cubierta: "Cubierta del motor",
  esc: "Conjunto ESC",
  soporte: "Soporte del motor",
  tubo: "Tubo de fibra de carbono",
  // Piezas del frente del dron (GLB v3). Sus nombres vienen de la exportacion
  // y no dicen que son; renombrarlas en Blender y quitar esto.
  camara_frontal_dummy: "Cámara frontal",
  camara_inferior_dummy: "Cámara inferior",
  ModeloAvantiv9: "Cubierta frontal",
  Open_CASCADE_STEP_translator_79_1: "Pieza del frente sin nombre",
};

/** true si `obj` es `ancestro` o cuelga de el. */
export function esDescendiente(
  obj: THREE.Object3D,
  ancestro: THREE.Object3D,
): boolean {
  let actual: THREE.Object3D | null = obj;
  while (actual) {
    if (actual === ancestro) return true;
    actual = actual.parent;
  }
  return false;
}

/**
 * Descompone un brazo en sus componentes, leyendo los nombres reales de sus
 * nodos (three.js sufija los duplicados de los cuatro brazos: estatico,
 * estatico001, ...).
 *
 * El caso clave es el MOTOR, que vive en dos nodos: `motor_giratorio` (la
 * mitad que gira, dentro de `giratorio`) y `estatico` (la mitad fija pegada al
 * tubo). Juntos son el MX80-007. Por eso un componente es una lista de nodos y
 * no uno solo.
 */
export function componentesDelBrazo(brazo: THREE.Object3D): Componente[] {
  const hijos = brazo.children;
  const porNombre = (nodos: THREE.Object3D[], re: RegExp) =>
    nodos.filter((n) => re.test(n.name));

  const giratorio = hijos.find((h) => /^giratorio/i.test(h.name));
  const deGiratorio = giratorio ? giratorio.children : [];

  const comps: Omit<Componente, "sku">[] = [
    {
      clave: "motor",
      nodos: [
        ...porNombre(deGiratorio, /^motor_giratorio/i),
        ...porNombre(hijos, /^estatico/i),
      ],
    },
    { clave: "balanceador", nodos: porNombre(deGiratorio, /^balanceador/i) },
    { clave: "helices", nodos: porNombre(deGiratorio, /^helices/i) },
    { clave: "cubierta", nodos: porNombre(hijos, /^cubierta_motor/i) },
    { clave: "esc", nodos: porNombre(hijos, /^esc/i) },
    { clave: "soporte", nodos: porNombre(hijos, /^sujeta_motor/i) },
    { clave: "tubo", nodos: porNombre(hijos, /^tubo_fibra/i) },
  ];

  // Cualquier otro hijo directo es su propio componente, para que todo el
  // brazo quede clicable aunque el GLB traiga un nodo nuevo.
  const usados = new Set<THREE.Object3D>(giratorio ? [giratorio] : []);
  for (const c of comps) for (const n of c.nodos) usados.add(n);
  for (const h of hijos) {
    if (!usados.has(h)) comps.push({ clave: h.name, nodos: [h] });
  }

  return comps
    .filter((c) => c.nodos.length > 0)
    .map((c) => ({ ...c, sku: SKU_COMPONENTE_BRAZO[c.clave] ?? null }));
}

/** Componente al que pertenece la malla tocada, o null. */
export function componenteDeMalla(
  malla: THREE.Object3D,
  comps: Componente[],
): Componente | null {
  return (
    comps.find((c) => c.nodos.some((nodo) => esDescendiente(malla, nodo))) ??
    null
  );
}
