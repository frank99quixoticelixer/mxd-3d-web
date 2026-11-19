/**
 * Estilo "lineas": el dron dibujado solo con sus contornos y aristas, como la
 * vista de lineas del programa de diseno. Para folletos y fichas.
 *
 * Tres capas por pieza:
 * - Superficie: un material que solo escribe profundidad. No se ve (el fondo
 *   transparente sigue transparente), pero tapa lo que hay detras: es un dibujo
 *   con lineas ocultas eliminadas.
 * - Contorno (silueta): "casco invertido". Las caras traseras de la pieza,
 *   empujadas hacia afuera a lo largo de su normal un grosor fijo en metros, en
 *   el color de linea. Asoman solo por el borde de la silueta, asi que las
 *   superficies curvas (el tanque) tambien tienen contorno.
 * - Aristas: las que doblan mas de ANGULO_ARISTA (no la triangulacion), con
 *   lineas gruesas (LineSegments2) de grosor en metros.
 *
 * Las piezas diminutas (tornillos, insertos) no llevan lineas: con el modelo
 * completo ensucian el dibujo. Solo tapan lo que esta detras.
 * Todo se calcula la primera vez que se activa y se reutiliza.
 */
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

/** Grados: aristas mas cerradas que esto se dibujan. */
const ANGULO_ARISTA = 40;
/** Grosor de las aristas [m]. */
const GROSOR_ARISTA = 0.0032;
/** Grosor del contorno [m]. */
const GROSOR_CONTORNO = 0.0055;
/** Piezas con radio menor a esto [m] no llevan lineas. */
const RADIO_MINIMO = 0.015;
/** Color de las lineas (claro: el dibujo va sobre fondos oscuros). */
export const COLOR_LINEAS = "#eef6f1";

export interface Lineas {
  mostrar: (activo: boolean) => void;
  liberar: () => void;
}

/** Material del casco invertido: caras traseras empujadas por su normal en espacio de vista. */
function materialContorno() {
  const m = new THREE.MeshBasicMaterial({ color: COLOR_LINEAS, side: THREE.BackSide });
  m.onBeforeCompile = (sombreador) => {
    sombreador.uniforms.uGrosor = { value: GROSOR_CONTORNO };
    sombreador.vertexShader = sombreador.vertexShader
      .replace("void main() {", "uniform float uGrosor;\nvoid main() {")
      .replace(
        "#include <project_vertex>",
        `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
        mvPosition.xyz += normalize( normalMatrix * normal ) * uGrosor;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  return m;
}

export function crearLineas(raiz: THREE.Object3D): Lineas {
  raiz.updateMatrixWorld(true);
  const material = new LineMaterial({ color: COLOR_LINEAS, linewidth: GROSOR_ARISTA, worldUnits: true });
  const contorno = materialContorno();
  // Solo profundidad, un poco empujada hacia atras para que las aristas de la
  // propia superficie queden encima.
  const profundidad = new THREE.MeshBasicMaterial({
    colorWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const mallas: THREE.Mesh[] = [];
  raiz.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh && !m.userData.esLinea) mallas.push(m);
  });

  const agregados: THREE.Object3D[] = [];
  const geometrias: THREE.BufferGeometry[] = [];
  const escala = new THREE.Vector3();
  for (const malla of mallas) {
    const geo = malla.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    malla.getWorldScale(escala);
    const radio = geo.boundingSphere!.radius * Math.max(escala.x, escala.y, escala.z);
    if (radio < RADIO_MINIMO) continue;

    const aristas = new THREE.EdgesGeometry(geo, ANGULO_ARISTA);
    const geoLinea = new LineSegmentsGeometry().fromEdgesGeometry(aristas);
    aristas.dispose();
    const linea = new LineSegments2(geoLinea, material);
    geometrias.push(geoLinea);

    const piezas: THREE.Object3D[] = [linea];
    if (geo.getAttribute("normal")) piezas.push(new THREE.Mesh(geo, contorno));
    for (const p of piezas) {
      // Despues de todas las superficies: si el contorno se dibuja antes, una
      // superficie que solo escribe profundidad ya no lo tapa y la pieza sale
      // rellena.
      p.renderOrder = 1;
      p.visible = false;
      p.userData.esLinea = true;
      p.raycast = () => {};
      malla.add(p);
      agregados.push(p);
    }
  }

  const guardados = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  return {
    mostrar(activo) {
      for (const p of agregados) p.visible = activo;
      for (const malla of mallas) {
        if (activo) {
          if (!guardados.has(malla)) guardados.set(malla, malla.material);
          malla.material = profundidad;
          malla.castShadow = false;
        } else if (guardados.has(malla)) {
          malla.material = guardados.get(malla)!;
          malla.castShadow = true;
          guardados.delete(malla);
        }
      }
    },
    liberar() {
      this.mostrar(false);
      for (const p of agregados) p.removeFromParent();
      for (const g of geometrias) g.dispose();
      material.dispose();
      contorno.dispose();
      profundidad.dispose();
    },
  };
}
