"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useFrame, useStore, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { useVisor } from "./estado";
import { piezaPorSku } from "./registro";

/**
 * Camara orbital con encuadre automatico.
 *
 * - Al cargar el modelo calcula la distancia a partir del radio real
 *   del ensamble, asi que funciona igual sin importar la escala de Blender.
 * - Al seleccionar una pieza, se acerca a ella de forma suave.
 * - "Reiniciar vista" vuelve al encuadre general.
 *
 * La interpolacion es exponencial y dependiente de delta, por lo que se ve
 * igual a 30 o a 144 cuadros por segundo.
 */

/** Direccion base de la camara respecto al modelo (tres cuartos, ligeramente elevada). */
const DIRECCION_INICIAL = new THREE.Vector3(1, 0.5, 1.25).normalize();

/** Margen alrededor del modelo al encuadrar (1.0 = justo, sin aire). */
const MARGEN_ENCUADRE = 1.12;

/**
 * Distancia de camara que encuadra por completo la caja envolvente del modelo.
 *
 * Se proyecta la caja sobre los ejes de la camara (derecha, arriba, profundidad)
 * y se resuelve la distancia por separado en vertical y en horizontal:
 *
 *     d_vertical   = semialto  / tan(fov_v / 2)
 *     d_horizontal = semiancho / tan(fov_h / 2)
 *     fov_h        = 2 * atan( tan(fov_v / 2) * relacion_de_aspecto )
 *
 * Se toma la mayor y se suma la mitad de la profundidad. Usar la caja en vez de
 * la esfera envolvente importa con piezas alargadas como el brazo del dron:
 * la esfera dejaria mucho aire arriba y abajo en pantallas anchas.
 */
function distanciaParaEncuadrar(
  camara: THREE.Camera,
  tamanio: { width: number; height: number },
  tamanoModelo: [number, number, number],
  direccion: THREE.Vector3,
  radioRespaldo: number,
): number {
  if (!(camara instanceof THREE.PerspectiveCamera)) return radioRespaldo * 2.6;

  const fovVertical = THREE.MathUtils.degToRad(camara.fov);
  const relacion =
    camara.aspect || (tamanio.height > 0 ? tamanio.width / tamanio.height : 1);
  const fovHorizontal = 2 * Math.atan(Math.tan(fovVertical / 2) * relacion);

  // Base ortonormal de la camara para la direccion de encuadre indicada.
  const adelante = direccion.clone().normalize();
  const arribaGlobal = new THREE.Vector3(0, 1, 0);
  let derecha = new THREE.Vector3().crossVectors(arribaGlobal, adelante);
  if (derecha.lengthSq() < 1e-8) derecha = new THREE.Vector3(1, 0, 0);
  derecha.normalize();
  const arriba = new THREE.Vector3()
    .crossVectors(adelante, derecha)
    .normalize();

  const semi = new THREE.Vector3(
    tamanoModelo[0] / 2,
    tamanoModelo[1] / 2,
    tamanoModelo[2] / 2,
  );

  // Extension de la caja proyectada sobre cada eje de la camara.
  const proyectar = (eje: THREE.Vector3) =>
    Math.abs(semi.x * eje.x) +
    Math.abs(semi.y * eje.y) +
    Math.abs(semi.z * eje.z);

  const semiancho = proyectar(derecha);
  const semialto = proyectar(arriba);
  const semiprofundidad = proyectar(adelante);

  const dVertical = semialto / Math.tan(fovVertical / 2);
  const dHorizontal = semiancho / Math.tan(fovHorizontal / 2);

  const distancia =
    Math.max(dVertical, dHorizontal) * MARGEN_ENCUADRE + semiprofundidad;

  // Salvaguarda por si el modelo llega sin dimensiones utiles.
  return distancia > 0 ? distancia : radioRespaldo * 2.6;
}

export function CamaraControles() {
  const controles = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camara = useThree((s) => s.camera);
  // Se lee el tamanio del lienzo desde el store (no como valor suscrito) para
  // calcular el encuadre sin reencuadrar cada vez que el usuario cambia el tamanio.
  const store = useStore();

  const radio = useVisor((s) => s.radio);
  const tamanoEnsamble = useVisor((s) => s.tamanoEnsamble);
  const seleccion = useVisor((s) => s.seleccion);
  const autoRotar = useVisor((s) => s.autoRotar);
  const solicitudReencuadre = useVisor((s) => s.solicitudReencuadre);

  const objetivoDeseado = useRef(new THREE.Vector3());
  const posicionDeseada = useRef(new THREE.Vector3());
  const animando = useRef(false);
  const auxiliar = useRef(new THREE.Vector3());
  const ultimoCentro = useRef<THREE.Vector3 | null>(null);
  const cajaSeguimiento = useRef(new THREE.Box3());
  const centroSeguimiento = useRef(new THREE.Vector3());

  // Encuadre general: al cargar el modelo y al pedir reinicio.
  useEffect(() => {
    // Planos de recorte proporcionales al modelo: asi funciona igual si
    // exportaste en metros, centimetros o milimetros.
    if (camara instanceof THREE.PerspectiveCamera) {
      camara.near = Math.max(radio * 0.005, 0.001);
      camara.far = radio * 60;
      camara.updateProjectionMatrix();
    }

    // Encuadre que garantiza que la esfera envolvente cabe tanto en vertical
    // como en horizontal. En un telefono en vertical el campo de vision
    // horizontal es mucho menor, por eso no basta con una distancia fija.
    const distancia = distanciaParaEncuadrar(
      camara,
      store.getState().size,
      tamanoEnsamble,
      DIRECCION_INICIAL,
      radio,
    );
    objetivoDeseado.current.set(0, 0, 0);
    posicionDeseada.current
      .copy(DIRECCION_INICIAL)
      .multiplyScalar(distancia);
    animando.current = true;
  }, [radio, tamanoEnsamble, solicitudReencuadre, camara, store]);

  // Acercamiento a la pieza seleccionada.
  useEffect(() => {
    if (!seleccion) return;
    const pieza = piezaPorSku(seleccion);
    if (!pieza) return;

    const centro = pieza.objeto.getWorldPosition(new THREE.Vector3());
    // Si el origen de la pieza esta lejos de su volumen, usar el centro geometrico.
    const caja = new THREE.Box3().setFromObject(pieza.objeto);
    if (!caja.isEmpty()) caja.getCenter(centro);

    // Distancia proporcional al tamanio de la pieza, con un minimo razonable
    // para que un tornillo no llene toda la pantalla.
    const distancia = Math.max(pieza.radioPieza * 5.5, radio * 0.75);

    // Se conserva la direccion actual de la camara: el usuario no pierde su orientacion.
    const direccionActual = auxiliar.current
      .copy(camara.position)
      .sub(controles.current?.target ?? new THREE.Vector3())
      .normalize();
    if (direccionActual.lengthSq() < 1e-6) {
      direccionActual.copy(DIRECCION_INICIAL);
    }

    objetivoDeseado.current.copy(centro);
    posicionDeseada.current
      .copy(centro)
      .add(direccionActual.multiplyScalar(distancia));
    ultimoCentro.current = centro.clone();
    animando.current = true;
  }, [seleccion, radio, camara]);

  useFrame((_, delta) => {
    const c = controles.current;
    if (!c) return;

    // Se suspende mientras la camara esta animando hacia un encuadre (al
    // seleccionar una pieza, al reiniciar la vista, o al cargar el modelo):
    // OrbitControls y el lerp manual de abajo escriben camera.position en
    // el mismo cuadro y se pisan entre si, lo que hacia ver el giro
    // "trabado" hasta que el usuario le daba clic al boton una segunda vez.
    c.autoRotate = autoRotar && !animando.current;
    c.autoRotateSpeed = 0.9;

    // Seguimiento: si la pieza seleccionada se mueve (slider de despiece),
    // camara y objetivo se desplazan igual para conservar el encuadre.
    const pieza = seleccion ? piezaPorSku(seleccion) : null;
    if (pieza && ultimoCentro.current) {
      const centro = centroSeguimiento.current;
      cajaSeguimiento.current.setFromObject(pieza.objeto);
      if (cajaSeguimiento.current.isEmpty()) {
        pieza.objeto.getWorldPosition(centro);
      } else {
        cajaSeguimiento.current.getCenter(centro);
      }
      const desplazamiento = auxiliar.current
        .copy(centro)
        .sub(ultimoCentro.current);
      if (desplazamiento.lengthSq() > 1e-12) {
        camara.position.add(desplazamiento);
        c.target.add(desplazamiento);
        objetivoDeseado.current.add(desplazamiento);
        posicionDeseada.current.add(desplazamiento);
        ultimoCentro.current.copy(centro);
      }
    } else if (!seleccion) {
      ultimoCentro.current = null;
    }

    if (animando.current) {
      const k = 1 - Math.exp(-5.5 * delta);
      camara.position.lerp(posicionDeseada.current, k);
      c.target.lerp(objetivoDeseado.current, k);

      const cerca =
        camara.position.distanceToSquared(posicionDeseada.current) <
          (radio * 0.002) ** 2 &&
        c.target.distanceToSquared(objetivoDeseado.current) <
          (radio * 0.002) ** 2;
      if (cerca) animando.current = false;
    }

    c.update();
  });

  return (
    <OrbitControls
      ref={controles}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      minDistance={radio * 0.35}
      maxDistance={radio * 9}
      // Evita que la camara pase por debajo del plano de sombra.
      maxPolarAngle={Math.PI * 0.495}
      zoomSpeed={0.8}
      rotateSpeed={0.85}
    />
  );
}
