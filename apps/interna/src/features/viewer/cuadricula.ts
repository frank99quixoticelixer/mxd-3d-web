import * as THREE from "three";

/**
 * Acomodo de las piezas en filas y columnas (tramo 100% -> 200% del despiece).
 *
 * COMO FUNCIONA
 * 1. Todos los objetos de una misma PIEZA DE CATALOGO forman un solo grupo y
 *    se mueven juntos, como un bloque: el balanceador ocupa una celda aunque
 *    sean tres objetos, el ESC otra con su base, el motor otra con sus nueve
 *    subpiezas. El campo "sku" que llega aqui ya es la llave del grupo.
 * 2. Los grupos se ordenan por el campo "orden" del catalogo.
 * 3. Se acomodan en un plano vertical frente a la camara (plano XY),
 *    llenando filas de izquierda a derecha, de arriba hacia abajo.
 * 4. Las piezas cuyo lado mas largo apunta hacia la camara (eje Z, como el
 *    tubo) se giran 90 grados para que se vean completas.
 *
 * Todo se calcula una sola vez, con el modelo ensamblado.
 */

export interface ElementoCuadricula {
  objeto: THREE.Object3D;
  sku: string;
  orden: number;
}

export interface DestinoCuadricula {
  /** Posicion final en el espacio local del padre. */
  posicion: THREE.Vector3;
  /** Rotacion final en el espacio local del padre. */
  cuaternion: THREE.Quaternion;
}

interface Grupo {
  indices: number[];
  caja: THREE.Box3;
  orden: number;
  rotacion: THREE.Quaternion;
  ancho: number;
  alto: number;
}

export function organizarEnCuadricula(
  elementos: ElementoCuadricula[],
  radio: number,
  /**
   * Proporcion ancho/alto del lienzo. La rejilla se dimensiona con la misma
   * forma que el visor, para que quepa entera sin dejar franjas vacias: en un
   * visor apaisado conviene una rejilla ancha, no una cuadrada.
   * 1 la deja cuadrada, que es como se comportaba antes.
   */
  aspecto = 1,
): DestinoCuadricula[] {
  const cajas = elementos.map((e) => new THREE.Box3().setFromObject(e.objeto));

  // 1. Agrupar por pieza de catalogo.
  //
  // Antes se agrupaba por proximidad: objetos del mismo SKU que se tocaban
  // formaban un bloque y las copias separadas ocupaban celdas propias. Ahora
  // la agrupacion la decide el catalogo, no la geometria, para que la vista
  // organizada muestre exactamente las piezas que se cotizan.
  const porRaiz = new Map<string, number[]>();
  elementos.forEach((e, i) => {
    const lista = porRaiz.get(e.sku);
    if (lista) lista.push(i);
    else porRaiz.set(e.sku, [i]);
  });

  const ejeY = new THREE.Vector3(0, 1, 0);
  const grupos: Grupo[] = [...porRaiz.values()].map((indices) => {
    const caja = new THREE.Box3();
    for (const i of indices) caja.union(cajas[i]);
    const tam = caja.getSize(new THREE.Vector3());
    // Lado largo hacia la camara: se gira para mostrarlo de costado.
    const girar = tam.z > Math.max(tam.x, tam.y) * 1.05;
    return {
      indices,
      caja,
      orden: Math.min(...indices.map((i) => elementos[i].orden)),
      rotacion: girar
        ? new THREE.Quaternion().setFromAxisAngle(ejeY, Math.PI / 2)
        : new THREE.Quaternion(),
      ancho: Math.max(girar ? tam.z : tam.x, 1e-3),
      alto: Math.max(tam.y, 1e-3),
    };
  });

  grupos.sort(
    (a, b) =>
      a.orden - b.orden ||
      a.caja.getCenter(new THREE.Vector3()).x -
        b.caja.getCenter(new THREE.Vector3()).x,
  );

  // 2. Llenado por filas. El ancho maximo de fila se deriva del area total y
  //    de la proporcion del visor, para que la rejilla tenga su misma forma.
  const separacion = radio * 0.06;
  const anchoMaximo = Math.max(...grupos.map((g) => g.ancho));
  const area = grupos.reduce((s, g) => s + g.ancho * g.alto, 0);
  // De A = ancho x alto con ancho/alto = aspecto sale ancho = sqrt(A x aspecto).
  // El 1.6 compensa el hueco que queda al no poder partir una celda entre dos
  // filas; el minimo de 0.2 evita una rejilla de una sola columna en pantallas
  // muy altas y estrechas.
  const limiteFila = Math.max(
    anchoMaximo,
    Math.sqrt(area * Math.max(aspecto, 0.2)) * 1.6,
  );

  const filas: { grupos: Grupo[]; ancho: number; alto: number }[] = [];
  for (const g of grupos) {
    const fila = filas[filas.length - 1];
    if (fila && fila.ancho + separacion + g.ancho <= limiteFila) {
      fila.grupos.push(g);
      fila.ancho += separacion + g.ancho;
      fila.alto = Math.max(fila.alto, g.alto);
    } else {
      filas.push({ grupos: [g], ancho: g.ancho, alto: g.alto });
    }
  }

  // 3. Posiciones finales, con la cuadricula centrada en el origen.
  const destinos: DestinoCuadricula[] = elementos.map((e) => ({
    posicion: e.objeto.position.clone(),
    cuaternion: e.objeto.quaternion.clone(),
  }));

  const altoTotal =
    filas.reduce((s, f) => s + f.alto, 0) + separacion * (filas.length - 1);
  let y = altoTotal / 2;

  for (const fila of filas) {
    let x = -fila.ancho / 2;
    const centroY = y - fila.alto / 2;

    for (const g of fila.grupos) {
      const destino = new THREE.Vector3(x + g.ancho / 2, centroY, 0);
      const centroGrupo = g.caja.getCenter(new THREE.Vector3());

      for (const i of g.indices) {
        const objeto = elementos[i].objeto;

        // Nueva posicion y rotacion en el mundo: girar alrededor del
        // centro del grupo y llevar ese centro a su celda.
        const posMundo = objeto
          .getWorldPosition(new THREE.Vector3())
          .sub(centroGrupo)
          .applyQuaternion(g.rotacion)
          .add(destino);
        const rotMundo = g.rotacion
          .clone()
          .multiply(objeto.getWorldQuaternion(new THREE.Quaternion()));

        // Pasar al espacio local del padre (lo que se escribe en position).
        if (objeto.parent) {
          objeto.parent.worldToLocal(posMundo);
          const rotPadre = objeto.parent
            .getWorldQuaternion(new THREE.Quaternion())
            .invert();
          rotMundo.premultiply(rotPadre);
        }
        destinos[i] = { posicion: posMundo, cuaternion: rotMundo };
      }
      x += g.ancho + separacion;
    }
    y -= fila.alto + separacion;
  }

  return destinos;
}
