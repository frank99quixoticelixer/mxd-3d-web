/**
 * Crea o actualiza las tablas de la base: las de cuentas (user, session,
 * account, verification, de Better Auth) y las del BOM (bom_piezas,
 * bom_cambios).
 *
 *   npm run db:migrar                muestra que haria
 *   npm run db:migrar -- --aplicar   lo aplica
 *
 * Lee la conexion de .env.local (DB_*, BETTER_AUTH_*). Es seguro repetirlo:
 * solo agrega lo que falta y no borra nada.
 */
import { getMigrations } from "better-auth/db/migration";
import type { RowDataPacket } from "mysql2/promise";

import { obtenerAuth } from "../src/lib/auth";
import { TABLAS_BOM } from "../src/lib/bom-tablas";
import { obtenerPool } from "../src/lib/db";

const auth = obtenerAuth();
const pool = obtenerPool();
if (!auth || !pool) {
  console.error(
    "Falta configuracion. Define DB_NOMBRE, DB_USUARIO, DB_CLAVE, BETTER_AUTH_URL y BETTER_AUTH_SECRET (32 caracteres o mas) en apps/interna/.env.local.",
  );
  process.exit(1);
}

async function main() {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth!.options);

  const [existentes] = await pool!.query<RowDataPacket[]>(
    "SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const yaEstan = new Set(existentes.map((f) => String(f.nombre).toLowerCase()));
  const tablasBomFaltantes = TABLAS_BOM.filter((t) => !yaEstan.has(t.tabla));

  if (toBeCreated.length === 0 && toBeAdded.length === 0 && tablasBomFaltantes.length === 0) {
    console.log("Las tablas ya estan al dia.");
    return;
  }

  for (const t of toBeCreated) console.log(`Crear tabla:   ${t.table}`);
  for (const t of toBeAdded) console.log(`Agregar a:     ${t.table} (${Object.keys(t.fields).join(", ")})`);
  for (const t of tablasBomFaltantes) console.log(`Crear tabla:   ${t.tabla}`);

  if (!process.argv.includes("--aplicar")) {
    console.log("\nNo se cambio nada. Repite con --aplicar para ejecutarlo.");
    return;
  }

  if (toBeCreated.length > 0 || toBeAdded.length > 0) await runMigrations();
  for (const t of tablasBomFaltantes) await pool!.query(t.ddl);
  console.log("\nListo.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
