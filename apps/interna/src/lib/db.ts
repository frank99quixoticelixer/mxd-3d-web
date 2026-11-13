import { createPool, type Pool } from "mysql2/promise";

/**
 * Conexion a MySQL (la base que incluye Hostinger).
 *
 * Solo corre en el servidor: nada de esto puede importarse desde un componente
 * de cliente. Las credenciales vienen de variables de entorno (hPanel en
 * produccion, .env.local en local) y NUNCA se hornean en el bundle: se leen la
 * primera vez que se pide el pool.
 *
 * Desde la app se conecta a 127.0.0.1, no al host srvNNNN.hstgr.io: ese solo
 * sirve desde fuera de Hostinger. "localhost" tambien se evita porque en Node
 * puede resolver a IPv6 (::1) y no todos los usuarios de la base tienen ese
 * permiso.
 *
 * Devuelve null si falta configuracion. Quien llama decide como cerrar: el
 * proxy responde 503, que es lo que evita que un olvido de configuracion deje
 * el panel abierto.
 */

type Almacen = { pool?: Pool | null };

/**
 * Se guarda en globalThis para que el recargado en caliente de `next dev` no
 * abra un pool nuevo en cada edicion y agote las conexiones de la base.
 */
const almacen = globalThis as typeof globalThis & { __mxdDb?: Almacen };
const estado: Almacen = (almacen.__mxdDb ??= {});

export function obtenerPool(): Pool | null {
  if (estado.pool !== undefined) return estado.pool;

  const { DB_HOST, DB_PUERTO, DB_NOMBRE, DB_USUARIO, DB_CLAVE } = process.env;
  if (!DB_NOMBRE || !DB_USUARIO || !DB_CLAVE) {
    // No se guarda el null: si la variable aparece despues (por ejemplo al
    // reiniciar), la siguiente llamada ya la ve.
    return null;
  }

  estado.pool = createPool({
    host: DB_HOST || "127.0.0.1",
    port: Number(DB_PUERTO) || 3306,
    database: DB_NOMBRE,
    user: DB_USUARIO,
    password: DB_CLAVE,
    // Better Auth lo pide: sin esto las fechas se desfasan segun la zona del servidor.
    timezone: "Z",
    // Pocas personas usan el panel; un pool chico no agota el limite de
    // conexiones del plan compartido.
    connectionLimit: 5,
    connectTimeout: 5000,
  });
  return estado.pool;
}
