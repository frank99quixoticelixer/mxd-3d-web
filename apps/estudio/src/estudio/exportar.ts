"use client";

import { zipSync } from "fflate";

import { COMBINACIONES, FORMATOS, PRECALENTAR_ASPERSION_S, type Formato } from "./config";
import { useEstudio, type Toma } from "./estado";

/** Descarga un archivo generado en el navegador. */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "Hero despliegue" -> "hero-despliegue" (nombres de archivo seguros). */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "toma";
}

/** Exporta lo que se ve ahora en un formato. */
export async function exportarActual(formato: Formato) {
  const capturador = useEstudio.getState().capturador;
  if (!capturador) throw new Error("La escena todavia no termina de cargar.");
  const blob = await capturador.capturar(formato);
  const color = useEstudio.getState().escena.color ?? "original";
  descargar(blob, `mx80_${color}_${formato.clave}.png`);
}

/**
 * Exportacion por lote: cada toma, en cada color y en cada formato, en un zip
 * ordenado por carpetas (toma/color/formato.png).
 *
 * Cada toma se aplica y se deja correr un momento antes de capturar: con la
 * aspersion encendida, el pool de gotas arranca vacio y la foto saldria sin
 * agua.
 */
export async function exportarLote(
  tomas: Toma[],
  colores: (string | null)[],
  formatos: Formato[],
  alAvanzar: (texto: string) => void,
) {
  const { capturador, ajustar } = useEstudio.getState();
  if (!capturador) throw new Error("La escena todavia no termina de cargar.");
  const archivos: Record<string, Uint8Array> = {};
  const total = tomas.length * colores.length * formatos.length;
  let hechas = 0;

  for (const toma of tomas) {
    for (const color of colores) {
      ajustar({ ...toma.escena, color });
      capturador.aplicarCamara(toma.camara);
      await esperar(toma.escena.aspersion ? PRECALENTAR_ASPERSION_S * 1000 : 250);
      for (const formato of formatos) {
        hechas++;
        alAvanzar(`Exportando ${hechas} de ${total}: ${toma.nombre} · ${color ?? "original"} · ${formato.nombre}`);
        const blob = await capturador.capturar(formato);
        const ruta = `${aSlug(toma.nombre)}/${color ?? "original"}/${formato.clave}.png`;
        archivos[ruta] = new Uint8Array(await blob.arrayBuffer());
      }
    }
  }

  alAvanzar("Comprimiendo…");
  // Los PNG ya vienen comprimidos: nivel 0 solo los empaqueta, mucho mas rapido.
  const zip = zipSync(archivos, { level: 0 });
  const fecha = new Date().toISOString().slice(0, 10);
  descargar(new Blob([zip as BlobPart], { type: "application/zip" }), `mx80_lote_${fecha}.zip`);
  alAvanzar(`Listo: ${total} imágenes en el zip.`);
}

/** Todas las opciones de color del lote: los 3 del cliente mas el original. */
export const COLORES_LOTE: (string | null)[] = [null, ...COMBINACIONES.map((c) => c.clave)];
export { FORMATOS };
