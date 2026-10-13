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
import { DESPIECE_MAXIMO, useVisor, type ZonaVisor } from "./estado";
import {
  ES_MARCO,
  NODO_MARCO_Y_TREN,
  componentesDelBrazo,
  esDescendiente,
  nombreBase,
  skuDeNodo,
} from "./componentes";
import { organizarEnCuadricula } from "./cuadricula";
import { Escenario } from "./Escenario";
import { LimiteError } from "./LimiteError";

/**
 * Los cuatro brazos del chasis se identifican por nombre de nodo, no por SKU.
 * El GLB es el de GLB_FRAME (4 brazos, geometria espejada en pares).
 *
 * THREE.GLTFLoader sanea nombres (PropertyBinding.sanitizeNodeName): quita
 * puntos y convierte espacios en guion bajo. Los nombres del v3 NO tienen
 * puntos en los propios brazos (brazo_2, no brazo.002), pero sus hijos si:
 * "giratorio.001" → "giratorio001", "propela_1.002" → "propela_1002".
 *
 * Los agarradores y retenedores del marco son fijos: no se animan con el
 * plegado.
 */
/**
 * Que nodos del GLB forman cada zona.
 *
 * Los brazos se reparten por el sentido de su helice: brazo y brazo_4 montan
 * Propela_CCW, brazo_2 y brazo_3 montan Propela_CW (ver SIGNO_GIRO). Un solo
 * brazo por zona: los cuatro son el mismo numero de parte montado cuatro
 * veces, asi que mostrar dos no aporta nada y estorba.
 *
 * En el GLB v2 el marco y el tren cuelgan del mismo grupo; se separan por
 * nombre con ES_MARCO (ver componentes.ts).
 */
function nodosDeZonaEn(raiz: THREE.Object3D, zona: ZonaVisor): THREE.Object3D[] {
  const uno = (nombre: string) => {
    const nodo = raiz.getObjectByName(nombre);
    return nodo ? [nodo] : [];
  };
  const marcoYTren = raiz.getObjectByName(NODO_MARCO_Y_TREN)?.children ?? [];
  switch (zona) {
    case "brazo-cw":
      return uno("brazo_2");
    case "brazo-ccw":
      return uno("brazo");
    case "tanque":
      return uno("tanque");
    case "frente":
      return uno("frontcase");
    case "frame":
      return marcoYTren.filter((n) => ES_MARCO.test(n.name));
    case "tren-aterrizaje":
      return marcoYTren.filter((n) => !ES_MARCO.test(n.name));
  }
}

const NOMBRES_BRAZO = ["brazo", "brazo_2", "brazo_3", "brazo_4"] as const;

const COLOR_HOVER = new THREE.Color(COLORES.verdeAcento);
/** Brazos y marco: piezas grandes y claras, con poco tinte basta. */
const INTENSIDAD_HOVER = 0.7;
/** Tanque, tren y frente son oscuros o blancos: necesitan mas tinte para notarse. */
const INTENSIDAD_HOVER_FUERTE = 1.8;
/** Componente o pieza suelta dentro de una zona. */
const INTENSIDAD_HOVER_PIEZA = 0.9;

/** Zona de la capa 1 a la que lleva cada brazo, por el sentido de su helice. */
const ZONA_DE_BRAZO: Record<(typeof NOMBRES_BRAZO)[number], ZonaVisor> = {
  brazo: "brazo-ccw",
  brazo_2: "brazo-cw",
  brazo_3: "brazo-cw",
  brazo_4: "brazo-ccw",
};

/**
 * Lo que queda bajo el cursor en la capa actual:
 *   capa 1  un conjunto entero (un brazo, el marco, el tanque...); el clic
 *           entra en su zona
 *   capa 2  un componente del brazo o una pieza suelta de la zona; el clic
 *           lo aisla
 *   capa 3  nada: ya es una sola pieza
 */
interface Objetivo {
  /** Identidad estable: el cursor sobre el mismo objetivo no reilumina. */
  clave: string;
  /** Nodos que se iluminan y, en la capa 2, los que se aislan. */
  nodos: THREE.Object3D[];
  /** Pieza del catalogo, si la hay. */
  sku: string | null;
  /** Solo en la capa 1: la zona en la que entra el clic. */
  zona: ZonaVisor | null;
  intensidad: number;
}

/** Lo que el visor le avisa a la interfaz sobre el objetivo bajo el cursor. */
export interface ObjetivoHover {
  clave: string;
  sku: string | null;
  zona: ZonaVisor | null;
}

/** Una pieza que se puede aislar en la zona abierta, para listarla fuera del lienzo. */
export interface PiezaDeZona {
  clave: string;
  sku: string | null;
  /** Cuantas piezas iguales agrupa la entrada (los tornillos repetidos). */
  cantidad: number;
}

/**
 * Despiece atomico, separacion por nivel del arbol del GLB. Cada pieza se
 * aleja del centro de su grupo, y cada grupo del centro del suyo: los niveles
 * internos se abren mas que el conjunto, asi el motor se despliega dentro del
 * brazo y el brazo se aleja del dron sin que todo salga disparado en linea
 * recta desde el centro.
 */
const SEPARACION_ATOMICA_CONJUNTO = 0.55;
const SEPARACION_ATOMICA_INTERNA = 1.6;

/** Suavizado de entrada y salida para los tramos del despiece atomico. */
const suave = (t: number) => {
  const u = THREE.MathUtils.clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

/**
 * Los dos tramos de la barra del despiece atomico:
 *   0 -> 0.5  vista explotada: cada pieza separada de su conjunto
 *   0.5 -> 1  de la vista explotada a la cuadricula, una celda por pieza
 */
function tramosAtomicos(t: number) {
  return { explotar: suave(t / 0.5), ordenar: suave((t - 0.5) / 0.5) };
}

/** Margen del encuadre sobre la esfera de lo que se ve. */
const MARGEN_ENCUADRE = 1.35;
/** Rapidez con que la camara acompania al despiece (mas alto = mas rapido). */
const AMORTIGUACION_ENCUADRE = 5;


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

/**
 * Vueltas por segundo del rotor con la barra de encendido al 100%.
 * La barra escala este valor, asi que al 50% gira a la mitad.
 *
 * El techo util no es el motor real sino la camara: la helice tiene 2 palas y
 * por tanto simetria de 180 grados, asi que a 60 cuadros por segundo el giro
 * se vuelve ambiguo pasando de ~15 vueltas/s (90 grados por cuadro) y empieza
 * a verse girando al reves o detenida. A 5 vueltas/s son 30 grados por cuadro:
 * rapido y todavia legible.
 *
 * Para referencia, el motor real llega a 2371 RPM (~39.5 vueltas/s); a esa
 * velocidad en pantalla no se veria girar, se veria vibrar.
 */
const VELOCIDAD_GIRO_MOTOR = 5.0;

/**
 * Despiece a partir del cual los rotores vuelven a su posicion de origen.
 * Es una fraccion del recorrido del mando (0..1), igual que el umbral de los
 * motores. Por debajo de esto las palas se quedan donde quedaron al frenar.
 */
const DESPIECE_REINICIA_ROTOR = 0.1;

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
  capa,
  zona,
  pieza,
  senalada,
  alMedir,
  alEntrarZona,
  alAislar,
  alPasarSobre,
  alListarPiezas,
}: {
  despliegue: number;
  /** Aceleracion de los rotores 0..1. Antes el giro dependia del despliegue;
   * ahora es un mando aparte, porque desplegar y acelerar son dos cosas. */
  encendido: number;
  explosion: number;
  despieceAtomico: number;
  capa: 1 | 2 | 3;
  zona: ZonaVisor | null;
  /** Clave de lo aislado en la capa 3 (ver estado.ts). */
  pieza: string | null;
  /** Pieza senalada desde la lista de fuera del lienzo. */
  senalada: string | null;
  alMedir: (medidas: { radio: number; semialto: number }) => void;
  /** Clic en un conjunto de la capa 1. */
  alEntrarZona: (zona: ZonaVisor) => void;
  /** Clic en una pieza de la capa 2: su clave. */
  alAislar: (pieza: string) => void;
  /** Cambio del objetivo bajo el cursor, para que la interfaz lo nombre. */
  alPasarSobre: (objetivo: ObjetivoHover | null) => void;
  /** Piezas que se pueden aislar en la zona abierta (vacia en la capa 1). */
  alListarPiezas: (piezas: PiezaDeZona[]) => void;
}) {
  const gltf = useGLTF(urlModelo(GLB_FRAME));
  const camara = useThree((s) => s.camera);
  // Proporcion del lienzo: la rejilla del despiece se dimensiona con la misma
  // forma, para que quepa entera y no deje franjas vacias a los lados.
  const aspecto = useThree((s) => s.size.width / s.size.height);
  /** Estado vivo de R3F, para leer el tamanio sin suscribirse a el. */
  const estadoR3F = useThree((s) => s.get);
  /** Angulo actual (amortiguado) de CADA brazo, por nombre: ya no es uno solo
   * compartido, cada uno avanza hacia su propio objetivo escalonado. */
  /** Progreso amortiguado de la coreografia: 0 contraido, 1 desplegado. */
  const progreso = useRef(0);
  /** Progreso amortiguado del despiece atomico. */
  const atomico = useRef(0);
  /**
   * Donde empezo el ultimo pulsado, para distinguir un clic de un arrastre.
   *
   * three.js dispara onClick tambien al soltar despues de girar la camara, asi
   * que sin esto cada giro entraba de capa sin querer: el despiece se reiniciaba
   * y la vista saltaba a una pieza suelta.
   */
  const inicioPulsado = useRef<{ x: number; y: number } | null>(null);
  /** Angulo acumulado (radianes) del rotor de cada brazo: crece sin limite
   * mientras gira, no es un "hacia un objetivo" como progreso. */
  const anguloGiro = useRef<Record<string, number>>({});

  const { raiz, brazos, marco, tanque, tren, frente, radio, semialto } =
    useMemo(() => {
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

    // Cada conjunto de la capa 1 con sus nodos y sus materiales clonados.
    const conjunto = (zona: ZonaVisor) => {
      const objetos = nodosDeZonaEn(copia, zona);
      return objetos.length
        ? { materiales: objetos.flatMap((o) => prepararMateriales(o)), objetos }
        : null;
    };
    const marco = conjunto("frame");
    const tren = conjunto("tren-aterrizaje");
    const tanque = conjunto("tanque");
    const frente = conjunto("frente");

    const caja = new THREE.Box3().setFromObject(copia);
    const centro = caja.getCenter(new THREE.Vector3());
    copia.position.sub(centro);
    const tamano = caja.getSize(new THREE.Vector3());

    return {
      raiz: copia,
      brazos,
      marco,
      tanque,
      tren,
      frente,
      radio: tamano.length() / 2,
      semialto: tamano.y / 2,
    };
  }, [gltf]);

  /**
   * Conjuntos de la capa 1, cada uno con la zona en la que entra su clic.
   * Cada brazo es su propio conjunto: se ilumina solo el que esta bajo el
   * cursor, aunque dos brazos lleven a la misma zona.
   */
  const conjuntos = useMemo(() => {
    const lista: { clave: string; zona: ZonaVisor; nodos: THREE.Object3D[]; intensidad: number }[] =
      brazos.map((b) => ({
        clave: b.nombre,
        zona: ZONA_DE_BRAZO[b.nombre as (typeof NOMBRES_BRAZO)[number]],
        nodos: [b.objeto],
        intensidad: INTENSIDAD_HOVER,
      }));
    if (marco) lista.push({ clave: "marco", zona: "frame", nodos: marco.objetos, intensidad: INTENSIDAD_HOVER });
    if (tanque) lista.push({ clave: "tanque", zona: "tanque", nodos: tanque.objetos, intensidad: INTENSIDAD_HOVER_FUERTE });
    if (tren) lista.push({ clave: "tren", zona: "tren-aterrizaje", nodos: tren.objetos, intensidad: INTENSIDAD_HOVER_FUERTE });
    if (frente) lista.push({ clave: "frente", zona: "frente", nodos: frente.objetos, intensidad: INTENSIDAD_HOVER_FUERTE });
    return lista;
  }, [brazos, marco, tanque, tren, frente]);

  /** Nodos de la zona abierta en la capa 2 y 3. */
  const nodosDeZona = useMemo(
    () => (zona ? nodosDeZonaEn(raiz, zona) : []),
    [zona, raiz],
  );

  /**
   * Lo que se puede aislar en la zona abierta: los componentes en un brazo,
   * cada malla en las demas zonas (marco, tanque, tren, frente).
   */
  const objetivosDeZona = useMemo((): Objetivo[] => {
    if (zona === "brazo-cw" || zona === "brazo-ccw") {
      return nodosDeZona.flatMap(componentesDelBrazo).map((c) => ({
        clave: c.clave,
        nodos: c.nodos,
        sku: c.sku,
        zona: null,
        intensidad: INTENSIDAD_HOVER_PIEZA,
      }));
    }
    // Fuera de los brazos, cada pieza de primer nivel de la zona; las
    // identicas (los tornillos repetidos) se juntan en una sola entrada.
    const porBase = new Map<string, Objetivo>();
    for (const nodo of nodosDeZona) {
      const piezas =
        (nodo as THREE.Mesh).isMesh || nodo.children.length === 0
          ? [nodo]
          : nodo.children;
      for (const n of piezas) {
        if (!n.name) continue;
        const clave = nombreBase(n.name);
        const existente = porBase.get(clave);
        if (existente) existente.nodos.push(n);
        else
          porBase.set(clave, {
            clave,
            nodos: [n],
            sku: skuDeNodo(n.name),
            zona: null,
            intensidad: INTENSIDAD_HOVER_PIEZA,
          });
      }
    }
    return [...porBase.values()];
  }, [zona, nodosDeZona]);

  /** Nodos de lo aislado en la capa 3, resueltos desde su clave. */
  const nodosAislados = useMemo(
    () =>
      capa === 3 && pieza
        ? (objetivosDeZona.find((o) => o.clave === pieza)?.nodos ?? [])
        : [],
    [capa, pieza, objetivosDeZona],
  );

  useEffect(() => {
    alListarPiezas(
      capa === 1
        ? []
        : objetivosDeZona.map(({ clave, sku, nodos }) => ({
            clave,
            sku,
            cantidad: nodos.length,
          })),
    );
  }, [capa, objetivosDeZona, alListarPiezas]);

  /**
   * Material guardado de cada material de la escena. prepararMateriales clona
   * uno por malla, asi que iluminar los materiales de un nodo ilumina solo ese
   * nodo y no a todas las piezas que compartian material en el GLB.
   */
  const guardadoPorMaterial = useMemo(() => {
    const mapa = new Map<THREE.Material, MaterialGuardado>();
    const todos = [
      ...brazos.flatMap((b) => b.materiales),
      ...(marco?.materiales ?? []),
      ...(tanque?.materiales ?? []),
      ...(tren?.materiales ?? []),
      ...(frente?.materiales ?? []),
    ];
    for (const g of todos) mapa.set(g.material, g);
    return mapa;
  }, [brazos, marco, tanque, tren, frente]);

  const materialesDe = useCallback(
    (nodos: THREE.Object3D[]): MaterialGuardado[] => {
      const lista: MaterialGuardado[] = [];
      for (const nodo of nodos) {
        nodo.traverse((n) => {
          const malla = n as THREE.Mesh;
          if (!malla.isMesh) return;
          const mats = Array.isArray(malla.material) ? malla.material : [malla.material];
          for (const m of mats) {
            const g = guardadoPorMaterial.get(m);
            if (g) lista.push(g);
          }
        });
      }
      return lista;
    },
    [guardadoPorMaterial],
  );

  /**
   * Que hay bajo el cursor, segun la capa. Es la unica funcion que decide que
   * se ilumina y que hace el clic, para que el hover y el clic no puedan
   * apuntar a cosas distintas.
   *
   * Antes la capa 2 reutilizaba la logica de la capa 1: el cursor sobre un
   * tornillo del brazo iluminaba el brazo entero, y el clic en el marco no
   * hacia nada porque solo sabia entrar en la zona.
   */
  const objetivoDe = useCallback(
    (malla: THREE.Object3D): Objetivo | null => {
      if (capa === 1) {
        const c = conjuntos.find((x) => x.nodos.some((n) => esDescendiente(malla, n)));
        return c
          ? { clave: c.clave, nodos: c.nodos, sku: null, zona: c.zona, intensidad: c.intensidad }
          : null;
      }
      if (capa === 2) {
        return (
          objetivosDeZona.find((o) =>
            o.nodos.some((n) => esDescendiente(malla, n)),
          ) ?? null
        );
      }
      return null;
    },
    [capa, conjuntos, objetivosDeZona],
  );

  /** El objetivo de la interseccion visible mas cercana que tenga uno. */
  const primerObjetivo = (
    intersecciones: readonly { object: THREE.Object3D }[],
  ): Objetivo | null => {
    for (const { object } of intersecciones) {
      if (!object.visible) continue;
      const objetivo = objetivoDe(object);
      if (objetivo) return objetivo;
    }
    return null;
  };

  const resaltado = useRef<{ clave: string; materiales: MaterialGuardado[] } | null>(null);

  const resaltar = useCallback(
    (siguiente: Objetivo | null) => {
      if ((siguiente?.clave ?? null) === (resaltado.current?.clave ?? null)) return;
      for (const g of resaltado.current?.materiales ?? []) {
        g.material.emissive.copy(g.emisivoOriginal);
        g.material.emissiveMap = g.mapaEmisivoOriginal;
        g.material.emissiveIntensity = g.intensidadEmisivaOriginal;
        g.material.needsUpdate = true;
      }
      const materiales = siguiente ? materialesDe(siguiente.nodos) : [];
      for (const g of materiales) {
        g.material.emissive.copy(COLOR_HOVER);
        g.material.emissiveMap = null;
        g.material.emissiveIntensity = siguiente!.intensidad;
        g.material.needsUpdate = true;
      }
      resaltado.current = siguiente ? { clave: siguiente.clave, materiales } : null;
      document.body.style.cursor = siguiente ? "pointer" : "auto";
      alPasarSobre(
        siguiente ? { clave: siguiente.clave, sku: siguiente.sku, zona: siguiente.zona } : null,
      );
    },
    [materialesDe, alPasarSobre],
  );

  // Al cambiar de capa, de zona o de pieza se apaga el resaltado: el objeto
  // que estaba bajo el cursor puede haber desaparecido y quedarse verde.
  // Tambien enciende la pieza senalada desde la lista de fuera del lienzo.
  useEffect(() => {
    resaltar(
      capa === 2 && senalada
        ? (objetivosDeZona.find((o) => o.clave === senalada) ?? null)
        : null,
    );
  }, [capa, zona, pieza, senalada, objetivosDeZona, resaltar]);

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
  /**
   * Plan de despiece, distinto en cada capa:
   *
   *   capa 1  se apartan los CONJUNTOS: cada brazo, el marco, el tanque
   *   capa 2  se aparta COMPONENTE por componente dentro de la zona abierta
   *   capa 3  se separan las piezas del componente aislado (las 9 del motor)
   *
   * Antes el plan era siempre el de conjuntos, asi que dentro de un brazo el
   * deslizador solo movia el brazo entero de sitio en vez de abrirlo.
   *
   * Se calcula con el modelo en su pose original (restaurarPose) porque lee
   * las posiciones vivas de los objetos.
   */
  const plan = useMemo(() => {
    restaurarPose();

    let elementos: { objeto: THREE.Object3D; sku: string; orden: number }[];

    if (capa === 1) {
      const conjuntos: { clave: string; objetos: THREE.Object3D[] }[] = [
        ...brazos.map((b) => ({ clave: b.nombre, objetos: [b.objeto] })),
        ...(marco ? [{ clave: "marco", objetos: marco.objetos }] : []),
        ...(tanque ? [{ clave: "tanque", objetos: tanque.objetos }] : []),
        ...(tren ? [{ clave: "tren", objetos: tren.objetos }] : []),
        ...(frente ? [{ clave: "frente", objetos: frente.objetos }] : []),
      ];
      elementos = conjuntos.flatMap((c, i) =>
        c.objetos.map((objeto) => ({ objeto, sku: c.clave, orden: i })),
      );
    } else if (capa === 2 || (capa === 3 && nodosAislados.length > 0)) {
      // Las mallas hoja de lo que se ve: la zona en la capa 2, el componente
      // aislado en la capa 3. Cada hoja va a su propia celda.
      const grupos = capa === 3 ? nodosAislados : nodosDeZona;
      const hojas: THREE.Object3D[] = [];
      for (const grupo of grupos) {
        if ((grupo as THREE.Mesh).isMesh) hojas.push(grupo);
        else
          grupo.traverse((n) => {
            if ((n as THREE.Mesh).isMesh && n.name) hojas.push(n);
          });
      }
      elementos = hojas.map((objeto, i) => ({
        objeto,
        sku: `${objeto.name}#${i}`,
        orden: i,
      }));
    } else {
      return [];
    }

    if (elementos.length === 0) return [];

    const caja = new THREE.Box3();
    for (const e of elementos) caja.expandByObject(e.objeto);
    const centroTotal = caja.getCenter(new THREE.Vector3());
    const radioPlan = caja.getBoundingSphere(new THREE.Sphere()).radius || radio;

    // La rejilla se arma donde esta lo que se ve, no en el centro del dron:
    // dentro de una zona, armarla en el origen la dejaba fuera del encuadre.
    const destinos = organizarEnCuadricula(elementos, radioPlan, aspecto, centroTotal);

    return elementos.map((e, i) => {
      const cajaMundo = new THREE.Box3().setFromObject(e.objeto);
      const direccion = cajaMundo.getCenter(new THREE.Vector3()).sub(centroTotal);
      direccion.y *= 0.35; // se abre mas en horizontal que en vertical
      if (direccion.lengthSq() < 1e-8) direccion.set(0, 1, 0);
      direccion.normalize();

      // La direccion se calcula en el mundo, pero se aplica a la position
      // LOCAL del objeto. Hay que pasarla al espacio de su padre: el tren
      // cuelga de un grupo con escala ~106 y el brazo de uno con 0.376 y
      // girado 90 grados. Sin esto el despiece mandaba las piezas del tren
      // cien veces mas lejos de lo pedido y las del brazo en otra direccion.
      const origenMundo = e.objeto.getWorldPosition(new THREE.Vector3());
      const inversa = e.objeto.parent
        ? e.objeto.parent.matrixWorld.clone().invert()
        : new THREE.Matrix4();
      const pasoLocal = origenMundo
        .clone()
        .add(direccion)
        .applyMatrix4(inversa)
        .sub(origenMundo.clone().applyMatrix4(inversa));

      return {
        objeto: e.objeto,
        posBase: e.objeto.position.clone(),
        rotBase: e.objeto.quaternion.clone(),
        /** Desplazamiento local que equivale a una unidad del mundo hacia afuera. */
        pasoLocal,
        direccion,
        cajaMundo,
        destino: destinos[i],
        destinoMundo: e.objeto.parent
          ? e.objeto.parent.localToWorld(destinos[i].posicion.clone())
          : destinos[i].posicion.clone(),
        origenMundo,
        radioPlan,
      };
    });
  }, [
    capa, nodosAislados, nodosDeZona, brazos, marco, tanque, tren, frente,
    radio, aspecto, restaurarPose,
  ]);

  /**
   * Caja que ocupa lo visible con un despiece dado, calculada desde el plan y
   * no midiendo la escena: asi se puede pedir el encuadre del despiece final
   * en cuanto se mueve el deslizador, sin esperar a que termine la animacion.
   */
  const cajaConDespiece = useCallback(
    (valor: number) => {
      const t = Math.min(valor, 1);
      const u = THREE.MathUtils.clamp(valor - 1, 0, 1);
      const organizar = u * u * (3 - 2 * u);
      const separacion = t * (plan[0]?.radioPlan ?? radio) * 1.15;
      const caja = new THREE.Box3();
      const corrimiento = new THREE.Vector3();
      for (const g of plan) {
        corrimiento.copy(g.direccion).multiplyScalar(separacion);
        if (organizar > 0) {
          corrimiento.lerp(g.destinoMundo.clone().sub(g.origenMundo), organizar);
        }
        caja.union(g.cajaMundo.clone().translate(corrimiento));
      }
      return caja;
    },
    [plan, radio],
  );

  /**
   * Plan del despiece ATOMICO: una celda por componente, no por conjunto.
   *
   * Es un plan aparte del de conjuntos porque opera sobre otros objetos —las
   * mallas hoja, no los grupos— y mover los dos a la vez los haria pelearse.
   * Por eso en el bucle son excluyentes.
   */
  const planAtomico = useMemo(() => {
    restaurarPose();
    const centros = new Map<THREE.Object3D, THREE.Vector3>();
    const centroDe = (n: THREE.Object3D) => {
      let c = centros.get(n);
      if (!c) {
        c = new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3());
        centros.set(n, c);
      }
      return c;
    };

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

    return elementos.map((e, i) => {
      // Separacion en el mundo, sumando nivel por nivel desde la hoja hasta
      // el conjunto: el nivel de arriba (el conjunto respecto al dron) se
      // separa poco y los de abajo mucho.
      const separacion = new THREE.Vector3();
      let nodo: THREE.Object3D = e.objeto;
      while (nodo.parent && nodo !== raiz) {
        const padre: THREE.Object3D = nodo.parent;
        const factor =
          padre === raiz ? SEPARACION_ATOMICA_CONJUNTO : SEPARACION_ATOMICA_INTERNA;
        separacion.addScaledVector(centroDe(nodo).clone().sub(centroDe(padre)), factor);
        nodo = padre;
      }

      // Igual que en el plan de conjuntos: la separacion se mide en el mundo
      // y se aplica a la position local, asi que se pasa al espacio del padre.
      const origenMundo = e.objeto.getWorldPosition(new THREE.Vector3());
      const padre = e.objeto.parent;
      const posExplotada = padre
        ? padre.worldToLocal(origenMundo.clone().add(separacion))
        : e.objeto.position.clone().add(separacion);

      return {
        objeto: e.objeto,
        posBase: e.objeto.position.clone(),
        rotBase: e.objeto.quaternion.clone(),
        posExplotada,
        destino: destinos[i],
        cajaMundo: new THREE.Box3().setFromObject(e.objeto),
        origenMundo,
        separacion,
        destinoMundo: padre
          ? padre.localToWorld(destinos[i].posicion.clone())
          : destinos[i].posicion.clone(),
      };
    });
  }, [raiz, radio, aspecto, restaurarPose]);

  /**
   * Que se ve en cada capa, y a donde mira la camara.
   *
   * Se oculta en vez de cargar otro GLB: el modelo del chasis ya trae cada
   * zona como grupo nombrado, asi que entrar en un brazo no descarga nada ni
   * puede desincronizarse del conjunto. Volver tampoco recarga.
   */
  const controles = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;

  /**
   * Distancia a la que la camara ve entera una caja. Usa el campo de vision
   * real y el mas angosto de los dos: en un lienzo vertical (movil) limita el
   * horizontal. El tamanio del lienzo se lee al momento y no es dependencia:
   * si lo fuera, cada cambio de tamanio (en movil, la barra del navegador al
   * hacer scroll) reencuadraria la camara en medio de un giro del usuario.
   */
  const distanciaPara = useCallback(
    (caja: THREE.Box3) => {
      const radioCaja = caja.getBoundingSphere(new THREE.Sphere()).radius || 1;
      const fovVertical = THREE.MathUtils.degToRad(
        camara instanceof THREE.PerspectiveCamera ? camara.fov : 35,
      );
      const { size } = estadoR3F();
      const fovHorizontal =
        2 * Math.atan(Math.tan(fovVertical / 2) * (size.width / size.height));
      return (
        (radioCaja / Math.sin(Math.min(fovVertical, fovHorizontal) / 2)) *
        MARGEN_ENCUADRE
      );
    },
    [camara, estadoR3F],
  );

  /** Encuadre que la camara persigue mientras cambia el despiece (ver abajo). */
  const encuadre = useRef<{ centro: THREE.Vector3; distancia: number } | null>(null);

  useEffect(() => {
    const visibles: THREE.Object3D[] = [];

    // Se parte SIEMPRE de todo visible. Antes solo se reencendian los hijos
    // directos de la raiz, asi que las mallas que la capa 3 habia apagado en
    // profundidad se quedaban ocultas para siempre: al volver, el brazo
    // aparecia vacio.
    raiz.traverse((n) => {
      n.visible = true;
    });

    if (capa === 1) {
      visibles.push(raiz);
    } else {
      const deZona = nodosDeZona;

      // Se apaga todo y se enciende solo la zona con su cadena de padres. No
      // basta con apagar los hijos de la raiz: en el GLB v2 el marco y el
      // tren comparten grupo, y encender ese grupo mostraba los dos.
      raiz.traverse((n) => {
        if (n !== raiz) n.visible = false;
      });
      for (const o of deZona) {
        o.traverse((n) => (n.visible = true));
        let actual: THREE.Object3D | null = o.parent;
        while (actual && actual !== raiz) {
          actual.visible = true;
          actual = actual.parent;
        }
      }

      // Un componente puede ser varios nodos (el motor), asi que se aisla la
      // lista entera.
      const piezas = nodosAislados;

      // Solo se apaga el resto si la pieza existe de verdad. Si no resolviera,
      // apagar primero dejaba la escena en negro sin forma de recuperarla.
      if (piezas.length > 0) {
        for (const o of deZona) {
          o.traverse((n) => {
            if ((n as THREE.Mesh).isMesh) n.visible = false;
          });
        }
        for (const pieza of piezas) {
          pieza.traverse((n) => (n.visible = true));
          let actual: THREE.Object3D | null = pieza;
          while (actual && actual !== raiz) {
            actual.visible = true;
            actual = actual.parent;
          }
        }
        visibles.push(...piezas);
      } else {
        visibles.push(...deZona);
      }
    }

    if (visibles.length === 0) return;

    // Reencuadre: la camara se planta a una distancia proporcional a lo que
    // queda visible, mirando su centro. Sin esto, entrar en una pieza chica
    // la deja como un punto en medio de la pantalla.
    const caja = new THREE.Box3();
    for (const o of visibles) caja.expandByObject(o);
    const centro = caja.getCenter(new THREE.Vector3());
    const distancia = distanciaPara(caja);
    encuadre.current = null;

    camara.position
      .copy(centro)
      .add(new THREE.Vector3(1.1, 0.85, 1.4).normalize().multiplyScalar(distancia));
    camara.lookAt(centro);
    if (controles) {
      controles.target.copy(centro);
      controles.update();
    }
  }, [capa, nodosDeZona, nodosAislados, raiz, camara, controles, distanciaPara]);

  /**
   * Encuadre que la camara persigue mientras cambia el despiece. Se fija al
   * mover el deslizador y se suelta al llegar, para que despues el usuario
   * pueda girar, acercar y desplazar sin que la camara se le resista.
   *
   * Antes el encuadre solo se calculaba al entrar en una capa, con todo
   * armado: al separar las piezas de un componente aislado se salian del
   * cuadro.
   */
  const despieceAnterior = useRef({ explosion, despieceAtomico });

  useEffect(() => {
    const anterior = despieceAnterior.current;
    if (
      anterior.explosion === explosion &&
      anterior.despieceAtomico === despieceAtomico
    ) {
      return;
    }
    despieceAnterior.current = { explosion, despieceAtomico };

    let caja: THREE.Box3;
    if (despieceAtomico > 0) {
      // La caja del despiece atomico con el valor de la barra, calculada
      // desde el plan: cada pieza en su punto de la vista explotada o de la
      // cuadricula.
      const { explotar, ordenar } = tramosAtomicos(despieceAtomico);
      caja = new THREE.Box3();
      const corrimiento = new THREE.Vector3();
      for (const n of planAtomico) {
        corrimiento.copy(n.separacion).multiplyScalar(explotar);
        if (ordenar > 0) {
          corrimiento.lerp(n.destinoMundo.clone().sub(n.origenMundo), ordenar);
        }
        caja.union(n.cajaMundo.clone().translate(corrimiento));
      }
    } else {
      if (plan.length === 0) return;
      caja = cajaConDespiece(explosion);
    }
    if (caja.isEmpty()) return;
    // En la capa 1 con todo armado, el encuadre es el del dron completo.
    if (capa === 1 && explosion === 0 && despieceAtomico === 0) caja.setFromObject(raiz);
    encuadre.current = {
      centro: caja.getCenter(new THREE.Vector3()),
      distancia: distanciaPara(caja),
    };
  }, [
    explosion, despieceAtomico, plan, planAtomico, capa, raiz,
    cajaConDespiece, distanciaPara,
  ]);

  useFrame((_, delta) => {
    // La camara persigue el encuadre pedido por el despiece, conservando el
    // angulo desde el que el usuario esta mirando.
    const meta = encuadre.current;
    if (meta && controles) {
      const k = 1 - Math.exp(-AMORTIGUACION_ENCUADRE * delta);
      controles.target.lerp(meta.centro, k);
      const direccionVista = camara.position.clone().sub(controles.target);
      const actual = direccionVista.length() || 1;
      const siguiente = THREE.MathUtils.lerp(actual, meta.distancia, k);
      camara.position
        .copy(controles.target)
        .addScaledVector(direccionVista.divideScalar(actual), siguiente);
      controles.update();
      if (
        controles.target.distanceTo(meta.centro) < meta.distancia * 0.002 &&
        Math.abs(siguiente - meta.distancia) < meta.distancia * 0.002
      ) {
        encuadre.current = null;
      }
    }

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
      const { explotar, ordenar } = tramosAtomicos(tAtomico);
      for (const n of planAtomico) {
        n.objeto.position.lerpVectors(n.posBase, n.posExplotada, explotar);
        if (ordenar > 0) n.objeto.position.lerp(n.destino.posicion, ordenar);
        n.objeto.quaternion.slerpQuaternions(n.rotBase, n.destino.cuaternion, ordenar);
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
    const separacion = tExplosion * (plan[0]?.radioPlan ?? radio) * 1.15;

    for (const g of plan) {
      destinoPos
        .copy(g.posBase)
        .addScaledVector(g.pasoLocal, separacion);
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
        // Al soltar el acelerador las palas se QUEDAN donde pararon: un rotor
        // que frena no vuelve solo a su marca. El angulo acumulado solo se
        // borra cuando el dron deja de estar listo para volar, que es cuando
        // esa pose ya no significa nada:
        //   - el despliegue baja del 100% (los brazos se mueven)
        //   - el despiece pasa del umbral (el dron se esta separando)
        const dejaDeVolar =
          p < 0.999 ||
          explosion / DESPIECE_MAXIMO > DESPIECE_REINICIA_ROTOR;

        if (dejaDeVolar) {
          anguloGiro.current[nombre] = 0;
        } else if (encendido > 0) {
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
        // R3F llama a este manejador una vez por cada malla atravesada por el
        // rayo, empezando por la mas cercana, que puede ser una pieza oculta
        // de otra zona. Se decide una sola vez con todas las intersecciones y
        // se corta la propagacion: decidir por malla apagaba y reencendia el
        // resaltado en cada movimiento.
        evento.stopPropagation();
        resaltar(primerObjetivo(evento.intersections));
      }}
      onPointerDown={(evento: ThreeEvent<PointerEvent>) => {
        inicioPulsado.current = { x: evento.clientX, y: evento.clientY };
      }}
      onPointerOut={() => resaltar(null)}
      onClick={(evento: ThreeEvent<MouseEvent>) => {
        // Si el puntero se movio mas que un pelo entre pulsar y soltar, fue un
        // giro de camara y no un clic: no se entra de capa.
        const inicio = inicioPulsado.current;
        inicioPulsado.current = null;
        if (
          inicio &&
          Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) > 6
        ) {
          return;
        }
        // Se resuelve desde el clic y no desde lo iluminado: en pantallas
        // tactiles no hay hover, y exigir que coincidieran bloqueaba el toque.
        evento.stopPropagation();
        const objetivo = primerObjetivo(evento.intersections);
        if (!objetivo) return;
        if (capa === 1 && objetivo.zona) alEntrarZona(objetivo.zona);
        else if (capa === 2) alAislar(objetivo.clave);
      }}
    />
  );
}

export function EscenaFrame({
  despliegue,
  encendido,
  explosion,
  despieceAtomico,
  capa,
  zona,
  pieza,
  senalada,
  alEntrarZona,
  alAislar,
  alPasarSobre,
  alListarPiezas,
}: {
  despliegue: number;
  encendido: number;
  explosion: number;
  despieceAtomico: number;
  capa: 1 | 2 | 3;
  zona: ZonaVisor | null;
  pieza: string | null;
  senalada: string | null;
  alEntrarZona: (zona: ZonaVisor) => void;
  alAislar: (pieza: string) => void;
  alPasarSobre: (objetivo: ObjetivoHover | null) => void;
  alListarPiezas: (piezas: PiezaDeZona[]) => void;
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
      <LimiteError
        respaldo={
          <Html center>
            <span className="whitespace-nowrap text-xs font-medium text-mxd-gris">
              No se pudo cargar el modelo 3D
            </span>
          </Html>
        }
      >
        <Suspense fallback={<Cargando />}>
          <ChasisPlegable
            despliegue={despliegue}
            encendido={encendido}
            explosion={explosion}
            despieceAtomico={despieceAtomico}
            capa={capa}
            zona={zona}
            pieza={pieza}
            senalada={senalada}
            alMedir={setMedidas}
            alEntrarZona={alEntrarZona}
            alAislar={alAislar}
            alPasarSobre={alPasarSobre}
            alListarPiezas={alListarPiezas}
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
