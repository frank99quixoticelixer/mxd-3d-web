"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";

import { COLORES } from "@/config/marca";
import {
  ANGULO_MAX_PLEGADO_FRAME,
  GLB_FRAME,
  urlModelo,
} from "@/config/modelos3d";
import { prepararMateriales, type MaterialGuardado } from "./resolverPiezas";
import { useVisor } from "./estado";
import { organizarEnCuadricula } from "./cuadricula";
import { Escenario } from "./Escenario";
import { LimiteError } from "./LimiteError";

/**
 * Los cuatro brazos del chasis se identifican por nombre de nodo, no por SKU.
 * El GLB es frame_MX80_v3_web.glb (4 brazos, geometria espejada en pares).
 *
 * THREE.GLTFLoader sanea nombres (PropertyBinding.sanitizeNodeName): quita
 * puntos y convierte espacios en guion bajo. Los nombres del v3 NO tienen
 * puntos en los propios brazos (brazo_2, no brazo.002), pero sus hijos si:
 * "giratorio.001" → "giratorio001", "propela_1.002" → "propela_1002".
 *
 * "agarrador de brazo"/.001/.002/.003 y "retenedor_brazo"*: brackets fijos
 * al frame, no se animan con el plegado.
 */
const NOMBRES_BRAZO = ["brazo", "brazo_2", "brazo_3", "brazo_4"] as const;

const COLOR_HOVER_BRAZO = new THREE.Color(COLORES.verdeAcento);
const COLOR_HOVER_MARCO = new THREE.Color(COLORES.verdeAcento);
const COLOR_HOVER_TANQUE = new THREE.Color(COLORES.verdeAcento);
const INTENSIDAD_HOVER = 0.7;
const MEZCLA_HOVER = 0.7;

/**
 * Nodo del tanque en el frame GLB (THREE.js sanitized).
 * Blender: "Tanque spline centrado 2.0" → THREE.js: quita puntos, espacios→_
 */
const NOMBRE_TANQUE = "Tanque_spline_centrado_20";

/** Nodos fijos del marco (THREE.js sanitized): agarradores, retenedores y tubos. */
const NOMBRES_MARCO = [
  "agarrador_de_brazo",
  "agarrador_de_brazo001",
  "agarrador_de_brazo002",
  "agarrador_de_brazo003",
  "retenedor_brazo",
  "retenedor_brazo_2",
  "retenedor_brazo_3",
  "retenedor_brazo_4",
  "tubo_de_42_step",
  "tubo_de_42_step001",
  "tubo_de_60_step",
  "tubo_de_60_step001",
] as const;

/** Velocidad de amortiguamiento del plegado (mas alto = mas rapido). */
const AMORTIGUACION_PLEGADO = 4.5;

/** Eje mundial de la bisagra: el chasis esta en Y-arriba; el plegado real es
 * hacia los lados (los brazos barren en el plano horizontal), asi que el eje
 * de giro es el vertical, Y. Confirmado visualmente, no viene marcado en el
 * GLB (se probo primero Z, que plegaba hacia arriba, y un eje por brazo
 * transformado por su propio baseQuat, que abria uno de los dos al lado
 * equivocado). Los dos brazos usan este mismo eje; lo que cambia entre uno
 * y otro es el signo (ver SIGNO_PLEGADO), por ser geometria espejada. */
const EJE_BISAGRA = new THREE.Vector3(0, 1, 0);

/**
 * Signo de giro de CADA brazo sobre EJE_BISAGRA: 1 = sentido horario visto
 * desde arriba (+Y), -1 = antihorario. Los brazos espejados llevan signo
 * contrario entre si. Corrije aqui si algun brazo pliega en la direccion
 * equivocada al probar visualmente.
 */
const SIGNO_PLEGADO: Record<(typeof NOMBRES_BRAZO)[number], number> = {
  brazo: 1,
  brazo_2: -1,
  brazo_3: -1,
  brazo_4: 1,
};

/**
 * Orden de despliegue: los brazos NO se abren a la vez, cada uno ocupa
 * su propio cuarto del recorrido del slider. 0 = primero, 3 = ultimo.
 */
/**
 * Coreografia del despliegue, en cuatro fases encadenadas sobre un unico
 * progreso 0..1. Cada fase ocupa su tramo y la siguiente no arranca hasta que
 * la anterior termina:
 *
 *   0.00 - 0.25  los cuatro giratorios giran a 180 grados
 *   0.25 - 0.50  se abren los brazos 2 y 4
 *   0.50 - 0.75  se abren los brazos 1 y 3
 *   0.75 - 1.00  se abren las palas de las helices
 *
 * Al contraer se recorre el mismo progreso hacia 0, asi que la secuencia se
 * reproduce exactamente al reves sin escribir una segunda coreografia: las
 * palas se cierran primero y los giratorios vuelven al final.
 */
const FASES = {
  giratorios: [0.0, 0.25],
  brazosPar: [0.25, 0.5],
  brazosImpar: [0.5, 0.75],
  palas: [0.75, 1.0],
} as const;

/** Progreso 0..1 dentro de un tramo: 0 antes de empezar, 1 ya terminado. */
function tramo(progreso: number, [inicio, fin]: readonly [number, number]): number {
  return THREE.MathUtils.clamp((progreso - inicio) / (fin - inicio), 0, 1);
}

/** Cuanto gira cada giratorio al abrirse, antes de que se muevan los brazos. */
const ANGULO_APERTURA_GIRATORIO = 180;

/**
 * Que brazos van en la primera tanda. Los pares (2 y 4) abren primero y los
 * impares (1 y 3) despues, para que no se estorben entre si al girar.
 */
const BRAZOS_PRIMERA_TANDA: readonly string[] = ["brazo_2", "brazo_4"];

/**
 * Las 2 palas de la helice de cada brazo. THREE.js sanitiza los puntos de
 * los hijos: "propela_1.002" → "propela_1002", etc.
 */
const NOMBRES_PALA: Record<(typeof NOMBRES_BRAZO)[number], readonly [string, string]> = {
  brazo: ["propela_1", "propela_2"],
  brazo_2: ["propela_1001", "propela_2001"],
  brazo_3: ["propela_1003", "propela_2003"],
  brazo_4: ["propela_1002", "propela_2002"],
};

/** Cuanto abre cada pala (grados) cuando su brazo llega a desplegado del todo. */
const ANGULO_APERTURA_PALA = 80;

/**
 * Fraccion del recorrido del brazo (0..1) a partir de la cual las palas
 * empiezan a abrirse. Por debajo de este umbral (brazo todavia moviendose o
 * plegado) las palas quedan exactamente en su baseQuat del GLB — la posicion
 * plana de transporte. Solo en el ultimo tramo se abren, ya con el brazo casi
 * en su sitio final.
 */
const UMBRAL_APERTURA_PALA = 0.85;

/**
 * Signo de apertura de cada pala dentro del par: opuesto entre las dos para
 * que se abran en tijera (una hacia cada lado) en vez de las dos para el
 * mismo lado. Mismo mecanismo que SIGNO_PLEGADO, a otra escala.
 */
const SIGNO_APERTURA_PALA: readonly [number, number] = [1, -1];

/** Eje LOCAL vertical, usado tanto por las palas como por "giratorio" (no
 * mundial: ambos viven varios niveles abajo de un brazo que ya esta
 * rotado, asi que "su propio arriba" solo tiene sentido en su propio
 * espacio, de ahi que se componga post-multiplicando en vez de
 * pre-multiplicando como EJE_BISAGRA — ver el useFrame). */
const EJE_LOCAL_VERTICAL = new THREE.Vector3(0, 1, 0);

/**
 * Nodo giratorio de cada brazo (motor_giratorio + balanceador + helices).
 * En el GLB los sufijos son .001, .002, .003; THREE.js los sanitiza a 001, etc.
 */
const NOMBRES_GIRATORIO: Record<(typeof NOMBRES_BRAZO)[number], string> = {
  brazo: "giratorio",
  brazo_2: "giratorio001",
  brazo_3: "giratorio003",
  brazo_4: "giratorio002",
};

/** Vueltas por segundo del rotor cuando el brazo esta desplegado del todo. */
const VELOCIDAD_GIRO_MOTOR = 1.6;

/**
 * Sentido de giro de cada rotor: +1 = CCW visto desde arriba, -1 = CW.
 * Determinado por el tipo de helice del GLB (Propela_CCW_* / Propela_CW_*).
 */
const SIGNO_GIRO: Record<(typeof NOMBRES_BRAZO)[number], number> = {
  brazo: 1,    // Propela_CCW
  brazo_2: -1, // Propela_CW
  brazo_3: -1, // Propela_CW
  brazo_4: 1,  // Propela_CCW
};

function Cargando() {
  const { progress } = useProgress();
  return (
    <Html center>
      <span className="whitespace-nowrap text-xs font-medium tracking-wide text-mxd-gris">
        Cargando chasis {Math.round(progress)}%
      </span>
    </Html>
  );
}

interface Pala {
  objeto: THREE.Object3D;
  baseQuat: THREE.Quaternion;
  signo: number;
}

interface Brazo {
  nombre: string;
  objeto: THREE.Object3D;
  baseQuat: THREE.Quaternion;
  palas: Pala[];
  giratorio: { objeto: THREE.Object3D; baseQuat: THREE.Quaternion } | null;
  materiales: MaterialGuardado[];
}

function ChasisPlegable({
  despliegue,
  encendido,
  explosion,
  despieceAtomico,
  alMedir,
  alClicBrazo,
  alClicMarco,
  alClicTanque,
}: {
  despliegue: number;
  encendido: number;
  explosion: number;
  despieceAtomico: number;
  /** Aceleracion de los rotores 0..1. Antes el giro dependia del despliegue;
   * ahora es un mando aparte, porque desplegar y acelerar son dos cosas. */
  alMedir: (medidas: { radio: number; semialto: number }) => void;
  /** Clic en un brazo: navega al explorador del brazo. La navegacion va
   * afuera del Canvas porque useRouter() no funciona dentro del reconciler
   * de R3F (ver VisorFrame.tsx). */
  alClicBrazo: () => void;
  /** Clic en un nodo fijo del marco: navega a /catalogo/marco. */
  alClicMarco: () => void;
  /** Clic en el tanque: navega a /catalogo/tanque. */
  alClicTanque: () => void;
}) {
  const gltf = useGLTF(urlModelo(GLB_FRAME));
  const camara = useThree((s) => s.camera);
  // Proporcion del lienzo: la rejilla del despiece se dimensiona con la misma
  // forma, para que quepa entera y no deje franjas vacias a los lados.
  const aspecto = useThree((s) => s.size.width / s.size.height);
  /** Angulo actual (amortiguado) de CADA brazo, por nombre: ya no es uno solo
   * compartido, cada uno avanza hacia su propio objetivo escalonado. */
  /** Progreso amortiguado de la coreografia: 0 contraido, 1 desplegado. */
  const progreso = useRef(0);
  /** Progreso amortiguado del despiece atomico. */
  const atomico = useRef(0);
  /** Angulo acumulado (radianes) del rotor de cada brazo: crece sin limite
   * mientras gira, no es un "hacia un objetivo" como progreso. */
  const anguloGiro = useRef<Record<string, number>>({});

  const { raiz, brazos, marco, tanque, radio, semialto } = useMemo(() => {
    const copia = gltf.scene.clone(true);

    const brazos: Brazo[] = NOMBRES_BRAZO.map((nombre) => {
      const objeto = copia.getObjectByName(nombre) as THREE.Object3D;
      const palas: Pala[] = NOMBRES_PALA[nombre].map((nombrePala, i) => {
        const objetoPala = objeto.getObjectByName(nombrePala) as THREE.Object3D;
        return {
          objeto: objetoPala,
          baseQuat: objetoPala.quaternion.clone(),
          signo: SIGNO_APERTURA_PALA[i],
        };
      });
      const objetoGiratorio = objeto.getObjectByName(NOMBRES_GIRATORIO[nombre]);
      const giratorio = objetoGiratorio
        ? { objeto: objetoGiratorio, baseQuat: objetoGiratorio.quaternion.clone() }
        : null;
      return {
        nombre,
        objeto,
        baseQuat: objeto.quaternion.clone(),
        palas,
        giratorio,
        materiales: prepararMateriales(objeto),
      };
    });

    // Marco: un unico grupo que agrupa TODOS los nodos fijos del chasis.
    // Hover o clic en cualquiera de ellos (agarrador, retenedor, tubo) ilumina
    // el chasis completo y navega a la misma pagina. El map porObjetoMarco
    // apunta todos sus descendientes a este mismo objeto.
    const marcoObjs = NOMBRES_MARCO.flatMap((nombre) => {
      const obj = copia.getObjectByName(nombre);
      return obj ? [obj] : [];
    });
    const marco = marcoObjs.length
      ? { materiales: marcoObjs.flatMap((o) => prepararMateriales(o)), objetos: marcoObjs }
      : null;

    const tanqueObj = copia.getObjectByName(NOMBRE_TANQUE) ?? null;
    const tanque = tanqueObj
      ? { materiales: prepararMateriales(tanqueObj), objetos: [tanqueObj] }
      : null;

    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);
    const tamano = caja.getSize(new THREE.Vector3());

    return {
      raiz: copia,
      brazos,
      marco,
      tanque,
      radio: tamano.length() / 2,
      semialto: tamano.y / 2,
    };
  }, [gltf]);

  type Marco = NonNullable<typeof marco>;
  type TanqueGrupo = NonNullable<typeof tanque>;

  const porObjetoBrazo = useMemo(() => {
    const mapa = new Map<THREE.Object3D, Brazo>();
    for (const b of brazos) b.objeto.traverse((n: THREE.Object3D) => mapa.set(n, b));
    return mapa;
  }, [brazos]);

  const porObjetoMarco = useMemo(() => {
    const mapa = new Map<THREE.Object3D, Marco>();
    if (marco) {
      for (const obj of marco.objetos) {
        obj.traverse((n: THREE.Object3D) => mapa.set(n, marco));
      }
    }
    return mapa;
  }, [marco]);

  const porObjetoTanque = useMemo(() => {
    const mapa = new Map<THREE.Object3D, TanqueGrupo>();
    if (tanque) {
      for (const obj of tanque.objetos) {
        obj.traverse((n: THREE.Object3D) => mapa.set(n, tanque));
      }
    }
    return mapa;
  }, [tanque]);

  const brazoDesdeEvento = (evento: { object: THREE.Object3D }): Brazo | null => {
    let actual: THREE.Object3D | null = evento.object;
    while (actual) {
      const b = porObjetoBrazo.get(actual);
      if (b) return b;
      actual = actual.parent;
    }
    return null;
  };

  type MarcoGrupo = NonNullable<typeof marco>;

  const marcoDesdeEvento = (evento: { object: THREE.Object3D }): MarcoGrupo | null => {
    let actual: THREE.Object3D | null = evento.object;
    while (actual) {
      const m = porObjetoMarco.get(actual);
      if (m) return m;
      actual = actual.parent;
    }
    return null;
  };

  const tanqueDesdeEvento = (evento: { object: THREE.Object3D }): TanqueGrupo | null => {
    let actual: THREE.Object3D | null = evento.object;
    while (actual) {
      const t = porObjetoTanque.get(actual);
      if (t) return t;
      actual = actual.parent;
    }
    return null;
  };

  type HoverItem =
    | { tipo: "brazo"; datos: Brazo }
    | { tipo: "marco"; datos: MarcoGrupo }
    | { tipo: "tanque"; datos: TanqueGrupo }
    | null;

  const resaltado = useRef<HoverItem>(null);

  const apagar = (item: HoverItem) => {
    if (!item) return;
    for (const g of item.datos.materiales) {
      g.material.emissive.copy(g.emisivoOriginal);
      g.material.emissiveMap = g.mapaEmisivoOriginal;
      g.material.emissiveIntensity = g.intensidadEmisivaOriginal;
      g.material.needsUpdate = true;
    }
  };

  const encender = (item: HoverItem, color: THREE.Color, intensidad = INTENSIDAD_HOVER) => {
    if (!item) return;
    for (const g of item.datos.materiales) {
      g.material.emissive.copy(color);
      g.material.emissiveMap = null;
      g.material.emissiveIntensity = intensidad;
      g.material.needsUpdate = true;
    }
  };

  const resaltar = (siguiente: HoverItem) => {
    if (siguiente === resaltado.current) return;
    apagar(resaltado.current);
    if (siguiente?.tipo === "brazo") encender(siguiente, COLOR_HOVER_BRAZO);
    if (siguiente?.tipo === "marco") encender(siguiente, COLOR_HOVER_MARCO);
    if (siguiente?.tipo === "tanque") encender(siguiente, COLOR_HOVER_TANQUE, 1.8);
    resaltado.current = siguiente;
  };

  useEffect(() => resaltar(null), [brazos, marco, tanque]);

  useEffect(() => {
    useVisor.setState({ radio });
    alMedir({ radio, semialto });
    if (camara instanceof THREE.PerspectiveCamera) {
      const distancia =
        (radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2))) * 1.35;
      camara.position.set(0.9, 0.9, 1.3).normalize().multiplyScalar(distancia);
      camara.near = Math.max(radio * 0.01, 0.001);
      camara.far = radio * 60;
      camara.lookAt(0, 0, 0);
      camara.updateProjectionMatrix();
    }
  }, [radio, semialto, camara, alMedir]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  /**
   * Pose original de cada objeto del GLB, capturada al cargar.
   *
   * Hace falta porque los planes de despiece se calculan leyendo la posicion
   * VIVA de los objetos, y se recalculan al cambiar el tamanio del visor. Sin
   * esto, redimensionar la ventana a media animacion tomaria las poses movidas
   * como si fueran las de reposo y la rejilla saldria descuadrada.
   */
  const poseOriginal = useMemo(() => {
    const mapa = new Map<
      THREE.Object3D,
      { pos: THREE.Vector3; rot: THREE.Quaternion }
    >();
    raiz.traverse((n) => {
      mapa.set(n, { pos: n.position.clone(), rot: n.quaternion.clone() });
    });
    return mapa;
  }, [raiz]);

  /** Devuelve todo el modelo a su pose original antes de medir una rejilla. */
  const restaurarPose = useCallback(() => {
    for (const [objeto, pose] of poseOriginal) {
      objeto.position.copy(pose.pos);
      objeto.quaternion.copy(pose.rot);
    }
    raiz.updateMatrixWorld(true);
  }, [poseOriginal, raiz]);

  /**
   * Plan de despiece, calculado UNA sola vez con el modelo ensamblado.
   *
   * Los conjuntos son los que se arman y se transportan: cada brazo completo,
   * el marco y el tanque. No se despieza por pieza suelta aqui — para eso esta
   * el explorador — asi que organizar deja seis bloques, no cien tornillos.
   *
   * La direccion de separacion sale del centro REAL de cada conjunto respecto
   * al centro del dron. Antes se usaba su position local, que para los brazos
   * cae casi en el origen: la direccion quedaba degenerada, todos salian hacia
   * el mismo lado y se atravesaban entre si.
   */
  const plan = useMemo(() => {
    restaurarPose();
    const conjuntos: { clave: string; objetos: THREE.Object3D[] }[] = [
      ...brazos.map((b) => ({ clave: b.nombre, objetos: [b.objeto] })),
      ...(marco ? [{ clave: "marco", objetos: marco.objetos }] : []),
      ...(tanque ? [{ clave: "tanque", objetos: tanque.objetos }] : []),
    ];

    const cajaTotal = new THREE.Box3().setFromObject(raiz);
    const centroTotal = cajaTotal.getCenter(new THREE.Vector3());

    const elementos = conjuntos.flatMap((c, i) =>
      c.objetos.map((objeto) => ({ objeto, sku: c.clave, orden: i })),
    );
    const destinos = organizarEnCuadricula(elementos, radio, aspecto);

    return elementos.map((e, i) => {
      const centro = new THREE.Box3()
        .setFromObject(e.objeto)
        .getCenter(new THREE.Vector3());
      const direccion = centro.sub(centroTotal);
      direccion.y *= 0.35; // se abre mas en horizontal que en vertical
      if (direccion.lengthSq() < 1e-8) direccion.set(0, 1, 0);
      return {
        objeto: e.objeto,
        posBase: e.objeto.position.clone(),
        rotBase: e.objeto.quaternion.clone(),
        direccion: direccion.normalize(),
        destino: destinos[i],
      };
    });
  }, [brazos, marco, tanque, raiz, radio, aspecto, restaurarPose]);

  /**
   * Plan del despiece ATOMICO: una celda por componente, no por conjunto.
   *
   * Es un plan aparte del de conjuntos porque opera sobre otros objetos —las
   * mallas hoja, no los grupos— y mover los dos a la vez los haria pelearse.
   * Por eso en el bucle son excluyentes.
   */
  const planAtomico = useMemo(() => {
    restaurarPose();
    const hojas: THREE.Object3D[] = [];
    raiz.traverse((n) => {
      if ((n as THREE.Mesh).isMesh && n.name) hojas.push(n);
    });
    const elementos = hojas.map((objeto, i) => ({
      objeto,
      sku: `${objeto.name}#${i}`, // clave unica: una celda por componente
      orden: i,
    }));
    const destinos = organizarEnCuadricula(elementos, radio, aspecto);
    return elementos.map((e, i) => ({
      objeto: e.objeto,
      posBase: e.objeto.position.clone(),
      rotBase: e.objeto.quaternion.clone(),
      destino: destinos[i],
    }));
  }, [raiz, radio, aspecto, restaurarPose]);

  useFrame((_, delta) => {
    // Despiece atomico: manda sobre todo lo demas. Mueve las mallas hoja, no
    // los grupos, asi que correrlo junto con el plegado o con el despiece de
    // conjuntos haria que dos planes escribieran el mismo objeto cada cuadro.
    atomico.current = THREE.MathUtils.damp(
      atomico.current,
      despieceAtomico,
      AMORTIGUACION_PLEGADO,
      delta,
    );
    const tAtomico = atomico.current;
    if (tAtomico > 0.001) {
      for (const n of planAtomico) {
        n.objeto.position.lerpVectors(n.posBase, n.destino.posicion, tAtomico);
        n.objeto.quaternion.slerpQuaternions(
          n.rotBase,
          n.destino.cuaternion,
          tAtomico,
        );
      }
      return;
    }
    // Al salir del modo atomico se devuelve cada hoja a su sitio, para que el
    // resto de la coreografia parta de la pose original del GLB.
    for (const n of planAtomico) {
      n.objeto.position.copy(n.posBase);
      n.objeto.quaternion.copy(n.rotBase);
    }

    // Un unico progreso 0..1 gobierna toda la coreografia. Amortiguarlo aqui y
    // repartirlo en fases es lo que hace que contraer sea exactamente el
    // despliegue al reves, sin una segunda secuencia que mantener aparte.
    progreso.current = THREE.MathUtils.damp(
      progreso.current,
      despliegue,
      AMORTIGUACION_PLEGADO,
      delta,
    );
    const p = progreso.current;

    const avanceGiratorios = tramo(p, FASES.giratorios);
    const avancePalas = tramo(p, FASES.palas);

    const destinoPos = new THREE.Vector3();

    // ---- Despiece de conjuntos ----
    //   0 -> 1  cada conjunto se aparta del centro del dron
    //   1 -> 2  viaja de ahi a su celda de la cuadricula
    const tExplosion = Math.min(explosion, 1);
    const u = THREE.MathUtils.clamp(explosion - 1, 0, 1);
    const tOrganizar = u * u * (3 - 2 * u); // suavizado de entrada y salida
    const separacion = tExplosion * radio * 1.15;

    for (const g of plan) {
      destinoPos
        .copy(g.posBase)
        .addScaledVector(g.direccion, separacion);
      if (tOrganizar > 0) {
        destinoPos.lerp(g.destino.posicion, tOrganizar);
      }
      g.objeto.position.copy(destinoPos);
    }

    const extra = new THREE.Quaternion();
    const extraPala = new THREE.Quaternion();
    const giroExtra = new THREE.Quaternion();

    for (const b of brazos) {
      const nombre = b.nombre as (typeof NOMBRES_BRAZO)[number];

      // ---- Brazos: por tandas, los pares antes que los impares ----
      const avanceBrazo = tramo(
        p,
        BRAZOS_PRIMERA_TANDA.includes(nombre)
          ? FASES.brazosPar
          : FASES.brazosImpar,
      );
      const signo = SIGNO_PLEGADO[nombre] ?? 1;
      extra.setFromAxisAngle(
        EJE_BISAGRA,
        THREE.MathUtils.degToRad(avanceBrazo * ANGULO_MAX_PLEGADO_FRAME * signo),
      );
      b.objeto.quaternion.multiplyQuaternions(extra, b.baseQuat);

      // ---- Palas: ultima fase, ya con los cuatro brazos en su sitio ----
      for (const pala of b.palas) {
        if (avancePalas === 0) {
          pala.objeto.quaternion.copy(pala.baseQuat);
        } else {
          extraPala.setFromAxisAngle(
            EJE_LOCAL_VERTICAL,
            THREE.MathUtils.degToRad(
              avancePalas * ANGULO_APERTURA_PALA * pala.signo,
            ),
          );
          pala.objeto.quaternion.multiplyQuaternions(pala.baseQuat, extraPala);
        }
      }

      // ---- Giratorio: apertura de la primera fase, mas el giro del motor ----
      //
      // Sentido de apertura: los brazos con helice CW se abren en antihorario
      // y los CCW en horario, o sea el CONTRARIO al sentido en que gira su
      // propio rotor. De ahi el signo invertido de SIGNO_GIRO, en vez de una
      // tabla aparte que habria que mantener en sincronia con aquella.
      if (b.giratorio) {
        const signoGiro = SIGNO_GIRO[nombre] ?? 1;
        const radianesApertura = THREE.MathUtils.degToRad(
          avanceGiratorios * ANGULO_APERTURA_GIRATORIO * -signoGiro,
        );

        // El rotor solo acumula vueltas con los motores encendidos y la
        // secuencia terminada. Fuera de eso el angulo vuelve a 0, para que el
        // giratorio quede siempre en la misma pose y no en una distinta segun
        // cuanto hubiera girado antes.
        if (encendido <= 0 || p < 0.999) {
          anguloGiro.current[nombre] = 0;
        } else {
          anguloGiro.current[nombre] =
            (anguloGiro.current[nombre] ?? 0) +
            VELOCIDAD_GIRO_MOTOR * encendido * Math.PI * 2 * signoGiro * delta;
        }

        // Apertura y giro comparten eje, asi que se suman los angulos en vez
        // de componer dos cuaterniones.
        giroExtra.setFromAxisAngle(
          EJE_LOCAL_VERTICAL,
          radianesApertura + (anguloGiro.current[nombre] ?? 0),
        );
        b.giratorio.objeto.quaternion.multiplyQuaternions(
          b.giratorio.baseQuat,
          giroExtra,
        );
      }
    }
  });

  return (
    <primitive
      object={raiz}
      onPointerMove={(evento: ThreeEvent<PointerEvent>) => {
        const b = brazoDesdeEvento(evento);
        const m = b ? null : marcoDesdeEvento(evento);
        const t = b || m ? null : tanqueDesdeEvento(evento);
        const siguiente: HoverItem = b
          ? { tipo: "brazo", datos: b }
          : m
            ? { tipo: "marco", datos: m }
            : t
              ? { tipo: "tanque", datos: t }
              : null;
        if (siguiente === resaltado.current) return;
        if (siguiente) evento.stopPropagation();
        document.body.style.cursor = siguiente ? "pointer" : "auto";
        resaltar(siguiente);
      }}
      onPointerOut={() => {
        if (!resaltado.current) return;
        document.body.style.cursor = "auto";
        resaltar(null);
      }}
      onClick={(evento: ThreeEvent<MouseEvent>) => {
        const b = brazoDesdeEvento(evento);
        if (b) {
          evento.stopPropagation();
          document.body.style.cursor = "auto";
          alClicBrazo();
          return;
        }
        const m = marcoDesdeEvento(evento);
        if (m) {
          evento.stopPropagation();
          document.body.style.cursor = "auto";
          alClicMarco();
          return;
        }
        const t = tanqueDesdeEvento(evento);
        if (t) {
          evento.stopPropagation();
          document.body.style.cursor = "auto";
          alClicTanque();
        }
      }}
    />
  );
}

export function EscenaFrame({
  despliegue,
  encendido,
  explosion,
  despieceAtomico,
  alClicBrazo,
  alClicMarco,
  alClicTanque,
}: {
  despliegue: number;
  encendido: number;
  explosion: number;
  despieceAtomico: number;
  alClicBrazo: () => void;
  alClicMarco: () => void;
  alClicTanque: () => void;
}) {
  const [medidas, setMedidas] = useState<{ radio: number; semialto: number } | null>(null);
  const radio = medidas?.radio ?? null;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 35, position: [1.4, 1.1, 1.8], near: 0.01, far: 300 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Escenario sombraY={medidas ? -medidas.semialto * 1.02 : undefined} />
      <LimiteError respaldo={null}>
        <Suspense fallback={<Cargando />}>
          <ChasisPlegable
            despliegue={despliegue}
            encendido={encendido}
            explosion={explosion}
            despieceAtomico={despieceAtomico}
            alMedir={setMedidas}
            alClicBrazo={alClicBrazo}
            alClicMarco={alClicMarco}
            alClicTanque={alClicTanque}
          />
        </Suspense>
      </LimiteError>
      {/* Recorrido tipo Blender: orbita de plato giratorio (el eje vertical
            del mundo se mantiene arriba), desplazamiento lateral con el boton
            derecho o dos dedos, y zoom con la rueda.

            El desplazamiento estaba apagado y con el despiece organizado hacia
            falta: la cuadricula de seis conjuntos no cabe entera en el encuadre
            y sin poder moverse no hay forma de llegar a las celdas de las
            orillas. Por lo mismo se permite bajar la camara por debajo del
            horizonte y alejarse mas. */}
      {radio !== null && (
        <OrbitControls
          makeDefault
          enableDamping
          enablePan
          screenSpacePanning
          minDistance={radio * 0.6}
          maxDistance={radio * 14}
          maxPolarAngle={Math.PI * 0.95}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      )}
    </Canvas>
  );
}

useGLTF.preload(urlModelo(GLB_FRAME));
