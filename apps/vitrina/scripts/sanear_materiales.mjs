#!/usr/bin/env node
/**
 * Corrige valores de material fuera de la norma glTF.
 *
 *   node scripts/sanear_materiales.mjs <archivo.glb>
 *
 * POR QUE EXISTE: algunos exportadores escriben factores PBR fuera de rango.
 * En el MX80 llego un material con metallicFactor = 100 cuando la norma admite
 * de 0 a 1. Un valor asi no se "clampea" solo: three.js lo mete tal cual al
 * shader y la pieza deja de verse como su color base —se vuelve un espejo sin
 * entorno que reflejar— aunque el baseColor sea el correcto.
 *
 * Es sanear, no maquillar: no se inventan colores, solo se recortan los
 * numeros al rango que el formato permite. El color base se respeta.
 *
 * Se corre despues de optimizar, porque la optimizacion conserva los
 * materiales tal cual venian.
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const ruta = process.argv[2];
if (!ruta) {
  console.error("\nUso: node scripts/sanear_materiales.mjs <archivo.glb>\n");
  process.exit(1);
}

/**
 * Materiales que deben verse NEGRO MATE, por indicacion del equipo.
 *
 * Su color base ya sale negro del export; lo que los rompia era el metalico.
 * Un material metalico no usa su color base como pintura sino como reflejo, y
 * sin un entorno que reflejar no se ve negro sino sucio. Poniendo el metalico
 * en 0 queda negro plano, igual que su gemelo "Standard" del mismo modelo.
 *
 * La comparacion es por prefijo y sin distinguir mayusculas, para que
 * sobreviva a los renombres del exportador ("Standard", "standard_2",
 * "Standard_737373"...).
 */
const NEGRO_MATE = ["standard"];

const debeSerNegro = (nombre) =>
  NEGRO_MATE.some((p) => (nombre || "").toLowerCase().startsWith(p));

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const documento = await io.read(ruta);

const correcciones = [];
for (const material of documento.getRoot().listMaterials()) {
  const nombre = material.getName() || "(sin nombre)";

  const metal = material.getMetallicFactor();
  if (metal < 0 || metal > 1) {
    const corregido = Math.min(1, Math.max(0, metal));
    material.setMetallicFactor(corregido);
    correcciones.push(`${nombre}: metallicFactor ${metal} -> ${corregido}`);
  }

  const rugosidad = material.getRoughnessFactor();
  if (rugosidad < 0 || rugosidad > 1) {
    const corregido = Math.min(1, Math.max(0, rugosidad));
    material.setRoughnessFactor(corregido);
    correcciones.push(`${nombre}: roughnessFactor ${rugosidad} -> ${corregido}`);
  }

  if (debeSerNegro(nombre)) {
    if (material.getMetallicFactor() !== 0) {
      material.setMetallicFactor(0);
      correcciones.push(`${nombre}: metalico a 0 para que quede negro mate`);
    }
    if (material.getRoughnessFactor() !== 1) {
      material.setRoughnessFactor(1);
      correcciones.push(`${nombre}: rugosidad a 1 para que quede negro mate`);
    }
  }

  const color = material.getBaseColorFactor();
  const fuera = color.some((c) => c < 0 || c > 1);
  if (fuera) {
    const corregido = color.map((c) => Math.min(1, Math.max(0, c)));
    material.setBaseColorFactor(corregido);
    correcciones.push(`${nombre}: baseColorFactor fuera de rango -> recortado`);
  }
}

if (correcciones.length === 0) {
  console.log(`\n[MXD] ${ruta}: todos los materiales dentro de norma.\n`);
  process.exit(0);
}

await io.write(ruta, documento);
console.log(`\n[MXD] ${ruta}: ${correcciones.length} correccion(es)`);
for (const c of correcciones) console.log(`      ${c}`);
console.log();
