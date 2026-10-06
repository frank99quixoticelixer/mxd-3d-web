#!/usr/bin/env node
/**
 * Optimizacion de archivos GLB para web.
 *
 * Envoltura sobre la herramienta oficial @gltf-transform/cli, con los
 * parametros que este proyecto usa por defecto.
 *
 * Uso:
 *   npm run glb:optimizar -- entrada.glb salida.glb
 *   npm run glb:optimizar -- entrada.glb salida.glb --draco
 *
 * Requisito (una sola vez):
 *   npm install -g @gltf-transform/cli
 *
 * Que aplica:
 *   - dedup      elimina geometrias y materiales repetidos
 *   - weld       une vertices coincidentes (clave tras un escaneo)
 *   - simplify   reduce triangulos conservando la silueta
 *   - compresion Meshopt por defecto (se decodifica rapido en el navegador
 *                y el decodificador ya viene incluido en three.js)
 *   - texturas   reescaladas a 2048 px y convertidas a WebP
 *                (KTX2 daria mejor compresion, pero exige instalar
 *                 KTX-Software aparte; WebP no necesita nada)
 *
 * Meshopt vs Draco:
 *   Meshopt descomprime mucho mas rapido y no bloquea el hilo principal.
 *   Draco comprime algo mas la geometria pero exige descargar un
 *   decodificador externo. Para un catalogo interactivo conviene Meshopt.
 */

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const usarDraco = args.includes("--draco");
const rutas = args.filter((a) => !a.startsWith("--"));

if (rutas.length < 2) {
  console.error(
    "\nUso: npm run glb:optimizar -- <entrada.glb> <salida.glb> [--draco]\n",
  );
  process.exit(1);
}

const [entrada, salida] = rutas;

if (!existsSync(entrada)) {
  console.error(`\n[MXD] No existe el archivo de entrada: ${entrada}\n`);
  process.exit(1);
}

const tamanioEntrada = statSync(entrada).size;

const parametros = [
  "@gltf-transform/cli",
  "optimize",
  entrada,
  salida,
  "--compress",
  usarDraco ? "draco" : "meshopt",
  "--texture-compress",
  "webp",
  "--texture-size",
  "2048",
  "--simplify-error",
  "0.001",
  // ------------------------------------------------------------------
  // CRITICO: estas cuatro pasadas vienen activas por defecto en
  // "gltf-transform optimize" y fusionan o reescriben el grafo de la
  // escena. El resultado pesa menos, pero los objetos pierden su nombre
  // y el visor ya no puede emparejarlos con las piezas del catalogo:
  // adios hotspots, adios despiece, adios panel de detalle.
  // No las reactives sin cambiar antes a identificar piezas por la
  // propiedad mxd_sku.
  // ------------------------------------------------------------------
  "--join",
  "false",
  "--flatten",
  "false",
  "--instance",
  "false",
  "--palette",
  "false",
];

console.log(`\n[MXD] Optimizando ${path.basename(entrada)} ...`);
console.log(`[MXD] Comando: npx ${parametros.join(" ")}\n`);

const proceso = spawn("npx", parametros, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

proceso.on("close", (codigo) => {
  if (codigo !== 0) {
    console.error(
      `\n[MXD] La optimizacion fallo (codigo ${codigo}).` +
        "\n[MXD] Verifica que @gltf-transform/cli este instalado:" +
        "\n      npm install -g @gltf-transform/cli\n",
    );
    process.exit(codigo ?? 1);
  }

  const tamanioSalida = statSync(salida).size;
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  const reduccion = (1 - tamanioSalida / tamanioEntrada) * 100;

  console.log(
    `\n[MXD] Listo.` +
      `\n      Entrada: ${mb(tamanioEntrada)} MB` +
      `\n      Salida:  ${mb(tamanioSalida)} MB  (-${reduccion.toFixed(1)}%)\n`,
  );

  if (tamanioSalida > 25 * 1024 * 1024) {
    console.warn(
      "[MXD] AVISO: el archivo supera 25 MB. Objetivo recomendado para el\n" +
        "      ensamble completo: 25 MB o menos. Aumenta la decimacion en\n" +
        "      Blender o reduce el tamanio de las texturas.\n",
    );
  }
});
