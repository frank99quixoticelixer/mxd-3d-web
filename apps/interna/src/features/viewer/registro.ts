import type { PiezaEnEscena } from "./resolverPiezas";

/**
 * Registro vivo de las piezas presentes en la escena.
 *
 * Existe para que la camara pueda consultar la posicion REAL de una pieza
 * en el instante del clic (que cambia mientras el modelo esta explotado),
 * sin pasar objetos de three.js a traves del estado de React.
 *
 * Lo escribe PlataformaPiezas y lo lee CamaraControles.
 */
export const registroPiezas: { actual: PiezaEnEscena[] } = { actual: [] };

export function piezaPorSku(sku: string): PiezaEnEscena | undefined {
  // Busca primero por SKU exacto; si no hay (piezas padre como MX80-007 que
  // solo existen como subpiezas en la escena), cae al primer elemento del grupo.
  return (
    registroPiezas.actual.find((p) => p.sku === sku) ??
    registroPiezas.actual.find((p) => p.grupo === sku)
  );
}
