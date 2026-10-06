/**
 * Identidad de marca MXD.
 *
 * ESTE ES EL UNICO ARCHIVO QUE DEBES TOCAR PARA CAMBIAR COLORES, NOMBRE O LOGO.
 * Los colores tambien estan declarados como variables CSS en src/app/globals.css;
 * si cambias un color aqui, cambialo tambien alla (se indica cual con el mismo nombre).
 */

export const MARCA = {
  nombre: "MXD",
  nombreLargo: "MXD Drones",
  descripcion:
    "Fabricación de drones agrícolas de alto desempeño. Catálogo técnico interactivo de componentes.",

  /**
   * Logo. Reemplaza el archivo public/brand/logo-mxd.svg por el logo real.
   * Formato recomendado: SVG (escala sin perdida). Si solo tienes PNG,
   * usalo a 512 px de alto minimo, con fondo transparente, y cambia la ruta aqui.
   */
  logo: {
    src: "/brand/logo-mxd.svg",
    // Alto de referencia en px dentro del header. La proporcion se conserva.
    altoHeader: 32,
    alt: "MXD",
  },

  contacto: {
    correo: "drones.mxd@gmail.com",
    telefono: "442 381 4786",
    ciudad: "Querétaro, México",
    representante: "Ing. Alfonso Ugalde",
    facebook: "Drones MXD",
    instagram: "dronesmxd",
  },
} as const;

/**
 * Paleta. Blanco y verde como colores principales.
 * Los valores hexadecimales aqui se usan en el visor 3D (three.js no lee CSS).
 * Deben coincidir con las variables de globals.css.
 */
export const COLORES = {
  /** Verde principal de marca */
  verde: "#0F8A4C",
  /** Verde oscuro para texto sobre blanco y estados hover */
  verdeOscuro: "#0A5F36",
  /** Verde muy claro para fondos de seccion y chips */
  verdeClaro: "#E9F5EE",
  /** Verde de acento/energia para resaltados en el visor */
  verdeAcento: "#22C55E",

  blanco: "#FFFFFF",
  /** Fondo suave, casi blanco con tinte frio */
  hueso: "#F6F8F7",
  /** Bordes y separadores */
  borde: "#E2E8E5",
  /** Texto secundario */
  grisTexto: "#5C6B66",
  /** Texto principal */
  tinta: "#0D1512",
} as const;

/**
 * Colores usados exclusivamente dentro del canvas 3D.
 */
export const COLORES_3D = {
  /** Color del resaltado al pasar el cursor */
  hover: COLORES.verde,
  /** El contorno de seleccion se configura en src/features/viewer/ContornoPantalla.tsx */
  /** Fondo del visor (degradado suave hacia blanco) */
  fondo: COLORES.hueso,
  /** Material de las piezas del modo demostracion (cuando no hay GLB cargado) */
  demo: "#C9D3CF",
  demoAlterno: "#8FA39B",
} as const;
