"use server";

import { revalidatePath } from "next/cache";

import { aplicarCruces, type CambioCruce } from "@/lib/cruces";
import { exigirSesion } from "@/lib/sesion";

export type { CambioCruce } from "@/lib/cruces";

/**
 * Guarda los cruces hechos en /maestro (ver aplicarCruces en lib/cruces.ts,
 * que valida y escribe en el BOM) y refresca las paginas que los muestran.
 * Cada cambio queda en el historial del BOM a nombre de quien tiene la sesion.
 */
export async function guardarCruces(cambios: CambioCruce[]): Promise<{ piezas: number }> {
  // Segunda puerta (ver acciones.ts de la ficha): una escritura no depende solo del proxy.
  const sesion = await exigirSesion();
  const resultado = await aplicarCruces(cambios, {
    id: sesion.user.id,
    correo: sesion.user.email,
  });
  revalidatePath("/maestro");
  revalidatePath("/catalogo", "layout");
  return resultado;
}
