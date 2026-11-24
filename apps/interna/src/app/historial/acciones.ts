"use server";

import { revalidatePath } from "next/cache";

import { restaurarCambio } from "@/lib/bom";
import { exigirSesion } from "@/lib/sesion";

export type ResultadoRestauracion = { ok: true } | { ok: false; error: string };

/**
 * Deshace un cambio del historial (ver restaurarCambio en lib/bom.ts). Se
 * devuelve el resultado en vez de lanzar: en produccion Next esconde el mensaje
 * de una excepcion de accion y la persona veria un error generico.
 */
export async function restaurarCambioBom(idCambio: number): Promise<ResultadoRestauracion> {
  const sesion = await exigirSesion();
  if (!Number.isInteger(idCambio) || idCambio < 1) return { ok: false, error: "Cambio no valido." };

  const resultado = await restaurarCambio(idCambio, { id: sesion.user.id, correo: sesion.user.email });
  if (resultado.ok) {
    revalidatePath("/historial");
    revalidatePath("/catalogo", "layout");
  }
  return resultado;
}
