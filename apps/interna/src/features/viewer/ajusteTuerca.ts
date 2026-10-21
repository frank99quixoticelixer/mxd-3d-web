import * as THREE from "three";

/**
 * Posicion de cada spacer dentro del balanceador, como fraccion de la altura
 * del jacket medida desde su base. Salen de las alturas reales del brazo,
 * medidas justo donde va la tuerca (no en el bbox de la pieza completa, que
 * incluye un bloque central mas alto): el balanceador inferior llega a
 * Y = -2.10 ahi y el superior empieza en Y = 2.89. Cada spacer se pega a su
 * mitad, no a los 17.5 mm que los separan en el CAD suelto (no caben).
 */
const FRACCION_SPACER_INFERIOR = 0.31;
const FRACCION_SPACER_SUPERIOR = 0.802;

export interface AjusteTuerca {
  escala: number;
  posicion: THREE.Vector3;
}

/**
 * Coloca la copia del modelo detallado (jacket + 2 spacers + tornillo, en
 * metros) sobre el placeholder de la tuerca del ensamble.
 *
 * El placeholder tiene la altura del jacket y el ancho de los spacers, asi
 * que la escala sale del ancho (X/Z) y la altura se alinea por el jacket:
 * centrar el conjunto completo lo corre hacia abajo porque el tornillo
 * sobresale solo por arriba. Debe llamarse con la copia sin mover.
 * Reposiciona los spacers (deben quedar antes de leer las posiciones base
 * del despiece).
 */
export function ajustarDetalleAlPlaceholder(
  copia: THREE.Object3D,
  cajaPlaceholder: THREE.Box3,
): AjusteTuerca {
  copia.updateMatrixWorld(true);
  const cajaDetalle = new THREE.Box3().setFromObject(copia);
  const tamanoDetalle = cajaDetalle.getSize(new THREE.Vector3());
  const tamanoPlaceholder = cajaPlaceholder.getSize(new THREE.Vector3());

  const ancho = (tamanoDetalle.x + tamanoDetalle.z) / 2;
  const escala = ancho > 0 ? (tamanoPlaceholder.x + tamanoPlaceholder.z) / 2 / ancho : 1;

  const jacket = copia.getObjectByName("jacket_balanceador");
  const cajaJacket = jacket ? new THREE.Box3().setFromObject(jacket) : cajaDetalle;
  const alturaJacket = cajaJacket.getSize(new THREE.Vector3()).y;

  const spacerInferior = copia.getObjectByName("spacer_balanceador_1");
  const spacerSuperior = copia.getObjectByName("spacer_balanceador_2");
  if (spacerInferior) {
    spacerInferior.position.y = cajaJacket.min.y + alturaJacket * FRACCION_SPACER_INFERIOR;
  }
  if (spacerSuperior) {
    spacerSuperior.position.y = cajaJacket.min.y + alturaJacket * FRACCION_SPACER_SUPERIOR;
  }

  const centroJacket = cajaJacket.getCenter(new THREE.Vector3());
  const centroPlaceholder = cajaPlaceholder.getCenter(new THREE.Vector3());
  const posicion = centroPlaceholder.sub(centroJacket.multiplyScalar(escala));
  return { escala, posicion };
}
