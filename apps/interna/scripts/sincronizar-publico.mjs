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

import { cp, mkdir, readdir, rm, rmdir, stat, utimes } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raizInterna = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raizVitrina = resolve(raizInterna, "..", "vitrina");

/** Carpetas que se espejan. `contenido` es opcional: no existe en todos los equipos. */
const CARPETAS = ["public", "contenido"];

let copiados = 0;
let omitidos = 0;
let borrados = 0;

/**
 * Borra de `destino` lo que ya no esta en `origen`. Sin esto el espejo solo
 * crecia: interna seguia sirviendo los GLB por pieza y los renders viejos que
 * vitrina ya habia quitado. `conservar` son rutas relativas que no vienen de
 * vitrina.
 */
async function podar(origen, destino, conservar = []) {
  for (const entrada of await readdir(destino, { withFileTypes: true })) {
    if (conservar.includes(entrada.name)) continue;
    const enOrigen = join(origen, entrada.name);
    const enDestino = join(destino, entrada.name);
    const infoOrigen = await datos(enOrigen);
    if (entrada.isDirectory()) {
      if (infoOrigen?.isDirectory()) {
        await podar(enOrigen, enDestino);
      } else {
        await rm(enDestino, { recursive: true, force: true });
        borrados += 1;
      }
      continue;
    }
    if (!infoOrigen) {
      await rm(enDestino, { force: true });
      borrados += 1;
    }
  }
  // Una carpeta que quedo vacia tambien sobra.
  if ((await readdir(destino)).length === 0 && !(await datos(origen))) {
    await rmdir(destino).catch(() => {});
  }
}

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
const hayVitrina = Boolean(origenVitrina?.isDirectory());
if (!hayVitrina) {
  console.log("[interna] apps/vitrina no esta presente; se usan los assets ya copiados.");
}

for (const carpeta of hayVitrina ? CARPETAS : []) {
  const origen = join(raizVitrina, carpeta);
  if (!(await datos(origen))?.isDirectory()) {
    console.log(`[interna] vitrina/${carpeta} no existe; se omite.`);
    continue;
  }
  await espejar(origen, join(raizInterna, carpeta));
  // Sin excepciones: las descargas ya no van en public/ (las sirve
  // /api/descargas desde apps/interna/descargas), asi que una carpeta
  // public/downloads de antes tambien se borra.
  await podar(origen, join(raizInterna, carpeta));
}

console.log(
  `[interna] assets sincronizados: ${copiados} copiados, ${omitidos} sin cambios, ${borrados} borrados.`,
);
