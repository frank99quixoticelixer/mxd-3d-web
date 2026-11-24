/**
 * El maestro de partes (el Excel oficial de los administrativos) dentro de la
 * base de datos, tabla `maestro_partidas`.
 *
 * Por que en la base y no en el repo: el repo es publico y el maestro trae
 * numeros OEM, proveedores y notas de calidad. `data/maestro-mx80.json` guarda
 * solo lo minimo para cruzar con el catalogo (numero, nombre, cantidad...);
 * todo lo demas esta aqui.
 *
 * Cada partida guarda sus columnas por el TITULO que tienen en el Excel
 * ("No. parte MXD", "Criticidad"...), asi que agregar una columna al maestro no
 * pide cambiar la tabla.
 *
 * Solo servidor (usa mysql2).
 */
import type { RowDataPacket } from "mysql2/promise";

import { obtenerPool } from "./db";

export type ValorMaestro = string | number | boolean | null;

export interface PartidaMaestro {
  numero: string;
  /** Posicion de la fila en el Excel; el export respeta este orden. */
  orden: number;
  /** Columnas por titulo, tal como estan en el Excel. */
  datos: Record<string, ValorMaestro>;
}

function pool() {
  const p = obtenerPool();
  if (!p) throw new Error("La base de datos no esta configurada (DB_NOMBRE, DB_USUARIO, DB_CLAVE).");
  return p;
}

/** Las partidas del maestro en el orden del Excel. Vacio si aun no se importo. */
export async function leerMaestro(): Promise<PartidaMaestro[]> {
  const [filas] = await pool().query<RowDataPacket[]>(
    "SELECT numero, orden, datos FROM maestro_partidas ORDER BY orden, numero",
  );
  return filas.map((f) => ({
    numero: String(f.numero),
    orden: Number(f.orden),
    datos: JSON.parse(String(f.datos)) as Record<string, ValorMaestro>,
  }));
}

/**
 * Reemplaza el contenido del maestro por estas partidas, en una transaccion: o
 * queda todo o no cambia nada. Es la importacion desde el Excel
 * (scripts/importar-maestro-a-base.ts); la app no edita el maestro.
 */
export async function reemplazarMaestro(partidas: PartidaMaestro[]): Promise<void> {
  const conexion = await pool().getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query("DELETE FROM maestro_partidas");
    const ahora = new Date();
    for (const p of partidas) {
      await conexion.query(
        "INSERT INTO maestro_partidas (numero, orden, datos, actualizado_en) VALUES (?, ?, ?, ?)",
        [p.numero, p.orden, JSON.stringify(p.datos), ahora],
      );
    }
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

/**
 * Los campos que una persona edito en la web, como "SKU|campo". Sirve para que
 * el Excel distinga un dato capturado a mano de uno que la pieza trae del
 * catalogo del 3D (esos no tienen renglon en el historial).
 */
export async function leerCamposEditados(): Promise<Set<string>> {
  const [filas] = await pool().query<RowDataPacket[]>("SELECT DISTINCT sku, campo FROM bom_cambios");
  return new Set(filas.map((f) => `${f.sku}|${f.campo}`));
}
