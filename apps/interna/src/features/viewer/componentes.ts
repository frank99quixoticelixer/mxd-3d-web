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
  /** Versiones espejo de la pieza (CW / CCW...), sin numero de parte. */
  variantes?: { clave: string; etiqueta: string; posicion: string }[];
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
  radar: "MX80-020",
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
  cables: "MX80-015",
  aspersor: "MX80-016",
};

/**
 * Piezas del catalogo DENTRO de un componente del brazo: el nivel que se abre
 * al aislar el componente. Sin esto el aspersor era un bloque de 38 nodos sin
 * forma de llegar al disco o a una manguera.
 *
 * La clave de una subpieza es "<componente>/<subpieza>" ("aspersor/disco"):
 * cabe en la URL (?pieza=aspersor/disco) y se sabe a que componente volver.
 * Las expresiones se prueban sobre los nodos del componente de arriba hacia
 * abajo; el primer nodo que coincide se toma entero (con sus hijos), asi que
 * el pivote del disco se lleva al disco y no se cuenta dos veces.
 */
const SUBPIEZAS_COMPONENTE: Record<
  string,
  readonly { clave: string; re: RegExp; sku: string }[]
> = {
  aspersor: [
    { clave: "cuerpo-y", re: /^pieza_A_cuerpo_Y/i, sku: "MX80-016-01" },
    { clave: "conector", re: /^pieza_B_conector/i, sku: "MX80-016-02" },
    { clave: "pasador", re: /^pasador_D5/i, sku: "MX80-016-03" },
    { clave: "tapas", re: /^tapa_(der|izq)/i, sku: "MX80-016-04" },
    { clave: "motor-centrifuga", re: /^(der|izq)_motor/i, sku: "MX80-016-05" },
    { clave: "disco", re: /^(pivote_)?(der|izq)_disco/i, sku: "MX80-016-06" },
    { clave: "tornillos", re: /^(der|izq)_tornillo/i, sku: "MX80-016-07" },
    { clave: "tuercas", re: /^(der|izq)_tuerca/i, sku: "MX80-016-08" },
    { clave: "mangueras-cabezal", re: /^manguera_(der|izq)/i, sku: "MX80-016-09" },
    { clave: "manguera-alimentacion", re: /^manguera_alimentacion/i, sku: "MX80-016-10" },
    { clave: "seguros", re: /^seguro_manguera/i, sku: "MX80-016-11" },
    { clave: "pigtail", re: /^cable_cabezal/i, sku: "MX80-016-12" },
    { clave: "conectores", re: /^conector_(der|izq)/i, sku: "MX80-016-13" },
    { clave: "arnes", re: /^arnes_com/i, sku: "MX80-016-14" },
    { clave: "conector-gh4p", re: /^arnes_conector_GH4P/i, sku: "MX80-016-15" },
    { clave: "malla", re: /^arnes_malla/i, sku: "MX80-016-16" },
    { clave: "termocontractil", re: /^arnes_termo/i, sku: "MX80-016-17" },
    { clave: "pasamuros", re: /^arnes_pasamuros/i, sku: "MX80-016-18" },
    { clave: "abrazaderas", re: /^arnes_abrazadera/i, sku: "MX80-016-19" },
  ],
  cables: [
    { clave: "potencia-positivo", re: /^cable_potencia_positivo/i, sku: "MX80-015-01" },
    { clave: "potencia-negativo", re: /^cable_potencia_negativo/i, sku: "MX80-015-02" },
    { clave: "manga-positivo", re: /^manga_cable_positivo/i, sku: "MX80-015-03" },
    { clave: "manga-negativo", re: /^manga_cable_negativo/i, sku: "MX80-015-04" },
    { clave: "funda", re: /^funda_cables_potencia/i, sku: "MX80-015-05" },
    { clave: "fases", re: /^cables_fase_motor/i, sku: "MX80-015-06" },
    { clave: "senal", re: /^cable_senal_ESC/i, sku: "MX80-015-07" },
    { clave: "jr3p", re: /^conector_senal_JR3P/i, sku: "MX80-015-08" },
  ],
  esc: [
    { clave: "esc-300a", re: /^ESC_300A/i, sku: "MX80-009-01" },
    { clave: "base", re: /^base_ESC/i, sku: "MX80-009-02" },
    { clave: "tapa-trasera", re: /^tapa_trasera_ESC/i, sku: "MX80-009-03" },
    { clave: "tornillos-esc", re: /^tornillo_M4x12_ESC/i, sku: "MX80-009-04" },
    { clave: "arandelas-esc", re: /^arandela_M4x12_ESC/i, sku: "MX80-009-05" },
    { clave: "arandelas-presion-esc", re: /^arandela_presion_M4x12_ESC/i, sku: "MX80-009-06" },
    { clave: "tornillos-abrazadera", re: /^tornillo_M4x18_abrazadera/i, sku: "MX80-009-07" },
    { clave: "arandelas-abrazadera", re: /^arandela_M4x18_abrazadera/i, sku: "MX80-009-08" },
    { clave: "arandelas-presion-abrazadera", re: /^arandela_presion_M4x18_abrazadera/i, sku: "MX80-009-09" },
    { clave: "insertos", re: /^inserto_roscado_M4/i, sku: "MX80-009-10" },
  ],
};

/** Separa "aspersor/disco" en su componente y su subpieza. */
export function partirClave(pieza: string): { componente: string; subpieza: string | null } {
  const i = pieza.indexOf("/");
  return i < 0
    ? { componente: pieza, subpieza: null }
    : { componente: pieza.slice(0, i), subpieza: pieza.slice(i + 1) };
}

/**
 * Las subpiezas de un componente del brazo, ya con sus nodos. Vacio si el
 * componente no se abre en piezas (el tubo, la cubierta).
 */
export function subpiezasDe(comp: Componente): Componente[] {
  const reglas = SUBPIEZAS_COMPONENTE[comp.clave];
  if (!reglas) return [];
  const porRegla = new Map<string, THREE.Object3D[]>();
  const visitar = (n: THREE.Object3D) => {
    const regla = reglas.find((r) => r.re.test(n.name));
    if (regla) {
      const lista = porRegla.get(regla.clave) ?? [];
      lista.push(n);
      porRegla.set(regla.clave, lista);
      return;
    }
    for (const hijo of n.children) visitar(hijo);
  };
  for (const nodo of comp.nodos) visitar(nodo);
  return reglas
    .filter((r) => porRegla.has(r.clave))
    .map((r) => ({ clave: `${comp.clave}/${r.clave}`, nodos: porRegla.get(r.clave)!, sku: r.sku }));
}

/**
 * Piezas sueltas del marco, el tanque y el tren: la expresion que reconoce sus
 * nodos en el GLB (nombres ya saneados por three.js: sin puntos, espacios a
 * guion bajo), su pieza del catalogo y, si se puede llegar a ella desde un
 * enlace, su zona y el nodo que la representa.
 *
 * El orden importa: la primera expresion que coincide gana, asi que las
 * mitades de cada cople van antes que el cople completo.
 *
 * Nombres del GLB v5 (MX80_completo_v5_web.glb). "frame_tubo69" es el tubo
 * que el catalogo llama "tubo de 60": confirmar la medida con quien modelo.
 *
 * `nodo` es tambien la clave con la que la zona agrupa la pieza en la lista:
 * todas las mallas de un mismo SKU (los cinco LED de la bateria, las cuatro
 * gomas del tren) son una sola entrada, y un enlace ?pieza=<nodo> la abre.
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
  // Tornillos y arandelas del agarrador y del retenedor: antes caian en
  // ES_MARCO (se agrupaban visualmente con el marco) pero no tenian SKU
  // propio, asi que tocarlos no abria ninguna ficha.
  { re: /^M4x7_agarrador/i, sku: "MX80-011-05", zona: "frame", nodo: "M4x7_agarrador" },
  { re: /^Arandela_M4/i, sku: "MX80-011-07", zona: "frame", nodo: "Arandela_M4" },
  { re: /^M6x10_retenedor/i, sku: "MX80-011-06", zona: "frame", nodo: "M6x10_retenedor" },
  { re: /^M4x9_retenedor/i, sku: "MX80-011-08", zona: "frame", nodo: "M4x9_retenedor" },
  { re: /^Arandela_M6/i, sku: "MX80-011-09", zona: "frame", nodo: "Arandela_M6" },
  // El v3 traia "frame_tubo42"; el v4, "frame_tubo50". Confirmar la medida.
  { re: /^frame_tubo(42|50)/i, sku: "MX80-011-03", zona: "frame", nodo: "frame_tubo50_del" },
  { re: /^frame_tubo69/i, sku: "MX80-011-04", zona: "frame", nodo: "frame_tubo69_der" },
  // Carcasa frontal (MX80-014). En el GLB v3 el cascaron se llama
  // ModeloAvantiv9 (6180 triangulos, el mismo de "frontcase" del v2).
  { re: /^ModeloAvantiv/i, sku: "MX80-014" },
  // En el GLB v4 el cascaron es "DRONE_CLEAN_TOPOLOGY"; en el v5, "carcasa_drone".
  { re: /^DRONE_CLEAN_TOPOLOGY/i, sku: "MX80-014" },
  { re: /^carcasa_drone/i, sku: "MX80-014", zona: "frente", nodo: "carcasa_drone" },
  // Frente (GLB v5): sensores. Las camaras son modelos representativos.
  { re: /^sensor_lidar/i, sku: "MX80-022", zona: "frente", nodo: "sensor_lidar" },
  { re: /^camara_frontal/i, sku: "MX80-023", zona: "frente", nodo: "camara_frontal_dummy" },
  { re: /^camara_inferior/i, sku: "MX80-024", zona: "frente", nodo: "camara_inferior_dummy" },
  // Tanque (MX80-012) y su bomba (MX80-021, nueva en el GLB v5)
  { re: /^tanque/i, sku: "MX80-012" },
  { re: /^bomba_recirculacion/i, sku: "MX80-021", zona: "tanque", nodo: "bomba_recirculacion" },
  // Tanque del GLB v6: motobombas (MX80-025), PMU (MX80-026) y su cableado
  // (MX80-027). Las mangueras de ramal (_1, _2) van antes que las principales
  // para que "entrada_principal" no caiga en la regla de ramal.
  { re: /^bomba_(izq|der)_cuerpo/i, sku: "MX80-025-01", zona: "tanque", nodo: "bomba_izq_cuerpo" },
  { re: /^bomba_(izq|der)_tornillos/i, sku: "MX80-025-02", zona: "tanque", nodo: "bomba_izq_tornillos" },
  { re: /^bomba_(izq|der)_manguera_entrada_principal/i, sku: "MX80-025-03", zona: "tanque", nodo: "bomba_izq_manguera_entrada_principal" },
  { re: /^bomba_(izq|der)_manguera_entrada_\d/i, sku: "MX80-025-04", zona: "tanque", nodo: "bomba_izq_manguera_entrada_1" },
  { re: /^bomba_(izq|der)_manguera_salida_principal/i, sku: "MX80-025-05", zona: "tanque", nodo: "bomba_izq_manguera_salida_principal" },
  { re: /^bomba_(izq|der)_manguera_salida_\d/i, sku: "MX80-025-06", zona: "tanque", nodo: "bomba_izq_manguera_salida_1" },
  { re: /^bomba_(izq|der)_y_entrada/i, sku: "MX80-025-07", zona: "tanque", nodo: "bomba_izq_y_entrada" },
  { re: /^bomba_(izq|der)_y_salida/i, sku: "MX80-025-08", zona: "tanque", nodo: "bomba_izq_y_salida" },
  { re: /^grapas_.*_abrazadera/i, sku: "MX80-025-09", zona: "tanque", nodo: "grapas_abrazadera" },
  { re: /^grapas_.*_hule/i, sku: "MX80-025-10", zona: "tanque", nodo: "grapas_hule" },
  { re: /^grapas_.*_tornillo/i, sku: "MX80-025-11", zona: "tanque", nodo: "grapas_tornillo" },
  { re: /^pmu__cuerpo/i, sku: "MX80-026-01", zona: "tanque", nodo: "pmu__cuerpo" },
  { re: /^pmu__disipador/i, sku: "MX80-026-02", zona: "tanque", nodo: "pmu__disipador" },
  { re: /^pmu__puerto/i, sku: "MX80-026-03", zona: "tanque", nodo: "pmu__puerto" },
  { re: /^pmu__tornillos/i, sku: "MX80-026-04", zona: "tanque", nodo: "pmu__tornillos" },
  { re: /^cable_alimentacion/i, sku: "MX80-027-01", zona: "tanque", nodo: "cable_alimentacion" },
  { re: /^cable_bomba_der/i, sku: "MX80-027-02", zona: "tanque", nodo: "cable_bomba_der" },
  { re: /^cable_bomba_izq/i, sku: "MX80-027-03", zona: "tanque", nodo: "cable_bomba_izq" },
  { re: /^cable_recirc/i, sku: "MX80-027-04", zona: "tanque", nodo: "cable_recirc" },
  { re: /^cable_senal_pdb/i, sku: "MX80-027-05", zona: "tanque", nodo: "cable_senal_pdb" },
  // Bateria (MX80-017): sus 28 mallas se agrupan en las 11 subpiezas.
  { re: /^BAT_Carcasa/i, sku: "MX80-017-01", zona: "energia", nodo: "BAT_Carcasa" },
  { re: /^BAT_(Asa|Barra_asa|Clip_asa)/i, sku: "MX80-017-02", zona: "energia", nodo: "BAT_Asa" },
  { re: /^BAT_Conector/i, sku: "MX80-017-03", zona: "energia", nodo: "BAT_Conector" },
  {
    re: /^BAT_(Placa_indicadores|LED|Boton_encendido|Icono_encendido)/i,
    sku: "MX80-017-04",
    zona: "energia",
    nodo: "BAT_Placa_indicadores",
  },
  { re: /^BAT_(Lamina|Franja)_frontal/i, sku: "MX80-017-05", zona: "energia", nodo: "BAT_Lamina_frontal" },
  { re: /^BAT_Etiqueta/i, sku: "MX80-017-06", zona: "energia", nodo: "BAT_Etiqueta_der" },
  { re: /^BAT_Seguro/i, sku: "MX80-017-07", zona: "energia", nodo: "BAT_Seguro_der" },
  { re: /^BAT_Riel_lateral/i, sku: "MX80-017-08", zona: "energia", nodo: "BAT_Riel_lateral_der" },
  { re: /^BAT_Pie/i, sku: "MX80-017-09", zona: "energia", nodo: "BAT_Pie_der" },
  { re: /^BAT_Tope_frontal/i, sku: "MX80-017-10", zona: "energia", nodo: "BAT_Tope_frontal_der" },
  { re: /^BAT_Tornillo/i, sku: "MX80-017-11", zona: "energia", nodo: "BAT_Tornillo_der" },
  // Tarjeta de distribucion de potencia (MX80-018)
  { re: /^PDB_carcasa_superior/i, sku: "MX80-018-01", zona: "energia", nodo: "PDB_carcasa_superior" },
  { re: /^PDB_carcasa_inferior/i, sku: "MX80-018-02", zona: "energia", nodo: "PDB_carcasa_inferior" },
  { re: /^PDB_aislante/i, sku: "MX80-018-03", zona: "energia", nodo: "PDB_aislante_superior" },
  { re: /^PDB_PCB/i, sku: "MX80-018-04", zona: "energia", nodo: "PDB_PCB_principal" },
  { re: /^PDB_AS150U/i, sku: "MX80-018-05", zona: "energia", nodo: "PDB_AS150U_ESC1" },
  { re: /^PDB_ACE/i, sku: "MX80-018-06", zona: "energia", nodo: "PDB_ACE_59626" },
  { re: /^PDB_Tornillo_M5x35/i, sku: "MX80-018-07", zona: "energia", nodo: "PDB_Tornillo_M5x35_inf_1" },
  // Rieles de la bateria (MX80-019)
  { re: /^RIEL_Riel_ranura/i, sku: "MX80-019-01", zona: "energia", nodo: "RIEL_Riel_ranura_der" },
  { re: /^RIEL_Mensula/i, sku: "MX80-019-02", zona: "energia", nodo: "RIEL_Mensula_tubo69_der" },
  // Radar y luces en el tubo de 30 mm (MX80-020)
  { re: /^radar_/i, sku: "MX80-020-01", zona: "radar", nodo: "radar_cuerpo" },
  { re: /^luz_frente_/i, sku: "MX80-020-02", zona: "radar", nodo: "luz_frente_carcasa" },
  { re: /^luz_abajo_/i, sku: "MX80-020-03", zona: "radar", nodo: "luz_abajo_carcasa" },
  { re: /^cuna/i, sku: "MX80-020-04", zona: "radar", nodo: "cuna" },
  { re: /^copa_tapa/i, sku: "MX80-020-05", zona: "radar", nodo: "copa_tapa" },
  { re: /^abrazadera_luz/i, sku: "MX80-020-06", zona: "radar", nodo: "abrazadera_luz_frente" },
  { re: /^abrazadera_superior/i, sku: "MX80-020-07", zona: "radar", nodo: "abrazadera_superior" },
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
  { re: /^goma_(der|izq)_(del|tra)/i, sku: "MX80-013-23", zona: "tren-aterrizaje", nodo: "goma_der_del" },
  // Las medidas de los tornillos cambiaron del GLB v3 al v4; se aceptan las dos.
  { re: /^M5x(55|51)_amarre_pata/i, sku: "MX80-013-11", zona: "tren-aterrizaje", nodo: "M5x51_amarre_pata" },
  { re: /^M5x(60|65)_agarre_tren/i, sku: "MX80-013-12", zona: "tren-aterrizaje", nodo: "M5x65_agarre_tren" },
  { re: /^M6x(50|42)_travesano/i, sku: "MX80-013-13", zona: "tren-aterrizaje", nodo: "M6x42_travesano" },
  { re: /^M5x(25|50)_cople/i, sku: "MX80-013-14", zona: "tren-aterrizaje", nodo: "M5x50_cople" },
  { re: /^Arandela_M5/i, sku: "MX80-013-24", zona: "tren-aterrizaje", nodo: "Arandela_M5" },
  { re: /^Tuerca_M5/i, sku: "MX80-013-25", zona: "tren-aterrizaje", nodo: "Tuerca_M5" },
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

/**
 * Clave con la que se lista un nodo suelto de una zona: la de su pieza del
 * catalogo si la tiene (asi las mallas de un mismo SKU son una entrada), o su
 * nombre base si no.
 */
export function claveDeNodo(nombre: string): string {
  return PIEZAS_SUELTAS.find((p) => p.re?.test(nombre))?.nodo ?? nombreBase(nombre);
}

const esBrazo = (zona: ZonaVisor | null) =>
  zona === "brazo-cw" || zona === "brazo-ccw";

/**
 * Pieza del catalogo de lo aislado en una zona. `pieza` es la clave del
 * componente en un brazo ("motor") o el nombre del nodo en las demas zonas.
 */
export function skuDePieza(zona: ZonaVisor | null, pieza: string): string | null {
  if (!esBrazo(zona)) return skuDeNodo(pieza);
  const { componente, subpieza } = partirClave(pieza);
  if (subpieza) {
    return SUBPIEZAS_COMPONENTE[componente]?.find((r) => r.clave === subpieza)?.sku ?? null;
  }
  return SKU_COMPONENTE_BRAZO[pieza] ?? null;
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
  for (const [componente, reglas] of Object.entries(SUBPIEZAS_COMPONENTE)) {
    const regla = reglas.find((r) => r.sku === sku);
    if (regla) return { zona: "brazo-cw", pieza: `${componente}/${regla.clave}` };
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
  cables: "Cableado del brazo",
  aspersor: "Aspersor centrífugo doble",
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

/**
 * Nodos del aspersor dentro de un brazo. Incluye los pivotes que la escena
 * agrega para girar los discos (ver aspersion/discos.ts).
 */
const ES_ASPERSOR =
  /^(pieza_A_cuerpo_Y|pieza_B_conector|pasador_D5|tapa_(der|izq)|(der|izq)_(disco|motor|tornillo|tuerca)|pivote_|manguera_|seguro_manguera|cable_cabezal|conector_(der|izq)|arnes_|aspersor_)/i;

/** Un brazo del GLB y el sentido de giro de su helice. */
export interface BrazoDelModelo {
  objeto: THREE.Object3D;
  sentido: "cw" | "ccw";
}

/**
 * Los cuatro brazos, por estructura y no por una lista de nombres fija: en el
 * GLB v5 se llaman brazo_CW_1, brazo_CCW_2, brazo_CW_3 y brazo_CCW_4, y el
 * sentido sale del nombre (el v4 los llamaba brazo, brazo_2... y el sentido
 * vivia en una tabla aparte que dejo de servir al cambiar las helices de lado).
 */
export function brazosDelModelo(raiz: THREE.Object3D): BrazoDelModelo[] {
  return raiz.children
    .filter((n) => /^brazo_C{1,2}W/i.test(n.name))
    .map((objeto) => ({
      objeto,
      sentido: /^brazo_CCW/i.test(objeto.name) ? ("ccw" as const) : ("cw" as const),
    }));
}

/**
 * El brazo que representa a su zona: de los dos del mismo sentido, el que trae
 * mas piezas. En el v5 es el que lleva aspersor (brazo_CW_3 y brazo_CCW_4).
 * Los dos son el mismo numero de parte, asi que mostrar uno basta.
 */
function brazoRepresentativo(
  raiz: THREE.Object3D,
  sentido: "cw" | "ccw",
): THREE.Object3D | null {
  const candidatos = brazosDelModelo(raiz).filter((b) => b.sentido === sentido);
  candidatos.sort((a, b) => b.objeto.children.length - a.objeto.children.length);
  return candidatos[0]?.objeto ?? null;
}

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
    { clave: "cables", nodos: porNombre(hijos, /^cables/i) },
    // El aspersor centrifugo (GLB v5) cuelga suelto del brazo: 26 nodos que
    // juntos son un conjunto (MX80-016). Sin agruparlos, cada tornillo y cada
    // manguera serian un componente aparte en la lista del brazo.
    { clave: "aspersor", nodos: porNombre(hijos, ES_ASPERSOR) },
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
 * Los brazos se reparten por el sentido de su helice (brazo_CW_* y
 * brazo_CCW_*). Un solo brazo por zona, el que lleva aspersor: los del mismo
 * sentido son el mismo numero de parte, asi que mostrar dos no aporta nada.
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
    case "brazo-ccw": {
      const brazo = brazoRepresentativo(raiz, zona === "brazo-cw" ? "cw" : "ccw");
      return brazo ? [brazo] : [];
    }
    case "tanque":
      return uno("tanque");
    case "frente":
      // "carcasa_frontal" en el GLB v4, "frente_drone" en el v5.
      return [...uno("carcasa_frontal"), ...uno("frente_dron"), ...uno("frente_drone")];
    case "energia":
      return uno("MX80_frame_PDB_rieles_bateria");
    case "radar":
      return uno("radar_y_luces_en_tubo_30mm");
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
    // La tuerca misma tambien necesita el detalle, no solo sus subpiezas:
    // `ancestros` no incluye a `sku` (ver cadenaAncestros en page.tsx), asi
    // que sin este caso la ficha de MX80-001-03 cargaba el GLB completo (el
    // placeholder de 2 nodos) y nunca mostraba boton de despiece.
    fuente: sku === SKU_TUERCA || ancestros.includes(SKU_TUERCA) ? GLB_TUERCA_DETALLADA : null,
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
 *
 * `restringirAUnConjunto` apaga esa restriccion de "un solo conjunto": sirve
 * para el caso de nombresSubpiezas (ver nodosDeSeleccion), donde los nombres
 * NO son instancias repetidas de una misma pieza sino partes DISTINTAS de un
 * ensamble (jacket + 2 spacers + tornillo de la tuerca del balanceador) que
 * pueden vivir cada una en su propio nodo de nivel superior. Con la
 * restriccion encendida ahi, solo sobrevivia la primera parte encontrada.
 */
function nodosConNombres(
  raiz: THREE.Object3D,
  nombres: string[],
  restringirAUnConjunto = true,
): THREE.Object3D[] {
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
  const conjunto = restringirAUnConjunto ? conjuntoDe(coincidencias[0]) : null;
  const vistos = new Set<string>();
  return coincidencias.filter((n) => {
    if (conjunto && conjuntoDe(n) !== conjunto) return false;
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
    // El brazo que tenga ese componente: el aspersor solo esta en dos de los
    // cuatro, asi que se prueba primero el que trae mas piezas.
    const brazos = brazosDelModelo(raiz).sort(
      (a, b) => b.objeto.children.length - a.objeto.children.length,
    );
    for (const { objeto } of brazos) {
      const comp = componentesDelBrazo(objeto).find((c) => c.clave === s.componente);
      if (comp) return comp.nodos;
    }
  }
  const propios = nodosConNombres(raiz, s.nombres);
  if (propios.length > 0) return propios;
  if (s.zona) return nodosDeZonaEn(raiz, s.zona);
  return nodosConNombres(raiz, s.nombresSubpiezas, false);
}
