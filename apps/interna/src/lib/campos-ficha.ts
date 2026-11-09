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

export type CampoFicha = { clave: string; etiqueta: string; tipo: TipoCampo; unidad?: string };

export const CAMPOS_ESPECIFICACIONES: CampoFicha[] = [
  { clave: "masa_g", etiqueta: "Masa", tipo: "numero", unidad: "g" },
  { clave: "largo_mm", etiqueta: "Largo", tipo: "numero", unidad: "mm" },
  { clave: "ancho_mm", etiqueta: "Ancho", tipo: "numero", unidad: "mm" },
  { clave: "alto_mm", etiqueta: "Alto", tipo: "numero", unidad: "mm" },
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
  { clave: "costo_masa_g", etiqueta: "Masa de producción", tipo: "numero", unidad: "g" },
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

export function textoValor(pieza: Pieza, campo: CampoFicha): string {
  if (pieza.camposNoAplican.includes(campo.clave)) return "N/A";
  const valor = valorInicial(pieza, campo.clave);
  // Un tornillo sin par documentado no es un dato faltante: es que no hace
  // falta torquimetro para esa pieza (ver comentario en EspecificacionesEsquema).
  if (campo.clave === "par_apriete_nm" && valor === null && pieza.especificaciones.numero_tornillos) {
    return "Apriete manual";
  }
  if (valor === null || valor === "") return "Pendiente";
  if (campo.tipo === "seleccionBooleano") return valor ? "In-house (MXD)" : "Maquilado afuera";
  if (campo.tipo === "seleccionSiNo") return valor ? "Sí" : "No";
  if (campo.tipo === "seleccionMaterial") return ETIQUETAS_GRUPO_MATERIAL[valor as string] ?? String(valor);
  if (campo.unidad === "MXN") return monedaTexto(valor as number);
  return campo.unidad ? `${valor} ${campo.unidad}` : String(valor);
}
