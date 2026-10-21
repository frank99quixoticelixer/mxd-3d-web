import { renderToBuffer } from "@react-pdf/renderer";

import { obtenerSubpiezas } from "@/lib/catalogo";
import type { Pieza } from "@/lib/esquema";

import { DocumentoFichas, type Alcance } from "./Documento";
import { cargarImagenes, cargarLogo } from "./recursos";
import { fechaEmision } from "./revision";

/**
 * Punto unico de generacion: las tres rutas de descarga pasan por aqui, asi que
 * las cabeceras, el nombre del archivo y el manejo de imagenes son identicos en
 * las tres y no hay que repetirlos en cada route handler.
 */

function piezasDe(alcance: Alcance): Pieza[] {
  return alcance.tipo === "pieza" ? [alcance.pieza] : alcance.piezas;
}

/**
 * Subpiezas de cada pieza del documento, indexadas por SKU del padre.
 *
 * El documento entrega primero la hoja general de la pieza y despues una hoja
 * por subpieza, para que el proveedor tenga el conjunto y el detalle en el
 * mismo archivo sin tener que pedir nada mas.
 *
 * Incluye TODOS los niveles, en profundidad: el balanceador trae la tuerca y
 * la tuerca trae sus 4 piezas (espaciadores, camisa, tornillo). Cada hoja
 * queda justo despues de la de su padre.
 */
function descendientes(sku: string): Pieza[] {
  return obtenerSubpiezas(sku).flatMap((h) => [h, ...descendientes(h.sku)]);
}

function subpiezasDe(piezas: Pieza[]): Map<string, Pieza[]> {
  const mapa = new Map<string, Pieza[]>();
  for (const pieza of piezas) {
    const hijas = descendientes(pieza.sku);
    if (hijas.length > 0) mapa.set(pieza.sku, hijas);
  }
  return mapa;
}

export async function respuestaPdf(
  alcance: Alcance,
  origen: string,
  nombreBase: string,
): Promise<Response> {
  const piezas = piezasDe(alcance);
  const subpiezas = subpiezasDe(piezas);
  const todas = [...piezas, ...[...subpiezas.values()].flat()];
  const [imagenes, logo] = await Promise.all([
    cargarImagenes(todas, origen),
    cargarLogo(origen),
  ]);

  const pdf = await renderToBuffer(
    <DocumentoFichas
      alcance={alcance}
      imagenes={imagenes}
      logo={logo}
      subpiezas={subpiezas}
    />,
  );

  const archivo = `${nombreBase}_${fechaEmision()}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      // Sin cache: el documento lleva fecha de emision y el codigo de revision
      // depende de los datos, asi que una copia guardada puede mentir sobre la
      // version vigente. Es justo lo que el sello de revision existe para evitar.
      "Cache-Control": "no-store",
    },
  });
}
