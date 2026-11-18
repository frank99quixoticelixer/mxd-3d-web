/**
 * Capa de lectura/escritura del BOM editable (especificaciones + compras +
 * inventario + costos + trazabilidad): una fila por SKU en la tabla
 * `bom_piezas` de la base de datos.
 *
 * Antes era un Excel en contenido/BOM_MX80.xlsx. El zip que se sube a Hostinger
 * lleva la app completa, asi que una edicion escrita a disco podia perderse en
 * el siguiente despliegue, y dos personas editando a la vez se pisaban. Ahora
 * la fuente de verdad es la base: lo que alguien guarda lo ven todos, cada
 * cambio queda en `bom_cambios` con quien lo hizo, y el Excel se genera al
 * descargarlo (lib/bom-excel.ts).
 *
 * Solo servidor. No importar desde un componente de cliente (usa mysql2); lo
 * que comparte con el cliente vive en lib/campos-ficha.ts.
 *
 * No vive en vitrina ni se sincroniza con ella: es exclusivo de interna.
 */
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { obtenerPool } from "./db";
import { EspecificacionesEsquema, type Especificaciones, type Pieza } from "./esquema";

/**
 * Orden de columnas del BOM (y del Excel que se descarga). Es la unica lista
 * que define "que campos tiene el BOM": la lectura, la escritura, la
 * importacion y la descarga la reusan, asi que agregar una columna es agregar
 * una entrada aqui. En la base los datos van como JSON, asi que una columna
 * nueva no pide ALTER TABLE.
 *
 * "tipo" controla como se lee el formulario y como se escribe la celda del
 * Excel (en la base los valores van tal cual, como JSON):
 *   texto/numero -> tal cual
 *   lista        -> array de string, unido con "; " en la celda
 *   listaCorta   -> array de string, unido con "," en la celda (nombres de
 *                   campo sin espacios, para camposNoAplican)
 */
export type TipoColumna = "texto" | "numero" | "lista" | "listaCorta" | "booleano";
const COLUMNAS: { clave: string; encabezado: string; tipo: TipoColumna }[] = [
  { clave: "sku", encabezado: "SKU", tipo: "texto" },
  { clave: "nombre", encabezado: "Nombre (referencia, no editable aqui)", tipo: "texto" },
  { clave: "categoria", encabezado: "Categoria", tipo: "texto" },
  { clave: "masa_g", encabezado: "Masa (g)", tipo: "numero" },
  { clave: "largo_mm", encabezado: "Largo (mm)", tipo: "numero" },
  { clave: "ancho_mm", encabezado: "Ancho (mm)", tipo: "numero" },
  { clave: "alto_mm", encabezado: "Alto (mm)", tipo: "numero" },
  { clave: "material", encabezado: "Material", tipo: "texto" },
  { clave: "grupo_material", encabezado: "Tipo de material (filtro del visor)", tipo: "texto" },
  { clave: "acabado", encabezado: "Acabado", tipo: "texto" },
  { clave: "tolerancia_mm", encabezado: "Tolerancia general (mm)", tipo: "numero" },
  { clave: "par_apriete_nm", encabezado: "Par de apriete (N·m)", tipo: "numero" },
  { clave: "numero_tornillos", encabezado: "No. de tornillos", tipo: "numero" },
  { clave: "rosca", encabezado: "Rosca", tipo: "texto" },
  { clave: "longitud_mm", encabezado: "Longitud (mm)", tipo: "numero" },
  { clave: "sentido_giro", encabezado: "Sentido de giro", tipo: "texto" },
  { clave: "modulo_conectado", encabezado: "Modulo al que conecta", tipo: "texto" },
  { clave: "volumen_ml", encabezado: "Volumen (mL)", tipo: "numero" },
  { clave: "diametro_tubo_mm", encabezado: "Diametro de tubo (mm)", tipo: "numero" },
  { clave: "grosor_pared_mm", encabezado: "Grosor de pared (mm)", tipo: "numero" },
  { clave: "diametro_barreno_mm", encabezado: "Diametro de barreno (mm)", tipo: "numero" },
  { clave: "ancho_perfil_mm", encabezado: "Ancho de perfil (mm)", tipo: "numero" },
  { clave: "alto_perfil_mm", encabezado: "Alto de perfil (mm)", tipo: "numero" },
  { clave: "motor_kv", encabezado: "Motor: KV (RPM/V)", tipo: "numero" },
  { clave: "motor_voltaje_nominal_v", encabezado: "Motor: voltaje nominal (V)", tipo: "numero" },
  { clave: "motor_rpm_nominal", encabezado: "Motor: RPM nominal", tipo: "numero" },
  { clave: "motor_torque_nominal_nm", encabezado: "Motor: torque nominal (Nm)", tipo: "numero" },
  { clave: "motor_torque_max_nm", encabezado: "Motor: torque maximo (Nm)", tipo: "numero" },
  { clave: "proveedor", encabezado: "Proveedor", tipo: "texto" },
  { clave: "parte_proveedor", encabezado: "No. de parte del proveedor", tipo: "texto" },
  { clave: "numero_parte_mxd", encabezado: "No. parte MXD", tipo: "texto" },
  { clave: "precio_mxn", encabezado: "Precio (MXN)", tipo: "numero" },
  { clave: "stock", encabezado: "Existencias", tipo: "numero" },
  { clave: "proceso_fabricacion", encabezado: "Proceso de fabricacion", tipo: "texto" },
  { clave: "descripcion_funcional", encabezado: "Descripcion funcional", tipo: "texto" },
  { clave: "especificaciones_tecnicas", encabezado: "Requisitos tecnicos", tipo: "lista" },
  { clave: "camposNoAplican", encabezado: "Campos que no aplican", tipo: "listaCorta" },
  { clave: "fuente", encabezado: "Origen del dato", tipo: "lista" },
  { clave: "notas", encabezado: "Notas", tipo: "texto" },
  // -- Costos de produccion. Claves con prefijo costo_ para no chocar con
  // "material" y "notas" de especificaciones (son conceptos distintos: uno es
  // el material que declara el proveedor, el otro el material que de verdad
  // se gasto al producir la pieza).
  { clave: "costo_fabricado_inhouse", encabezado: "Fabricado in-house", tipo: "booleano" },
  { clave: "costo_equipo", encabezado: "Equipo de produccion", tipo: "texto" },
  { clave: "costo_material", encabezado: "Material de produccion", tipo: "texto" },
  { clave: "costo_masa_g", encabezado: "Masa de produccion (g)", tipo: "numero" },
  { clave: "costo_horas_produccion", encabezado: "Horas de produccion", tipo: "numero" },
  { clave: "costo_pintura_mxn", encabezado: "Costo de pintura (MXN)", tipo: "numero" },
  { clave: "costo_mano_obra_mxn", encabezado: "Costo de mano de obra (MXN)", tipo: "numero" },
  { clave: "costo_notas", encabezado: "Notas de costos", tipo: "texto" },
  // -- Trazabilidad de manufactura. Claves con prefijo trazabilidad_, mismo
  // criterio que costo_: columnas del BOM maestro sin equivalente en el resto
  // de este esquema (ver comentario en TrazabilidadEsquema).
  { clave: "trazabilidad_criticidad", encabezado: "Criticidad", tipo: "texto" },
  { clave: "trazabilidad_control_calidad", encabezado: "Control de calidad", tipo: "texto" },
  { clave: "trazabilidad_intercambiable", encabezado: "Interc.", tipo: "booleano" },
  { clave: "trazabilidad_carpeta_pieza", encabezado: "Carpeta de la pieza", tipo: "texto" },
  { clave: "trazabilidad_archivo_step", encabezado: "Archivo STEP", tipo: "booleano" },
  { clave: "trazabilidad_archivo_stl", encabezado: "Archivo STL", tipo: "booleano" },
  // -- Cruce con el maestro de partes (pagina /maestro). El numero de la pieza
  // entera va en numero_parte_mxd; si la pieza tiene versiones (CW/CCW,
  // derecha/izquierda) cada una puede llevar el suyo: "cw=MXD-...; ccw=MXD-...".
  { clave: "cruce_estado", encabezado: "Estado del cruce con el maestro", tipo: "texto" },
  { clave: "numeros_variantes", encabezado: "No. parte MXD por versión", tipo: "texto" },
];

/** Una fila del BOM ya tipada: especificaciones + compras/inventario + metadatos. */
export type FilaBom = Pick<Especificaciones, Exclude<keyof Especificaciones, "fuente">> & {
  sku: string;
  nombre: string;
  categoria: string | null;
  proceso_fabricacion: string | null;
  descripcion_funcional: string | null;
  especificaciones_tecnicas: string[];
  camposNoAplican: string[];
  fuente: string[];
  numero_parte_mxd: string | null;
  precio_mxn: number | null;
  stock: number | null;
  costo_fabricado_inhouse: boolean | null;
  costo_equipo: string | null;
  costo_material: string | null;
  costo_masa_g: number | null;
  costo_horas_produccion: number | null;
  costo_pintura_mxn: number | null;
  costo_mano_obra_mxn: number | null;
  costo_notas: string | null;
  trazabilidad_criticidad: string | null;
  trazabilidad_control_calidad: string | null;
  trazabilidad_intercambiable: boolean | null;
  trazabilidad_carpeta_pieza: string | null;
  trazabilidad_archivo_step: boolean | null;
  trazabilidad_archivo_stl: boolean | null;
  cruce_estado: string | null;
  numeros_variantes: string | null;
};

/** Campos editables desde la UI (todo menos sku/nombre, que no se tocan aqui). */
export type CambiosFilaBom = Partial<Omit<FilaBom, "sku" | "nombre">>;

/** Valida la forma minima de una fila (de la base o de un Excel) (sku no vacio); el resto son los defaults de Zod. */
export function normalizarFila(obj: Record<string, unknown>): FilaBom {
  if (!obj.sku || typeof obj.sku !== "string") {
    throw new Error(`Fila del BOM sin SKU valido: ${JSON.stringify(obj)}`);
  }
  // Las especificaciones "clasicas" se validan con el mismo esquema que usa
  // el resto de la app, para no duplicar reglas (positive(), etc.).
  const especPartial = EspecificacionesEsquema.partial().parse(obj);
  return {
    ...especPartial,
    sku: obj.sku,
    nombre: typeof obj.nombre === "string" ? obj.nombre : "",
    categoria: (obj.categoria as string | null) ?? null,
    proceso_fabricacion: (obj.proceso_fabricacion as string | null) ?? null,
    descripcion_funcional: (obj.descripcion_funcional as string | null) ?? null,
    especificaciones_tecnicas: (obj.especificaciones_tecnicas as string[]) ?? [],
    camposNoAplican: (obj.camposNoAplican as string[]) ?? [],
    fuente: (obj.fuente as string[]) ?? [],
    numero_parte_mxd: (obj.numero_parte_mxd as string | null) ?? null,
    precio_mxn: (obj.precio_mxn as number | null) ?? null,
    stock: (obj.stock as number | null) ?? null,
    costo_fabricado_inhouse: (obj.costo_fabricado_inhouse as boolean | null) ?? null,
    costo_equipo: (obj.costo_equipo as string | null) ?? null,
    costo_material: (obj.costo_material as string | null) ?? null,
    costo_masa_g: (obj.costo_masa_g as number | null) ?? null,
    costo_horas_produccion: (obj.costo_horas_produccion as number | null) ?? null,
    costo_pintura_mxn: (obj.costo_pintura_mxn as number | null) ?? null,
    costo_mano_obra_mxn: (obj.costo_mano_obra_mxn as number | null) ?? null,
    costo_notas: (obj.costo_notas as string | null) ?? null,
    trazabilidad_criticidad: (obj.trazabilidad_criticidad as string | null) ?? null,
    trazabilidad_control_calidad: (obj.trazabilidad_control_calidad as string | null) ?? null,
    trazabilidad_intercambiable: (obj.trazabilidad_intercambiable as boolean | null) ?? null,
    trazabilidad_carpeta_pieza: (obj.trazabilidad_carpeta_pieza as string | null) ?? null,
    trazabilidad_archivo_step: (obj.trazabilidad_archivo_step as boolean | null) ?? null,
    trazabilidad_archivo_stl: (obj.trazabilidad_archivo_stl as boolean | null) ?? null,
    cruce_estado: (obj.cruce_estado as string | null) ?? null,
    numeros_variantes: (obj.numeros_variantes as string | null) ?? null,
  } as FilaBom;
}

/** Quien hace un cambio. `id` es null solo en cargas por script (sin sesion). */
export interface AutorBom {
  id: string | null;
  correo: string | null;
}

/**
 * Se lanza cuando alguien guarda una pieza que otra persona ya cambio desde que
 * se abrio la ficha. La interfaz lo atrapa y avisa en vez de pisar el cambio.
 */
export class ConflictoBom extends Error {
  constructor(public readonly sku: string) {
    super(`${sku} cambio mientras la editabas. Recarga la ficha y vuelve a aplicar tus cambios.`);
    this.name = "ConflictoBom";
  }
}

function poolBom() {
  const pool = obtenerPool();
  if (!pool) {
    throw new Error("La base de datos no esta configurada (DB_NOMBRE, DB_USUARIO, DB_CLAVE).");
  }
  return pool;
}

/**
 * `datos` llega como objeto en MySQL y como texto en MariaDB (donde JSON es un
 * alias de LONGTEXT). Se acepta cualquiera de los dos.
 */
function leerDatos(crudo: unknown): Record<string, unknown> {
  const valor = typeof crudo === "string" ? JSON.parse(crudo) : crudo;
  if (!valor || typeof valor !== "object") throw new Error("bom_piezas.datos no es un objeto JSON.");
  return valor as Record<string, unknown>;
}

function filaDeRegistro(registro: RowDataPacket): FilaBom {
  return normalizarFila({ ...leerDatos(registro.datos), sku: registro.sku });
}

/** Lee el BOM completo. Si la tabla esta vacia, devuelve un mapa vacio. */
export async function leerBom(): Promise<Map<string, FilaBom>> {
  const [registros] = await poolBom().query<RowDataPacket[]>("SELECT sku, datos FROM bom_piezas");
  const mapa = new Map<string, FilaBom>();
  for (const registro of registros) {
    const fila = filaDeRegistro(registro);
    mapa.set(fila.sku, fila);
  }
  return mapa;
}

export async function leerPieza(sku: string): Promise<FilaBom | null> {
  const [registros] = await poolBom().query<RowDataPacket[]>(
    "SELECT sku, datos FROM bom_piezas WHERE sku = ? LIMIT 1",
    [sku],
  );
  return registros[0] ? filaDeRegistro(registros[0]) : null;
}

/**
 * La version actual de una pieza (sube en uno con cada cambio), o 0 si todavia
 * no tiene fila. El formulario de la ficha la manda de vuelta al guardar para
 * que escribirPieza detecte si alguien cambio la pieza mientras se editaba.
 */
export async function leerVersionBom(sku: string): Promise<number> {
  const [registros] = await poolBom().query<RowDataPacket[]>(
    "SELECT version FROM bom_piezas WHERE sku = ? LIMIT 1",
    [sku],
  );
  return registros[0] ? Number(registros[0].version) : 0;
}

/** Una fila del historial del BOM (tabla bom_cambios). */
export interface CambioBom {
  id: number;
  sku: string;
  /** Clave del campo (ver COLUMNAS); usar nombreDeCampo() para mostrarlo. */
  campo: string;
  anterior: string | null;
  nuevo: string | null;
  /** Correo de quien lo cambio; null en cambios hechos por scripts. */
  usuarioCorreo: string | null;
  fecha: Date | string;
}

/** El nombre legible de un campo del BOM, o la clave si no se conoce. */
export function nombreDeCampo(clave: string): string {
  const columna = COLUMNAS.find((c) => c.clave === clave);
  if (!columna) return clave;
  // El encabezado de "nombre" lleva una nota para el Excel que aqui sobra.
  return columna.encabezado.replace(/ \(referencia.*\)$/, "");
}

/**
 * Los cambios mas recientes del BOM, del mas nuevo al mas viejo. Con `sku` solo
 * los de esa pieza. `limite` se acota a 1-1000.
 */
export async function leerCambios(
  opciones: { sku?: string; limite?: number } = {},
): Promise<CambioBom[]> {
  const limite = Math.min(Math.max(Math.trunc(opciones.limite ?? 200), 1), 1000);
  const [filas] = await poolBom().query<RowDataPacket[]>(
    `SELECT id, sku, campo, anterior, nuevo, usuario_correo, fecha FROM bom_cambios ${
      opciones.sku ? "WHERE sku = ?" : ""
    } ORDER BY fecha DESC, id DESC LIMIT ${limite}`,
    opciones.sku ? [opciones.sku] : [],
  );
  return filas.map((f) => ({
    id: Number(f.id),
    sku: String(f.sku),
    campo: String(f.campo),
    anterior: f.anterior === null ? null : String(f.anterior),
    nuevo: f.nuevo === null ? null : String(f.nuevo),
    usuarioCorreo: f.usuario_correo === null ? null : String(f.usuario_correo),
    fecha: f.fecha as Date | string,
  }));
}

/** Como se guarda un valor en bom_cambios: el texto tal cual, lo demas como JSON. */
function textoDeCambio(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === "string" ? valor : JSON.stringify(valor);
}

function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export interface OpcionesEscritura {
  /** Para piezas nuevas: el nombre de referencia (las que ya tienen fila no lo tocan). */
  nombreSiEsNueva?: string;
  /**
   * La version que vio quien edita. Si la pieza ya va en otra, se lanza
   * ConflictoBom y no se escribe nada. Sin esto, los campos que se mandan se
   * mezclan sobre lo que haya (sirve para escrituras por lote, como los cruces).
   */
  versionEsperada?: number;
}

/**
 * Actualiza una pieza (crea la fila si el SKU no existe todavia) y registra en
 * bom_cambios una fila por cada campo que de verdad cambio, con quien lo hizo.
 * Todo en una sola transaccion: o se guarda la pieza y su historial, o nada.
 *
 * Devuelve cuantos campos cambiaron (0 si lo que se mando ya era lo guardado:
 * en ese caso no sube la version ni se escribe historial).
 */
export async function escribirPieza(
  sku: string,
  cambios: CambiosFilaBom,
  autor: AutorBom,
  opciones: OpcionesEscritura = {},
): Promise<number> {
  const conexion = await poolBom().getConnection();
  try {
    await conexion.beginTransaction();
    const cambiados = await escribirDentro(conexion, sku, cambios, autor, opciones);
    await conexion.commit();
    return cambiados;
  } catch (error) {
    await conexion.rollback().catch(() => undefined);
    throw error;
  } finally {
    conexion.release();
  }
}

async function escribirDentro(
  conexion: PoolConnection,
  sku: string,
  cambios: CambiosFilaBom,
  autor: AutorBom,
  opciones: OpcionesEscritura,
): Promise<number> {
  // FOR UPDATE: dos personas guardando la misma pieza a la vez se turnan.
  const [existentes] = await conexion.query<RowDataPacket[]>(
    "SELECT datos, version FROM bom_piezas WHERE sku = ? FOR UPDATE",
    [sku],
  );
  const existente = existentes[0];
  const ahora = new Date();

  if (!existente && opciones.versionEsperada) {
    // Se abrio la ficha con una version y la fila ya no esta: algo la borro.
    throw new ConflictoBom(sku);
  }
  if (existente && opciones.versionEsperada !== undefined) {
    if (Number(existente.version) !== opciones.versionEsperada) throw new ConflictoBom(sku);
  }

  const antes: FilaBom = existente
    ? normalizarFila({ ...leerDatos(existente.datos), sku })
    : normalizarFila({ sku, nombre: opciones.nombreSiEsNueva ?? "" });
  // Se vuelve a validar la fila completa con el esquema: un valor invalido
  // (un numero negativo donde no cabe, por ejemplo) falla aqui y revierte todo.
  const despues = normalizarFila({ ...antes, ...cambios });

  const claves = COLUMNAS.map((c) => c.clave).filter(
    (clave) => clave !== "sku" && clave !== "nombre" && Object.hasOwn(cambios, clave),
  );
  const cambiados = claves.filter((clave) => {
    const k = clave as keyof FilaBom;
    return !iguales(antes[k], despues[k]);
  });

  // Una fila nueva se guarda siempre (aunque no cambie ningun campo): sembrar
  // un SKU es en si el cambio.
  if (existente && cambiados.length === 0) return 0;

  if (existente) {
    await conexion.query(
      "UPDATE bom_piezas SET datos = ?, version = version + 1, actualizado_por = ?, actualizado_en = ? WHERE sku = ?",
      [JSON.stringify(despues), autor.id, ahora, sku],
    );
  } else {
    await conexion.query(
      "INSERT INTO bom_piezas (sku, datos, version, actualizado_por, actualizado_en) VALUES (?, ?, 1, ?, ?)",
      [sku, JSON.stringify(despues), autor.id, ahora],
    );
  }

  if (cambiados.length > 0) {
    await conexion.query(
      "INSERT INTO bom_cambios (sku, campo, anterior, nuevo, usuario_id, usuario_correo, fecha) VALUES ?",
      [
        cambiados.map((clave) => [
          sku,
          clave,
          textoDeCambio(antes[clave as keyof FilaBom]),
          textoDeCambio(despues[clave as keyof FilaBom]),
          autor.id,
          autor.correo,
          ahora,
        ]),
      ],
    );
  }
  return cambiados.length;
}

/**
 * Carga inicial: inserta filas completas en bom_piezas (version 1, sin
 * historial: no son cambios de nadie). Rehusa si la tabla ya tiene filas, para
 * no pisar ediciones, salvo `reemplazar`, que la vacia primero.
 *
 * Con `soloFaltantes` agrega unicamente los SKU que todavia no estan y no toca
 * los que ya existen.
 */
export async function cargarFilasIniciales(
  filas: FilaBom[],
  opciones: { reemplazar?: boolean; soloFaltantes?: boolean } = {},
): Promise<{ insertadas: number; yaExistian: number }> {
  const conexion = await poolBom().getConnection();
  try {
    await conexion.beginTransaction();
    const [conteo] = await conexion.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM bom_piezas FOR UPDATE",
    );
    const n = Number(conteo[0].n);
    if (n > 0 && !opciones.reemplazar && !opciones.soloFaltantes) {
      throw new Error(
        `bom_piezas ya tiene ${n} filas. No las piso: usa --reemplazar para empezar de cero o --agregar-faltantes para sumar solo las nuevas.`,
      );
    }
    if (opciones.reemplazar) await conexion.query("DELETE FROM bom_piezas");

    const [registros] = await conexion.query<RowDataPacket[]>("SELECT sku FROM bom_piezas");
    const existentes = new Set(registros.map((r) => String(r.sku)));
    const nuevas = filas.filter((f) => !existentes.has(f.sku));

    const ahora = new Date();
    for (const fila of nuevas) {
      await conexion.query<ResultSetHeader>(
        "INSERT INTO bom_piezas (sku, datos, version, actualizado_por, actualizado_en) VALUES (?, ?, 1, NULL, ?)",
        [fila.sku, JSON.stringify(fila), ahora],
      );
    }
    await conexion.commit();
    return { insertadas: nuevas.length, yaExistian: filas.length - nuevas.length };
  } catch (error) {
    await conexion.rollback().catch(() => undefined);
    throw error;
  } finally {
    conexion.release();
  }
}

/** "cw=MXD-...; ccw=MXD-..." -> { cw: "MXD-...", ccw: "MXD-..." } */
export function leerNumerosVariantes(texto: string | null): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const parte of (texto ?? "").split(";")) {
    const [clave, numero] = parte.split("=").map((s) => s.trim());
    if (clave && numero) mapa[clave] = numero;
  }
  return mapa;
}

/** { cw: "MXD-...", ccw: "MXD-..." } -> "cw=MXD-...; ccw=MXD-..." (null si vacio) */
export function escribirNumerosVariantes(mapa: Record<string, string>): string | null {
  const partes = Object.entries(mapa).map(([clave, numero]) => `${clave}=${numero}`);
  return partes.length > 0 ? partes.join("; ") : null;
}

/**
 * La fila completa del BOM de una pieza, con lo que hoy dice el catalogo.
 *
 * Una fila nueva NUNCA se crea solo con el campo que se cambio: escribirPieza
 * deja en null todo lo demas y, como la fila manda sobre el catalogo, la
 * ficha perderia categoria, cotas y material. Por eso se siembra con esto.
 */
export function filaDesdePieza(pieza: Pieza): FilaBom {
  const porVersion = Object.fromEntries(
    pieza.variantes.filter((v) => v.numeroBom).map((v) => [v.clave, v.numeroBom as string]),
  );
  return {
    ...pieza.especificaciones,
    sku: pieza.sku,
    nombre: pieza.nombre,
    categoria: pieza.categoria,
    proceso_fabricacion: pieza.proceso_fabricacion,
    descripcion_funcional: pieza.descripcion_funcional,
    especificaciones_tecnicas: pieza.especificaciones_tecnicas,
    camposNoAplican: pieza.camposNoAplican,
    numero_parte_mxd: pieza.numeroBom,
    precio_mxn: pieza.precio_mxn,
    stock: pieza.stock,
    costo_fabricado_inhouse: pieza.costosProduccion.fabricadoInhouse,
    costo_equipo: pieza.costosProduccion.equipo,
    costo_material: pieza.costosProduccion.material,
    costo_masa_g: pieza.costosProduccion.masaG,
    costo_horas_produccion: pieza.costosProduccion.horasProduccion,
    costo_pintura_mxn: pieza.costosProduccion.costoPinturaMxn,
    costo_mano_obra_mxn: pieza.costosProduccion.costoManoObraMxn,
    costo_notas: pieza.costosProduccion.notas,
    trazabilidad_criticidad: pieza.trazabilidad.criticidad,
    trazabilidad_control_calidad: pieza.trazabilidad.controlCalidad,
    trazabilidad_intercambiable: pieza.trazabilidad.intercambiable,
    trazabilidad_carpeta_pieza: pieza.trazabilidad.carpetaPieza,
    trazabilidad_archivo_step: pieza.trazabilidad.archivoStep,
    trazabilidad_archivo_stl: pieza.trazabilidad.archivoStl,
    cruce_estado: pieza.cruceBom?.estado ?? null,
    numeros_variantes: escribirNumerosVariantes(porVersion),
  };
}

export { COLUMNAS as COLUMNAS_BOM };
