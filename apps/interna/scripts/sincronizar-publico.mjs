/**
 * Sincroniza los assets pesados de vitrina hacia interna.
 *
 * interna es un clon del catalogo de vitrina y usa exactamente los mismos
 * GLB, renders y descargas (103 MB). Duplicarlos en git doblaria el peso del
 * repo en cada clon, asi que apps/interna/public esta gitignored y se llena
 * desde apps/vitrina/public justo antes de cada dev o build.
 *
 * En Hostinger el zip que se despliega contiene solo apps/interna, sin
 * vitrina al lado: ahi este script no encuentra el origen y no hace nada,
 * porque el workflow ya copio los assets antes de empaquetar.
 *
 * La copia es incremental: solo reescribe archivos con tamanio o fecha
 * distinta, para que arrancar `npm run dev` no tarde medio minuto.
 */

import { cp, mkdir, readdir, stat, utimes } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raizInterna = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raizVitrina = resolve(raizInterna, "..", "vitrina");

/** Carpetas que se espejan. `contenido` es opcional: no existe en todos los equipos. */
const CARPETAS = ["public", "contenido"];

let copiados = 0;
let omitidos = 0;

/** @param {string} ruta */
async function datos(ruta) {
  try {
    return await stat(ruta);
  } catch {
    return null;
  }
}

/**
 * Copia `origen` en `destino` recursivamente, saltando lo que ya coincide.
 * @param {string} origen
 * @param {string} destino
 */
async function espejar(origen, destino) {
  await mkdir(destino, { recursive: true });

  for (const entrada of await readdir(origen, { withFileTypes: true })) {
    const desde = join(origen, entrada.name);
    const hacia = join(destino, entrada.name);

    if (entrada.isDirectory()) {
      await espejar(desde, hacia);
      continue;
    }

    const [infoOrigen, infoDestino] = await Promise.all([datos(desde), datos(hacia)]);
    if (!infoOrigen) continue;

    const iguales =
      infoDestino &&
      infoDestino.size === infoOrigen.size &&
      Math.abs(infoDestino.mtimeMs - infoOrigen.mtimeMs) < 1000;

    if (iguales) {
      omitidos += 1;
      continue;
    }

    await cp(desde, hacia);
    // Sin esto la copia queda con la fecha de hoy y la siguiente corrida la
    // volveria a copiar: la comparacion por mtime necesita la fecha original.
    await utimes(hacia, infoOrigen.atime, infoOrigen.mtime);
    copiados += 1;
  }
}

const origenVitrina = await datos(raizVitrina);
if (!origenVitrina?.isDirectory()) {
  console.log("[interna] apps/vitrina no esta presente; se usan los assets ya copiados.");
  process.exit(0);
}

for (const carpeta of CARPETAS) {
  const origen = join(raizVitrina, carpeta);
  if (!(await datos(origen))?.isDirectory()) {
    console.log(`[interna] vitrina/${carpeta} no existe; se omite.`);
    continue;
  }
  await espejar(origen, join(raizInterna, carpeta));
}

console.log(`[interna] assets sincronizados: ${copiados} copiados, ${omitidos} sin cambios.`);
