import * as THREE from "three";

/**
 * Giro de los discos atomizadores del aspersor centrifugo.
 *
 * Solo giran los nodos `*_disco`: el motor de la centrifuga, el cuerpo en Y y
 * las mangueras quedan fijos. El GLB no trae el eje de giro marcado ni el
 * origen del disco en su centro, asi que el eje se saca de la geometria y se
 * cuelga el disco de un pivote alineado a el. Se rota el pivote, nunca el
 * disco: rotar el disco giraria alrededor de su origen, que no esta en el eje,
 * y lo haria orbitar en vez de girar en su sitio.
 */

/** Disco listo para girar y para emitir gotas. */
export interface Disco {
  /** El nodo del GLB (`der_disco`, `izq_disco001`...). */
  nodo: THREE.Object3D;
  /** Pivote: centro en el eje del disco, Y local = eje (hacia arriba). */
  pivote: THREE.Object3D;
  baseQuat: THREE.Quaternion;
  /** +1 antihorario visto desde arriba (brazo CCW), -1 horario (brazo CW). */
  sentido: number;
  /** "cw" o "ccw": a que mando de brazo responde. */
  brazo: "cw" | "ccw";
  /** Radio maximo de los vertices respecto al eje, en metros. */
  radio: number;
  /** Altura sobre el eje (local del pivote) del borde de donde salen las gotas. */
  alturaBorde: number;
  /** Inclinacion del eje respecto a la vertical, en grados (validacion). */
  inclinacionGrados: number;
  /** Angulo acumulado, en radianes. */
  angulo: number;
}

/** Brazo al que pertenece un nodo, por el nombre de su raiz (`brazo_CW_3`). */
function brazoDe(nodo: THREE.Object3D): { raiz: THREE.Object3D; sentido: "cw" | "ccw" } | null {
  let actual: THREE.Object3D | null = nodo;
  while (actual) {
    if (/^brazo_CCW/i.test(actual.name)) return { raiz: actual, sentido: "ccw" };
    if (/^brazo_CW/i.test(actual.name)) return { raiz: actual, sentido: "cw" };
    actual = actual.parent;
  }
  return null;
}

/**
 * Autovector de menor autovalor de una matriz simetrica 3x3 (Jacobi). Es la
 * direccion de menor varianza de los vertices: en un solido de revolucion
 * aplanado como el disco, su eje.
 */
function ejeDeMenorVarianza(c: number[][]): THREE.Vector3 {
  const a = c.map((fila) => fila.slice());
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let iter = 0; iter < 50; iter++) {
    let p = 0;
    let q = 1;
    for (const [i, k] of [[0, 1], [0, 2], [1, 2]] as const) {
      if (Math.abs(a[i][k]) > Math.abs(a[p][q])) {
        p = i;
        q = k;
      }
    }
    if (Math.abs(a[p][q]) < 1e-15) break;
    const theta = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    for (let k = 0; k < 3; k++) {
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = cos * akp - sin * akq;
      a[k][q] = sin * akp + cos * akq;
    }
    for (let k = 0; k < 3; k++) {
      const apk = a[p][k];
      const aqk = a[q][k];
      a[p][k] = cos * apk - sin * aqk;
      a[q][k] = sin * apk + cos * aqk;
    }
    for (let k = 0; k < 3; k++) {
      const vkp = v[k][p];
      const vkq = v[k][q];
      v[k][p] = cos * vkp - sin * vkq;
      v[k][q] = sin * vkp + cos * vkq;
    }
  }
  let menor = 0;
  if (a[1][1] < a[menor][menor]) menor = 1;
  if (a[2][2] < a[menor][menor]) menor = 2;
  return new THREE.Vector3(v[0][menor], v[1][menor], v[2][menor]).normalize();
}

/** Vertices de una malla (y sus hijas) en coordenadas del mundo. */
function verticesMundo(nodo: THREE.Object3D): THREE.Vector3[] {
  const puntos: THREE.Vector3[] = [];
  nodo.traverse((n) => {
    const malla = n as THREE.Mesh;
    if (!malla.isMesh) return;
    const pos = malla.geometry.getAttribute("position");
    if (!pos) return;
    // Con KHR_mesh_quantization el atributo viene normalizado y la escala va en
    // la matriz del nodo; fromBufferAttribute ya desnormaliza.
    for (let i = 0; i < pos.count; i++) {
      puntos.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(malla.matrixWorld));
    }
  });
  return puntos;
}

/**
 * Busca los discos dentro de `raiz`, mide su eje y los cuelga de un pivote.
 * Modifica el arbol de `raiz` (agrega un nodo `pivote_<disco>` por disco), asi
 * que se llama sobre la copia de la escena, nunca sobre la del cache de useGLTF.
 */
export function prepararDiscos(raiz: THREE.Object3D): Disco[] {
  raiz.updateMatrixWorld(true);
  const nodos: THREE.Object3D[] = [];
  raiz.traverse((n) => {
    if (/^(der|izq)_disco/i.test(n.name)) nodos.push(n);
  });

  const discos: Disco[] = [];
  for (const nodo of nodos) {
    const brazo = brazoDe(nodo);
    const padre = nodo.parent;
    if (!brazo || !padre) continue;

    const puntos = verticesMundo(nodo);
    if (puntos.length < 3) continue;

    const centro = new THREE.Vector3();
    for (const p of puntos) centro.add(p);
    centro.divideScalar(puntos.length);

    const cov = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const d = new THREE.Vector3();
    for (const p of puntos) {
      d.subVectors(p, centro);
      const arr = [d.x, d.y, d.z];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) cov[r][k] += arr[r] * arr[k];
    }
    const eje = ejeDeMenorVarianza(cov);
    // Eje apuntando hacia arriba: asi "antihorario visto desde arriba" es un
    // angulo positivo para los dos brazos.
    if (eje.y < 0) eje.negate();

    // Radio y altura del borde: el borde es donde el disco es mas ancho, y las
    // gotas salen de ahi, no del centroide.
    let radio = 0;
    const radiales: { r: number; h: number }[] = [];
    for (const p of puntos) {
      d.subVectors(p, centro);
      const h = d.dot(eje);
      const r = Math.sqrt(Math.max(0, d.lengthSq() - h * h));
      radiales.push({ r, h });
      if (r > radio) radio = r;
    }
    let sumaH = 0;
    let n = 0;
    for (const { r, h } of radiales) {
      if (r >= radio * 0.95) {
        sumaH += h;
        n++;
      }
    }
    const alturaBorde = n > 0 ? sumaH / n : 0;

    const inclinacionGrados = THREE.MathUtils.radToDeg(eje.angleTo(new THREE.Vector3(0, 1, 0)));
    if (process.env.NODE_ENV !== "production" && (inclinacionGrados < 15 || inclinacionGrados > 25)) {
      // Referencia del diseno: 20 grados hacia afuera. Si sale otra cosa, el
      // GLB cambio o el PCA tomo un eje equivocado: avisa en desarrollo.
      console.warn(
        `[aspersion] ${nodo.name}: eje inclinado ${inclinacionGrados.toFixed(1)}°, se esperaban ~20°`,
      );
    }

    // Pivote en el centro del disco con su Y local sobre el eje. Se agrega al
    // mismo padre (el brazo) para que se pliegue y se mueva con el, y el disco
    // se cuelga de el conservando su posicion en el mundo (attach).
    const pivote = new THREE.Object3D();
    pivote.name = `pivote_${nodo.name}`;
    const cuatMundo = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), eje);
    const cuatPadre = padre.getWorldQuaternion(new THREE.Quaternion());
    const escalaPadre = padre.getWorldScale(new THREE.Vector3());
    padre.add(pivote);
    pivote.position.copy(padre.worldToLocal(centro.clone()));
    pivote.quaternion.copy(cuatPadre.invert().multiply(cuatMundo));
    // El pivote no hereda la escala del brazo: compensarla deja sus unidades
    // en metros del mundo, que es como estan medidos radio y alturaBorde.
    pivote.scale.set(1 / escalaPadre.x, 1 / escalaPadre.y, 1 / escalaPadre.z);
    pivote.updateMatrixWorld(true);
    pivote.attach(nodo);

    discos.push({
      nodo,
      pivote,
      baseQuat: pivote.quaternion.clone(),
      sentido: brazo.sentido === "ccw" ? 1 : -1,
      brazo: brazo.sentido,
      radio,
      alturaBorde,
      inclinacionGrados,
      angulo: 0,
    });
  }
  return discos;
}

const EJE_Y = new THREE.Vector3(0, 1, 0);
const giro = new THREE.Quaternion();

/**
 * Avanza el giro de cada disco. `rpm` ya trae aplicada la rampa (0 = quieto);
 * `activo` dice si el brazo de ese disco esta encendido.
 */
export function girarDiscos(
  discos: Disco[],
  rpmPorBrazo: { cw: number; ccw: number },
  delta: number,
) {
  for (const d of discos) {
    const rpm = rpmPorBrazo[d.brazo];
    if (rpm <= 0) continue;
    d.angulo = (d.angulo + (rpm / 60) * Math.PI * 2 * d.sentido * delta) % (Math.PI * 2);
    giro.setFromAxisAngle(EJE_Y, d.angulo);
    d.pivote.quaternion.multiplyQuaternions(d.baseQuat, giro);
  }
}

/** Devuelve los discos a su pose del GLB (al reiniciar o al salir). */
export function detenerDiscos(discos: Disco[]) {
  for (const d of discos) {
    d.angulo = 0;
    d.pivote.quaternion.copy(d.baseQuat);
  }
}
