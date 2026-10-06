import * as THREE from "three";
import type { Pieza } from "@/lib/esquema";
import { normalizarNombre } from "@/lib/texto";
import { organizarEnCuadricula } from "./cuadricula";

/**
 * Empareja los nodos de un modelo 3D con las piezas del catalogo.
 *
 * ORDEN DE BUSQUEDA (de mas confiable a menos):
 *   1. Propiedad personalizada  mxd_sku  del objeto en Blender.
 *      Es el metodo recomendado: sobrevive a cambios de nombre.
 *      En Blender: Object Properties > Custom Properties > New,
 *      nombre "mxd_sku", valor "MX80-001".
 *      Al exportar activa "Include > Custom Properties".
 *   2. Coincidencia del nombre del objeto con alguno de los alias
 *      declarados en el catalogo (campo nombresBlender), ignorando
 *      mayusculas, acentos, guiones y los sufijos .001 de Blender.
 *
 * Los nodos que no coinciden con nada se reportan para que aparezcan
 * en el panel de diagnostico, en lugar de desaparecer en silencio.
 */

export interface PiezaEnEscena {
  /** SKU del objeto: puede ser una subpieza (MX80-001-02). */
  sku: string;
  /**
   * Pieza de CATALOGO a la que pertenece: su padre, o ella misma si no es
   * subpieza. Es la llave con la que se agrupa en la vista organizada y la
   * que se selecciona al hacer clic, para que el panel muestre la pieza que
   * el usuario reconoce y no un tornillo interno.
   */
  grupo: string;
  objeto: THREE.Object3D;
  /** Posicion local original, antes de explotar. */
  posicionBase: THREE.Vector3;
  /** Rotacion local original. */
  cuaternionBase: THREE.Quaternion;
  /** Posicion local en la vista organizada por filas y columnas (200%). */
  posicionOrganizada: THREE.Vector3;
  /** Rotacion local en la vista organizada por filas y columnas (200%). */
  cuaternionOrganizado: THREE.Quaternion;
  /** Direccion de separacion, ya convertida al espacio local del padre. */
  direccion: THREE.Vector3;
  /** Multiplicador individual de separacion. */
  factor: number;
  /** Centro de la pieza en coordenadas del mundo. */
  centro: THREE.Vector3;
  /** Radio de la esfera envolvente de la pieza (define el acercamiento de camara). */
  radioPieza: number;
  /** Materiales clonados de esta pieza, con su estado original guardado. */
  materiales: MaterialGuardado[];
}

export interface MaterialGuardado {
  material: THREE.MeshStandardMaterial;
  emisivoOriginal: THREE.Color;
  mapaEmisivoOriginal: THREE.Texture | null;
  intensidadEmisivaOriginal: number;
  opacidadOriginal: number;
  transparenteOriginal: boolean;
}

export interface ResultadoResolucion {
  piezas: PiezaEnEscena[];
  sinCoincidencia: string[];
  radio: number;
  centroEnsamble: THREE.Vector3;
  /** Dimensiones completas de la caja envolvente del ensamble. */
  tamanoEnsamble: THREE.Vector3;
}

/** Construye el indice nombre-normalizado -> SKU a partir del catalogo. */
function construirIndice(catalogo: Pieza[]): Map<string, string> {
  const indice = new Map<string, string>();
  for (const pieza of catalogo) {
    const claves = [
      pieza.sku,
      pieza.slug,
      pieza.nombre,
      ...pieza.nombresBlender,
    ];
    for (const clave of claves) {
      const normalizada = normalizarNombre(clave);
      if (normalizada && !indice.has(normalizada)) {
        indice.set(normalizada, pieza.sku);
      }
    }
  }
  return indice;
}

/** Determina el SKU de un objeto, o null si no corresponde a ninguna pieza. */
function skuDeObjeto(
  objeto: THREE.Object3D,
  indice: Map<string, string>,
  skusValidos: Set<string>,
): string | null {
  // 1. Propiedad personalizada exportada desde Blender.
  const propiedad = objeto.userData?.mxd_sku;
  if (typeof propiedad === "string" && skusValidos.has(propiedad.trim())) {
    return propiedad.trim();
  }
  // 2. Coincidencia por nombre.
  const porNombre = indice.get(normalizarNombre(objeto.name ?? ""));
  return porNombre ?? null;
}

/** Clona los materiales de una rama para poder resaltarla sin afectar a las demas. */
export function prepararMateriales(raizPieza: THREE.Object3D): MaterialGuardado[] {
  const guardados: MaterialGuardado[] = [];

  raizPieza.traverse((nodo) => {
    const malla = nodo as THREE.Mesh;
    if (!malla.isMesh) return;

    malla.castShadow = true;
    malla.receiveShadow = true;

    const originales = Array.isArray(malla.material)
      ? malla.material
      : [malla.material];

    const clonados = originales.map((mat) => {
      const clon = (mat as THREE.Material).clone() as THREE.MeshStandardMaterial;
      // Solo los MeshStandardMaterial tienen emissive; si el GLB trae otro tipo,
      // se convierte el manejo a un no-op seguro comprobando la propiedad.
      if (clon.emissive === undefined) {
        clon.emissive = new THREE.Color(0x000000);
      }
      guardados.push({
        material: clon,
        emisivoOriginal: clon.emissive.clone(),
        mapaEmisivoOriginal: clon.emissiveMap ?? null,
        intensidadEmisivaOriginal: clon.emissiveIntensity ?? 1,
        opacidadOriginal: clon.opacity,
        transparenteOriginal: clon.transparent,
      });
      return clon;
    });

    malla.material = Array.isArray(malla.material) ? clonados : clonados[0];
  });

  return guardados;
}

/**
 * Reparto del despiece para una pieza que el GLB trae como VARIOS objetos.
 *
 * El motor es el caso: nueve objetos concentricos apilados sobre su eje. Con
 * la direccion automatica normal —la que va del centro del ensamble al centro
 * de la pieza— los nueve apuntan casi al mismo lado, porque estan a milimetros
 * unos de otros y a medio brazo de distancia del centro. Resultado: el motor
 * se desplaza armado y no se abre nunca, por mucho que se suba el factor.
 *
 * Aqui se hace lo que hace un despiece de manual: se detecta el eje sobre el
 * que estan apilados y se separan a lo largo de EL, escalonados desde el
 * centro del grupo. El objeto del medio se queda quieto y sirve de referencia;
 * los de los extremos son los que mas viajan.
 */
interface RepartoInterno {
  direccion: THREE.Vector3;
  /** Multiplicador del factor de la pieza, de 0 en el centro a 1 en los extremos. */
  escala: number;
}

function repartirDespieceInterno(centros: THREE.Vector3[]): RepartoInterno[] {
  const n = centros.length;

  // Eje de apilamiento: aquel en el que los centros estan mas separados.
  const dispersion = [0, 1, 2].map((k) => {
    const valores = centros.map((c) => c.getComponent(k));
    return Math.max(...valores) - Math.min(...valores);
  });
  const eje = dispersion.indexOf(Math.max(...dispersion));
  const direccionEje = new THREE.Vector3().setComponent(eje, 1);

  // Orden a lo largo del eje, del extremo inferior al superior.
  const orden = centros
    .map((_, i) => i)
    .sort((a, b) => centros[a].getComponent(eje) - centros[b].getComponent(eje));

  const reparto: RepartoInterno[] = new Array(n);
  const medio = (n - 1) / 2;
  for (let rango = 0; rango < n; rango++) {
    const i = orden[rango];
    const desde = rango - medio; // negativo hacia abajo, positivo hacia arriba
    reparto[i] = {
      direccion: direccionEje.clone().multiplyScalar(Math.sign(desde) || 1),
      escala: medio > 0 ? Math.abs(desde) / medio : 0,
    };
  }
  return reparto;
}

export function resolverPiezas(
  raiz: THREE.Object3D,
  catalogo: Pieza[],
): ResultadoResolucion {
  const indice = construirIndice(catalogo);
  const skusValidos = new Set(catalogo.map((p) => p.sku));
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));

  // Una misma pieza puede aparecer varias veces en el ensamble
  // (dos helices, dos motores...): cada objeto se registra por separado.
  const encontradas: [string, THREE.Object3D][] = [];
  const sinCoincidencia: string[] = [];

  // Recorrido en profundidad. Al encontrar una pieza NO se sigue bajando:
  // toda su rama pertenece a esa pieza.
  const recorrer = (nodo: THREE.Object3D) => {
    const sku = skuDeObjeto(nodo, indice, skusValidos);
    if (sku) {
      encontradas.push([sku, nodo]);
      return;
    }
    if (nodo.children.length === 0) {
      // Hoja sin coincidencia: se reporta solo si es una malla con nombre.
      const malla = nodo as THREE.Mesh;
      if (malla.isMesh && nodo.name) sinCoincidencia.push(nodo.name);
      return;
    }
    for (const hijo of [...nodo.children]) recorrer(hijo);
  };

  for (const hijo of [...raiz.children]) recorrer(hijo);

  // Geometria global del ensamble: define el zoom y la escala de la explosion.
  raiz.updateWorldMatrix(true, true);
  const cajaTotal = new THREE.Box3().setFromObject(raiz);
  const centroEnsamble = cajaTotal.getCenter(new THREE.Vector3());
  const esfera = cajaTotal.getBoundingSphere(new THREE.Sphere());
  const radio = esfera.radius > 0 ? esfera.radius : 1;
  const tamanoEnsamble = cajaTotal.getSize(new THREE.Vector3());

  // Reparto interno de las piezas que aparecen como varios objetos. Solo
  // aplica a las que dejan direccionExplosion en null: si el catalogo declara
  // una direccion explicita, manda esa.
  const repartos = new Map<THREE.Object3D, RepartoInterno>();
  {
    // Se agrupa por pieza de catalogo: las nueve subpiezas del motor tienen
    // SKU distinto pero se abren como un solo conjunto.
    const porGrupo = new Map<string, THREE.Object3D[]>();
    for (const [sku, objeto] of encontradas) {
      // Solo entran las que dejan la direccion en null; si el catalogo declara
      // una direccion explicita para esa subpieza, manda esa.
      if (porSku.get(sku)?.direccionExplosion) continue;
      const grupo = porSku.get(sku)?.parteDe ?? sku;
      const lista = porGrupo.get(grupo);
      if (lista) lista.push(objeto);
      else porGrupo.set(grupo, [objeto]);
    }
    for (const nodos of porGrupo.values()) {
      if (nodos.length < 2) continue;
      const centros = nodos.map((o) =>
        new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()),
      );
      const reparto = repartirDespieceInterno(centros);
      nodos.forEach((o, i) => repartos.set(o, reparto[i]));
    }
  }

  const piezas: PiezaEnEscena[] = [];

  for (const [sku, objeto] of encontradas) {
    const datos = porSku.get(sku);
    if (!datos) continue;

    const caja = new THREE.Box3().setFromObject(objeto);
    const centro = caja.getCenter(new THREE.Vector3());
    const esferaPieza = caja.getBoundingSphere(new THREE.Sphere());
    const radioPieza = esferaPieza.radius > 0 ? esferaPieza.radius : 0.05;

    // Direccion de separacion y cuanto viaja esta copia en concreto.
    const reparto = repartos.get(objeto);
    let factor = datos.factorExplosion;
    let direccionMundo: THREE.Vector3;
    if (datos.direccionExplosion) {
      direccionMundo = new THREE.Vector3(...datos.direccionExplosion);
    } else if (reparto) {
      // Pieza de varios objetos: se abre sobre su propio eje, escalonada.
      direccionMundo = reparto.direccion.clone();
      factor *= reparto.escala;
    } else {
      direccionMundo = centro.clone().sub(centroEnsamble);
    }
    if (direccionMundo.lengthSq() < 1e-8) {
      // Pieza centrada en el ensamble: se separa hacia arriba.
      direccionMundo.set(0, 1, 0);
    }
    direccionMundo.normalize();

    // Pasar la direccion al espacio local del padre para poder sumarla a position.
    const direccionLocal = direccionMundo.clone();
    if (objeto.parent) {
      const cuaternionPadre = new THREE.Quaternion();
      objeto.parent.getWorldQuaternion(cuaternionPadre);
      direccionLocal.applyQuaternion(cuaternionPadre.invert());
    }

    // Marca para que el manejador de clics sepa a que pieza pertenece cada
    // malla. Se marca el GRUPO: al hacer clic en el estator, el panel abre la
    // ficha del motor, que es lo que existe en el catalogo.
    const grupo = datos.parteDe ?? sku;
    objeto.traverse((n) => {
      n.userData.__mxdSku = grupo;
    });

    piezas.push({
      sku,
      grupo,
      objeto,
      posicionBase: objeto.position.clone(),
      cuaternionBase: objeto.quaternion.clone(),
      // Se calculan abajo, cuando ya se conocen todas las piezas.
      posicionOrganizada: objeto.position.clone(),
      cuaternionOrganizado: objeto.quaternion.clone(),
      direccion: direccionLocal.normalize(),
      factor,
      centro,
      radioPieza,
      materiales: prepararMateriales(objeto),
    });
  }

  // Destinos de la vista organizada en filas y columnas.
  const destinos = organizarEnCuadricula(
    piezas.map((p) => ({
      objeto: p.objeto,
      // Llave de agrupacion: una celda por pieza de catalogo. El balanceador
      // ocupa una sola celda aunque sean tres objetos, igual que el ESC con
      // su base y el motor con sus nueve subpiezas.
      sku: p.grupo,
      orden: porSku.get(p.grupo)?.orden ?? porSku.get(p.sku)?.orden ?? 999,
    })),
    radio,
  );
  piezas.forEach((p, i) => {
    p.posicionOrganizada = destinos[i].posicion;
    p.cuaternionOrganizado = destinos[i].cuaternion;
  });

  return {
    piezas,
    sinCoincidencia: [...new Set(sinCoincidencia)],
    radio,
    centroEnsamble,
    tamanoEnsamble,
  };
}

/**
 * true si la pieza es `sku` o forma parte del grupo `sku`. Seleccion y hover
 * guardan el SKU del GRUPO (el balanceador, no cada uno de sus tres objetos),
 * asi que comparar solo contra pieza.sku dejaba sin resaltar a las subpiezas.
 */
export function perteneceAlSku(pieza: PiezaEnEscena, sku: string | null): boolean {
  return sku !== null && (pieza.sku === sku || pieza.grupo === sku);
}

/** Sube por la jerarquia hasta encontrar el SKU marcado, o null. */
export function skuDesdeObjeto(objeto: THREE.Object3D | null): string | null {
  let actual: THREE.Object3D | null = objeto;
  while (actual) {
    const sku = actual.userData?.__mxdSku;
    if (typeof sku === "string") return sku;
    actual = actual.parent;
  }
  return null;
}
