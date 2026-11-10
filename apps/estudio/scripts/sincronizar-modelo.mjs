#!/usr/bin/env node
/**
 * Espeja el modelo del dron desde apps/vitrina/protegido a apps/estudio/public.
 *
 * En la vitrina los GLB van en protegido/ (ADR 0005). El estudio solo corre en
 * local y no se despliega, asi que aqui si puede servirlo desde public/.
 *
 * El GLB vive una sola vez en git, en la vitrina (ver CLAUDE.md, "Archivos de
 * modelos"). El estudio lo copia antes de dev y build, solo si cambio
 * (tamano o fecha), igual que el espejo de interna.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = path.join(AQUI, "..", "..", "vitrina", "protegido");
const DESTINO = path.join(AQUI, "..", "public");

/** Lo que el estudio usa. Un modelo nuevo se agrega aqui y en src/config.ts. */
const ARCHIVOS = ["models/mx80/MX80_completo_v6_web.glb"];

let copiados = 0;
for (const rel of ARCHIVOS) {
  const de = path.join(ORIGEN, rel);
  const a = path.join(DESTINO, rel);
  if (!existsSync(de)) {
    console.error(`[estudio] No existe ${de}`);
    process.exit(1);
  }
  const igual =
    existsSync(a) &&
    statSync(a).size === statSync(de).size &&
    statSync(a).mtimeMs >= statSync(de).mtimeMs;
  if (igual) continue;
  mkdirSync(path.dirname(a), { recursive: true });
  copyFileSync(de, a);
  copiados++;
}
console.log(`[estudio] modelo sincronizado: ${copiados} copiado(s), ${ARCHIVOS.length - copiados} sin cambios.`);
