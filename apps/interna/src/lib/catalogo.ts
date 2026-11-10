import { existsSync } from "node:fs";
import path from "node:path";

import { PIEZAS_MX80 } from "@/data/mx80";
import { leerBom, leerNumerosVariantes, leerPieza, type FilaBom } from "@/lib/bom";
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
/**
 * El render de una pieza que no declara `imagen`: protegido/renders/<SKU>.jpg, si
 * existe. Lo generan `npm run renders:generar` (ver blender/README.md), asi
 * que una pieza nueva tiene imagen en cuanto se renderiza, sin tocar mx80.ts.
 */
function conRender(pieza: Pieza): Pieza {
  if (pieza.imagen) return pieza;
  const ruta = `/renders/${pieza.sku}.jpg`;
  return existsSync(path.join(process.cwd(), "protegido", ruta))
    ? { ...pieza, imagen: ruta }
    : pieza;
}

const CATALOGO: Pieza[] = CatalogoEsquema.parse([...PIEZAS_MX80]).map(conRender);

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
 * Mezcla una fila del BOM (especificaciones + compras + inventario, editables
 * en vivo) sobre una pieza estatica. `sku` y `nombre` de la fila se ignoran a
 * proposito: esos siguen viviendo en mx80.ts, la fila del BOM es solo
 * referencia para esos dos campos (ver comentario en lib/bom.ts).
 */
function conBom(pieza: Pieza, fila: FilaBom | null): Pieza {
  if (!fila) return pieza;
  const {
    sku: _sku,
    nombre: _nombre,
    categoria,
    proceso_fabricacion,
    descripcion_funcional,
    especificaciones_tecnicas,
    camposNoAplican,
    numero_parte_mxd,
    precio_mxn,
    stock,
    costo_fabricado_inhouse,
    costo_equipo,
    costo_material,
    costo_masa_g,
    costo_horas_produccion,
    costo_pintura_mxn,
    costo_mano_obra_mxn,
    costo_notas,
    trazabilidad_criticidad,
    trazabilidad_control_calidad,
    trazabilidad_intercambiable,
    trazabilidad_carpeta_pieza,
    trazabilidad_archivo_step,
    trazabilidad_archivo_stl,
    cruce_estado,
    numeros_variantes,
    ...especificaciones
  } = fila;
  // Numero de cada version (CW/CCW...) y estado del cruce, capturados en la
  // pagina /maestro. Sin dato en la fila se queda lo del catalogo.
  const porVersion = leerNumerosVariantes(numeros_variantes);
  const variantes = numeros_variantes
    ? pieza.variantes.map((v) => ({ ...v, numeroBom: porVersion[v.clave] ?? null }))
    : pieza.variantes;
  const estadoValido = (["confirmado", "propuesto", "sin-numero"] as const).find(
    (e) => e === cruce_estado,
  );
  const cruceBom = estadoValido
    ? { estado: estadoValido, nota: pieza.cruceBom?.nota ?? null }
    : pieza.cruceBom;
  return {
    ...pieza,
    categoria,
    proceso_fabricacion,
    descripcion_funcional,
    especificaciones_tecnicas,
    camposNoAplican,
    numeroBom: numero_parte_mxd,
    variantes,
    cruceBom,
    precio_mxn,
    stock,
    especificaciones: { ...pieza.especificaciones, ...especificaciones },
    costosProduccion: {
      ...pieza.costosProduccion,
      fabricadoInhouse: costo_fabricado_inhouse,
      equipo: costo_equipo,
      material: costo_material,
      masaG: costo_masa_g,
      horasProduccion: costo_horas_produccion,
      costoPinturaMxn: costo_pintura_mxn,
      costoManoObraMxn: costo_mano_obra_mxn,
      notas: costo_notas,
    },
    trazabilidad: {
      ...pieza.trazabilidad,
      criticidad: trazabilidad_criticidad,
      controlCalidad: trazabilidad_control_calidad,
      intercambiable: trazabilidad_intercambiable,
      carpetaPieza: trazabilidad_carpeta_pieza,
      archivoStep: trazabilidad_archivo_step,
      archivoStl: trazabilidad_archivo_stl,
    },
  };
}

/**
 * Version "en vivo" de obtenerPiezaPorSlug/Sku: lee el BOM_MX80.xlsx en cada
 * llamada y la superpone a la pieza estatica. Usar solo donde de verdad hace
 * falta el dato fresco (la ficha web editable y la ficha PDF) -- el resto del
 * sitio (listados, navegacion, visor 3D) sigue con las funciones sincronas de
 * arriba, que no tienen el costo de leer un archivo en cada peticion.
 */
export async function obtenerPiezaConBomPorSlug(slug: string): Promise<Pieza | undefined> {
  const pieza = obtenerPiezaPorSlug(slug);
  if (!pieza) return undefined;
  return conBom(pieza, await leerPieza(pieza.sku));
}

export async function obtenerPiezaConBomPorSku(sku: string): Promise<Pieza | undefined> {
  const pieza = obtenerPiezaPorSku(sku);
  if (!pieza) return undefined;
  return conBom(pieza, await leerPieza(sku));
}

/**
 * Igual que obtenerPiezaConBomPorSku pero para varias piezas (fichas de
 * seccion o del catalogo completo): una sola lectura del Excel para todas,
 * no una por pieza.
 */
export async function conBomTodas(piezas: Pieza[]): Promise<Pieza[]> {
  const bom = await leerBom();
  return piezas.map((p) => conBom(p, bom.get(p.sku) ?? null));
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
