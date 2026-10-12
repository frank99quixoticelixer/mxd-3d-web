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
  "tanque",
  "parte-frontal",
  "pilas",
];

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
  /** Acabado o tratamiento superficial. */
  acabado: z.string().nullable().default(null),

  /** Tolerancia dimensional general, en milimetros. */
  tolerancia_mm: z.number().positive().nullable().default(null),
  /** Par de apriete, en newton-metro. */
  par_apriete_nm: z.number().positive().nullable().default(null),

  /** Proveedor asignado, cuando la pieza no se fabrica en casa. */
  proveedor: z.string().nullable().default(null),
  /** Numero de parte del proveedor. */
  parte_proveedor: z.string().nullable().default(null),

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
