/**
 * Altas y bajas de cuentas de interna (no hay registro publico: ADR 0006).
 *
 *   npm run usuarios -- crear <correo> "<Nombre completo>"
 *   npm run usuarios -- desactivar <correo>
 *   npm run usuarios -- activar <correo>
 *   npm run usuarios -- listar
 *
 * `crear` pide la contrasena en la terminal sin mostrarla (12 caracteres o
 * mas). Nunca se pasa por argumento: quedaria en el historial del shell.
 * Lee la conexion de .env.local.
 *
 * Desactivar cierra tambien las sesiones abiertas; el navegador de esa persona
 * deja de entrar en cuanto vence su cache de sesion (60 segundos).
 */
import type { RowDataPacket } from "mysql2/promise";

import { obtenerAuth } from "../src/lib/auth";
import { obtenerPool } from "../src/lib/db";

const [, , comando, correoCrudo, ...resto] = process.argv;

const auth = obtenerAuth();
const pool = obtenerPool();
if (!auth || !pool) {
  console.error(
    "Falta configuracion. Define DB_NOMBRE, DB_USUARIO, DB_CLAVE, BETTER_AUTH_URL y BETTER_AUTH_SECRET en apps/interna/.env.local.",
  );
  process.exit(1);
}

const correo = correoCrudo?.trim().toLowerCase();

/** Lee una linea de la terminal sin hacer eco de lo que se escribe. */
function pedirClave(pregunta: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const entrada = process.stdin;
    if (!entrada.isTTY) {
      rechazar(new Error("Hace falta una terminal interactiva para escribir la contrasena."));
      return;
    }
    process.stdout.write(pregunta);
    let texto = "";
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    const alRecibir = (tecla: string) => {
      for (const c of tecla) {
        if (c === "\r" || c === "\n") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", alRecibir);
          process.stdout.write("\n");
          resolver(texto);
          return;
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") texto = texto.slice(0, -1);
        else texto += c;
      }
    };
    entrada.on("data", alRecibir);
  });
}

async function crear() {
  const nombre = resto.join(" ").trim();
  if (!correo || !correo.includes("@") || !nombre) {
    console.error('Uso: npm run usuarios -- crear <correo> "<Nombre completo>"');
    process.exit(1);
  }
  const ctx = await auth!.$context;
  if (await ctx.internalAdapter.findUserByEmail(correo)) {
    console.error(`Ya existe una cuenta con ${correo}.`);
    process.exit(1);
  }

  const clave = await pedirClave("Contrasena (12 caracteres o mas): ");
  if (clave.length < 12 || clave.length > 128) {
    console.error("La contrasena debe tener entre 12 y 128 caracteres.");
    process.exit(1);
  }
  if (clave !== (await pedirClave("Repite la contrasena: "))) {
    console.error("Las contrasenas no coinciden.");
    process.exit(1);
  }

  // signUpEmail esta cerrado a proposito (disableSignUp), asi que se crea por
  // el adaptador interno: el mismo hash scrypt que usa el inicio de sesion.
  const usuario = await ctx.internalAdapter.createUser(
    {
      email: correo,
      name: nombre,
      emailVerified: true,
      activo: true,
    },
    // Mismo origen que declara el registro por correo de Better Auth.
    { method: "email-password" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: usuario.id,
    providerId: "credential",
    accountId: usuario.id,
    password: await ctx.password.hash(clave),
  });
  console.log(`Cuenta creada: ${correo}`);
}

async function cambiarEstado(activo: boolean) {
  if (!correo) {
    console.error(`Uso: npm run usuarios -- ${activo ? "activar" : "desactivar"} <correo>`);
    process.exit(1);
  }
  const [resultado] = await pool!.query("UPDATE `user` SET activo = ? WHERE email = ?", [
    activo ? 1 : 0,
    correo,
  ]);
  if (!("affectedRows" in resultado) || resultado.affectedRows === 0) {
    console.error(`No existe una cuenta con ${correo}.`);
    process.exit(1);
  }
  if (!activo) {
    await pool!.query(
      "DELETE FROM `session` WHERE userId IN (SELECT id FROM `user` WHERE email = ?)",
      [correo],
    );
  }
  console.log(`${correo}: ${activo ? "activa" : "desactivada, sesiones cerradas"}`);
}

async function listar() {
  const [filas] = await pool!.query<RowDataPacket[]>(
    "SELECT email, name, activo, createdAt FROM `user` ORDER BY createdAt",
  );
  if (filas.length === 0) console.log("No hay cuentas todavia.");
  for (const f of filas) {
    console.log(`${f.activo ? "activa  " : "inactiva"}  ${f.email}  ${f.name}`);
  }
}

async function main() {
  switch (comando) {
    case "crear":
      await crear();
      break;
    case "desactivar":
      await cambiarEstado(false);
      break;
    case "activar":
      await cambiarEstado(true);
      break;
    case "listar":
      await listar();
      break;
    default:
      console.error("Comandos: crear, desactivar, activar, listar");
      process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
