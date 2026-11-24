/**
 * Tablas del BOM en la base de datos (ver docs/plan-usuarios-interna.md).
 *
 * Solo sentencias SQL, sin imports: las usan `scripts/db-migrar.ts` y no deben
 * arrastrar el catalogo ni el esquema de piezas.
 *
 * La base de Hostinger es MariaDB (11.x), no MySQL. Alli `JSON` es un alias de
 * LONGTEXT con una comprobacion de que sea JSON valido, y el driver devuelve el
 * texto sin parsear: lib/bom.ts lo parsea a mano para que funcione igual en las
 * dos.
 *
 * `usuario_id` apunta a `user.id` (varchar 36) pero NO es llave foranea a
 * proposito: una cuenta se da de baja con activo = 0, no se borra, y el
 * historial no debe depender de que la fila de la cuenta siga ahi. Por eso
 * `bom_cambios` guarda tambien el correo de quien edito.
 */

export const DDL_BOM_PIEZAS = `
CREATE TABLE IF NOT EXISTS bom_piezas (
  sku VARCHAR(64) NOT NULL,
  datos JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  actualizado_por VARCHAR(36) NULL,
  actualizado_en DATETIME(3) NOT NULL,
  PRIMARY KEY (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export const DDL_BOM_CAMBIOS = `
CREATE TABLE IF NOT EXISTS bom_cambios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(64) NOT NULL,
  campo VARCHAR(64) NOT NULL,
  anterior TEXT NULL,
  nuevo TEXT NULL,
  usuario_id VARCHAR(36) NULL,
  usuario_correo VARCHAR(255) NULL,
  fecha DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_bom_cambios_sku_fecha (sku, fecha),
  KEY idx_bom_cambios_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/**
 * Cortes del BOM (lib/bom-cortes.ts): una foto con nombre del BOM completo.
 * `datos` es LONGTEXT con el JSON de todas las filas; no se consulta por dentro.
 */
export const DDL_BOM_CORTES = `
CREATE TABLE IF NOT EXISTS bom_cortes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  piezas INT UNSIGNED NOT NULL,
  datos LONGTEXT NOT NULL,
  creado_por VARCHAR(36) NULL,
  creado_por_correo VARCHAR(255) NULL,
  fecha DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_bom_cortes_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/** Nombre de la tabla y su sentencia, en el orden en que se crean. */
export const TABLAS_BOM: { tabla: string; ddl: string }[] = [
  { tabla: "bom_piezas", ddl: DDL_BOM_PIEZAS },
  { tabla: "bom_cambios", ddl: DDL_BOM_CAMBIOS },
  { tabla: "bom_cortes", ddl: DDL_BOM_CORTES },
];
