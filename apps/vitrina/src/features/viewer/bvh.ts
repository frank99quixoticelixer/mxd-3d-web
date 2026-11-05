/**
 * Acelera el raycasting de three.js con un arbol de limites (BVH).
 *
 * POR QUE EXISTE: el visor resuelve que pieza esta bajo el cursor en CADA
 * evento "pointermove" del navegador (no por cuadro), y tambien mientras se
 * arrastra para girar la camara — arrastrar dispara pointermove igual que
 * mover el mouse sin tocar nada. Sin esto, three.js prueba el rayo contra
 * cada triangulo de cada malla, una por una (lineal), y con un GLB de ~350
 * nodos y miles de triangulos eso es lo que se siente como "se pone lento al
 * pasar el mouse o al girar": el trabajo no es del renderizado, es del
 * raycasting que corre por debajo en cada movimiento.
 *
 * three-mesh-bvh cambia esa prueba de lineal a logaritmica por malla. Hay que
 * importar este modulo (por su efecto secundario) antes de que cualquier
 * escena intente hacer raycasting — se importa al inicio de EscenaFrame.tsx
 * y EscenaPieza.tsx.
 *
 * El arbol en si se calcula por malla, una vez, en construirBVH() — ver su
 * comentario.
 */
import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * Calcula el arbol de limites de cada malla de `raiz`, una sola vez por
 * geometria.
 *
 * Se guarda en la geometria, no en la malla: useGLTF cachea el GLB cargado
 * por URL y clonar un Object3D (gltf.scene.clone(true), o malla.clone())
 * COMPARTE la misma BufferGeometry por referencia, no la copia. Calcularlo
 * una vez beneficia a todas las copias futuras de esa misma geometria —
 * incluidas las de otras piezas que comparten el mismo GLB grande (GLB_FRAME
 * en la portada, el GLB combinado en cada ficha de pieza).
 *
 * Llamar computeBoundsTree() en una geometria que ya lo tiene lo recalcula
 * sin romper nada, pero es trabajo de sobra: por eso el chequeo de
 * `boundsTree` antes de llamarlo.
 */
export function construirBVH(raiz: THREE.Object3D): void {
  raiz.traverse((nodo) => {
    const malla = nodo as THREE.Mesh;
    if (!malla.isMesh) return;
    const geometria = malla.geometry;
    if (geometria && !geometria.boundsTree) {
      geometria.computeBoundsTree();
    }
  });
}
