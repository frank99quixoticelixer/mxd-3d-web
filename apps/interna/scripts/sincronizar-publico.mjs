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

/**
 * Carpetas que se espejan. `protegido` trae los GLB y renders que entregan
 * /api/modelos y /api/renders (no pueden ir en public/: ver lib/protegido.ts).
 * `contenido` es opcional: no existe en todos los equipos, y en interna guarda
 * el BOM, asi que NO se le pone el mismo nombre a la carpeta de vitrina.
 */
const CARPETAS = ["public", "protegido", "contenido"];

/**
 * Renders de piezas que solo existen en el catalogo de interna (sujetadores
 * que vitrina no muestra: tornillos, arandelas, goma del tren). Si no estuvieran
 * en vitrina/protegido/renders, sin esta excepcion `podar` los borraria en
 * cada dev/build.
 */
const RENDERS_SOLO_INTERNA = [
  "renders/MX80-001-08.jpg",
  "renders/MX80-005-01.jpg",
  "renders/MX80-005-02.jpg",
  "renders/MX80-011-05.jpg",
  "renders/MX80-011-06.jpg",
  "renders/MX80-011-07.jpg",
  "renders/MX80-011-08.jpg",
  "renders/MX80-011-09.jpg",
  "renders/MX80-013-23.jpg",
];

let copiados = 0;
let omitidos = 0;
let borrados = 0;

/**
 * Borra de `destino` lo que ya no esta en `origen`. Sin esto el espejo solo
 * crecia: interna seguia sirviendo los GLB por pieza y los renders viejos que
 * vitrina ya habia quitado. `conservar` son rutas relativas que no vienen de
 * vitrina.
 */
async function podar(origen, destino, conservar = [], rutaActual = "") {
  for (const entrada of await readdir(destino, { withFileTypes: true })) {
    const ruta = rutaActual ? `${rutaActual}/${entrada.name}` : entrada.name;
    if (conservar.includes(ruta)) continue;
    const enOrigen = join(origen, entrada.name);
    const enDestino = join(destino, entrada.name);
    const infoOrigen = await datos(enOrigen);
    if (entrada.isDirectory()) {
      if (infoOrigen?.isDirectory()) {
        await podar(enOrigen, enDestino, conservar, ruta);
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
  // Sin mas excepciones: las descargas ya no van en public/ (las sirve
  // /api/descargas desde apps/interna/descargas), asi que una carpeta
  // public/downloads de antes tambien se borra.
  await podar(origen, join(raizInterna, carpeta), carpeta === "protegido" ? RENDERS_SOLO_INTERNA : []);
}

console.log(
  `[interna] assets sincronizados: ${copiados} copiados, ${omitidos} sin cambios, ${borrados} borrados.`,
);
