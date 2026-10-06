#!/usr/bin/env node
/**
 * Extrae un GLB por pieza de catalogo a partir del GLB del brazo completo.
 *
 *   npm run glb:piezas
 *
 * POR QUE: el visor de cada ficha necesita la pieza sola, y hasta ahora esos
 * archivos salian de .blend sueltos que ya no viven en el repositorio. Sacarlos
 * del mismo GLB que carga el sitio garantiza que la pieza aislada y la pieza
 * dentro del brazo sean literalmente la misma geometria: no pueden divergir.
 *
 * Cada archivo conserva los objetos con su nombre, asi que una pieza con
 * subpiezas (el balanceador, el motor, el conjunto ESC) llega al visor con sus
 * partes separables y el boton "Ver despiece" funciona solo.
 *
 * El centro de la pieza se lleva al origen para que gire sobre si misma en vez
 * de orbitar alrededor del centro del brazo.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup } from "@gltf-transform/functions";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENTRADA = path.join(
  AQUI, "..", "contenido", "piezas_MX80",
  "visualizacion", "brazo-cw", "MX80_brazo_CW.glb",
);
const SALIDA = path.join(AQUI, "..", "public", "models", "mx80", "piezas");

/** Mismo criterio que src/lib/texto.ts, para emparejar con el catalogo igual que el visor. */
const norm = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\.\d+$/, "").replace(/(_\d+)+$/, "").replace(/[^a-z0-9]/g, "");

// ---- catalogo: que objetos pertenecen a cada pieza de catalogo ----
const src = readFileSync(path.join(AQUI, "..", "src", "data", "mx80.ts"), "utf8");

const entradas = [];
for (const m of src.matchAll(
  /sku:\s*"(MX\d{2}-\d{3}(?:-\d{2})?)"[\s\S]{0,1400}?nombresBlender:\s*\[([\s\S]*?)\]/g,
)) {
  const trozo = src.slice(Math.max(0, m.index - 200), m.index + 400);
  const padre = (trozo.match(/parteDe:\s*"(MX\d{2}-\d{3})"/) || [])[1] ?? null;
  entradas.push({
    sku: m[1],
    padre,
    alias: [...m[2].matchAll(/"([^"]+)"/g)].map((a) => a[1]),
  });
}
// Las subpiezas del motor se generan con .map() y no calzan con el patron de
// arriba; se recogen de su tabla literal.
for (const m of src.matchAll(/\["(\d{2})",\s*"[^"]+",\s*"[^"]+",\s*"([^"]+)"\]/g)) {
  entradas.push({ sku: `MX80-007-${m[1]}`, padre: "MX80-007", alias: [m[2]] });
}

const grupoDe = new Map(); // nombre normalizado del objeto -> SKU de catalogo
for (const e of entradas) {
  const grupo = e.padre ?? e.sku;
  for (const a of e.alias) if (!grupoDe.has(norm(a))) grupoDe.set(norm(a), grupo);
}

// ---- extraccion ----
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const original = await io.read(ENTRADA);

const porGrupo = new Map();
for (const nodo of original.getRoot().listNodes()) {
  const grupo = grupoDe.get(norm(nodo.getName() || ""));
  if (grupo) porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), nodo.getName()]);
}

mkdirSync(SALIDA, { recursive: true });
const hechos = [];
const sinObjetos = [];

for (const [sku, nombres] of [...porGrupo].sort()) {
  const doc = await io.read(ENTRADA); // copia limpia por pieza
  const escena = doc.getRoot().listScenes()[0];
  const conservar = new Set(nombres);

  for (const nodo of doc.getRoot().listNodes()) {
    if (!conservar.has(nodo.getName())) {
      nodo.detach();
      nodo.dispose();
    }
  }

  // Centrar: el visor de ficha gira la pieza sobre su propio centro.
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const nodo of escena.listChildren()) {
    const malla = nodo.getMesh();
    if (!malla) continue;
    const [sx, sy, sz] = nodo.getScale();
    const [tx, ty, tz] = nodo.getTranslation();
    for (const prim of malla.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const pmin = pos.getMinNormalized([0, 0, 0]);
      const pmax = pos.getMaxNormalized([0, 0, 0]);
      const e = [[sx, tx], [sy, ty], [sz, tz]];
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], pmin[k] * e[k][0] + e[k][1], pmax[k] * e[k][0] + e[k][1]);
        max[k] = Math.max(max[k], pmin[k] * e[k][0] + e[k][1], pmax[k] * e[k][0] + e[k][1]);
      }
    }
  }
  if (Number.isFinite(min[0])) {
    const c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
    for (const nodo of escena.listChildren()) {
      const t = nodo.getTranslation();
      nodo.setTranslation([t[0] - c[0], t[1] - c[1], t[2] - c[2]]);
    }
  }

  await doc.transform(prune(), dedup());
  const bytes = await io.writeBinary(doc);
  const archivo = path.join(SALIDA, `${sku}_v1.glb`);
  writeFileSync(archivo, bytes);
  hechos.push({ sku, objetos: nombres.length, kb: bytes.byteLength / 1024 });
}

for (const e of entradas) {
  const grupo = e.padre ?? e.sku;
  if (!porGrupo.has(grupo) && !sinObjetos.includes(grupo)) sinObjetos.push(grupo);
}

console.log(`\n[MXD] ${hechos.length} GLB por pieza -> ${path.relative(process.cwd(), SALIDA)}\n`);
console.log("  SKU          objetos     peso");
for (const h of hechos)
  console.log(`  ${h.sku.padEnd(13)}${String(h.objetos).padStart(4)}   ${h.kb.toFixed(0).padStart(7)} KB`);
if (sinObjetos.length) console.log(`\n  sin objetos en el GLB del brazo: ${sinObjetos.join(", ")}`);
console.log();
