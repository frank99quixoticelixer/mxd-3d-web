import { createHash } from "node:crypto";

import type { Pieza } from "@/lib/esquema";

/**
 * Codigo de revision de una ficha.
 *
 * POR QUE EXISTE: un proveedor que cotiza sobre una hoja vieja es un error caro
 * y silencioso. Si dos hojas de la misma pieza traen el mismo codigo, describen
 * la misma pieza; si diferen, algo cambio y hay que volver a cotizar.
 *
 * COMO SE CALCULA: hash de los campos que le importan a quien fabrica. Es
 * deterministico, asi que no hace falta llevar un contador a mano ni una tabla
 * de revisiones, y no puede quedar desactualizado: si cambias una cota, el
 * codigo cambia solo. Lo que NO entra en el hash es igual de importante: el
 * orden en el catalogo o la imagen no alteran la revision de la pieza.
 *
 * Cuando exista la base de datos con historial, esto se reemplaza por el numero
 * de revision real y este archivo es lo unico que se toca.
 */
export function codigoRevision(pieza: Pieza): string {
  const relevante = JSON.stringify({
    sku: pieza.sku,
    nombre: pieza.nombre,
    especificaciones: pieza.especificaciones,
    secciones: [...pieza.secciones].sort(),
    cantidadPorSeccion: pieza.cantidadPorSeccion,
    // Estos tambien cambian lo que se fabrica, asi que mueven la revision.
    categoria: pieza.categoria,
    proceso_fabricacion: pieza.proceso_fabricacion,
    descripcion_funcional: pieza.descripcion_funcional,
    especificaciones_tecnicas: pieza.especificaciones_tecnicas,
  });

  return createHash("sha1").update(relevante).digest("hex").slice(0, 4).toUpperCase();
}

/** Fecha de emision en formato ISO corto (2026-09-22), sin ambiguedad de region. */
export function fechaEmision(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Linea de identificacion que va en el pie de cada pagina de una ficha. */
export function selloRevision(pieza: Pieza): string {
  return `${pieza.sku} · Rev. ${codigoRevision(pieza)} · ${fechaEmision()}`;
}
