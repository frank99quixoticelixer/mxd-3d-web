import fs from "node:fs";
import path from "node:path";

/**
 * Agrega a una ruta publica (ej. "/renders/MX80-003.jpg") un parametro de
 * version basado en la fecha real de modificacion del archivo en disco.
 *
 * Por que: los renders se regeneran con el mismo nombre de archivo (el SKU
 * no cambia). Sin esto, el navegador (o una extension, o un proxy) puede
 * quedarse sirviendo la version vieja desde su cache indefinidamente aunque
 * el servidor ya tenga el archivo nuevo, porque la URL nunca cambio.
 * Con el parametro, cada regeneracion produce una URL distinta y fuerza
 * una descarga nueva en cualquier cache.
 *
 * Solo corre en servidor (Server Components): usa fs para leer el archivo
 * real en public/. Si no lo encuentra, devuelve la ruta tal cual en vez de
 * romper el render.
 */
export function conVersion(rutaPublica: string | null | undefined): string | null {
  if (!rutaPublica) return null;
  try {
    const absoluta = path.join(process.cwd(), "public", rutaPublica);
    const { mtimeMs } = fs.statSync(absoluta);
    const separador = rutaPublica.includes("?") ? "&" : "?";
    return `${rutaPublica}${separador}v=${Math.round(mtimeMs)}`;
  } catch {
    return rutaPublica;
  }
}
