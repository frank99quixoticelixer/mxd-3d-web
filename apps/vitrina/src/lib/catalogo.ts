import { PIEZAS_MX80 } from "@/data/mx80";
import {
  CatalogoEsquema,
  ORDEN_SECCIONES,
  type ModeloDron,
  type Pieza,
  type Seccion,
} from "@/lib/esquema";

/**
 * Capa de acceso al catalogo.
 *
 * Hoy lee de un arreglo en memoria validado con Zod. Cuando se conecte
 * PostgreSQL, SOLO se reemplaza el cuerpo de estas funciones por consultas
 * de Prisma: las paginas y componentes no cambian porque dependen de esta
 * interfaz, no de la fuente de datos. Esa es la razon de que exista este archivo.
 */

/** Valida los datos semilla al arrancar. Si hay un error de formato, falla aqui y no en la interfaz. */
const CATALOGO: Pieza[] = CatalogoEsquema.parse([...PIEZAS_MX80]);

/**
 * Piezas de CATALOGO: las que se cotizan, se listan y ocupan una celda en la
 * vista organizada. Las subpiezas quedan fuera a proposito; se piden con
 * obtenerSubpiezas.
 */
export function obtenerPiezas(modelo?: ModeloDron): Pieza[] {
  const piezas = CATALOGO.filter(
    (p) => p.parteDe === null && (!modelo || p.modelo === modelo),
  );
  return [...piezas].sort((a, b) => a.orden - b.orden);
}

/** Todas las entradas, incluidas las subpiezas. Lo usa el visor 3D. */
export function obtenerTodas(modelo?: ModeloDron): Pieza[] {
  const piezas = modelo ? CATALOGO.filter((p) => p.modelo === modelo) : CATALOGO;
  return [...piezas].sort((a, b) => a.orden - b.orden);
}

/** Subpiezas de una pieza, en orden de desarmado. Vacio si no se desarma. */
export function obtenerSubpiezas(sku: string): Pieza[] {
  return CATALOGO.filter((p) => p.parteDe === sku).sort(
    (a, b) => a.orden - b.orden,
  );
}

/**
 * Llave con la que se agrupa una entrada en el visor: la pieza de catalogo a
 * la que pertenece. Una subpieza se agrupa con su padre; una pieza suelta
 * consigo misma. Es lo que hace que el balanceador ocupe UNA celda en la
 * vista organizada aunque el GLB traiga tres objetos.
 */
export function llaveDeGrupo(pieza: Pieza): string {
  return pieza.parteDe ?? pieza.sku;
}

export function obtenerPiezaPorSlug(slug: string): Pieza | undefined {
  return CATALOGO.find((p) => p.slug === slug);
}

export function obtenerPiezaPorSku(sku: string): Pieza | undefined {
  return CATALOGO.find((p) => p.sku === sku);
}

/**
 * Slugs con ficha propia en el sitio. Solo piezas de catalogo: una subpieza no
 * tiene pagina, se ve dentro del despiece de su padre.
 */
export function obtenerSlugs(): string[] {
  return obtenerPiezas().map((p) => p.slug);
}

/** Conteo por subsistema, para los filtros del catalogo. */
export function contarPorSubsistema(modelo?: ModeloDron): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const pieza of obtenerPiezas(modelo)) {
    conteo[pieza.subsistema] = (conteo[pieza.subsistema] ?? 0) + 1;
  }
  return conteo;
}

/** Piezas que pertenecen a una seccion. Una pieza puede salir en varias. */
export function obtenerPiezasPorSeccion(
  seccion: Seccion,
  modelo?: ModeloDron,
): Pieza[] {
  return obtenerPiezas(modelo).filter((p) => p.secciones.includes(seccion));
}

/**
 * Secciones que hoy tienen al menos una pieza, en el orden de presentacion.
 * Se usa para no dibujar encabezados de secciones vacias mientras el resto
 * del dron sigue sin modelar.
 */
export function obtenerSeccionesConPiezas(modelo?: ModeloDron): Seccion[] {
  const piezas = obtenerPiezas(modelo);
  return ORDEN_SECCIONES.filter((seccion) =>
    piezas.some((p) => p.secciones.includes(seccion)),
  );
}

/** Conteo por seccion, para los filtros y para la portada de cada paquete. */
export function contarPorSeccion(modelo?: ModeloDron): Record<Seccion, number> {
  const conteo = {} as Record<Seccion, number>;
  for (const seccion of ORDEN_SECCIONES) {
    conteo[seccion] = obtenerPiezasPorSeccion(seccion, modelo).length;
  }
  return conteo;
}
