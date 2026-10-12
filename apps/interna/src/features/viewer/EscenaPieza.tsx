"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";

import { COLORES } from "@/config/marca";
import { obtenerSubpiezas } from "@/lib/catalogo";
import type { Pieza } from "@/lib/esquema";
import { normalizarNombre } from "@/lib/texto";

import { ajustarDetalleAlPlaceholder } from "./ajusteTuerca";
import { useVisor } from "./estado";
import { Escenario } from "./Escenario";
import { LimiteError } from "./LimiteError";
import { prepararMateriales, type MaterialGuardado } from "./resolverPiezas";

/** Tinte de hover. El del explorador (COLORES_3D.hover a 0.22) es casi
 * invisible sobre las piezas negras del balanceador; aqui se usa el verde
 * de acento y mas intensidad para que se note de verdad. */
const COLOR_HOVER = new THREE.Color(COLORES.verdeAcento);
const INTENSIDAD_HOVER = 0.7;
/** Cuanto se mezcla el color base hacia el verde: el emisivo solo no alcanza
 * en materiales blancos (la camisa de la tuerca se veria verde menta). */
const MEZCLA_HOVER = 0.7;
const colorOriginal = new WeakMap<THREE.Material, THREE.Color>();

/** Vueltas por segundo en radianes: una vuelta cada ~10 s. */
const VELOCIDAD_GIRO = 0.63;

/**
 * Cuanto se separan las sub-piezas al explotar, como fraccion de su propia
 * distancia al centro. 0.9 = cada pieza termina a 1.9x su offset original.
 * El margen de camara (ver mas abajo) esta calculado para que este valor
 * quepa en cuadro sin recalcular el encuadre durante la animacion.
 */
const FACTOR_DESPIECE = 0.9;

/** Velocidad de amortiguamiento de la animacion de despiece (mas alto = mas rapido). */
const AMORTIGUACION_DESPIECE = 4.5;

/**
 * MX80-001_v1.glb (el balanceador extraido del brazo, ver
 * extraer_piezas_glb.mjs) trae la tuerca como un placeholder simple
 * (sujetador_balanceador_1/2): dos nodos sin el despiece interno. El modelo
 * con detalle real (jacket + 2 spacers + tornillo) es un export CAD aparte
 * que solo existe como pieza suelta. Mismo mecanismo que TuercaDetallada.tsx
 * usa en el explorador completo, adaptado aqui a un solo GLB en vez de
 * varias instancias de PiezaEnEscena.
 */
const URL_TUERCA_DETALLADA = "/models/mx80/piezas/MX80-003_v2.glb";
const PATRON_TUERCA_PLACEHOLDER = /^sujetador_balanceador/i;

/**
 * Cuanto se separan jacket/spacers/tornillo entre si dentro del detalle,
 * igual que en TuercaDetallada.tsx (ver comentario ahi: la tuerca es
 * diminuta dentro del ensamble, necesita mas separacion relativa que el
 * resto de la pieza para que se note).
 */
const FACTOR_DESPIECE_INTERNO = 1.6;

/**
 * Geometria vacia compartida: ver el comentario largo en TuercaDetallada.tsx
 * sobre por que se vacia la geometria del placeholder en vez de ocultarlo.
 */
const GEOMETRIA_VACIA = new THREE.BufferGeometry();

interface ParteInternaTuerca {
  objeto: THREE.Object3D;
  base: THREE.Vector3;
}

/**
 * Sustituye cada nodo placeholder de la tuerca por una copia del modelo
 * detallado, ajustada a su tamano real. La escala sale de comparar el
 * bounding box del placeholder contra el del detalle (en vez de un factor
 * fijo como en TuercaDetallada.tsx) porque aqui el GLB de origen puede
 * cambiar de escala de Blender sin que nadie tenga que recalcular nada.
 */
function DetalleTuercaEnPieza({
  nodos,
  despiece,
}: {
  nodos: THREE.Mesh[];
  despiece: boolean;
}) {
  const gltf = useGLTF(URL_TUERCA_DETALLADA);
  const factorActual = useRef(0);

  const instancias = useMemo(() => {
    return nodos.map((nodo) => {
      nodo.geometry.computeBoundingBox();
      const caja = nodo.geometry.boundingBox ?? new THREE.Box3();

      const copia = gltf.scene.clone(true);
      const { escala, posicion: centro } = ajustarDetalleAlPlaceholder(copia, caja);
      const partes: ParteInternaTuerca[] = copia.children.map((hijo) => ({
        objeto: hijo,
        base: hijo.position.clone(),
      }));

      return { nodo, copia, escala, centro, partes };
    });
  }, [nodos, gltf]);

  useEffect(() => {
    const geometriasOriginales = new Map<THREE.Mesh, THREE.BufferGeometry>();
    for (const { nodo, copia, escala, centro } of instancias) {
      geometriasOriginales.set(nodo, nodo.geometry);
      nodo.geometry = GEOMETRIA_VACIA;
      copia.scale.setScalar(escala);
      copia.position.copy(centro);
      nodo.add(copia);
    }
    return () => {
      for (const { nodo, copia } of instancias) {
        nodo.remove(copia);
        const original = geometriasOriginales.get(nodo);
        if (original) nodo.geometry = original;
      }
    };
  }, [instancias]);

  useFrame((_, delta) => {
    factorActual.current = THREE.MathUtils.damp(
      factorActual.current,
      despiece ? 1 : 0,
      AMORTIGUACION_DESPIECE,
      delta,
    );
    const escala = 1 + factorActual.current * FACTOR_DESPIECE_INTERNO;
    for (const { partes } of instancias) {
      for (const parte of partes) {
        parte.objeto.position.copy(parte.base).multiplyScalar(escala);
      }
    }
  });

  return null;
}

useGLTF.preload(URL_TUERCA_DETALLADA);

function Cargando() {
  const { progress } = useProgress();
  return (
    <Html center>
      <span className="whitespace-nowrap text-xs font-medium tracking-wide text-mxd-gris">
        Cargando pieza {Math.round(progress)}%
      </span>
    </Html>
  );
}

interface ParteDespiece {
  objeto: THREE.Object3D;
  base: THREE.Vector3;
  /** Vector desde el centro del conjunto hasta el centro de esta parte. */
  separacion: THREE.Vector3;
}

/**
 * Empareja cada nodo de primer nivel del GLB con la subpieza del catalogo a
 * la que corresponde, por nombre (mismo criterio que resolverPiezas.ts para
 * el ensamble completo, pero aqui solo hace falta el primer nivel: esta
 * escena no tiene grupos ni mxd_sku, es una sola pieza con sus sub-piezas
 * directas). Sirve para que un clic en el visor de UNA pieza (p. ej. el
 * balanceador) lleve a la ficha de la parte exacta que se toco (p. ej. la
 * tuerca), igual que el clic en el explorador completo.
 */
function emparejarPartesConCatalogo(
  partes: { objeto: THREE.Object3D }[],
  subpiezas: Pieza[],
): Map<THREE.Object3D, Pieza> {
  const indice = new Map<string, Pieza>();
  // Indice por nombre EXACTO: normalizarNombre le quita el sufijo _N, asi que
  // spacer_balanceador_1 y spacer_balanceador_2 (dos piezas distintas) se
  // volverian el mismo nombre y las dos caerian en la primera subpieza.
  const indiceExacto = new Map<string, Pieza>();
  for (const sub of subpiezas) {
    for (const clave of [sub.sku, sub.slug, sub.nombre, ...sub.nombresBlender]) {
      const normalizada = normalizarNombre(clave);
      if (normalizada && !indice.has(normalizada)) indice.set(normalizada, sub);
      const exacta = clave.toLowerCase();
      if (!indiceExacto.has(exacta)) indiceExacto.set(exacta, sub);
    }
  }
  const emparejadas = new Map<THREE.Object3D, Pieza>();
  for (const { objeto } of partes) {
    const nombre = objeto.name ?? "";
    const sub =
      indiceExacto.get(nombre.toLowerCase()) ?? indice.get(normalizarNombre(nombre));
    if (sub) emparejadas.set(objeto, sub);
  }
  return emparejadas;
}

/** Muestra solo la pieza, centrada, girando sobre su eje vertical. */
function PiezaGirando({
  url,
  sku,
  alMedir,
  alDetectarPartes,
  alPasarSobreSubpieza,
  despiece,
  girando,
}: {
  url: string;
  /** SKU de catalogo de esta pieza: si tiene subpiezas, sus nodos de primer
   * nivel se vuelven clicables (llevan a la ficha de la subpieza tocada). */
  sku?: string;
  alMedir: (medidas: { radio: number; semialto: number }) => void;
  /** Numero de sub-piezas de nivel superior detectadas en el GLB (1 = no hay despiece posible). */
  alDetectarPartes?: (n: number) => void;
  /** Se llama con la subpieza bajo el cursor, o null al salir. */
  alPasarSobreSubpieza?: (pieza: Pieza | null) => void;
  /** true = animar hacia la vista explosionada; false = volver al ensamble. */
  despiece: boolean;
  /** false = pausar el giro automatico. */
  girando: boolean;
}) {
  const gltf = useGLTF(url);
  const camara = useThree((s) => s.camera);
  const router = useRouter();
  const giro = useRef<THREE.Group>(null);
  const factorActual = useRef(0);
  const subpiezas = useMemo(() => (sku ? obtenerSubpiezas(sku) : []), [sku]);

  const { raiz, partes, nodosTuerca, radio, semialto } = useMemo(() => {
    const copia = gltf.scene.clone(true);
    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);
    const contenedor = new THREE.Group();
    contenedor.add(copia);
    const tamano = caja.getSize(new THREE.Vector3());
    // Cada nodo de primer nivel es una sub-pieza (balanceador superior,
    // inferior, ESC, base...). Las estampas (decals) no son una parte del despiece: viajan pegadas a la
    // pieza mas cercana, si no se quedarian flotando solas al separarse.
    contenedor.updateMatrixWorld(true);
    const centroDe = (o: THREE.Object3D) =>
      new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const esEstampa = (o: THREE.Object3D) => /^estampa_/i.test(o.name);
    const principales = copia.children.filter((h) => !esEstampa(h));
    if (principales.length > 0) {
      for (const estampa of copia.children.filter(esEstampa)) {
        const c = centroDe(estampa);
        let mejor = principales[0];
        let distMin = Infinity;
        for (const p of principales) {
          const d = centroDe(p).distanceToSquared(c);
          if (d < distMin) {
            distMin = d;
            mejor = p;
          }
        }
        mejor.attach(estampa);
      }
    }

    // Cada parte se separa a lo largo del vector que va del centro del conjunto
    // (el promedio de los centros de sus partes) al suyo. No del origen de la
    // escena: el GLB de una pieza puede no estar centrado en el origen.
    const centros = copia.children.map(centroDe);
    const promedio = centros
      .reduce((acc, c) => acc.add(c), new THREE.Vector3())
      .divideScalar(Math.max(centros.length, 1));
    const partes: ParteDespiece[] = copia.children.map((hijo, i) => ({
      objeto: hijo,
      base: hijo.position.clone(),
      separacion: centros[i].clone().sub(promedio),
    }));
    const nodosTuerca = copia.children.filter(
      (hijo): hijo is THREE.Mesh =>
        (hijo as THREE.Mesh).isMesh === true &&
        PATRON_TUERCA_PLACEHOLDER.test(hijo.name),
    );
    return {
      raiz: contenedor,
      partes,
      nodosTuerca,
      radio: tamano.length() / 2,
      semialto: tamano.y / 2,
    };
  }, [gltf]);

  // Que parte de primer nivel corresponde a que subpieza del catalogo, para
  // resolver el clic. Separado del useMemo de arriba porque no depende del
  // GLB: cambia solo si cambia el catalogo de subpiezas (en la practica,
  // nunca, ya montado).
  const piezasPorObjeto = useMemo(
    () => emparejarPartesConCatalogo(partes, subpiezas),
    [partes, subpiezas],
  );

  // Materiales clonados de las partes de cada subpieza (prepararMateriales
  // clona para no pisar el material que comparte el cache de useGLTF). Se
  // preparan la PRIMERA vez que se pasa el cursor, no al montar: la tuerca
  // detallada se inyecta en un efecto posterior y sus mallas tienen que
  // existir ya para quedar incluidas. Una subpieza puede ser varios nodos
  // (sujetador_balanceador_1 y _2 son la misma tuerca), por eso se acumulan
  // todos bajo el mismo sku.
  const cacheMateriales = useMemo(
    () => new Map<string, MaterialGuardado[]>(),
    [piezasPorObjeto],
  );
  const materialesDe = (sku: string): MaterialGuardado[] => {
    let lista = cacheMateriales.get(sku);
    if (!lista) {
      lista = [];
      for (const [objeto, pieza] of piezasPorObjeto) {
        if (pieza.sku === sku) lista.push(...prepararMateriales(objeto));
      }
      cacheMateriales.set(sku, lista);
    }
    return lista;
  };

  /** SKU actualmente resaltado en verde, o null. Vive en un ref (no state):
   * cambia en cada movimiento del mouse y no debe disparar un rerender. */
  const skuResaltado = useRef<string | null>(null);

  /** Pinta de verde las partes de `sku` y devuelve a su color original las
   * del que estaba resaltado antes. Mismo tinte que PlataformaPiezas.tsx. */
  const resaltar = (sku: string | null) => {
    if (sku === skuResaltado.current) return;
    if (skuResaltado.current) {
      for (const g of materialesDe(skuResaltado.current)) {
        g.material.emissive.copy(g.emisivoOriginal);
        g.material.emissiveMap = g.mapaEmisivoOriginal;
        g.material.emissiveIntensity = g.intensidadEmisivaOriginal;
        const base = colorOriginal.get(g.material);
        if (base) g.material.color.copy(base);
        g.material.needsUpdate = true;
      }
    }
    if (sku) {
      for (const g of materialesDe(sku)) {
        g.material.emissive.copy(COLOR_HOVER);
        g.material.emissiveMap = null;
        g.material.emissiveIntensity = INTENSIDAD_HOVER;
        if (!colorOriginal.has(g.material)) {
          colorOriginal.set(g.material, g.material.color.clone());
        }
        g.material.color
          .copy(colorOriginal.get(g.material)!)
          .lerp(COLOR_HOVER, MEZCLA_HOVER);
        g.material.needsUpdate = true;
      }
    }
    skuResaltado.current = sku;
  };

  // Restaura los materiales al desmontar: si el usuario navega justo con el
  // cursor encima de una subpieza, sin esto se quedaria pintada de verde en
  // la copia cacheada del GLB (useGLTF reusa la escena entre montajes).
  useEffect(() => {
    return () => resaltar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheMateriales]);

  /** Sube por los padres desde el objeto tocado hasta dar con una parte de
   * primer nivel emparejada con el catalogo, o null si el clic no toco
   * ninguna (p. ej. el piso del estudio). */
  const piezaDesdeEvento = (evento: { object: THREE.Object3D }): Pieza | null => {
    let actual: THREE.Object3D | null = evento.object;
    while (actual) {
      const pieza = piezasPorObjeto.get(actual);
      if (pieza) return pieza;
      actual = actual.parent;
    }
    return null;
  };

  useEffect(() => {
    // La luz y la sombra del estudio se escalan con este radio.
    useVisor.setState({ radio });
    alMedir({ radio, semialto });
    alDetectarPartes?.(partes.length);
    if (camara instanceof THREE.PerspectiveCamera) {
      // Con mas de una sub-pieza dejamos margen extra: el despiece separa
      // las partes hasta 1.9x su offset original y no recalcula el encuadre
      // durante la animacion, asi que el margen tiene que preverlo de una vez.
      const margen = partes.length > 1 ? 2.3 : 1.15;
      const distancia = (radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2))) * margen;
      camara.position
        .set(1, 0.5, 1.25)
        .normalize()
        .multiplyScalar(distancia);
      camara.near = Math.max(radio * 0.01, 0.001);
      camara.far = radio * 60;
      camara.lookAt(0, 0, 0);
      camara.updateProjectionMatrix();
    }
  }, [radio, semialto, camara, alMedir, alDetectarPartes, partes]);

  // Limpieza del cursor al desmontar (si el usuario navega justo con el
  // puntero encima de una subpieza, sin esto se quedaria en "pointer").
  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  useFrame((_, delta) => {
    // Con el cursor sobre una subpieza el modelo se queda quieto: si siguiera
    // girando, la pieza se iria de debajo del cursor antes de poder dar clic.
    if (giro.current && girando && !skuResaltado.current) {
      giro.current.rotation.y += delta * VELOCIDAD_GIRO;
    }

    factorActual.current = THREE.MathUtils.damp(
      factorActual.current,
      despiece ? 1 : 0,
      AMORTIGUACION_DESPIECE,
      delta,
    );
    if (partes.length > 1) {
      const escala = factorActual.current * FACTOR_DESPIECE;
      for (const parte of partes) {
        parte.objeto.position
          .copy(parte.base)
          .addScaledVector(parte.separacion, escala);
      }
    }
  });

  return (
    <group ref={giro}>
      <primitive
        object={raiz}
        onPointerMove={(evento: ThreeEvent<PointerEvent>) => {
          // onPointerMove (no onPointerOver) porque el cursor puede pasar de
          // una malla a otra DENTRO de la misma parte (p. ej. la tuerca trae
          // 4 mallas): onPointerOver/Out dispararian un parpadeo del tinte
          // en cada cruce. Aqui solo se actualiza si el SKU resuelto cambio.
          const pieza = piezaDesdeEvento(evento);
          const sku = pieza?.sku ?? null;
          if (sku === skuResaltado.current) return;
          if (pieza) evento.stopPropagation();
          document.body.style.cursor = pieza ? "pointer" : "auto";
          resaltar(sku);
          alPasarSobreSubpieza?.(pieza);
        }}
        onPointerOut={() => {
          // Se dispara al salir de TODA la pieza (no de una malla interna):
          // aqui si conviene limpiar sin condicion.
          if (!skuResaltado.current) return;
          document.body.style.cursor = "auto";
          resaltar(null);
          alPasarSobreSubpieza?.(null);
        }}
        onClick={(evento: ThreeEvent<MouseEvent>) => {
          const pieza = piezaDesdeEvento(evento);
          if (!pieza) return;
          evento.stopPropagation();
          document.body.style.cursor = "auto";
          router.push(`/catalogo/${pieza.slug}`);
        }}
      />
      {nodosTuerca.length > 0 && (
        <DetalleTuercaEnPieza nodos={nodosTuerca} despiece={despiece} />
      )}
    </group>
  );
}

export function EscenaPieza({
  url,
  sku,
  despiece = false,
  girando = true,
  alDetectarPartes,
  alPasarSobreSubpieza,
}: {
  url: string;
  /** SKU de catalogo de la pieza mostrada: activa el clic a subpiezas. */
  sku?: string;
  /** true = mostrar las sub-piezas separadas en vez del ensamble. */
  despiece?: boolean;
  /** false = pausar el giro automatico (el usuario sigue pudiendo arrastrar). */
  girando?: boolean;
  /** Se llama al cargar con el numero de sub-piezas del GLB. */
  alDetectarPartes?: (n: number) => void;
  /** Se llama con la subpieza bajo el cursor, o null al salir. */
  alPasarSobreSubpieza?: (pieza: Pieza | null) => void;
}) {
  // Los limites de zoom dependen del tamano real de la pieza: los controles
  // se montan hasta conocerlo, ya con la camara encuadrada.
  const [medidas, setMedidas] = useState<{ radio: number; semialto: number } | null>(null);
  const radio = medidas?.radio ?? null;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 35, position: [1.8, 1.0, 2.3], near: 0.01, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Escenario sombraY={medidas ? -medidas.semialto * 1.02 : undefined} />
      <LimiteError respaldo={null}>
        <Suspense fallback={<Cargando />}>
          <PiezaGirando
            url={url}
            sku={sku}
            alMedir={setMedidas}
            alDetectarPartes={alDetectarPartes}
            alPasarSobreSubpieza={alPasarSobreSubpieza}
            despiece={despiece}
            girando={girando}
          />
        </Suspense>
      </LimiteError>
      {radio !== null && (
        <OrbitControls
          makeDefault
          enableDamping
          enablePan={false}
          minDistance={radio * 1.5}
          maxDistance={radio * 9}
          maxPolarAngle={Math.PI * 0.495}
        />
      )}
    </Canvas>
  );
}
