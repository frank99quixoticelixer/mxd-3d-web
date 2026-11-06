import { z } from "zod";

/**
 * Esquema unico de una pieza del catalogo.
 *
 * Este esquema es la fuente de verdad: valida los datos semilla al arrancar
 * y define el tipo TypeScript que usa toda la aplicacion. Cuando migres a
 * PostgreSQL + Prisma, este mismo esquema valida lo que sale de la base de datos,
 * asi que los componentes no cambian.
 */

/** Modelos de dron de MXD. */
export const ModeloDronEsquema = z.enum(["MX30", "MX50", "MX80"]);
export type ModeloDron = z.infer<typeof ModeloDronEsquema>;

/** Agrupacion funcional; se usa para filtrar y para explotar por subsistema. */
export const SubsistemaEsquema = z.enum([
  "propulsion",
  "estructura",
  "liquidos",
  "electronica",
  "tren-aterrizaje",
  "aspercion",
  "otros",
]);
export type Subsistema = z.infer<typeof SubsistemaEsquema>;

export const ETIQUETAS_SUBSISTEMA: Record<Subsistema, string> = {
  propulsion: "Propulsión",
  estructura: "Estructura",
  liquidos: "Sistema de líquidos",
  electronica: "Electrónica",
  "tren-aterrizaje": "Tren de aterrizaje",
  aspercion: "Sistema de aspersión",
  otros: "Otros",
};

/**
 * Seccion fisica del dron: la division con la que se arma el modelo en Blender
 * (una coleccion por seccion) y la unidad con la que se entregan los paquetes
 * de descarga (ficha PDF y mallas STL por seccion).
 *
 * Es un eje DISTINTO al subsistema y los dos conviven a proposito:
 *   subsistema -> que hace la pieza  (propulsion, electronica...)
 *   seccion    -> donde vive y en que paquete se entrega
 * El motor es "propulsion" y esta en las cuatro secciones de brazo.
 */
export const SeccionEsquema = z.enum([
  "brazo-cw-1",
  "brazo-cw-2",
  "brazo-ccw-1",
  "brazo-ccw-2",
  "frame-general",
  "tren-de-aterrizaje",
  "tanque",
  "parte-frontal",
  "pilas",
]);
export type Seccion = z.infer<typeof SeccionEsquema>;

export const ETIQUETAS_SECCION: Record<Seccion, string> = {
  "brazo-cw-1": "Brazo CW 1",
  "brazo-cw-2": "Brazo CW 2",
  "brazo-ccw-1": "Brazo CCW 1",
  "brazo-ccw-2": "Brazo CCW 2",
  "frame-general": "Frame general",
  "tren-de-aterrizaje": "Tren de aterrizaje",
  tanque: "Tanque",
  "parte-frontal": "Parte frontal",
  pilas: "Pilas",
};

/**
 * Orden de presentacion de las secciones en el catalogo y en los documentos.
 * No se deriva del enum: el orden del enum puede cambiar sin afectar la vista.
 */
export const ORDEN_SECCIONES: readonly Seccion[] = [
  "brazo-cw-1",
  "brazo-cw-2",
  "brazo-ccw-1",
  "brazo-ccw-2",
  "frame-general",
  "tren-de-aterrizaje",
  "tanque",
  "parte-frontal",
  "pilas",
];

/** Sentido de giro de una hoja de helice. */
export const SentidoGiroEsquema = z.enum(["CW", "CCW"]);
export type SentidoGiro = z.infer<typeof SentidoGiroEsquema>;

/**
 * Especificaciones tecnicas.
 *
 * IMPORTANTE: todos los campos son opcionales y su valor por defecto es null.
 * Un null significa "pendiente de medir/capturar" y asi se muestra en la interfaz.
 * NO se inventan valores: una especificacion vacia es informacion honesta,
 * una inventada es un error que llega al cliente.
 */
export const EspecificacionesEsquema = z.object({
  /** Masa en gramos. */
  masa_g: z.number().positive().nullable().default(null),
  /** Dimensiones envolventes en milimetros. */
  largo_mm: z.number().positive().nullable().default(null),
  ancho_mm: z.number().positive().nullable().default(null),
  alto_mm: z.number().positive().nullable().default(null),
  /** Material principal, tal como lo declara el proveedor. */
  material: z.string().nullable().default(null),
  /**
   * Tipo de material para el filtro del visor ("Ver por material"). Lo que se
   * escriba aqui manda sobre las reglas automaticas de
   * features/viewer/materiales.ts, para esta pieza y lo que cuelga de ella.
   */
  grupo_material: z.enum(["plastico", "metal", "electronica", "otros"]).nullable().default(null),
  /** Acabado o tratamiento superficial. */
  acabado: z.string().nullable().default(null),

  /** Tolerancia dimensional general, en milimetros. */
  tolerancia_mm: z.number().positive().nullable().default(null),
  /** Par de apriete, en newton-metro. Ver nota de "apriete manual" mas abajo. */
  par_apriete_nm: z.number().positive().nullable().default(null),
  /**
   * Cuantos tornillos fijan la pieza. Es un campo aparte de par_apriete_nm
   * porque muchas piezas atornilladas no tienen un par critico que
   * documentar (les basta quedar bien sujetas): esas llevan numero_tornillos
   * con par_apriete_nm en null. La interfaz y los documentos deben mostrar
   * "Apriete manual" en ese caso, no "pendiente" — "pendiente" es solo para
   * un dato que falta capturar, no para uno que no aplica.
   */
  numero_tornillos: z.number().int().nonnegative().nullable().default(null),

  /** Proveedor asignado, cuando la pieza no se fabrica en casa. */
  proveedor: z.string().nullable().default(null),
  /** Numero de parte del proveedor. */
  parte_proveedor: z.string().nullable().default(null),

  // -- Campos especificos por tipo de pieza --------------------------------
  // Todos conviven en una sola hoja (un renglon por SKU en el BOM Excel) en
  // vez de un esquema distinto por categoria: la mayoria de las piezas no
  // los usa, y eso es justo lo que describe `camposNoAplican` en PiezaEsquema
  // (ver mas abajo). Mantenerlos aqui evita un segundo lugar donde buscar
  // "que campos tiene esta pieza".

  /** Rosca del sujetador (p. ej. "M3", "M4"). Solo tornillos y tuercas. */
  rosca: z.string().nullable().default(null),
  /** Longitud, en milimetros: tornillos, hojas de helice. Reemplaza largo/ancho/alto cuando aplica. */
  longitud_mm: z.number().positive().nullable().default(null),
  /** Sentido de giro de una hoja de helice. */
  sentido_giro: SentidoGiroEsquema.nullable().default(null),

  /** A que modulo/PCB se conecta (p. ej. "PowerModuleBoard", "FCU"). Solo electronica. */
  modulo_conectado: z.string().nullable().default(null),

  /** Volumen util, en mililitros. Solo el tanque de aspersion. */
  volumen_ml: z.number().positive().nullable().default(null),

  /** Diametro exterior del tubo, en milimetros. Tubos redondos (brazo, patines, travesanos). */
  diametro_tubo_mm: z.number().positive().nullable().default(null),
  /** Grosor de pared, en milimetros. Tubos redondos y perfiles rectangulares. */
  grosor_pared_mm: z.number().positive().nullable().default(null),
  /** Diametro de los barrenos de montaje, en milimetros. Tubos y perfiles. */
  diametro_barreno_mm: z.number().positive().nullable().default(null),

  /** Ancho y alto de seccion del perfil de aluminio rectangular del frame. */
  ancho_perfil_mm: z.number().positive().nullable().default(null),
  alto_perfil_mm: z.number().positive().nullable().default(null),

  /** Constante KV del motor, en RPM por volt. Solo el ensamble del motor. */
  motor_kv: z.number().positive().nullable().default(null),
  /** Voltaje nominal de operacion, en volts. */
  motor_voltaje_nominal_v: z.number().positive().nullable().default(null),
  /** Velocidad nominal, en RPM. */
  motor_rpm_nominal: z.number().positive().nullable().default(null),
  /** Par nominal, en newton-metro. */
  motor_torque_nominal_nm: z.number().positive().nullable().default(null),
  /** Par maximo, en newton-metro. */
  motor_torque_max_nm: z.number().positive().nullable().default(null),

  /**
   * De donde sale cada dato de esta ficha. Una cota medida con calibrador y
   * una copiada de la hoja de un proveedor no merecen la misma confianza;
   * cuando algo no cuadre en produccion, esto dice cual era cual.
   */
  fuente: z.array(z.string()).default([]),

  /** Notas libres (pendientes, discrepancias, cosas por confirmar). */
  notas: z.string().nullable().default(null),
});
export type Especificaciones = z.infer<typeof EspecificacionesEsquema>;

/**
 * Costeo de produccion. Nace con la carcasa frontal (MX80-014), la primera
 * pieza que se logro imprimir in-house en la Neptune 4 Pro Max; la idea es ir
 * llenando esta hoja pieza por pieza a medida que se produce cada una.
 *
 * Va separado de `especificaciones` porque es informacion de negocio (cuanto
 * cuesta hacerla), no tecnica (que es y como se mide), y porque
 * `especificaciones` se sobreescribe completo con cada
 * `npm run specs:importar` — mezclar costos ahi los borraria en el siguiente
 * import. Por eso tambien el peso vive aqui (`masaG`) y no se reusa
 * `especificaciones.masa_g`: ese es el peso de ingenieria que entra por el
 * CSV del proveedor, este es el peso real que salio de la impresion.
 *
 * El costo de material NO se guarda como numero fijo: se calcula a partir de
 * `masaG` y `material` (la clave hacia el precio por kilo) con las funciones
 * de lib/costos.ts. Asi un cambio de precio del rollo o una correccion de
 * peso recalcula solo, sin ir pieza por pieza.
 *
 * IMPORTANTE: mismo criterio que EspecificacionesEsquema. null = pendiente de
 * pesar/cronometrar/cotizar, no se inventan valores.
 */
export const CostosProduccionEsquema = z.object({
  /** Si se fabrica dentro de MXD (impresion/maquinado propio) o se manda a hacer afuera. */
  fabricadoInhouse: z.boolean().nullable().default(null),
  /** Maquina o proceso donde se produce, cuando es in-house (p. ej. "Neptune 4 Pro Max"). */
  equipo: z.string().nullable().default(null),
  /** Material de produccion, como clave hacia COSTO_MATERIAL_MXN_KG (p. ej. "PLA"). */
  material: z.string().nullable().default(null),
  /** Masa real consumida al producir UNA pieza, en gramos (pesada o calculada en la impresion). */
  masaG: z.number().positive().nullable().default(null),
  /** Horas de maquina para producir UNA pieza. */
  horasProduccion: z.number().positive().nullable().default(null),
  /** Costo de pintado o acabado post-proceso, por pieza, en MXN. */
  costoPinturaMxn: z.number().nonnegative().nullable().default(null),
  /** Costo de mano de obra aparte del material y la pintura, por pieza, en MXN. */
  costoManoObraMxn: z.number().nonnegative().nullable().default(null),
  /** Notas libres sobre el costeo (pendientes, supuestos, discrepancias). */
  notas: z.string().nullable().default(null),
});
export type CostosProduccion = z.infer<typeof CostosProduccionEsquema>;

/**
 * Trazabilidad de manufactura, alineada a las columnas que no tienen
 * equivalente en este esquema dentro del BOM maestro
 * (mxd-3d/Maestro_Partes_MX80.xlsx, hoja "Maestro Partes MX80"). Las demas
 * columnas del maestro SI tienen equivalente aqui con otro nombre y no se
 * duplican: Nivel/Ensamble padre -> parteDe, Modelo GLB -> glb,
 * Estado del modelado -> estado, Zona del dron -> secciones/subsistema,
 * Rev. -> el sufijo "-R00" de numeroBom, Fotografia -> imagen.
 *
 * Va separado de `especificaciones` por el mismo motivo que
 * CostosProduccionEsquema: no es informacion tecnica de la pieza, es
 * seguimiento de control de calidad y manufactura.
 */
export const TrazabilidadEsquema = z.object({
  /** "Alta"/"Media"/"Baja" en el maestro; aqui texto libre para no duplicar un enum ajeno. */
  criticidad: z.string().nullable().default(null),
  /** Que prueba o inspeccion aprueba la pieza (p. ej. "Prueba funcional de vuelo"). */
  controlCalidad: z.string().nullable().default(null),
  /** Si una pieza de otro proveedor o revision puede sustituirla sin rediseno. */
  intercambiable: z.boolean().nullable().default(null),
  /** Ruta de referencia a la carpeta de la pieza en el maestro (informativa, no se usa para servir archivos). */
  carpetaPieza: z.string().nullable().default(null),
  /** Si ya existe un archivo STEP de la pieza. */
  archivoStep: z.boolean().nullable().default(null),
  /** Si ya existe un archivo STL de la pieza. */
  archivoStl: z.boolean().nullable().default(null),
});
export type Trazabilidad = z.infer<typeof TrazabilidadEsquema>;

/** Estado de la pieza dentro del pipeline de digitalizacion. */
export const EstadoPiezaEsquema = z.enum([
  "pendiente",
  "escaneada",
  "modelada",
  "publicada",
]);
export type EstadoPieza = z.infer<typeof EstadoPiezaEsquema>;

export const ETIQUETAS_ESTADO: Record<EstadoPieza, string> = {
  pendiente: "Pendiente de escaneo",
  escaneada: "Escaneada",
  modelada: "Modelada en Blender",
  publicada: "Publicada",
};

/**
 * Una version espejo de una pieza (ver `variantes` en PiezaEsquema).
 */
export const VarianteEsquema = z.object({
  /** "cw", "ccw", "izq", "der", "m12"... */
  clave: z.string(),
  /** Como se nombra en la interfaz: "Versión CW". */
  etiqueta: z.string(),
  /** Donde va: "Brazos M1 y M3". */
  posicion: z.string(),
  /** Numero de parte del maestro para esta version. Solo lo llena interna. */
  numeroBom: z.string().nullable().default(null),
});
export type Variante = z.infer<typeof VarianteEsquema>;

export const PiezaEsquema = z.object({
  /**
   * SKU: identificador unico y estable. Es la llave que une el modelo 3D, la
   * base de datos y el Excel de control.
   *
   * Dos niveles:
   *   MX80-001      pieza de catalogo (lo que se cotiza y se ve en el sitio)
   *   MX80-001-02   subpieza de esa pieza (lo que se desarma de ella)
   *
   * Un SKU nunca se reutiliza. Si una pieza deja de existir, su numero se
   * retira: dos hojas distintas con el mismo SKU es justo el error que el
   * codigo de revision existe para evitar.
   */
  sku: z
    .string()
    .regex(/^MX\d{2}-\d{3}(-\d{2})?$/, "Formato de SKU invalido"),

  /**
   * SKU de la pieza a la que pertenece, o null si es pieza de catalogo.
   *
   * El catalogo es plano a proposito: padres y subpiezas viven en la misma
   * lista y se distinguen por este campo. Asi la ficha PDF, el CSV y la
   * validacion siguen siendo uno-por-SKU, sin estructuras anidadas.
   */
  parteDe: z.string().nullable().default(null),

  /** Slug para la URL de la ficha: /catalogo/{slug} */
  slug: z.string().min(1),

  modelo: ModeloDronEsquema,
  nombre: z.string().min(1),
  descripcion: z.string().default(""),
  subsistema: SubsistemaEsquema.default("otros"),
  estado: EstadoPiezaEsquema.default("pendiente"),

  /**
   * Secciones a las que pertenece la pieza.
   *
   * Es una lista, no un valor unico, porque una misma pieza vive en varias
   * secciones: el motor va en los cuatro brazos y sigue siendo UN numero de
   * parte. Duplicar la ficha por brazo obligaria a mantener la misma cota en
   * cuatro lugares. Un arreglo vacio significa "todavia sin asignar".
   */
  secciones: z.array(SeccionEsquema).default([]),

  /**
   * Cuantas unidades de esta pieza lleva CADA seccion en la que aparece.
   * El total por dron sale de multiplicar por el numero de secciones; ese es
   * el dato que necesita un proveedor para cotizar.
   */
  cantidadPorSeccion: z.number().int().positive().default(1),

  /**
   * Nombres posibles del objeto dentro del archivo de Blender.
   *
   * El visor identifica cada pieza del GLB en este orden:
   *   1. propiedad personalizada  mxd_sku  del objeto  (metodo recomendado)
   *   2. coincidencia con alguno de estos nombres      (respaldo)
   *
   * Agrega aqui todas las variantes que uses en Blender. La comparacion
   * ignora mayusculas, acentos, espacios, guiones y sufijos .001 .002
   */
  nombresBlender: z.array(z.string()).default([]),

  /**
   * Direccion de explosion en coordenadas del modelo (X, Y, Z).
   * Si se deja en null, el visor la calcula automaticamente como el vector
   * que va del centro del ensamble al centro de la pieza. Para la mayoria
   * de las piezas el calculo automatico es suficiente.
   */
  direccionExplosion: z
    .tuple([z.number(), z.number(), z.number()])
    .nullable()
    .default(null),

  /** Multiplicador de la separacion de esta pieza al explotar (1 = normal, 0 = fija). */
  factorExplosion: z.number().nonnegative().default(1),

  /** Precio de lista. Hoy no se muestra en el sitio; el campo existe para la fase 2. */
  precio_mxn: z.number().nonnegative().nullable().default(null),
  /** Existencias. Hoy no se muestra; existe para la fase 2. */
  stock: z.number().int().nonnegative().nullable().default(null),

  especificaciones: EspecificacionesEsquema,

  /**
   * Nombres de campos de `especificaciones` que NO le corresponden a esta
   * pieza (p. ej. "par_apriete_nm" en el tanque, que va montado sin
   * atornillar). La interfaz y los documentos deben mostrar "N/A" para estos
   * campos, nunca "pendiente": "pendiente" implica que falta capturar un
   * dato que SI existe, "N/A" dice que el dato no existe para esta pieza.
   * No confundir con numero_tornillos=null + par_apriete_nm=null, que es el
   * caso de "apriete manual" (ver comentario en EspecificacionesEsquema):
   * ahi el tornillo si existe, solo no tiene un par critico que documentar.
   */
  camposNoAplican: z.array(z.string()).default([]),

  /** Costeo de produccion. Ver comentario en CostosProduccionEsquema. */
  costosProduccion: CostosProduccionEsquema.default({}),

  /** Trazabilidad de manufactura. Ver comentario en TrazabilidadEsquema. */
  trazabilidad: TrazabilidadEsquema.default({}),

  /** Clasificacion de compra o de ingenieria ("Propulsion - helice"). */
  categoria: z.string().nullable().default(null),

  /** Como se fabrica: proceso, no descripcion comercial. */
  proceso_fabricacion: z.string().nullable().default(null),

  /**
   * Que hace la pieza, en lenguaje tecnico. Es distinto de "descripcion",
   * que es el texto de catalogo: este va en la ficha que lee un proveedor.
   */
  descripcion_funcional: z.string().nullable().default(null),

  /**
   * Requisitos tecnicos, uno por entrada. Es una lista y no un parrafo para
   * que la ficha PDF los imprima como vinetas: un proveedor los lee como
   * puntos a cumplir, no como prosa.
   */
  especificaciones_tecnicas: z.array(z.string()).default([]),

  /** Ruta publica del render de la pieza (miniatura de la tarjeta). */
  imagen: z.string().nullable().optional(),

  /** GLB de la pieza sola (ficha del catalogo), relativo a public/. */
  glb: z.string().nullable().optional(),

  /**
   * Oculta el boton "Ver despiece" en la ficha de la pieza aunque el GLB
   * tenga varias sub-piezas de nivel superior. Se usa cuando esa separacion
   * no representa un desmontaje real (p. ej. herrajes internos del
   * balanceador o el par de helices, que no se "explotan" en servicio).
   */
  sinDespiece: z.boolean().optional(),

  /** Orden de aparicion en el catalogo (menor primero). */
  orden: z.number().int().default(999),

  /**
   * Numero de parte oficial del maestro de partes MXD
   * (MXD-MX80-<SISTEMA>-<TIPO>-<NNN>-R00), cuando ya esta confirmado el cruce
   * con el SKU interno de este catalogo. No todas las piezas lo tienen
   * todavia — el cruce se hace a mano, pieza por pieza, con Eduardo.
   * Solo es una etiqueta informativa: el SKU interno sigue siendo la llave
   * real de la app (rutas, descargas, seleccion en el visor). No confundir
   * los dos ni derivar uno del otro.
   */
  numeroBom: z.string().nullable().default(null),

  /**
   * Versiones espejo de la pieza. Los brazos CW y CCW son espejo uno del otro
   * (y el lado izquierdo y derecho del marco): el soporte de motor de un brazo
   * CW se inclina hacia un lado y el del CCW hacia el otro. Son piezas
   * distintas que NO se intercambian, aunque el catalogo las muestre en una
   * sola ficha. Vacio = la misma pieza sirve en todas las posiciones.
   */
  variantes: z.array(VarianteEsquema).default([]),

  /**
   * La pieza no se compra suelta: se surte dentro de su conjunto (las piezas
   * de la PDB, del motor, de la bateria). Esta en el catalogo para ubicarla en
   * el 3D, no para pedirla por separado.
   */
  surtidaEnConjunto: z.boolean().default(false),
  /**
   * Como quedo el cruce con el maestro de partes (Maestro_Partes_MX80.xlsx):
   *   confirmado  el numero corresponde a esta pieza sin duda
   *   propuesto   el cruce es razonable pero falta que alguien lo confirme
   *   sin-numero  la pieza no tiene numero en el maestro (diseno MXD nuevo,
   *               tornilleria que el maestro no desglosa)
   */
  cruceBom: z
    .object({
      estado: z.enum(["confirmado", "propuesto", "sin-numero"]),
      nota: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export type Pieza = z.infer<typeof PiezaEsquema>;

/**
 * Unidades de la pieza que lleva un dron completo.
 * Devuelve 0 mientras la pieza no tenga secciones asignadas: es informacion
 * honesta, no un 1 inventado que terminaria en una orden de compra.
 */
export function cantidadPorDron(pieza: Pieza): number {
  return pieza.secciones.length * pieza.cantidadPorSeccion;
}

export const CatalogoEsquema = z.array(PiezaEsquema);
