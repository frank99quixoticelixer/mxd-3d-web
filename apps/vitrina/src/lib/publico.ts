import {
  EspecificacionesEsquema,
  PiezaEsquema,
  type Pieza,
} from "@/lib/esquema";

/**
 * Frontera entre lo que la vitrina publica y lo que se queda dentro.
 *
 * POR QUE EXISTE: la vitrina es material de venta. Quien la visita explora el
 * dron, no consulta su ingenieria. Pero el esquema de Pieza es uno solo y trae
 * proveedor, precio, stock, numero de parte del BOM y cotas, datos que viven en
 * la app interna y que aqui no deberian existir.
 *
 * Y no basta con no dibujarlos. El explorador pasa el catalogo completo a un
 * componente de cliente, y todo lo que cruza esa frontera viaja serializado
 * dentro del HTML de la pagina. Comprobado en produccion: el HTML de
 * /explorador traia los 33 registros enteros, con proveedor y numeroBom, aunque
 * ningun boton los mostrara. Esconder la interfaz no esconde el dato.
 *
 * La lista es de lo que SI sale, no de lo que se quita. Un campo nuevo en el
 * esquema queda fuera por omision: si manana alguien agrega "costo_unitario",
 * no se publica porque nadie lo puso aqui. Con una lista de exclusiones
 * pasaria lo contrario, el campo nuevo se publicaria por descuido.
 */

/**
 * Lo que la vitrina necesita: identidad, jerarquia, texto de venta y todo lo
 * que el visor 3D usa para armar la escena (nombresBlender marca que objeto
 * del GLB es cada pieza; direccionExplosion y factorExplosion, como se abre).
 */
const EsquemaPublico = PiezaEsquema.pick({
  sku: true,
  parteDe: true,
  slug: true,
  modelo: true,
  nombre: true,
  descripcion: true,
  descripcion_funcional: true,
  subsistema: true,
  estado: true,
  secciones: true,
  cantidadPorSeccion: true,
  nombresBlender: true,
  direccionExplosion: true,
  factorExplosion: true,
  imagen: true,
  glb: true,
  sinDespiece: true,
  orden: true,
});

/**
 * La misma pieza, sin los datos internos.
 *
 * Devuelve Pieza y no un tipo nuevo a proposito: el visor, el catalogo y el
 * resolvedor estan tipados sobre Pieza y son mas de mil lineas que no hay
 * razon de tocar para esto. Los campos internos se quedan en su valor por
 * omision (null, o lista vacia), el mismo que tiene una pieza sin medir.
 */
export function aPiezaPublica(pieza: Pieza): Pieza {
  return PiezaEsquema.parse({
    ...EsquemaPublico.parse(pieza),
    especificaciones: EspecificacionesEsquema.parse({}),
  });
}
