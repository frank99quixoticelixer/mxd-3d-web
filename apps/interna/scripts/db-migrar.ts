/**
 * Crea o actualiza las tablas de cuentas en la base (user, session, account y
 * verification, de Better Auth).
 *
 *   npm run db:migrar                muestra que haria
 *   npm run db:migrar -- --aplicar   lo aplica
 *
 * Lee la conexion de .env.local (DB_*, BETTER_AUTH_*). Es seguro repetirlo:
 * solo agrega lo que falta y no borra nada.
 */
import { getMigrations } from "better-auth/db/migration";

import { obtenerAuth } from "../src/lib/auth";

const auth = obtenerAuth();
if (!auth) {
  console.error(
    "Falta configuracion. Define DB_NOMBRE, DB_USUARIO, DB_CLAVE, BETTER_AUTH_URL y BETTER_AUTH_SECRET (32 caracteres o mas) en apps/interna/.env.local.",
  );
  process.exit(1);
}

async function main() {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth!.options);

  if (toBeCreated.length === 0 && toBeAdded.length === 0) {
    console.log("Las tablas ya estan al dia.");
    return;
  }

  for (const t of toBeCreated) console.log(`Crear tabla:   ${t.table}`);
  for (const t of toBeAdded) console.log(`Agregar a:     ${t.table} (${Object.keys(t.fields).join(", ")})`);

  if (!process.argv.includes("--aplicar")) {
    console.log("\nNo se cambio nada. Repite con --aplicar para ejecutarlo.");
    return;
  }

  await runMigrations();
  console.log("\nListo.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
