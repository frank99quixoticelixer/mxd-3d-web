import type * as THREE from "three";

import { normalizarNombre as normalizar } from "@/lib/texto";

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
  frente: "MX80-014",
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
  // El v3 traia "frame_tubo42"; el v4, "frame_tubo50". Confirmar la medida.
  { re: /^frame_tubo(42|50)/i, sku: "MX80-011-03", zona: "frame", nodo: "frame_tubo50_del" },
  { re: /^frame_tubo69/i, sku: "MX80-011-04", zona: "frame", nodo: "frame_tubo69_der" },
  // Carcasa frontal (MX80-014). En el GLB v3 el cascaron se llama
  // ModeloAvantiv9 (6180 triangulos, el mismo de "frontcase" del v2).
  { re: /^ModeloAvantiv/i, sku: "MX80-014" },
  // En el GLB v4 el cascaron es "DRONE_CLEAN_TOPOLOGY" (renombrarlo en Blender).
  { re: /^DRONE_CLEAN_TOPOLOGY/i, sku: "MX80-014" },
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
  // Las medidas de los tornillos cambiaron del GLB v3 al v4; se aceptan las dos.
  { re: /^M5x(55|51)_amarre_pata/i, sku: "MX80-013-11", zona: "tren-aterrizaje", nodo: "M5x51_amarre_pata" },
  { re: /^M5x(60|65)_agarre_tren/i, sku: "MX80-013-12", zona: "tren-aterrizaje", nodo: "M5x65_agarre_tren" },
  { re: /^M6x(50|42)_travesano/i, sku: "MX80-013-13", zona: "tren-aterrizaje", nodo: "M6x42_travesano" },
  { re: /^M5x(25|50)_cople/i, sku: "MX80-013-14", zona: "tren-aterrizaje", nodo: "M5x50_cople" },
];

/**
 * En el GLB el marco y el tren cuelgan del mismo grupo (`tren_aterrizaje`).
 * Lo que coincide con esto es marco; el resto, tren. Los tornillos y sus
 * arandelas van con la pieza que sujetan: M4 a los agarradores y retenedores,
 * M6x10 a los retenedores. Las arandelas y tuercas M5 y las gomas son del
 * tren.
 *
 * Los coples y sus tornillos M5x25 son del tren (catalogo MX80-013): unen los
 * patines a los travesanos. Antes estaban aqui y el clic en un cople abria el
 * marco.
 */
export const ES_MARCO =
  /^(agarrador_|retenedor_|frame_tubo|M4x\d+_(agarrador|retenedor)|M6x10_retenedor|Arandela_M4|Arandela_M6)/i;

/** Nombre del grupo que contiene marco y tren en el GLB v2. */
export const NODO_MARCO_Y_TREN = "tren_aterrizaje";

/**
 * Nombre base de un nodo, sin los sufijos de duplicado: "M4x10_agarrador_01005"
 * y "M4x10_agarrador_01" son el mismo tornillo repetido. Sirve para agrupar
 * en una sola entrada las piezas identicas (48 tornillos M4x10 son una, no 48).
 */
export function nombreBase(nombre: string): string {
  // Se quitan sufijos hasta que no quede ninguno: "Arandela_M4_001001" pasa
  // por "Arandela_M4_001" hasta "Arandela_M4". Nunca toca el "M4" del final
  // porque no va precedido de guion bajo.
  let base = nombre;
  let antes;
  do {
    antes = base;
    base = base.replace(/\d{3}$/, "").replace(/_\d{1,3}$/, "").replace(/_+$/, "");
  } while (base !== antes);
  return base;
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
  // Por la geometria (7580 triangulos) son los 4 tornillos M2x10 de la
  // carcasa fusionados en una malla. Confirmar y renombrar en Blender.
  Open_CASCADE_STEP_translator_79_1: "Tornillos de la carcasa",
  goma_der_del: "Goma delantera derecha",
  goma_der_tra: "Goma trasera derecha",
  goma_izq_del: "Goma delantera izquierda",
  goma_izq_tra: "Goma trasera izquierda",
  Arandela_M4: "Arandelas M4",
  Arandela_M5: "Arandelas M5",
  Arandela_M6: "Arandelas M6",
  Tuerca_M5: "Tuercas M5",
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

/**
 * Que nodos del GLB forman cada zona.
 *
 * Los brazos se reparten por el sentido de su helice: brazo y brazo_4 montan
 * Propela_CCW, brazo_2 y brazo_3 montan Propela_CW (ver SIGNO_GIRO). Un solo
 * brazo por zona: los cuatro son el mismo numero de parte montado cuatro
 * veces, asi que mostrar dos no aporta nada y estorba.
 *
 * El marco y el tren cuelgan del mismo grupo; se separan por nombre con
 * ES_MARCO.
 */
export function nodosDeZonaEn(raiz: THREE.Object3D, zona: ZonaVisor): THREE.Object3D[] {
  const uno = (nombre: string) => {
    const nodo = raiz.getObjectByName(nombre);
    return nodo ? [nodo] : [];
  };
  const marcoYTren = raiz.getObjectByName(NODO_MARCO_Y_TREN)?.children ?? [];
  switch (zona) {
    case "brazo-cw":
      return uno("brazo_2");
    case "brazo-ccw":
      return uno("brazo");
    case "tanque":
      return uno("tanque");
    case "frente":
      // "frente_dron" en el GLB v3, "carcasa_frontal" en el v4.
      return [...uno("carcasa_frontal"), ...uno("frente_dron")];
    case "frame":
      return marcoYTren.filter((n) => ES_MARCO.test(n.name));
    case "tren-aterrizaje":
      return marcoYTren.filter((n) => !ES_MARCO.test(n.name));
  }
}

/**
 * Que mostrar de una pieza en el visor de su ficha.
 *
 * POR QUE: la ficha ya no carga un GLB por pieza; muestra los nodos de la
 * pieza dentro del mismo GLB completo de la portada (una sola descarga, que
 * el navegador ya tiene en cache si se llego desde el visor). Esto dice
 * cuales nodos son.
 *
 * Se arma en el servidor con los datos del catalogo (seleccionDePieza) y se
 * resuelve en el navegador contra el GLB cargado (nodosDeSeleccion).
 */
export interface SeleccionPieza {
  /**
   * GLB de donde salen los nodos, relativo a public/. null = el GLB completo.
   * La unica excepcion es el interior de la tuerca del balanceador, que el GLB
   * completo no trae (ver URL_TUERCA_DETALLADA en EscenaPieza.tsx).
   */
  fuente: string | null;
  /** La pieza es una zona entera del visor (marco, tanque, tren, frente). */
  zona: ZonaVisor | null;
  /** La pieza es un componente del brazo ("motor", "helices"...). */
  componente: string | null;
  /** Nombres de nodo de la pieza (sus nombresBlender). */
  nombres: string[];
  /** Nombres de nodo de sus subpiezas: el respaldo de un conjunto. */
  nombresSubpiezas: string[];
}

/** Modelo detallado de la tuerca del balanceador: lo unico que no trae el GLB completo. */
export const GLB_TUERCA_DETALLADA = "models/mx80/piezas/MX80-003_v2.glb";
const SKU_TUERCA = "MX80-001-03";

/**
 * Seleccion de una pieza. `ancestros` son los SKU de sus piezas padre y
 * `nombresDescendientes` los nombresBlender de todas sus subpiezas: se usan
 * cuando la pieza no tiene nombres propios (un conjunto como el tren).
 */
export function seleccionDePieza(
  sku: string,
  nombresBlender: string[],
  ancestros: string[],
  nombresDescendientes: string[],
): SeleccionPieza {
  const zona =
    (Object.entries(SKU_ZONA).find(([, s]) => s === sku)?.[0] as ZonaVisor | undefined) ??
    null;
  const componente =
    Object.entries(SKU_COMPONENTE_BRAZO).find(([, s]) => s === sku)?.[0] ?? null;
  return {
    fuente: ancestros.includes(SKU_TUERCA) ? GLB_TUERCA_DETALLADA : null,
    zona,
    componente,
    nombres: nombresBlender,
    nombresSubpiezas: nombresDescendientes,
  };
}

/** true si hay algo que buscar: si no, la ficha no muestra visor. */
export function seleccionTieneAlgo(s: SeleccionPieza): boolean {
  return Boolean(
    s.zona || s.componente || s.nombres.length > 0 || s.nombresSubpiezas.length > 0,
  );
}

/** Nombre de nodo como lo deja three.js al cargar el GLB. */
const sanear = (nombre: string) =>
  nombre.replace(/\s/g, "_").replace(/[[\].:/]/g, "");

/**
 * Los nodos con alguno de esos nombres. Primero por nombre exacto: si se
 * comparara normalizado de entrada, "spacer_balanceador_1" y "_2" serian el
 * mismo y las dos fichas mostrarian el primero. Solo si nada coincide exacto
 * se compara normalizado, que absorbe los sufijos de instancia (_1, _01005).
 *
 * Una pieza que el dron lleva varias veces (los motores de los cuatro brazos,
 * 48 tornillos iguales) se muestra una vez: de las coincidencias se queda con
 * las del primer conjunto en que aparece y, dentro de el, una por nombre.
 */
function nodosConNombres(raiz: THREE.Object3D, nombres: string[]): THREE.Object3D[] {
  if (nombres.length === 0) return [];
  const exactos = new Set(nombres.map(sanear));
  const normalizados = new Set(nombres.map(normalizar));
  const buscar = (coincide: (n: THREE.Object3D) => boolean) => {
    const encontrados: THREE.Object3D[] = [];
    raiz.traverse((n) => {
      if (n !== raiz && n.name && coincide(n)) encontrados.push(n);
    });
    return encontrados;
  };
  let coincidencias = buscar((n) => exactos.has(n.name));
  if (coincidencias.length === 0) {
    coincidencias = buscar((n) => normalizados.has(normalizar(n.name)));
  }
  if (coincidencias.length === 0) return [];

  const conjuntoDe = (n: THREE.Object3D) => {
    let actual = n;
    while (actual.parent && actual.parent !== raiz) actual = actual.parent;
    return actual;
  };
  const conjunto = conjuntoDe(coincidencias[0]);
  const vistos = new Set<string>();
  return coincidencias.filter((n) => {
    if (conjuntoDe(n) !== conjunto) return false;
    const clave = normalizar(n.name);
    if (vistos.has(clave) && !exactos.has(n.name)) return false;
    vistos.add(clave);
    return true;
  });
}

/**
 * Los nodos de la seleccion dentro de `raiz`, en este orden:
 *   1. un componente del brazo (el motor son dos nodos, no un nombre)
 *   2. los nombres de la propia pieza
 *   3. la zona entera, para un conjunto cuyos nombres no estan en el GLB
 *      (el marco del catalogo usa los nombres del GLB v1)
 *   4. los nombres de sus subpiezas
 * La carcasa frontal, por ejemplo, se resuelve en el paso 2: si ganara la
 * zona, su ficha mostraria tambien las camaras del frente.
 */
export function nodosDeSeleccion(
  raiz: THREE.Object3D,
  s: SeleccionPieza,
): THREE.Object3D[] {
  if (s.componente) {
    const brazo = raiz.getObjectByName("brazo");
    const comp = brazo
      ? componentesDelBrazo(brazo).find((c) => c.clave === s.componente)
      : undefined;
    if (comp) return comp.nodos;
  }
  const propios = nodosConNombres(raiz, s.nombres);
  if (propios.length > 0) return propios;
  if (s.zona) return nodosDeZonaEn(raiz, s.zona);
  return nodosConNombres(raiz, s.nombresSubpiezas);
}
