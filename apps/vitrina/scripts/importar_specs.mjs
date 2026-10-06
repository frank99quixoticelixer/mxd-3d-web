#!/usr/bin/env node
/**
 * Importa las especificaciones del CSV al catalogo.
 *
 *   npm run specs:importar
 *
 * Lee  contenido/piezas_MX80/especificaciones_brazo_CW1.csv
 * y escribe  src/data/especificaciones-mx80.json,  que src/data/mx80.ts mezcla
 * por SKU.
 *
 * POR QUE EXISTE: el CSV es donde se trabajan los datos y el catalogo es donde
 * los lee la aplicacion. Transcribir 13 piezas por 20 columnas a mano cada vez
 * que cambia una cota garantiza que en algun momento los dos digan cosas
 * distintas, y el que se entera es el proveedor que ya cotizo. Con este script
 * el CSV manda y el JSON es generado: nunca se edita a mano.
 *
 * REGLAS DE CONVERSION
 *  - "Pendiente" (en cualquier caja) y la celda vacia se convierten en null.
 *    En la ficha se imprime "Pendiente", que es lo que significan.
 *  - Los campos numericos que no son un numero limpio se dejan en null y se
 *    avisa por consola, en lugar de colar un NaN a la ficha.
 *  - Los campos de lista se parten por " | ", que es como estan escritos.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENTRADA = path.join(
  AQUI,
  "..",
  "contenido",
  "piezas_MX80",
  "especificaciones_brazo_CW1.csv",
);
const SALIDA = path.join(AQUI, "..", "src", "data", "especificaciones-mx80.json");

/** Lector de CSV con comillas: los campos traen comas y saltos de linea. */
function leerCsv(texto) {
  const filas = [];
  let campo = "";
  let fila = [];
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }

  const encabezado = filas.shift().map((h) => h.replace(/^﻿/, "").trim());
  return filas
    .filter((f) => f.some((v) => v.trim()))
    .map((f) => Object.fromEntries(encabezado.map((h, i) => [h, (f[i] ?? "").trim()])));
}

const PENDIENTE = /^(pendiente|n\/a|no aplica|-)?$/i;

const texto = (v) => (PENDIENTE.test(v.trim()) ? null : v.trim());

function numero(v, sku, columna, avisos) {
  const t = texto(v);
  if (t === null) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) {
    avisos.push(`${sku}: ${columna} = "${t}" no es un numero, queda en null`);
    return null;
  }
  return n;
}

const lista = (v) => {
  const t = texto(v);
  return t === null ? [] : t.split("|").map((x) => x.trim()).filter(Boolean);
};

const avisos = [];
const filas = leerCsv(readFileSync(ENTRADA, "utf8"));
const salida = {};

for (const f of filas) {
  const sku = f.sku;
  if (!/^MX\d{2}-\d{3}(-\d{2})?$/.test(sku)) {
    avisos.push(`fila ignorada: SKU invalido "${sku}"`);
    continue;
  }
  salida[sku] = {
    especificaciones: {
      masa_g: numero(f.masa_g, sku, "masa_g", avisos),
      largo_mm: numero(f.largo_mm, sku, "largo_mm", avisos),
      ancho_mm: numero(f.ancho_mm, sku, "ancho_mm", avisos),
      alto_mm: numero(f.alto_mm, sku, "alto_mm", avisos),
      material: texto(f.material),
      acabado: texto(f.acabado),
      tolerancia_mm: numero(f.tolerancia_mm, sku, "tolerancia_mm", avisos),
      par_apriete_nm: numero(f.par_apriete_nm, sku, "par_apriete_nm", avisos),
      proveedor: texto(f.proveedor),
      parte_proveedor: texto(f.parte_proveedor),
      fuente: lista(f.fuente),
      notas: texto(f.notas),
    },
    categoria: texto(f.categoria),
    proceso_fabricacion: texto(f.proceso_fabricacion),
    descripcion_funcional: texto(f.descripcion_funcional),
    especificaciones_tecnicas: lista(f.especificaciones_tecnicas),
  };
}

// JSON no admite comentarios, asi que la advertencia de "no editar a mano" va
// como una clave mas dentro del propio archivo generado.
writeFileSync(
  SALIDA,
  JSON.stringify(
    {
      _generado_por: "scripts/importar_specs.mjs a partir del CSV — no editar a mano",
      piezas: salida,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

const subpiezas = Object.keys(salida).filter((k) => k.length > 8).length;
const conCota = Object.values(salida).filter((p) => p.especificaciones.largo_mm).length;
const conMasa = Object.values(salida).filter((p) => p.especificaciones.masa_g).length;

console.log(`\n[MXD] ${Object.keys(salida).length} piezas importadas -> ${path.relative(process.cwd(), SALIDA)}`);
console.log(`      piezas de catalogo: ${Object.keys(salida).length - subpiezas}   subpiezas: ${subpiezas}`);
console.log(`      con cotas: ${conCota}   con masa: ${conMasa}`);
if (avisos.length) {
  console.log("\n[MXD] avisos:");
  for (const a of avisos) console.log(`      ${a}`);
}
console.log();
