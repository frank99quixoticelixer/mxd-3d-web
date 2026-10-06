#!/usr/bin/env node
/**
 * Convierte el logo SVG a PNG para poder incrustarlo en los PDF.
 *
 *   npm run logo:png
 *
 * POR QUE: el componente Image de react-pdf no carga archivos SVG, y el logo
 * de marca (public/brand/logo-mxd.svg) es un trazado de VTracer con 125 paths
 * y 125 tonos distintos por el antialias del original. Pasar eso a primitivas
 * vectoriales de react-pdf engordaria cada pagina sin ganar nitidez, asi que se
 * rasteriza una sola vez y el PDF incrusta el PNG.
 *
 * Se renderiza a 4x el tamanio con el que se imprime (unos 18 pt de alto) para
 * que se vea limpio en pantalla y en papel.
 *
 * Si cambia el logo: reemplaza el SVG y vuelve a correr este script.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENTRADA = path.join(AQUI, "..", "public", "brand", "logo-mxd.svg");
const SALIDA = path.join(AQUI, "..", "public", "brand", "logo-mxd.png");

const ALTO = 160; // 4x los ~40 pt de alto maximo con que se usa en el PDF

// trim() quita el margen transparente que deja el trazado. Sin esto el logo
// queda flotando en medio de su caja y se ve mas chico de lo que es.
const png = await sharp(readFileSync(ENTRADA), { density: 600 })
  .trim()
  .resize({ height: ALTO, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(SALIDA, png);

const meta = await sharp(png).metadata();
console.log(
  `\n[MXD] Logo rasterizado -> ${path.relative(process.cwd(), SALIDA)}` +
    `\n      ${meta.width} x ${meta.height} px, ${(png.length / 1024).toFixed(1)} KB` +
    `\n      canal alfa: ${meta.hasAlpha ? "si" : "no"}\n`,
);
