import type { Pieza } from "./esquema";

/**
 * Lista unica de los campos editables de una pieza (especificaciones, compras
 * e inventario, costos de produccion) y como mostrarlos.
 *
 * Es la fuente compartida entre la ficha web editable (FichaEditable.tsx) y
 * la ficha en PDF (ficha-pdf/FichaPieza.tsx): antes cada una tenia su propia
 * copia de esta lista y de la logica de "N/A" / "Apriete manual" / moneda, y
 * se desincronizaban cada vez que se agregaba un campo nuevo (los campos de
 * tornillos, helices, tubos y motor que se agregaron esta sesion nunca
 * llegaron al PDF). Este archivo no tiene nada de cliente ni de servidor
 * (sin "use client", sin exceljs): lo importan los dos.
 */
export type TipoCampo =
  | "numero"
  | "texto"
  | "seleccionGiro"
  | "seleccionBooleano"
  | "seleccionSiNo"
  | "seleccionMaterial";
/** Como se lee cada tipo de material en la ficha (mismos textos que el visor). */
export const ETIQUETAS_GRUPO_MATERIAL: Record<string, string> = {
  plastico: "Plástica",
  metal: "Metálica",
  electronica: "Electrónica",
  otros: "Otro (carbono, hule, manguera)",
};

/** Una unidad en la que se puede capturar un campo: cuantas unidades base (las del BOM) vale una. */
export type UnidadCaptura = { etiqueta: string; factor: number };

/** Gramos o kilogramos: el BOM guarda en gramos, la persona captura en la que le quede mas facil. */
export const UNIDADES_PESO: UnidadCaptura[] = [
  { etiqueta: "g", factor: 1 },
  { etiqueta: "kg", factor: 1000 },
];

/** Milimetros, centimetros o metros: el BOM guarda en milimetros. */
export const UNIDADES_LONGITUD: UnidadCaptura[] = [
  { etiqueta: "mm", factor: 1 },
  { etiqueta: "cm", factor: 10 },
  { etiqueta: "m", factor: 1000 },
];

export type CampoFicha = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  unidad?: string;
  /** Si el campo se puede capturar en varias unidades. `unidad` es la del BOM y el primer `factor` es 1. */
  unidades?: UnidadCaptura[];
};

/** Pasa un numero capturado en una unidad a la unidad del BOM, sin arrastrar decimales de punto flotante. */
export function aUnidadBase(valor: number, factor: number): number {
  return Math.round(valor * factor * 1e6) / 1e6;
}

/** Pasa un numero en la unidad del BOM a otra unidad de captura. */
export function deUnidadBase(valor: number, factor: number): number {
  return Math.round((valor / factor) * 1e6) / 1e6;
}

/** "3.12 kg (3120 g)" desde gramos; por debajo de 1 kg, solo "850 g". */
export function textoPeso(gramos: number): string {
  return gramos >= 1000 ? `${deUnidadBase(gramos, 1000)} kg (${gramos} g)` : `${gramos} g`;
}

export const CAMPOS_ESPECIFICACIONES: CampoFicha[] = [
  { clave: "masa_g", etiqueta: "Peso unitario", tipo: "numero", unidad: "g", unidades: UNIDADES_PESO },
  { clave: "largo_mm", etiqueta: "Largo", tipo: "numero", unidad: "mm", unidades: UNIDADES_LONGITUD },
  { clave: "ancho_mm", etiqueta: "Ancho", tipo: "numero", unidad: "mm", unidades: UNIDADES_LONGITUD },
  { clave: "alto_mm", etiqueta: "Alto", tipo: "numero", unidad: "mm", unidades: UNIDADES_LONGITUD },
  { clave: "profundidad_mm", etiqueta: "Profundidad", tipo: "numero", unidad: "mm", unidades: UNIDADES_LONGITUD },
  { clave: "tolerancia_mm", etiqueta: "Tolerancia general", tipo: "numero", unidad: "mm" },
  { clave: "par_apriete_nm", etiqueta: "Par de apriete", tipo: "numero", unidad: "N·m" },
  { clave: "numero_tornillos", etiqueta: "No. de tornillos", tipo: "numero" },
  { clave: "material", etiqueta: "Material", tipo: "texto" },
  { clave: "grupo_material", etiqueta: "Tipo de material (filtro del visor)", tipo: "seleccionMaterial" },
  { clave: "acabado", etiqueta: "Acabado", tipo: "texto" },
  { clave: "proceso_fabricacion", etiqueta: "Proceso de fabricación", tipo: "texto" },
  { clave: "rosca", etiqueta: "Rosca", tipo: "texto" },
  { clave: "longitud_mm", etiqueta: "Longitud", tipo: "numero", unidad: "mm" },
  { clave: "sentido_giro", etiqueta: "Sentido de giro", tipo: "seleccionGiro" },
  { clave: "modulo_conectado", etiqueta: "Módulo al que conecta", tipo: "texto" },
  { clave: "volumen_ml", etiqueta: "Volumen", tipo: "numero", unidad: "mL" },
  { clave: "capacidad_l", etiqueta: "Capacidad", tipo: "numero", unidad: "L" },
  { clave: "capacidad_carga_kg", etiqueta: "Capacidad máxima de carga", tipo: "numero", unidad: "kg" },
  { clave: "diametro_tubo_mm", etiqueta: "Diámetro de tubo", tipo: "numero", unidad: "mm" },
  { clave: "grosor_pared_mm", etiqueta: "Grosor de pared", tipo: "numero", unidad: "mm" },
  { clave: "diametro_barreno_mm", etiqueta: "Diámetro de barreno", tipo: "numero", unidad: "mm" },
  { clave: "ancho_perfil_mm", etiqueta: "Ancho de perfil", tipo: "numero", unidad: "mm" },
  { clave: "alto_perfil_mm", etiqueta: "Alto de perfil", tipo: "numero", unidad: "mm" },
  { clave: "motor_kv", etiqueta: "Motor: KV", tipo: "numero", unidad: "RPM/V" },
  { clave: "motor_voltaje_nominal_v", etiqueta: "Motor: voltaje nominal", tipo: "numero", unidad: "V" },
  { clave: "motor_rpm_nominal", etiqueta: "Motor: RPM nominal", tipo: "numero" },
  { clave: "motor_torque_nominal_nm", etiqueta: "Motor: torque nominal", tipo: "numero", unidad: "N·m" },
  { clave: "motor_torque_max_nm", etiqueta: "Motor: torque máximo", tipo: "numero", unidad: "N·m" },
  { clave: "notas", etiqueta: "Notas", tipo: "texto" },
];

export const CAMPOS_COMPRAS: CampoFicha[] = [
  { clave: "numero_parte_mxd", etiqueta: "Número de parte (BOM)", tipo: "texto" },
  { clave: "proveedor", etiqueta: "Proveedor", tipo: "texto" },
  { clave: "parte_proveedor", etiqueta: "Parte del proveedor", tipo: "texto" },
  { clave: "precio_mxn", etiqueta: "Precio", tipo: "numero", unidad: "MXN" },
  { clave: "stock", etiqueta: "Existencias", tipo: "numero", unidad: "pzas" },
];

export const CAMPOS_COSTOS: CampoFicha[] = [
  { clave: "costo_fabricado_inhouse", etiqueta: "Fabricado in-house", tipo: "seleccionBooleano" },
  { clave: "costo_equipo", etiqueta: "Equipo de producción", tipo: "texto" },
  { clave: "costo_material", etiqueta: "Material de producción", tipo: "texto" },
  { clave: "costo_masa_g", etiqueta: "Masa de producción", tipo: "numero", unidad: "g", unidades: UNIDADES_PESO },
  { clave: "costo_horas_produccion", etiqueta: "Horas de producción", tipo: "numero", unidad: "h" },
  { clave: "costo_pintura_mxn", etiqueta: "Costo de pintura", tipo: "numero", unidad: "MXN" },
  { clave: "costo_mano_obra_mxn", etiqueta: "Costo de mano de obra", tipo: "numero", unidad: "MXN" },
  { clave: "costo_notas", etiqueta: "Notas de costos", tipo: "texto" },
];

/**
 * Trazabilidad de manufactura: las columnas del BOM maestro
 * (mxd-3d/Maestro_Partes_MX80.xlsx) que no tienen equivalente en otro campo
 * de este catalogo. Ver comentario en TrazabilidadEsquema (lib/esquema.ts).
 */
export const CAMPOS_TRAZABILIDAD: CampoFicha[] = [
  { clave: "trazabilidad_criticidad", etiqueta: "Criticidad", tipo: "texto" },
  { clave: "trazabilidad_control_calidad", etiqueta: "Control de calidad", tipo: "texto" },
  { clave: "trazabilidad_intercambiable", etiqueta: "Intercambiable", tipo: "seleccionSiNo" },
  { clave: "trazabilidad_carpeta_pieza", etiqueta: "Carpeta de la pieza", tipo: "texto" },
  { clave: "trazabilidad_archivo_step", etiqueta: "Archivo STEP", tipo: "seleccionSiNo" },
  { clave: "trazabilidad_archivo_stl", etiqueta: "Archivo STL", tipo: "seleccionSiNo" },
];

export function campoPorClave(campos: CampoFicha[], clave: string): CampoFicha {
  const campo = campos.find((c) => c.clave === clave);
  if (!campo) throw new Error(`Campo de ficha desconocido: ${clave}`);
  return campo;
}

/** Las pocas claves donde el nombre de columna del BOM no coincide con donde vive el dato en Pieza. */
export function valorInicial(pieza: Pieza, clave: string): string | number | boolean | null {
  if (clave === "numero_parte_mxd") return pieza.numeroBom;
  if (clave === "proceso_fabricacion") return pieza.proceso_fabricacion;
  if (clave === "precio_mxn") return pieza.precio_mxn;
  if (clave === "stock") return pieza.stock;
  if (clave === "costo_fabricado_inhouse") return pieza.costosProduccion.fabricadoInhouse;
  if (clave === "costo_equipo") return pieza.costosProduccion.equipo;
  if (clave === "costo_material") return pieza.costosProduccion.material;
  if (clave === "costo_masa_g") return pieza.costosProduccion.masaG;
  if (clave === "costo_horas_produccion") return pieza.costosProduccion.horasProduccion;
  if (clave === "costo_pintura_mxn") return pieza.costosProduccion.costoPinturaMxn;
  if (clave === "costo_mano_obra_mxn") return pieza.costosProduccion.costoManoObraMxn;
  if (clave === "costo_notas") return pieza.costosProduccion.notas;
  if (clave === "trazabilidad_criticidad") return pieza.trazabilidad.criticidad;
  if (clave === "trazabilidad_control_calidad") return pieza.trazabilidad.controlCalidad;
  if (clave === "trazabilidad_intercambiable") return pieza.trazabilidad.intercambiable;
  if (clave === "trazabilidad_carpeta_pieza") return pieza.trazabilidad.carpetaPieza;
  if (clave === "trazabilidad_archivo_step") return pieza.trazabilidad.archivoStep;
  if (clave === "trazabilidad_archivo_stl") return pieza.trazabilidad.archivoStl;
  return (pieza.especificaciones as unknown as Record<string, string | number | null>)[clave] ?? null;
}

export function monedaTexto(valor: number | null): string {
  return valor === null
    ? "Pendiente"
    : valor.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function textoValor(
  pieza: Pieza,
  campo: CampoFicha,
  /** Lo que el maestro de partes dice de esta pieza, por clave del BOM (lib/partida-maestro.ts). */
  delMaestro?: Record<string, string>,
): string {
  if (pieza.camposNoAplican.includes(campo.clave)) return "N/A";
  const valor = valorInicial(pieza, campo.clave);
  // Un tornillo sin par documentado no es un dato faltante: es que no hace
  // falta torquimetro para esa pieza (ver comentario en EspecificacionesEsquema).
  if (campo.clave === "par_apriete_nm" && valor === null && pieza.especificaciones.numero_tornillos) {
    return "Apriete manual";
  }
  if (valor === null || valor === "") {
    // Sin dato en la ficha pero con dato en el maestro: se muestra, marcado como suyo.
    const sugerido = delMaestro?.[campo.clave];
    if (sugerido) {
      const n = Number(sugerido);
      if (campo.unidad === "g" && Number.isFinite(n)) return `${textoPeso(n)} (del maestro)`;
      return `${sugerido}${campo.unidad && campo.unidad !== "MXN" ? ` ${campo.unidad}` : ""} (del maestro)`;
    }
    return "Pendiente";
  }
  if (campo.tipo === "seleccionBooleano") return valor ? "In-house (MXD)" : "Maquilado afuera";
  if (campo.tipo === "seleccionSiNo") return valor ? "Sí" : "No";
  if (campo.tipo === "seleccionMaterial") return ETIQUETAS_GRUPO_MATERIAL[valor as string] ?? String(valor);
  if (campo.unidad === "MXN") return monedaTexto(valor as number);
  // Un peso de 1 kg o mas se lee mejor en kg; las medidas se quedan en mm, como en el BOM.
  if (campo.unidad === "g" && typeof valor === "number") return textoPeso(valor);
  return campo.unidad ? `${valor} ${campo.unidad}` : String(valor);
}
