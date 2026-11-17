"use server";

import { revalidatePath } from "next/cache";

import { COLUMNAS_BOM, ConflictoBom, escribirPieza, type CambiosFilaBom } from "@/lib/bom";
import { exigirSesion } from "@/lib/sesion";

/**
 * Guarda los cambios de especificaciones/compras/inventario del formulario de
 * edicion de la ficha. Reusa COLUMNAS_BOM (la misma lista que define las
 * columnas del Excel) para saber como convertir cada input de texto al tipo
 * correcto -- asi el formulario nunca puede desalinearse de lo que
 * lib/bom.ts espera.
 */
export type ResultadoGuardado = { ok: true } | { ok: false; error: string };

export async function guardarEspecificaciones(formData: FormData): Promise<ResultadoGuardado> {
  // Segunda puerta: proxy.ts ya pide sesion, pero una escritura no debe
  // depender de una sola comprobacion. Ademas da el nombre para el historial.
  const sesion = await exigirSesion();

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

  // La version que vio quien edito: si otra persona guardo antes, no se pisa.
  const versionCruda = formData.get("version");
  const versionEsperada =
    typeof versionCruda === "string" && versionCruda !== "" ? Number(versionCruda) : undefined;
  if (versionEsperada !== undefined && !Number.isInteger(versionEsperada)) {
    throw new Error("Formulario de edicion con version invalida.");
  }

  try {
    await escribirPieza(
      sku,
      cambios as CambiosFilaBom,
      { id: sesion.user.id, correo: sesion.user.email },
      { versionEsperada },
    );
  } catch (error) {
    // Estos dos se devuelven en vez de lanzarse: en produccion Next esconde el
    // mensaje de una excepcion de accion, y la persona veria un error generico.
    if (error instanceof ConflictoBom) return { ok: false, error: error.message };
    if (error instanceof Error && error.name === "ZodError") {
      return { ok: false, error: "Hay un valor que no es valido (revisa los numeros)." };
    }
    throw error;
  }

  // El BOM se ve en la ficha, en el catalogo y en las fichas PDF: se refrescan
  // todas, no solo esta pagina.
  revalidatePath(`/catalogo/${slug}`);
  revalidatePath("/catalogo", "layout");
  return { ok: true };
}
