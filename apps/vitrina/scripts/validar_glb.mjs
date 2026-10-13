/**
 * Revisa que cada GLB de public/ este entero: que el tamanio que declara su
 * encabezado coincida con el del archivo y que ningun buffer ni accessor se
 * salga de sus datos.
 *
 * POR QUE EXISTE: una regla de .gitattributes trataba los GLB como texto, y
 * git les cambio CRLF por LF al commitearlos. Los archivos quedaron unos bytes
 * mas cortos, el visor del catalogo los recibia en blanco y el unico aviso era
 * "Invalid typed array length" en la consola del navegador.
 *
 *   npm run glb:validar
 *
 * Sale con codigo 1 si algun archivo esta danado.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RAIZ = path.join(process.cwd(), "public");
const COMPONENTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function* glbs(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* glbs(ruta);
    else if (nombre.toLowerCase().endsWith(".glb")) yield ruta;
  }
}

function revisar(ruta) {
  const b = readFileSync(ruta);
  if (b.length < 20 || b.toString("latin1", 0, 4) !== "glTF") {
    return ["no empieza con glTF (puede ser un puntero de Git LFS)"];
  }
  const errores = [];
  const declarado = b.readUInt32LE(8);
  if (declarado !== b.length) {
    errores.push(`el encabezado dice ${declarado} bytes y el archivo tiene ${b.length}`);
  }
  const largoJson = b.readUInt32LE(12);
  let json;
  try {
    json = JSON.parse(b.toString("utf8", 20, 20 + largoJson));
  } catch {
    return [...errores, "el bloque JSON no se puede leer"];
  }
  const inicioBin = 20 + largoJson;
  if (inicioBin + 8 <= b.length) {
    const largoBin = b.readUInt32LE(inicioBin);
    if (inicioBin + 8 + largoBin > b.length) {
      errores.push(`el bloque binario (${largoBin} bytes) se sale del archivo`);
    }
  }
  for (const [i, v] of (json.bufferViews ?? []).entries()) {
    const buffer = json.buffers?.[v.buffer];
    if (buffer && (v.byteOffset ?? 0) + v.byteLength > buffer.byteLength) {
      errores.push(`bufferView ${i} se sale de su buffer`);
    }
  }
  for (const [i, a] of (json.accessors ?? []).entries()) {
    if (a.bufferView === undefined) continue;
    const v = json.bufferViews[a.bufferView];
    const elemento = COMPONENTES[a.type] * BYTES[a.componentType];
    const paso = v.byteStride ?? elemento;
    const fin = (a.byteOffset ?? 0) + paso * (a.count - 1) + elemento;
    if (fin > v.byteLength) errores.push(`accessor ${i} se sale de su bufferView`);
  }
  return errores;
}

let danados = 0;
let total = 0;
for (const ruta of glbs(RAIZ)) {
  total++;
  const errores = revisar(ruta);
  if (errores.length > 0) {
    danados++;
    console.error(`DANADO ${path.relative(process.cwd(), ruta)}: ${errores.slice(0, 3).join("; ")}`);
  }
}
console.log(`${total} GLB revisados, ${danados} danados.`);
process.exit(danados > 0 ? 1 : 0);
