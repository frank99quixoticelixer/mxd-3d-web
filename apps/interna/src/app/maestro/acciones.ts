"use server";

import { revalidatePath } from "next/cache";

import { aplicarCruces, type CambioCruce } from "@/lib/cruces";

export type { CambioCruce } from "@/lib/cruces";

/**
 * Guarda los cruces hechos en /maestro (ver aplicarCruces en lib/cruces.ts,
 * que valida y escribe en el BOM) y refresca las paginas que los muestran.
 */
export async function guardarCruces(cambios: CambioCruce[]): Promise<{ piezas: number }> {
  const resultado = await aplicarCruces(cambios);
  revalidatePath("/maestro");
  revalidatePath("/catalogo", "layout");
  return resultado;
}
