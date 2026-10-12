import type { Pieza, Seccion } from "@/lib/esquema";

import GENERADO from "./especificaciones-mx80.json";

/**
 * Los datos que un proveedor lee (cotas, material, proceso, requisitos) NO se
 * escriben en este archivo: salen de
 *   contenido/piezas_MX80/especificaciones_brazo_CW1.csv
 * y entran con  npm run specs:importar.
 *
 * Este archivo se queda solo con lo que el CSV no puede saber: como se llama la
 * pieza en Blender y como se comporta al explotar el ensamble. Asi cada dato
 * vive en un unico lugar y no hay dos versiones de la misma cota.
 */
type DatosFicha = Pick<
  Pieza,
  | "especificaciones"
  | "categoria"
  | "proceso_fabricacion"
  | "descripcion_funcional"
  | "especificaciones_tecnicas"
>;

function datosDeFicha(sku: string): DatosFicha {
  const datos = (GENERADO.piezas as Record<string, DatosFicha>)[sku];
  if (!datos) {
    throw new Error(
      `No hay especificaciones para ${sku}. Agrega la fila al CSV y corre: npm run specs:importar`,
    );
  }
  return datos;
}

/**
 * Catalogo semilla del MX80.
 *
 * ================== DOS NIVELES ==================
 * MX80-001      pieza de catalogo: lo que se cotiza, lo que sale en el sitio,
 *               lo que ocupa UNA celda en la vista organizada.
 * MX80-001-02   subpieza: en lo que se desarma esa pieza. No tiene ficha
 *               propia en el catalogo, pero si hoja propia en el PDF y se
 *               separa sola en el despiece.
 *
 * Los dos viven en esta misma lista y se distinguen por "parteDe". El catalogo
 * es plano a proposito: asi el CSV, la validacion y la ficha PDF siguen siendo
 * uno-por-SKU y no hay que manejar estructuras anidadas en ningun lado.
 *
 * ============ COMO AGREGAR UNA PIEZA NUEVA ============
 * 1. Copia un bloque completo. SKU nuevo y consecutivo; los retirados
 *    (MX80-002, MX80-003, MX80-010) NO se reutilizan.
 * 2. Slug en minusculas con guiones, sin acentos.
 * 3. En "nombresBlender" va el nombre EXACTO del objeto en Blender.
 * 4. Agrega su fila al CSV y corre  npm run specs:importar.
 * 5. Si la pieza se desarma, dale subpiezas con parteDe apuntando a ella.
 *
 * ============ NOTA SOBRE LA EXPLOSION ============
 * El GLB usa Y hacia arriba: el eje del motor es Y y el tubo corre sobre +Z.
 * factorExplosion es la separacion como fraccion del radio del ensamble.
 * Con direccionExplosion en null y varias subpiezas bajo el mismo padre,
 * resolverPiezas las abre escalonadas sobre su propio eje (ver ahi).
 */

/**
 * Las piezas de esta lista son el conjunto del BRAZO, y el brazo se repite
 * cuatro veces en el dron: dos horarios (CW) y dos antihorarios (CCW). Por eso
 * comparten estas cuatro secciones en lugar de duplicarse por brazo.
 */
const BRAZOS: Seccion[] = [
  "brazo-cw-1",
  "brazo-cw-2",
  "brazo-ccw-1",
  "brazo-ccw-2",
];

/** Valores comunes a todas las piezas del brazo, para no repetirlos 25 veces. */
const BASE = {
  modelo: "MX80",
  estado: "modelada",
  secciones: BRAZOS,
  cantidadPorSeccion: 1,
  precio_mxn: null,
  stock: null,
  direccionExplosion: null,
  factorExplosion: 1,
  parteDe: null,
  numeroBom: null,
} as const;

export const PIEZAS_MX80: Pieza[] = [
  // ===================================================================
  // MX80-001  Balanceador de helices  (3 subpiezas)
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-001",
    imagen: "/renders/MX80-001.jpg",
    slug: "balanceador-helices",
    nombre: "Balanceador de hélices",
    descripcion:
      "Conjunto que sujeta la hélice al eje del motor. Las dos mitades aprietan la raíz de las palas y la tuerca mantiene la precarga durante el giro.",
    subsistema: "propulsion",
    nombresBlender: [],
    ...datosDeFicha("MX80-001"),
    glb: "models/mx80/piezas/MX80-001_v1.glb",
    numeroBom: "MXD-MX80-PRO-ENS-001-R00",
    orden: 1,
  },
  {
    ...BASE,
    sku: "MX80-001-01",
    parteDe: "MX80-001",
    slug: "balanceador-helices-superior",
    nombre: "Balanceador superior",
    descripcion:
      "Elemento superior del conjunto balanceador. Junto con la pieza inferior sujeta la hélice al eje del motor y reparte la carga durante el giro.",
    subsistema: "propulsion",
    nombresBlender: [
      "Balanceador_Superior",
      "balanceador_helices_arriba",
      "Balanceador de helices arriba",
      "balanceador_helice_sup",
    ],
    direccionExplosion: [0, 1, 0],
    factorExplosion: 0.44,
    ...datosDeFicha("MX80-001-01"),
    glb: "models/mx80/piezas/MX80-001-01_v1.glb",
    imagen: "/renders/MX80-001-01.jpg",
    orden: 2,
  },
  {
    ...BASE,
    sku: "MX80-001-02",
    parteDe: "MX80-001",
    slug: "balanceador-helices-inferior",
    nombre: "Balanceador inferior",
    descripcion:
      "Elemento inferior del conjunto balanceador. Sirve de asiento de la hélice sobre el motor y define el plano de giro.",
    subsistema: "propulsion",
    nombresBlender: [
      "Balanceador_Inferior",
      "balanceador_helices_abajo",
      "Balanceador de helices abajo",
      "balanceador_helice_inf",
    ],
    direccionExplosion: [0, 1, 0],
    factorExplosion: 0.16,
    ...datosDeFicha("MX80-001-02"),
    glb: "models/mx80/piezas/MX80-001-02_v1.glb",
    imagen: "/renders/MX80-001-02.jpg",
    orden: 3,
  },
  {
    ...BASE,
    sku: "MX80-001-03",
    parteDe: "MX80-001",
    slug: "tuerca-balanceador",
    nombre: "Tuerca del balanceador",
    descripcion:
      "Tuerca de apriete que cierra el conjunto balanceador y fija la hélice. Es la pieza de mantenimiento más frecuente del sistema de propulsión.",
    subsistema: "propulsion",
    // El CSV y el GLB coinciden: dos por brazo.
    cantidadPorSeccion: 2,
    // Los 4 nodos del detalle real (jacket_balanceador, spacer_balanceador_1/2,
    // tornillo_balanceador) son nombresBlender de las subpiezas MX80-001-04..07,
    // no de esta pieza: cada uno pertenece a UNA de ellas. Que esten repartidos
    // asi (y no aqui) es seguro porque TuercaDetallada.tsx (el que sustituye el
    // placeholder del ensamble grande por este mismo detalle) filtra por
    // NOMBRE de nodo, no por sku — ver el comentario ahi.
    nombresBlender: [
      "Tuerca_Balanceador",
      "tuerca_balanceador",
      "Tuerca del Balanceador para sujetar helices",
      "sujetador_balanceador_1",
      "sujetador_balanceador_2",
    ],
    direccionExplosion: [0, 1, 0],
    // Sube al tope de la pila del rotor.
    factorExplosion: 0.55,
    ...datosDeFicha("MX80-001-03"),
    // Antes esta pieza no tenia glb propio (su ficha caia al ensamble
    // completo aislado). Reusa el MISMO archivo que ya usan TuercaDetallada.tsx
    // y DetalleTuercaEnPieza en EscenaPieza.tsx para inyectar el detalle
    // dentro del placeholder del ensamble/del balanceador: ya trae los 4
    // nodos (jacket + 2 spacers + tornillo) separados, no hacia falta armar
    // un archivo nuevo.
    glb: "models/mx80/piezas/MX80-003_v2.glb",
    imagen: "/renders/MX80-001-03.jpg",
    numeroBom: "MXD-MX80-PRO-ENS-002-R00",
    orden: 1,
  },
  {
    ...BASE,
    sku: "MX80-001-04",
    // Logicamente es hija de la TUERCA, no del balanceador directo: el
    // numero no seria "MX80-001-03-01" porque el resto de la app (ruta de
    // descarga, el esquema y el importador del CSV) exige el formato
    // MX80-NNN(-NN), un solo sufijo de 2 digitos. parteDe si expresa la
    // jerarquia real.
    parteDe: "MX80-001-03",
    slug: "espaciador-a-tuerca-balanceador",
    nombre: "Espaciador A del balanceador",
    descripcion:
      "Espaciador que va junto al tornillo dentro de la tuerca del balanceador, entre la camisa y la cabeza del tornillo.",
    subsistema: "propulsion",
    cantidadPorSeccion: 2,
    nombresBlender: ["spacer_balanceador_1", "Wear-Resistant Plate A", "Wear Resistant Plate A"],
    ...datosDeFicha("MX80-001-04"),
    glb: "models/mx80/piezas/MX80-001-04_v1.glb",
    imagen: "/renders/MX80-001-04.jpg",
    numeroBom: "MXD-MX80-PRO-PZA-002-R00",
    orden: 2,
  },
  {
    ...BASE,
    sku: "MX80-001-05",
    parteDe: "MX80-001-03",
    slug: "espaciador-b-tuerca-balanceador",
    nombre: "Espaciador B del balanceador",
    descripcion:
      "Segundo espaciador del balanceador, junto al primero (A) a los lados de la camisa.",
    subsistema: "propulsion",
    cantidadPorSeccion: 2,
    nombresBlender: ["spacer_balanceador_2", "Wear-Resistant Plate B", "Wear Resistant Plate B"],
    ...datosDeFicha("MX80-001-05"),
    glb: "models/mx80/piezas/MX80-001-05_v1.glb",
    imagen: "/renders/MX80-001-05.jpg",
    numeroBom: "MXD-MX80-PRO-PZA-003-R00",
    orden: 3,
  },
  {
    ...BASE,
    sku: "MX80-001-06",
    parteDe: "MX80-001-03",
    slug: "camisa-tuerca-balanceador",
    nombre: "Camisa del balanceador",
    descripcion:
      "Camisa metálica que envuelve el tornillo dentro de la tuerca del balanceador y reparte la carga de apriete sobre los espaciadores.",
    subsistema: "propulsion",
    cantidadPorSeccion: 2,
    nombresBlender: ["jacket_balanceador", "steel_sleeve", "Steel Sleeve"],
    ...datosDeFicha("MX80-001-06"),
    glb: "models/mx80/piezas/MX80-001-06_v1.glb",
    imagen: "/renders/MX80-001-06.jpg",
    numeroBom: "MXD-MX80-PRO-PZA-004-R00",
    orden: 4,
  },
  {
    ...BASE,
    sku: "MX80-001-07",
    parteDe: "MX80-001-03",
    slug: "tornillo-tuerca-balanceador",
    nombre: "Tornillo del balanceador",
    descripcion:
      "Tornillo que atraviesa la camisa y los espaciadores y cierra la tuerca del balanceador.",
    subsistema: "propulsion",
    cantidadPorSeccion: 2,
    nombresBlender: ["tornillo_balanceador", "bolt", "Propeller Clamp Rotation Bolt"],
    ...datosDeFicha("MX80-001-07"),
    glb: "models/mx80/piezas/MX80-001-07_v1.glb",
    imagen: "/renders/MX80-001-07.jpg",
    numeroBom: "MXD-MX80-PRO-PZA-007-R00",
    orden: 5,
  },

  // ===================================================================
  // MX80-004  Helices  (2 subpiezas: hoja CW y hoja CCW)
  //
  // El BOM maestro numera cada hoja por separado (PZA-005 CW, PZA-006 CCW),
  // asi que aqui tambien: MX80-004 es el conjunto ("el par que se cotiza y se
  // cataloga"), MX80-004-01/-02 son las hojas. Antes MX80-004 era una sola
  // pieza que solo traia la CW porque era lo unico que habia; la CCW llego
  // despues (ver mapeo-bom-maestro-mx80 en la memoria del proyecto).
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-004",
    imagen: "/renders/MX80-004.jpg",
    slug: "helices-fibra-carbono",
    nombre: "Par de hélices",
    descripcion:
      "Par de hélices de fibra de carbono, una de sentido horario (CW) y otra antihorario (CCW). Cada rotor monta la que le corresponde.",
    subsistema: "propulsion",
    // Como categoria cubre las 4 posiciones: 2 hojas CW en los brazos CW, 2
    // CCW en los CCW. Cada subpieza abajo acota esto a las suyas.
    secciones: BRAZOS,
    // 2 hojas por brazo (las que arman una helice completa).
    cantidadPorSeccion: 2,
    nombresBlender: [],
    ...datosDeFicha("MX80-004"),
    // Muestra 1 hoja CW + 1 hoja CCW juntas: representa el PAR, no una helice
    // armada (para eso esta la ficha de cada subpieza).
    glb: "models/mx80/piezas/MX80-004-par_v1.glb",
    sinDespiece: true,
    orden: 3,
  },
  {
    ...BASE,
    sku: "MX80-004-01",
    parteDe: "MX80-004",
    slug: "helice-cw",
    nombre: "Pala CW",
    descripcion:
      "Pala de hélice CW, de fibra de carbono. Monta en los rotores de sentido horario.",
    subsistema: "propulsion",
    // Solo los brazos horarios.
    secciones: ["brazo-cw-1", "brazo-cw-2"],
    cantidadPorSeccion: 2,
    nombresBlender: [
      "Helice_CW",
      "helice_cw_fibra_carbono",
      "Hélices CW de fibra de carbono",
      "Propeller_CW",
      "Propela_CW_1",
      "Propela_CW_2",
    ],
    direccionExplosion: [0, 1, 0],
    factorExplosion: 0.3,
    ...datosDeFicha("MX80-004-01"),
    // Ya esta en el ensamble (Propela_CW_1_1/_2 en el brazo CW): mismo
    // archivo que antes usaba MX80-004, sin cambios, solo reasignado.
    glb: "models/mx80/piezas/MX80-004_v1.glb",
    imagen: "/renders/MX80-004-01.jpg",
    sinDespiece: true,
    numeroBom: "MXD-MX80-PRO-PZA-005-R00",
    orden: 1,
  },
  {
    ...BASE,
    sku: "MX80-004-02",
    parteDe: "MX80-004",
    slug: "helice-ccw",
    nombre: "Pala CCW",
    descripcion:
      "Pala de hélice CCW, de fibra de carbono. Monta en los rotores de sentido antihorario.",
    subsistema: "propulsion",
    // Solo los brazos antihorarios. OJO: esta hoja NO esta en
    // MX80_brazo_CW_web.glb (ese archivo es un brazo CW): nunca se resuelve
    // en el ensamble principal, por eso trae su propio glb para la ficha.
    secciones: ["brazo-ccw-1", "brazo-ccw-2"],
    cantidadPorSeccion: 2,
    nombresBlender: [
      "Helice_CCW",
      "helice_ccw_fibra_carbono",
      "Hélices CCW de fibra de carbono",
      "Propeller_CCW",
      "Propela_CCW_1",
      "Propela_CCW_2",
    ],
    direccionExplosion: [0, 1, 0],
    factorExplosion: 0.3,
    ...datosDeFicha("MX80-004-02"),
    glb: "models/mx80/piezas/MX80-004-02_v1.glb",
    imagen: "/renders/MX80-004-02.jpg",
    sinDespiece: true,
    numeroBom: "MXD-MX80-PRO-PZA-006-R00",
    orden: 2,
  },

  // ===================================================================
  // MX80-005  Soporte de motor
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-005",
    imagen: "/renders/MX80-005.jpg",
    slug: "soporte-motor",
    nombre: "Soporte de motor",
    descripcion:
      "Pieza que une el motor al extremo del tubo de fibra de carbono y transmite al brazo el empuje y el par de reacción.",
    subsistema: "estructura",
    nombresBlender: [
      "Soporte_Motor",
      "sujetador_motor",
      "Motor_bracket",
      // 6 tornillos M2 que fijan el soporte al motor: mismo objeto repetido,
      // el emparejador ignora el sufijo _1.._6 de cada instancia.
      "tornillo_m2_sujeta_motor",
    ],
    direccionExplosion: [0, -1, 0],
    factorExplosion: 0.21,
    ...datosDeFicha("MX80-005"),
    glb: "models/mx80/piezas/MX80-005_v1.glb",
    // El maestro trae DOS numeros para esta pieza (-021 y -022, "Single Motor
    // Mount 1-3" / "2-4"): Eduardo cree que es un error del maestro, que aqui
    // es UNA sola pieza para las 4 posiciones. Se deja el primero hasta que
    // se confirme con quien mantiene el maestro (ver mapeo-bom-maestro-mx80
    // en la memoria del proyecto).
    numeroBom: "MXD-MX80-EST-PZA-021-R00",
    orden: 7,
  },

  // ===================================================================
  // MX80-006  Cubierta de motor
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-006",
    imagen: "/renders/MX80-006.jpg",
    slug: "cubierta-motor",
    nombre: "Cubierta de motor",
    descripcion:
      "Cubierta protectora del motor contra impacto, agua y residuos de aplicación.",
    subsistema: "estructura",
    nombresBlender: [
      "Cubierta_Motor",
      "cubierta_motor",
      "CarcasaMotor",
      "estampa_mxd_cubierta",
    ],
    direccionExplosion: [0, -0.45, -0.89],
    // Sale hacia afuera del brazo para liberar al soporte.
    factorExplosion: 0.37,
    ...datosDeFicha("MX80-006"),
    glb: "models/mx80/piezas/MX80-006_v1.glb",
    numeroBom: "MXD-MX80-PLA-PZA-001-R00",
    orden: 5,
  },

  // ===================================================================
  // MX80-007  Motor  (9 subpiezas)
  //
  // Todas las subpiezas dejan direccionExplosion en null: resolverPiezas las
  // abre escalonadas sobre el eje del motor. El 0.15 es el techo medido: por
  // encima de eso la cubierta superior se mete en el grupo de helices.
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-007",
    imagen: "/renders/MX80-007.jpg",
    slug: "motor",
    nombre: "Motor",
    descripcion:
      "Motor brushless del grupo propulsor. Se acopla al soporte de motor y acciona el conjunto balanceador-hélice.",
    subsistema: "propulsion",
    nombresBlender: ["Motor", "motor", "Motor_Brushless", "motor_only"],
    ...datosDeFicha("MX80-007"),
    glb: "models/mx80/piezas/MX80-007_v1.glb",
    numeroBom: "MXD-MX80-PRO-SUB-001-R00",
    orden: 6,
  },
  ...[
    ["01", "cubierta-superior-motor", "Cubierta superior del motor", "motor_cubierta_sup"],
    ["02", "escobillas-rodamiento-motor", "Escobillas y rodamiento del motor", "escobillas_rodamiento_motor"],
    ["03", "eje-motor", "Eje del motor", "eje_motor"],
    ["04", "rotor-motor", "Rotor del motor", "motor_rotor"],
    ["05", "estator-motor", "Estator del motor", "estator_motor"],
    ["06", "cubierta-inferior-motor", "Cubierta inferior del motor", "motor_cubierta_inf"],
    ["07", "modulo-conexion", "Módulo de conexión", "modulo_conexion"],
    ["08", "base-modulo-conexion", "Base del módulo de conexión", "base_modulo_conexion"],
    ["09", "empaque-modulo-conexion", "Empaque del módulo de conexión", "empaque_modulo_conexion"],
  ].map(([n, slug, nombre, blender], i): Pieza => ({
    ...BASE,
    sku: `MX80-007-${n}`,
    glb: `models/mx80/piezas/MX80-007-${n}_v1.glb`,
    // Renders de la biblioteca: faltan -07, -08 y -09 (modulo de conexion).
    ...(Number(n) <= 6 ? { imagen: `/renders/MX80-007-${n}.jpg` } : {}),
    parteDe: "MX80-007",
    slug,
    nombre,
    descripcion: `${nombre}. Subconjunto del motor; se separa en el despiece pero no se cotiza por separado.`,
    subsistema: "propulsion",
    nombresBlender: [blender],
    factorExplosion: 0.15,
    ...datosDeFicha(`MX80-007-${n}`),
    orden: i + 1,
  })),

  // ===================================================================
  // MX80-008  Tubo de fibra de carbono
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-008",
    imagen: "/renders/MX80-008.jpg",
    slug: "tubo-fibra-carbono",
    nombre: "Tubo del brazo",
    descripcion:
      "Tubo de fibra de carbono que forma el brazo. Soporta el motor y la hélice y los une al cuerpo del dron.",
    subsistema: "estructura",
    nombresBlender: ["Tubo_Fibra_Carbono", "tubo_fibra_carbono", "Brazo"],
    direccionExplosion: [0, 0, 1],
    // Se aleja del motor a lo largo de su eje.
    factorExplosion: 0.25,
    ...datosDeFicha("MX80-008"),
    glb: "models/mx80/piezas/MX80-008_v1.glb",
    orden: 8,
  },

  // ===================================================================
  // MX80-009  Conjunto ESC 300A  (2 subpiezas)
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-009",
    imagen: "/renders/MX80-009.jpg",
    slug: "conjunto-esc-300a",
    nombre: "Conjunto ESC 300A",
    descripcion:
      "Controlador electrónico de velocidad de 300 A con su base de montaje. Regula la potencia entregada al motor y se fija al brazo.",
    subsistema: "electronica",
    nombresBlender: [],
    ...datosDeFicha("MX80-009"),
    glb: "models/mx80/piezas/MX80-009_v1.glb",
    orden: 9,
  },
  {
    ...BASE,
    sku: "MX80-009-01",
    glb: "models/mx80/piezas/MX80-009-01_v1.glb",
    parteDe: "MX80-009",
    slug: "esc-300a",
    nombre: "ESC 300A",
    descripcion:
      "Controlador electrónico de velocidad (ESC) de 300 A que regula la potencia entregada al motor.",
    subsistema: "electronica",
    nombresBlender: [
      "ESC_300A",
      "esc_300a",
      "ESC 300A",
      "estampa_ESC",
      "OFC_estampa",
    ],
    direccionExplosion: [0.707, 0, 0.707],
    // Acompania al tubo y se separa hacia un lado de su base.
    factorExplosion: 0.36,
    imagen: "/renders/MX80-009-01.jpg",
    ...datosDeFicha("MX80-009-01"),
    numeroBom: "MXD-MX80-PRO-SUB-002-R00",
    orden: 1,
  },
  {
    ...BASE,
    sku: "MX80-009-02",
    glb: "models/mx80/piezas/MX80-009-02_v1.glb",
    parteDe: "MX80-009",
    slug: "base-esc",
    nombre: "Base del ESC",
    descripcion: "Base de montaje que fija el ESC al brazo del dron.",
    subsistema: "electronica",
    nombresBlender: ["base_ESC", "Base_ESC", "Base del ESC"],
    // Perpendicular al tubo, no a lo largo de el: con la direccion anterior
    // (casi +Z, la del propio tubo) la base viajaba en paralelo y las dos
    // cajas seguian traslapadas al 100%.
    direccionExplosion: [1, 0, 0],
    factorExplosion: 0.3,
    ...datosDeFicha("MX80-009-02"),
    // Pendiente ALTA: el maestro cuenta esta pieza como 8 (2 por brazo x 4
    // brazos); solo tenemos escaneado un lado (ver
    // pendiente-esc-bracket-scan-trasero en la memoria del proyecto).
    numeroBom: "MXD-MX80-PLA-PZA-002-R00",
    orden: 2,
  },

  // ===================================================================
  // MX80-011  Marco (frame central)  (4 subpiezas)
  // MX80-010 esta retirado; no se reutiliza.
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-011",
    imagen: "/renders/MX80-011.jpg",
    slug: "marco",
    nombre: "Marco",
    descripcion:
      "Marco estructural central del MX80. Integra los tubos de fibra de carbono, los retenedores y los soportes para brazo que unen los cuatro brazos plegables al cuerpo del dron.",
    subsistema: "estructura",
    secciones: ["frame-general"],
    cantidadPorSeccion: 1,
    nombresBlender: [
      "agarrador de brazo",
      "agarrador de brazo.001",
      "agarrador de brazo.002",
      "agarrador de brazo.003",
      "retenedor_brazo",
      "retenedor_brazo_2",
      "retenedor_brazo_3",
      "retenedor_brazo_4",
      "tubo de 42 step",
      "tubo de 42 step.001",
      "tubo de 60 step",
      "tubo de 60 step.001",
    ],
    glb: "models/mx80/piezas/MX80-011_v1.glb",
    sinDespiece: false,
    ...datosDeFicha("MX80-011"),
    orden: 11,
  },
  {
    ...BASE,
    sku: "MX80-011-01",
    parteDe: "MX80-011",
    slug: "agarrador-de-brazo",
    nombre: "Soporte para brazo",
    descripcion:
      "Pieza que sujeta cada brazo plegable al marco central y actúa como punto de pivote de la bisagra.",
    subsistema: "estructura",
    secciones: ["frame-general"],
    cantidadPorSeccion: 4,
    nombresBlender: [
      "agarrador de brazo",
      "agarrador de brazo.001",
      "agarrador de brazo.002",
      "agarrador de brazo.003",
    ],
    glb: "models/mx80/piezas/MX80-011-01_v1.glb",
    imagen: "/renders/MX80-011-01.jpg",
    direccionExplosion: [1, 0, 0],
    factorExplosion: 0.6,
    ...datosDeFicha("MX80-011-01"),
    orden: 1,
  },
  {
    ...BASE,
    sku: "MX80-011-02",
    parteDe: "MX80-011",
    slug: "retenedor-de-brazo",
    nombre: "Retenedor de brazo",
    descripcion:
      "Retiene el brazo en su posición (plegado o desplegado) y evita el juego lateral en la bisagra.",
    subsistema: "estructura",
    secciones: ["frame-general"],
    cantidadPorSeccion: 4,
    nombresBlender: [
      "retenedor_brazo",
      "retenedor_brazo_2",
      "retenedor_brazo_3",
      "retenedor_brazo_4",
    ],
    glb: "models/mx80/piezas/MX80-011-02_v1.glb",
    imagen: "/renders/MX80-011-02.jpg",
    direccionExplosion: [0, 1, 0],
    factorExplosion: 0.5,
    ...datosDeFicha("MX80-011-02"),
    orden: 2,
  },
  {
    ...BASE,
    sku: "MX80-011-03",
    parteDe: "MX80-011",
    slug: "tubo-42",
    nombre: "Tubo del marco 42 mm",
    descripcion:
      "Tubo de fibra de carbono de 42 mm de diámetro que forma parte del marco central del MX80.",
    subsistema: "estructura",
    secciones: ["frame-general"],
    cantidadPorSeccion: 2,
    nombresBlender: ["tubo de 42 step", "tubo de 42 step.001"],
    glb: "models/mx80/piezas/MX80-011-03_v1.glb",
    imagen: "/renders/MX80-011-03.jpg",
    direccionExplosion: [0, 0, 1],
    factorExplosion: 0.5,
    ...datosDeFicha("MX80-011-03"),
    orden: 3,
  },
  {
    ...BASE,
    sku: "MX80-011-04",
    parteDe: "MX80-011",
    slug: "tubo-60",
    nombre: "Tubo del marco 60 mm",
    descripcion:
      "Tubo de fibra de carbono de 60 mm de diámetro que forma parte del marco central del MX80.",
    subsistema: "estructura",
    secciones: ["frame-general"],
    cantidadPorSeccion: 2,
    nombresBlender: ["tubo de 60 step", "tubo de 60 step.001"],
    glb: "models/mx80/piezas/MX80-011-04_v1.glb",
    imagen: "/renders/MX80-011-04.jpg",
    direccionExplosion: [0, 0, -1],
    factorExplosion: 0.5,
    ...datosDeFicha("MX80-011-04"),
    orden: 4,
  },

  // ===================================================================
  // MX80-012  Tanque
  // Bombas, valvulas y boquillas pendientes de modelado.
  // ===================================================================
  {
    ...BASE,
    sku: "MX80-012",
    imagen: "/renders/MX80-012.jpg",
    slug: "tanque",
    nombre: "Tanque",
    descripcion:
      "Depósito de líquido fitosanitario del MX80. Aloja el sistema de bombeo y las conexiones al conjunto de boquillas.",
    subsistema: "aspercion",
    secciones: ["tanque"],
    cantidadPorSeccion: 1,
    nombresBlender: ["tanque_spline"],
    glb: "models/mx80/piezas/MX80-012_v1.glb",
    sinDespiece: true,
    parteDe: null,
    ...datosDeFicha("MX80-012"),
    orden: 12,
  },
];
