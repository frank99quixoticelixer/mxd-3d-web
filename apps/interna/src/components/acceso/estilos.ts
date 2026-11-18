/**
 * Estilos compartidos por /login y /registro (paginas sin sesion).
 *
 * El boton principal se hunde al pulsarlo (escala, desplazamiento y color mas
 * oscuro con sombra interior), para que se note que el clic se registro. Va en
 * :active y no en un estado de carga porque estas paginas funcionan sin
 * JavaScript: un formulario HTML normal no tiene estado de carga que mostrar.
 */
export const BOTON_PRINCIPAL =
  "rounded-lg bg-mxd-verde-acento px-4 py-2 text-base font-semibold text-mxd-tinta shadow-sm " +
  "transition-all duration-75 hover:brightness-95 " +
  "active:translate-y-0.5 active:scale-95 active:brightness-75 active:shadow-inner " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mxd-verde";

/** Circulo que gira dentro de un boton (hereda el color del texto). */
export const GIRANDO =
  "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-pulse";

export const CAMPO_TEXTO =
  "w-full rounded-lg border border-mxd-borde bg-mxd-fondo px-3 py-2 text-base font-normal text-mxd-tinta";
