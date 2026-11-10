"use client";

import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ARRASTRE, DOWNWASH, RAMPA_CAUDAL_S, RAMPA_GIRO_S } from "./aspersion/config";
import { detenerDiscos, girarDiscos, prepararDiscos } from "./aspersion/discos";
import { crearGotas } from "./aspersion/gotas";
import {
  ACENTO,
  ANGULO_APERTURA_GIRATORIO,
  ANGULO_APERTURA_PALA,
  ANGULO_PLEGADO_BRAZO,
  CARROCERIA,
  COMBINACIONES,
  DESPIECE_VERTICAL,
  ETIQUETAS,
  FASES,
  GLB_DRON,
  VELOCIDAD_ROTOR,
  type Acabado,
} from "./config";
import type { EstadoEscena } from "./estado";

/**
 * El MX80 del estudio: la misma coreografia del visor de la vitrina
 * (EscenaFrame.tsx), sin capas ni clics, mas el despiece vertical, los
 * colores para el cliente y las anclas de las etiquetas.
 *
 * A diferencia del visor, nada se amortigua: la pose sale directo de los
 * mandos. Asi una toma guardada se exporta siempre igual, sin depender de
 * cuanto tiempo paso desde que se movio un deslizador.
 */

const EJE_Y = new THREE.Vector3(0, 1, 0);

/** Lo que es marco dentro del grupo "tren_aterrizaje" (igual que componentes.ts). */
const ES_MARCO =
  /^(agarrador_|retenedor_|frame_tubo|M4x\d+_(agarrador|retenedor)|M6x10_retenedor|Arandela_M4|Arandela_M6)/i;

const tramo = (p: number, [a, b]: readonly [number, number]) =>
  THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

/** Signo de plegado por el cuadrante de la bisagra (la tabla validada del v4). */
const signoPlegado = (x: number, z: number) => (x * z >= 0 ? 1 : -1);

/** Signo que abre la pala hacia afuera (la punta lejos del eje del rotor). */
function signoAperturaPala(pala: THREE.Object3D, ejeRotor: THREE.Vector3): number {
  const base = pala.quaternion.clone();
  const distancia = (signo: number) => {
    pala.quaternion
      .copy(base)
      .multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Y, THREE.MathUtils.degToRad(ANGULO_APERTURA_PALA * signo)));
    pala.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(pala).getCenter(new THREE.Vector3());
    return Math.hypot(c.x - ejeRotor.x, c.z - ejeRotor.z);
  };
  const signo = distancia(1) >= distancia(-1) ? 1 : -1;
  pala.quaternion.copy(base);
  pala.updateMatrixWorld(true);
  return signo;
}

interface Brazo {
  objeto: THREE.Object3D;
  base: THREE.Quaternion;
  signoGiro: number;
  signoPlegado: number;
  primeraTanda: boolean;
  giratorio: { objeto: THREE.Object3D; base: THREE.Quaternion } | null;
  palas: { objeto: THREE.Object3D; base: THREE.Quaternion; signo: number }[];
}

interface PiezaPintable {
  malla: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  pintura: THREE.MeshPhysicalMaterial;
  rol: "carroceria" | "acento";
}

/** Una pieza del despiece vertical: cuanto sube y en que direccion local. */
interface PiezaDespiece {
  objeto: THREE.Object3D;
  base: THREE.Vector3;
  pasoLocal: THREE.Vector3;
  subida: number;
}

/** Punto del mundo al que apunta cada etiqueta; lo actualiza cada cuadro. */
export interface Ancla {
  texto: string;
  punto: THREE.Vector3;
  visible: boolean;
}

/** Cambia el material de una malla (fuera del componente: es mutacion de three.js). */
function ponerMaterial(malla: THREE.Mesh, material: THREE.Material | THREE.Material[]) {
  malla.material = material;
}

function pintar(m: THREE.MeshPhysicalMaterial, a: Acabado) {
  m.color.set(a.color);
  m.roughness = a.rugosidad;
  m.metalness = a.metalicidad;
  m.clearcoat = a.barniz;
  m.clearcoatRoughness = 0.15;
  // El color manda: un mapa de color del modelo lo mezclaria con el original.
  m.map = null;
  m.needsUpdate = true;
}

export function Dron({
  escena,
  anclasRef,
  alGotas,
}: {
  escena: EstadoEscena;
  /** Lo llena el dron cada cuadro: donde va cada etiqueta en el mundo. */
  anclasRef: React.RefObject<Ancla[]>;
  /** Entrega el THREE.Points de las gotas para montarlo en el mundo. */
  alGotas: (puntos: THREE.Points) => void;
}) {
  const gltf = useGLTF(GLB_DRON);
  const grupo = useRef<THREE.Group>(null);
  const anguloRotor = useRef<Map<Brazo, number>>(new Map());
  const rampaGiro = useRef(0);
  const rampaCaudal = useRef(0);

  const modelo = useMemo(() => {
    const raiz = gltf.scene.clone(true);
    raiz.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    // Los discos se cuelgan de su pivote antes de medir nada.
    const discos = prepararDiscos(raiz);

    // Panza en y = 0 y centrado en planta: el grupo de afuera lo sube a la
    // altura de vuelo.
    raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(raiz);
    const centro = caja.getCenter(new THREE.Vector3());
    raiz.position.set(-centro.x, -caja.min.y, -centro.z);
    raiz.updateMatrixWorld(true);

    // ---- Brazos ----
    const brazos: Brazo[] = raiz.children
      .filter((n) => /^brazo_C{1,2}W/i.test(n.name))
      .map((objeto) => {
        const sentidoCcw = /^brazo_CCW/i.test(objeto.name);
        const gir = objeto.children.find((h) => /^giratorio/i.test(h.name));
        const helices = gir?.children.find((h) => /^helices/i.test(h.name));
        const ejeRotor = gir?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
        const bisagra = objeto.getWorldPosition(new THREE.Vector3());
        return {
          objeto,
          base: objeto.quaternion.clone(),
          signoGiro: sentidoCcw ? 1 : -1,
          signoPlegado: signoPlegado(bisagra.x, bisagra.z),
          primeraTanda: bisagra.x > 0,
          giratorio: gir ? { objeto: gir, base: gir.quaternion.clone() } : null,
          palas: (helices?.children ?? []).map((p) => ({
            objeto: p,
            base: p.quaternion.clone(),
            signo: signoAperturaPala(p, ejeRotor),
          })),
        };
      });

    // ---- Despiece vertical ----
    // Conjunto de cada malla: su raiz del GLB, salvo los brazos (un solo
    // nivel, los cuatro) y el grupo del tren, que trae marco y tren juntos.
    const conjuntoDe = (malla: THREE.Object3D) => {
      let primer: THREE.Object3D = malla;
      let raizGlb: THREE.Object3D = malla;
      for (let a: THREE.Object3D | null = malla; a && a !== raiz; a = a.parent) {
        primer = raizGlb;
        raizGlb = a;
      }
      if (/^brazo_/i.test(raizGlb.name)) return "brazos";
      if (/^tren_aterrizaje/i.test(raizGlb.name)) return ES_MARCO.test(primer.name) ? "marco" : "tren";
      return raizGlb.name;
    };
    const centroDe = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const mallas: { malla: THREE.Mesh; conjunto: string; y: number }[] = [];
    raiz.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) mallas.push({ malla: n as THREE.Mesh, conjunto: conjuntoDe(n), y: centroDe(n).y });
    });
    const porConjunto = new Map<string, typeof mallas>();
    for (const m of mallas) porConjunto.set(m.conjunto, [...(porConjunto.get(m.conjunto) ?? []), m]);
    const niveles = [...porConjunto.entries()]
      .map(([conjunto, lista]) => ({ conjunto, lista, y: lista.reduce((s, m) => s + m.y, 0) / lista.length }))
      .sort((a, b) => a.y - b.y);
    const despiece: PiezaDespiece[] = [];
    niveles.forEach(({ lista }, nivel) => {
      const ordenadas = [...lista].sort((a, b) => a.y - b.y);
      ordenadas.forEach(({ malla }, i) => {
        const padre = malla.parent!;
        const origen = malla.getWorldPosition(new THREE.Vector3());
        // La subida se mide en el mundo y se aplica en el espacio del padre
        // (hay padres con escala y giro): igual que el despiece del visor.
        const pasoLocal = padre
          .worldToLocal(origen.clone().add(EJE_Y))
          .sub(padre.worldToLocal(origen.clone()));
        const interna = ordenadas.length > 1 ? i / (ordenadas.length - 1) : 0;
        despiece.push({
          objeto: malla,
          base: malla.position.clone(),
          pasoLocal,
          subida:
            nivel * DESPIECE_VERTICAL.separacionNivel + interna * DESPIECE_VERTICAL.separacionInterna,
        });
      });
    });

    // ---- Piezas que se pintan ----
    const pintables: PiezaPintable[] = [];
    raiz.traverse((n) => {
      const malla = n as THREE.Mesh;
      if (!malla.isMesh) return;
      const rol = CARROCERIA.test(malla.name) ? "carroceria" : ACENTO.test(malla.name) ? "acento" : null;
      if (!rol) return;
      const original = malla.material;
      const fuente = (Array.isArray(original) ? original[0] : original) as THREE.MeshStandardMaterial;
      // Pintura propia por malla, nunca el material del cache de useGLTF.
      const pintura = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(pintura, fuente);
      pintables.push({ malla, original, pintura, rol });
    });

    // ---- Etiquetas ----
    const objetivos = ETIQUETAS.map((e) => {
      let encontrado: THREE.Mesh | null = null;
      raiz.traverse((n) => {
        if (!encontrado && (n as THREE.Mesh).isMesh && e.nodos.test(n.name)) encontrado = n as THREE.Mesh;
      });
      return { texto: e.texto, malla: encontrado as THREE.Mesh | null };
    });

    return { raiz, discos, brazos, despiece, pintables, objetivos };
  }, [gltf.scene]);

  const gotas = useMemo(() => crearGotas(16000), []);
  useEffect(() => {
    alGotas(gotas.puntos);
    return () => gotas.liberar();
  }, [gotas, alGotas]);

  // Materiales de pintura: propios, se liberan al desmontar.
  useEffect(
    () => () => {
      for (const p of modelo.pintables) p.pintura.dispose();
    },
    [modelo],
  );

  // ---- Color del cliente ----
  useEffect(() => {
    const combinacion = COMBINACIONES.find((c) => c.clave === escena.color) ?? null;
    for (const p of modelo.pintables) {
      if (combinacion) pintar(p.pintura, p.rol === "carroceria" ? combinacion.carroceria : combinacion.acento);
      ponerMaterial(p.malla, combinacion ? p.pintura : p.original);
    }
  }, [escena.color, modelo]);

  // ---- Despiece vertical ----
  useEffect(() => {
    for (const d of modelo.despiece) {
      d.objeto.position.copy(d.base).addScaledVector(d.pasoLocal, d.subida * escena.despiece);
    }
  }, [escena.despiece, modelo]);

  useFrame((_, delta) => {
    const p = escena.despliegue;
    const avanceGir = tramo(p, FASES.giratorios);
    const avancePalas = tramo(p, FASES.palas);
    const extra = new THREE.Quaternion();
    const listo = p >= 0.999 && escena.despiece === 0;

    for (const b of modelo.brazos) {
      const avance = tramo(p, b.primeraTanda ? FASES.brazosPar : FASES.brazosImpar);
      extra.setFromAxisAngle(EJE_Y, THREE.MathUtils.degToRad(avance * ANGULO_PLEGADO_BRAZO * b.signoPlegado));
      b.objeto.quaternion.multiplyQuaternions(extra, b.base);

      for (const pala of b.palas) {
        extra.setFromAxisAngle(EJE_Y, THREE.MathUtils.degToRad(avancePalas * ANGULO_APERTURA_PALA * pala.signo));
        pala.objeto.quaternion.multiplyQuaternions(pala.base, extra);
      }

      if (b.giratorio) {
        let angulo = anguloRotor.current.get(b) ?? 0;
        if (!listo) angulo = 0;
        else angulo += VELOCIDAD_ROTOR * escena.encendido * Math.PI * 2 * b.signoGiro * delta;
        anguloRotor.current.set(b, angulo);
        extra.setFromAxisAngle(
          EJE_Y,
          THREE.MathUtils.degToRad(avanceGir * ANGULO_APERTURA_GIRATORIO * -b.signoGiro) + angulo,
        );
        b.giratorio.objeto.quaternion.multiplyQuaternions(b.giratorio.base, extra);
      }
    }

    // ---- Aspersion: misma rampa que el visor; el caudal va detras del giro ----
    const quiere = listo && escena.aspersion;
    rampaGiro.current = THREE.MathUtils.clamp(rampaGiro.current + (quiere ? 1 : -1) * (delta / RAMPA_GIRO_S), 0, 1);
    const abre = quiere && rampaGiro.current > 0.6;
    rampaCaudal.current = THREE.MathUtils.clamp(rampaCaudal.current + (abre ? 1 : -1) * (delta / RAMPA_CAUDAL_S), 0, 1);
    if (escena.despiece > 0) {
      detenerDiscos(modelo.discos);
      gotas.vaciar();
    } else {
      const rpm = escena.rpm * rampaGiro.current;
      girarDiscos(modelo.discos, { cw: rpm, ccw: rpm }, delta);
      const caudal = escena.caudal * rampaCaudal.current;
      gotas.actualizar(
        modelo.discos,
        {
          caudalPorBrazo: { cw: caudal, ccw: caudal },
          rpmPorBrazo: { cw: rpm, ccw: rpm },
          arrastre: ARRASTRE.inicial,
          downwash: DOWNWASH.inicial * escena.encendido,
          sueloY: escena.follaje,
        },
        delta,
      );
    }

    // ---- Anclas de las etiquetas ----
    if (anclasRef.current) {
      anclasRef.current = modelo.objetivos.map(({ texto, malla }) => {
        if (!malla) return { texto, punto: new THREE.Vector3(), visible: false };
        if (!malla.geometry.boundingSphere) malla.geometry.computeBoundingSphere();
        const punto = malla.geometry.boundingSphere!.center.clone().applyMatrix4(malla.matrixWorld);
        return { texto, punto, visible: true };
      });
    }
  });

  return (
    <group ref={grupo} position={[0, escena.altura, 0]}>
      <primitive object={modelo.raiz} />
    </group>
  );
}

useGLTF.preload(GLB_DRON);
