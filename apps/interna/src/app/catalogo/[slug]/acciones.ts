"use server";

import { revalidatePath } from "next/cache";

import { COLUMNAS_BOM, escribirPieza, type CambiosFilaBom } from "@/lib/bom";

/**
 * Guarda los cambios de especificaciones/compras/inventario del formulario de
 * edicion de la ficha. Reusa COLUMNAS_BOM (la misma lista que define las
 * columnas del Excel) para saber como convertir cada input de texto al tipo
 * correcto -- asi el formulario nunca puede desalinearse de lo que
 * lib/bom.ts espera.
 */
export async function guardarEspecificaciones(formData: FormData): Promise<void> {
  const sku = formData.get("sku");
  const slug = formData.get("slug");
  if (typeof sku !== "string" || typeof slug !== "string") {
    throw new Error("Formulario de edicion sin sku/slug.");
  }

  const cambios: Record<string, unknown> = {};
  for (const columna of COLUMNAS_BOM) {
    if (columna.clave === "sku" || columna.clave === "nombre") continue;
    if (!formData.has(columna.clave)) continue;

    const crudo = String(formData.get(columna.clave) ?? "").trim();
    if (columna.tipo === "numero") {
      cambios[columna.clave] = crudo === "" ? null : Number(crudo);
    } else if (columna.tipo === "lista") {
      cambios[columna.clave] = crudo === "" ? [] : crudo.split(";").map((s) => s.trim()).filter(Boolean);
    } else if (columna.tipo === "listaCorta") {
      cambios[columna.clave] = crudo === "" ? [] : crudo.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (columna.tipo === "booleano") {
      cambios[columna.clave] = crudo === "" ? null : crudo === "si";
    } else {
      cambios[columna.clave] = crudo === "" ? null : crudo;
    }
  }

  await escribirPieza(sku, cambios as CambiosFilaBom);
  revalidatePath(`/catalogo/${slug}`);
}
