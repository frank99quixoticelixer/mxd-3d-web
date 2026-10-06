/**
 * Configuracion central de los modelos 3D.
 *
 * AQUI SE CAMBIA LA RUTA Y LA VERSION DEL GLB. Nada mas en todo el proyecto
 * debe construir rutas de modelos a mano.
 */

const ORIGEN = process.env.NEXT_PUBLIC_ORIGEN_MODELOS ?? "local";
const BASE_CDN = process.env.NEXT_PUBLIC_ASSETS_URL ?? "";

/**
 * ===================================================================
 * EL GLB QUE CARGA LA PAGINA. Cambia esta linea y ya.
 * ===================================================================
 * Ruta relativa a public/: se sirve como archivo estatico sin pasar
 * por el API route. Al actualizar el modelo, copia el nuevo _web.glb
 * a public/models/mx80/ y cambia el nombre aqui.
 */
export const GLB_ACTIVO = "models/mx80/MX80_brazo_CW_web.glb";

/** Chasis completo con los 4 brazos plegables (ver /explorador). */
export const GLB_FRAME = "models/mx80/frame_MX80_v3_web.glb";

/**
 * Angulo maximo del control de plegado del chasis (grados), 0 = desplegado.
 * Vive aqui (no en EscenaFrame.tsx) porque VisorFrame.tsx lo necesita para
 * el slider y EscenaFrame.tsx se importa con next/dynamic(ssr:false): un
 * import normal de ese archivo arrastraria three.js/drei al bundle del
 * servidor. Este archivo es config plana, sin esos paquetes pesados.
 */
export const ANGULO_MAX_PLEGADO_FRAME = 135;

/** URL de un GLB servido desde contenido/piezas_MX80/. */
export function urlGlbContenido(rutaRelativa: string): string {
  const limpia = rutaRelativa.replace(/^\/+/, "");
  if (ORIGEN === "cdn" && BASE_CDN) {
    return `${BASE_CDN.replace(/\/+$/, "")}/${limpia}`;
  }
  return `/api/modelo/${limpia}`;
}

/**
 * Devuelve la URL publica de un archivo de modelo.
 * - origen "local": /models/...            (archivos dentro de public/)
 * - origen "cdn":   https://.../models/... (Cloudflare R2 o S3)
 */
export function urlModelo(rutaRelativa: string): string {
  const limpia = rutaRelativa.replace(/^\/+/, "");
  if (ORIGEN === "cdn" && BASE_CDN) {
    return `${BASE_CDN.replace(/\/+$/, "")}/${limpia}`;
  }
  return `/${limpia}`;
}

export type ModeloDron = "MX30" | "MX50" | "MX80";

export interface ConfigModelo {
  id: ModeloDron;
  nombre: string;
  /** Archivo del ensamble completo. Cambia la version cuando reexportes. */
  ensamble: string;
  /** Carpeta de piezas individuales (opcional; el sitio funciona sin ellas). */
  carpetaPiezas: string;
  /** true cuando ya subiste el GLB del ensamble. Si es false se usa el modo demostracion. */
  disponible: boolean;
}

export const MODELOS: Record<ModeloDron, ConfigModelo> = {
  MX80: {
    id: "MX80",
    nombre: "MX80",
    ensamble: GLB_ACTIVO,
    carpetaPiezas: "models/mx80/piezas",
    // Cambia a true cuando el archivo de arriba exista.
    // Si lo dejas en false, el visor muestra un ensamble de demostracion
    // generado con primitivas, para que puedas probar toda la interaccion.
    disponible: true,
  },
  MX50: {
    id: "MX50",
    nombre: "MX50",
    ensamble: "mx50/mx50_ensamble.glb",
    carpetaPiezas: "models/mx50/piezas",
    disponible: false,
  },
  MX30: {
    id: "MX30",
    nombre: "MX30",
    ensamble: "mx30/mx30_ensamble.glb",
    carpetaPiezas: "models/mx30/piezas",
    disponible: false,
  },
};

/** Modelo que se muestra por defecto en el sitio. */
export const MODELO_PREDETERMINADO: ModeloDron = "MX80";

/** Muestra el panel que lista los nodos del GLB sin coincidencia en el catalogo. */
export const DIAGNOSTICO_ACTIVO =
  process.env.NEXT_PUBLIC_DIAGNOSTICO_3D !== "false";

/**
 * Parametros de la vista explosionada.
 * La magnitud es relativa al radio del modelo, asi que funciona igual
 * sin importar la escala en la que exportaste desde Blender.
 */
export const EXPLOSION = {
  /** Separacion maxima, como fraccion del radio de la esfera envolvente. */
  magnitudMaxima: 0.9,
  /** Velocidad de interpolacion (mayor = mas rapido). */
  suavizado: 6,
} as const;
