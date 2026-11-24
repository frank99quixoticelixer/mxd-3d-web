/**
 * Cortes del BOM: una foto con nombre del BOM completo ("BOM al cierre de
 * diciembre"), guardada en `bom_cortes`. Sirve para volver a ver, y bajar como
 * Excel, como estaba el BOM en un momento dado sin depender de recorrer el
 * historial campo por campo.
 *
 * Un corte no se edita ni se restaura sobre el BOM vivo: es solo de consulta.
 * Para deshacer un cambio concreto esta "Restaurar" en /historial.
 *
 * Solo servidor (usa mysql2).
 */
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { leerBom, normalizarFila, type AutorBom, type FilaBom } from "./bom";
import { obtenerPool } from "./db";

export const LARGO_MAXIMO_NOMBRE_CORTE = 120;

export interface CorteBom {
  id: number;
  nombre: string;
  piezas: number;
  /** Correo de quien lo creo; null si lo hizo un script. */
  creadoPor: string | null;
  fecha: Date | string;
}

function pool() {
  const p = obtenerPool();
  if (!p) throw new Error("La base de datos no esta configurada (DB_NOMBRE, DB_USUARIO, DB_CLAVE).");
  return p;
}

/**
 * Guarda el BOM tal como esta ahora bajo un nombre. Devuelve el id del corte, o
 * null si el nombre esta vacio o es demasiado largo.
 */
export async function crearCorte(nombreCrudo: string, autor: AutorBom): Promise<number | null> {
  const nombre = nombreCrudo.trim().replace(/\s+/g, " ");
  if (!nombre || nombre.length > LARGO_MAXIMO_NOMBRE_CORTE) return null;

  const filas = [...(await leerBom()).values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const [resultado] = await pool().query<ResultSetHeader>(
    "INSERT INTO bom_cortes (nombre, piezas, datos, creado_por, creado_por_correo, fecha) VALUES (?, ?, ?, ?, ?, ?)",
    [nombre, filas.length, JSON.stringify(filas), autor.id, autor.correo, new Date()],
  );
  return resultado.insertId;
}

/** Los cortes, del mas nuevo al mas viejo (sin su contenido). */
export async function leerCortes(): Promise<CorteBom[]> {
  const [filas] = await pool().query<RowDataPacket[]>(
    "SELECT id, nombre, piezas, creado_por_correo, fecha FROM bom_cortes ORDER BY fecha DESC, id DESC LIMIT 200",
  );
  return filas.map((f) => ({
    id: Number(f.id),
    nombre: String(f.nombre),
    piezas: Number(f.piezas),
    creadoPor: f.creado_por_correo === null ? null : String(f.creado_por_correo),
    fecha: f.fecha as Date | string,
  }));
}

/** Un corte con sus filas, o null si no existe. */
export async function leerCorte(id: number): Promise<(CorteBom & { filas: FilaBom[] }) | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const [registros] = await pool().query<RowDataPacket[]>(
    "SELECT id, nombre, piezas, creado_por_correo, fecha, datos FROM bom_cortes WHERE id = ? LIMIT 1",
    [id],
  );
  const r = registros[0];
  if (!r) return null;
  const crudas = JSON.parse(String(r.datos)) as Record<string, unknown>[];
  return {
    id: Number(r.id),
    nombre: String(r.nombre),
    piezas: Number(r.piezas),
    creadoPor: r.creado_por_correo === null ? null : String(r.creado_por_correo),
    fecha: r.fecha as Date | string,
    filas: crudas.map((fila) => normalizarFila(fila)),
  };
}
