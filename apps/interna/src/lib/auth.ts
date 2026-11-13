import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import type { RowDataPacket } from "mysql2/promise";

import { obtenerPool } from "@/lib/db";

/**
 * Cuentas individuales de interna (ADR 0006).
 *
 * Better Auth se usa SOLO desde el servidor, llamando a `auth.api.*` desde
 * acciones de servidor, el proxy y los scripts. No se monta su ruta HTTP
 * (`/api/auth/*`): nada la necesita, y una ruta que no se usa es superficie
 * expuesta sin revisar (SEGURIDAD.md seccion 2). Por lo mismo su limitador de
 * intentos, que vive en esa ruta, no aplica: el de `lib/limite-acceso.ts` es el
 * que frena el inicio de sesion.
 *
 * No hay registro publico: `disableSignUp`. Las cuentas las crea el equipo con
 * `npm run usuarios -- crear <correo>`.
 *
 * Todos los usuarios activos tienen los mismos privilegios (sin roles).
 *
 * Se arma al primer uso y no al importar: `next build` importa los modulos para
 * recolectar paginas y no debe fallar por falta de variables. Si falta
 * configuracion devuelve null y el proxy responde 503 (se cierra, no se abre).
 */

const MINIMO_SECRETO = 32;

function crearAuth() {
  const baseURL = process.env.BETTER_AUTH_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  const pool = obtenerPool();
  if (!baseURL || !secret || secret.length < MINIMO_SECRETO || !pool) return null;

  const enProduccion = process.env.NODE_ENV === "production";

  return betterAuth({
    appName: "MXD interna",
    baseURL,
    secret,
    database: pool,
    trustedOrigins: [baseURL],

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },

    session: {
      // Una semana, y se renueva si la persona entra al menos una vez por dia.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      /**
       * La sesion firmada viaja en la cookie y se valida sin ir a la base
       * durante 60 segundos. Sin esto cada archivo estatico de una pagina
       * (proxy.ts protege tambien /_next/static) costaria una consulta.
       * El precio: una cuenta desactivada sigue entrando hasta 60 segundos.
       */
      cookieCache: { enabled: true, maxAge: 60, strategy: "compact" },
    },

    user: {
      additionalFields: {
        // Dar de baja a alguien = activo en 0. input:false: ningun formulario
        // puede escribirlo, solo los scripts del equipo.
        activo: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },

    advanced: {
      useSecureCookies: enProduccion,
      // La IP que mide el proxy de Hostinger es la ultima entrada; ver
      // ipDelCliente en lib/protegido.ts.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },

    databaseHooks: {
      session: {
        create: {
          // Una cuenta inactiva no puede abrir sesion aunque la contrasena sea
          // correcta.
          before: async (sesion) => {
            const [filas] = await pool.query<RowDataPacket[]>(
              "SELECT activo FROM `user` WHERE id = ? LIMIT 1",
              [sesion.userId],
            );
            if (!filas[0] || !filas[0].activo) {
              throw new APIError("FORBIDDEN", { message: "Cuenta inactiva" });
            }
            return { data: sesion };
          },
        },
      },
    },

    // Debe ir al final: es lo que deja a las acciones de servidor poner la cookie.
    plugins: [nextCookies()],
  });
}

type InstanciaAuth = NonNullable<ReturnType<typeof crearAuth>>;

const almacen = globalThis as typeof globalThis & { __mxdAuth?: InstanciaAuth };

/** La instancia de Better Auth, o null si falta configuracion. */
export function obtenerAuth(): InstanciaAuth | null {
  if (almacen.__mxdAuth) return almacen.__mxdAuth;
  const instancia = crearAuth();
  if (instancia) almacen.__mxdAuth = instancia;
  return instancia;
}
