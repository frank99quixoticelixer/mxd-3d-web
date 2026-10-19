/**
 * Genera el render de cada pieza del catalogo desde el archivo de Blender.
 *
 *   npm run renders:generar
 *   npm run renders:generar -- --solo=MX80-007,MX80-013
 *   npm run renders:generar -- --archivo=blender/otro.blend
 *   npm run renders:generar -- --sin-copiar   (solo deja los JPG en blender/salida/)
 *
 * 1. Toma el .blend (o .glb) de blender/. Si hay varios, el mas reciente.
 * 2. Decide que objetos forman cada pieza con las MISMAS reglas del visor de
 *    la ficha (seleccionDePieza y nodosDeSeleccion en componentes.ts), sobre
 *    el arbol de nodos del GLB del sitio. Asi el render y el 3D de la ficha
 *    muestran exactamente lo mismo.
 * 3. Corre Blender sin interfaz con blender/render_piezas.py.
 * 4. Copia cada JPG a public/renders/<SKU>.jpg. La ficha lo toma sola: el
 *    catalogo usa ese archivo si la pieza no declara otra imagen.
 *
 * Los tornillos no se renderizan.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as THREE from "three";

import { GLB_FRAME } from "@/config/modelos3d";
import { PIEZAS_MX80 } from "@/data/mx80";
import {
  GLB_TUERCA_DETALLADA,
  nodosDeSeleccion,
  seleccionDePieza,
} from "@/features/viewer/componentes";
import type { Pieza } from "@/lib/esquema";

const RAIZ = process.cwd();
const CARPETA_BLENDER = path.join(RAIZ, "blender");
const SALIDA = path.join(CARPETA_BLENDER, "salida");
const RENDERS = path.join(RAIZ, "public", "renders");

const argumento = (nombre: string) =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split("=")[1];

/** Un tornillo no lleva render: por su nombre o por el de sus nodos. */
function esTornillo(p: Pieza): boolean {
  if (/^tornillo/i.test(p.nombre)) return true;
  return (
    p.nombresBlender.length > 0 &&
    p.nombresBlender.every((n) => /^(m\d+x\d+|tornillo)/i.test(n))
  );
}

/** El archivo de entrada: el pedido con --archivo, o el mas reciente de blender/. */
function archivoDeEntrada(): string {
  const pedido = argumento("archivo");
  if (pedido) return path.resolve(RAIZ, pedido);
  const candidatos = existsSync(CARPETA_BLENDER)
    ? readdirSync(CARPETA_BLENDER)
        .filter((f) => /\.(blend|glb)$/i.test(f))
        .map((f) => path.join(CARPETA_BLENDER, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    : [];
  if (candidatos.length === 0) {
    throw new Error("No hay ningun .blend ni .glb en apps/vitrina/blender/. Pon ahi el archivo del dron.");
  }
  return candidatos[0];
}

/** blender.exe: la variable BLENDER, o la version mas nueva instalada. */
function rutaBlender(): string {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = "C:/Program Files/Blender Foundation";
  if (existsSync(base)) {
    const versiones = readdirSync(base)
      .filter((d) => existsSync(path.join(base, d, "blender.exe")))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (versiones.length > 0) return path.join(base, versiones[0], "blender.exe");
  }
  return "blender";
}

/** El arbol de nodos de un GLB, sin geometria: basta para resolver nombres. */
function arbolDeGlb(rutaPublica: string): THREE.Object3D {
  const b = readFileSync(path.join(RAIZ, "public", rutaPublica));
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const sanear = (n?: string) => (n ?? "").replace(/\s/g, "_").replace(/[[\].:/]/g, "");
  const nodos: THREE.Object3D[] = json.nodes.map((n: { name?: string; mesh?: number }) => {
    const o = n.mesh !== undefined ? new THREE.Mesh() : new THREE.Object3D();
    o.name = sanear(n.name);
    return o;
  });
  json.nodes.forEach((n: { children?: number[] }, i: number) =>
    (n.children ?? []).forEach((c) => nodos[i].add(nodos[c])),
  );
  const raiz = new THREE.Group();
  for (const i of json.scenes[json.scene ?? 0].nodes) raiz.add(nodos[i]);
  return raiz;
}

function main() {
  const entrada = archivoDeEntrada();
  const solo = argumento("solo")?.split(",").map((s) => s.trim());

  const completo = arbolDeGlb(GLB_FRAME);
  const tuerca = arbolDeGlb(GLB_TUERCA_DETALLADA);
  const porSku = new Map(PIEZAS_MX80.map((p) => [p.sku, p]));
  const ancestros = (sku: string) => {
    const lista: string[] = [];
    let padre = porSku.get(sku)?.parteDe ?? null;
    while (padre) {
      lista.push(padre);
      padre = porSku.get(padre)?.parteDe ?? null;
    }
    return lista;
  };
  const nombresDescendientes = (sku: string): string[] =>
    PIEZAS_MX80.filter((p) => p.parteDe === sku).flatMap((p) => [
      ...p.nombresBlender,
      ...nombresDescendientes(p.sku),
    ]);

  const omitidosTornillo: string[] = [];
  const mapa = PIEZAS_MX80.filter((p) => !solo || solo.includes(p.sku)).flatMap((p) => {
    if (esTornillo(p)) {
      omitidosTornillo.push(p.sku);
      return [];
    }
    const seleccion = seleccionDePieza(
      p.sku,
      p.nombresBlender,
      ancestros(p.sku),
      nombresDescendientes(p.sku),
    );
    const nodos = nodosDeSeleccion(seleccion.fuente ? tuerca : completo, seleccion);
    return [
      {
        sku: p.sku,
        nodos: nodos.map((n) => n.name),
        nombres: [...seleccion.nombres, ...seleccion.nombresSubpiezas],
      },
    ];
  });

  mkdirSync(SALIDA, { recursive: true });
  const rutaMapa = path.join(SALIDA, "mapa.json");
  writeFileSync(rutaMapa, JSON.stringify(mapa, null, 2));

  const blender = rutaBlender();
  const script = path.join(CARPETA_BLENDER, "render_piezas.py");
  const esGlb = /\.glb$/i.test(entrada);
  console.log(`[MXD] ${mapa.length} piezas a renderizar (${omitidosTornillo.length} tornillos omitidos)`);
  console.log(`[MXD] Blender: ${blender}`);
  console.log(`[MXD] Archivo: ${path.relative(RAIZ, entrada)}\n`);
  execFileSync(
    blender,
    esGlb
      ? ["-b", "--factory-startup", "-P", script, "--", rutaMapa, SALIDA, entrada]
      : ["-b", entrada, "-P", script, "--", rutaMapa, SALIDA],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  const resultado = JSON.parse(readFileSync(path.join(SALIDA, "resultado.json"), "utf8")) as {
    renderizadas: string[];
    sin_objetos: string[];
  };
  const copiar = !process.argv.includes("--sin-copiar");
  if (copiar) {
    mkdirSync(RENDERS, { recursive: true });
    for (const sku of resultado.renderizadas) {
      copyFileSync(path.join(SALIDA, `${sku}.jpg`), path.join(RENDERS, `${sku}.jpg`));
    }
  }

  console.log(
    `\n[MXD] Listo: ${resultado.renderizadas.length} renders ${
      copiar ? "copiados a public/renders/" : "en blender/salida/ (sin copiar)"
    }.`,
  );
  if (resultado.sin_objetos.length > 0) {
    console.log(
      `[MXD] Sin objetos en el archivo (revisa sus nombresBlender en data/mx80.ts): ${resultado.sin_objetos.join(", ")}`,
    );
  }
  console.log(`[MXD] Tornillos omitidos: ${omitidosTornillo.join(", ") || "ninguno"}`);
}

main();
