"use server";

import { revalidatePath } from "next/cache";

import { crearCorte } from "@/lib/bom-cortes";
import { exigirSesion } from "@/lib/sesion";

/** Crea un corte del BOM con el nombre del formulario. Un nombre invalido no hace nada. */
export async function crearCorteBom(formData: FormData): Promise<void> {
  const sesion = await exigirSesion();
  await crearCorte(String(formData.get("nombre") ?? ""), {
    id: sesion.user.id,
    correo: sesion.user.email,
  });
  revalidatePath("/cortes");
}
