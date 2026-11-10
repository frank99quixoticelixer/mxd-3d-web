import * as THREE from "three";

import {
  APERTURA_ABANICO_GRADOS,
  ARRASTRE_NIEBLA_FACTOR,
  CAIDA_BAJO_SUELO_M,
  COLOR_GOTA,
  COLOR_NIEBLA,
  DISPERSION_VELOCIDAD,
  ESCALA_VELOCIDAD_SALIDA,
  FRACCION_NIEBLA,
  FRACCION_RADIAL,
  GRAVEDAD,
  GRAVEDAD_NIEBLA_FACTOR,
  OPACIDAD_GOTA,
  OPACIDAD_NIEBLA,
  PASO_MAX_S,
  PASOS_MAX_POR_CUADRO,
  TAMANO_GOTA_M,
  TAMANO_NIEBLA_M,
  VIDA_MAX_S,
} from "./config";
import type { Disco } from "./discos";

/**
 * Gotas del aspersor: un pool fijo de particulas en un solo THREE.Points.
 *
 * Todo se reserva al crear el sistema (posiciones, velocidades, vida, tamano)
 * y se recicla en anillo: una gota que agota su vida o cae lo suficiente queda
 * libre y la siguiente emision la reutiliza. Nada se crea ni se destruye por
 * cuadro, que es lo que mantiene el visor fluido en un telefono.
 *
 * Hay dos tipos en el mismo pool, para que la cortina tenga volumen:
 *   gota    sale lejos del disco y cae en cono
 *   niebla  frena enseguida y flota junto al disco: el halo del atomizado
 *
 * Las posiciones estan en coordenadas del MUNDO: el Points no cuelga del
 * modelo, asi que las gotas ya lanzadas no se mueven si el brazo se mueve.
 */

/** Lo que cambia cuadro a cuadro y llega desde los mandos (ya con rampas). */
export interface ParametrosGotas {
  /** Gotas por segundo por disco, por brazo. 0 = cerrado. */
  caudalPorBrazo: { cw: number; ccw: number };
  /** RPM visual actual por brazo: da la velocidad tangencial de salida. */
  rpmPorBrazo: { cw: number; ccw: number };
  /** Arrastre lineal, 1/s. */
  arrastre: number;
  /** Empuje hacia abajo, m/s^2 (ya escalado por el encendido de motores). */
  downwash: number;
  /** Altura de la sombra del dron en el mundo; las gotas caen hasta debajo. */
  sueloY: number;
}

export interface SistemaGotas {
  puntos: THREE.Points;
  actualizar: (discos: Disco[], p: ParametrosGotas, delta: number) => void;
  /** Apaga todas las gotas vivas (al salir de la vista o reiniciar). */
  vaciar: () => void;
  liberar: () => void;
}

const VERTEX = /* glsl */ `
  attribute float tamano;
  attribute float alfa;
  attribute float niebla;
  uniform float escalaPantalla;
  varying float vAlfa;
  varying float vNiebla;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlfa = alfa;
    vNiebla = niebla;
    // Tamano en metros de escena convertido a pixeles segun la distancia.
    gl_PointSize = tamano > 0.0 ? max(1.5, tamano * escalaPantalla / -mv.z) : 0.0;
  }
`;

/**
 * La gota se sombrea como una esfera (normal sacada de gl_PointCoord) con un
 * brillo especular fijo: asi se lee como agua y no como un punto plano. La
 * niebla es un disco difuso, sin brillo.
 */
const FRAGMENT = /* glsl */ `
  uniform vec3 colorGota;
  uniform vec3 colorNiebla;
  uniform float opacidadGota;
  uniform float opacidadNiebla;
  varying float vAlfa;
  varying float vNiebla;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    if (vNiebla > 0.5) {
      float suave = exp(-r2 * 3.0);
      gl_FragColor = vec4(colorNiebla, opacidadNiebla * suave * vAlfa);
      return;
    }
    vec3 n = vec3(c.x, -c.y, sqrt(1.0 - r2));
    vec3 luz = normalize(vec3(-0.4, 0.7, 0.6));
    float difusa = 0.55 + 0.45 * max(dot(n, luz), 0.0);
    float brillo = pow(max(dot(reflect(-luz, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
    // Mas transparente al centro, mas opaca en el borde: el aspecto de una gota.
    float borde = mix(0.55, 1.0, r2);
    vec3 color = colorGota * difusa + vec3(brillo);
    gl_FragColor = vec4(color, opacidadGota * borde * vAlfa + brillo * 0.5 * vAlfa);
  }
`;

export function crearGotas(capacidad: number): SistemaGotas {
  const pos = new Float32Array(capacidad * 3);
  const vel = new Float32Array(capacidad * 3);
  const vida = new Float32Array(capacidad);
  const tamano = new Float32Array(capacidad);
  const alfa = new Float32Array(capacidad);
  const niebla = new Float32Array(capacidad);
  /** Tamano al nacer; la niebla crece desde aqui. */
  const tamanoBase = new Float32Array(capacidad);

  const geometria = new THREE.BufferGeometry();
  const atrPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const atrTamano = new THREE.BufferAttribute(tamano, 1).setUsage(THREE.DynamicDrawUsage);
  const atrAlfa = new THREE.BufferAttribute(alfa, 1).setUsage(THREE.DynamicDrawUsage);
  const atrNiebla = new THREE.BufferAttribute(niebla, 1).setUsage(THREE.DynamicDrawUsage);
  geometria.setAttribute("position", atrPos);
  geometria.setAttribute("tamano", atrTamano);
  geometria.setAttribute("alfa", atrAlfa);
  geometria.setAttribute("niebla", atrNiebla);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      colorGota: { value: new THREE.Color(COLOR_GOTA) },
      colorNiebla: { value: new THREE.Color(COLOR_NIEBLA) },
      opacidadGota: { value: OPACIDAD_GOTA },
      opacidadNiebla: { value: OPACIDAD_NIEBLA },
      escalaPantalla: { value: 800 },
    },
    transparent: true,
    depthWrite: false,
  });

  const puntos = new THREE.Points(geometria, material);
  puntos.name = "gotas_aspersion";
  // Las gotas cambian de sitio cada cuadro: una esfera envolvente fija las
  // recortaria al salir de ella. Y no se tocan: el clic pasa a traves.
  puntos.frustumCulled = false;
  puntos.raycast = () => {};
  puntos.renderOrder = 10;
  // La escala de pantalla depende del alto del lienzo y del campo de vision;
  // se ajusta justo antes de dibujar, con la camara que de verdad se usa.
  const tamanoLienzo = new THREE.Vector2();
  puntos.onBeforeRender = (renderer, _escena, camara) => {
    const alto = renderer.getDrawingBufferSize(tamanoLienzo).y;
    const fov = camara instanceof THREE.PerspectiveCamera ? camara.fov : 35;
    material.uniforms.escalaPantalla.value = alto / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  };

  let siguiente = 0;
  let vivas = 0;
  /** Gotas pendientes de emitir por disco (fraccion acumulada entre cuadros). */
  const pendientes = new Map<Disco, number>();

  const centro = new THREE.Vector3();
  const eje = new THREE.Vector3();
  const u = new THREE.Vector3();
  const w = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const tangente = new THREE.Vector3();
  const cuat = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const apertura = Math.tan(THREE.MathUtils.degToRad(APERTURA_ABANICO_GRADOS));

  function emitir(d: Disco, cantidad: number, rpm: number) {
    // Marco del disco en el mundo: centro, eje (Y del pivote) y dos vectores
    // en su plano. Se lee del pivote vivo, asi que sigue al brazo y al giro.
    d.pivote.matrixWorld.decompose(centro, cuat, escala);
    eje.set(0, 1, 0).applyQuaternion(cuat);
    u.set(1, 0, 0).applyQuaternion(cuat);
    w.crossVectors(eje, u);
    centro.addScaledVector(eje, d.alturaBorde);

    const omega = (rpm / 60) * Math.PI * 2;
    const vTangencial = omega * d.radio * ESCALA_VELOCIDAD_SALIDA;

    for (let k = 0; k < cantidad; k++) {
      const i = siguiente;
      siguiente = (siguiente + 1) % capacidad;
      if (vida[i] <= 0) vivas++;

      const esNiebla = Math.random() < FRACCION_NIEBLA;
      const fi = Math.random() * Math.PI * 2;
      radial.copy(u).multiplyScalar(Math.cos(fi)).addScaledVector(w, Math.sin(fi));
      // Tangente segun el sentido de giro: eje x radial apunta antihorario.
      tangente.crossVectors(eje, radial).multiplyScalar(d.sentido);

      const factor = 1 + (Math.random() * 2 - 1) * DISPERSION_VELOCIDAD;
      const v = vTangencial * factor * (esNiebla ? 0.6 : 1);
      // Salida en el plano del disco (inclinado 20 grados hacia afuera, asi que
      // el abanico sale inclinado igual) mas un poco fuera de el, para que la
      // cortina tenga espesor.
      const fuera = (Math.random() * 2 - 1) * apertura * v;
      const i3 = i * 3;
      pos[i3] = centro.x + radial.x * d.radio;
      pos[i3 + 1] = centro.y + radial.y * d.radio;
      pos[i3 + 2] = centro.z + radial.z * d.radio;
      vel[i3] = tangente.x * v + radial.x * v * FRACCION_RADIAL + eje.x * fuera;
      vel[i3 + 1] = tangente.y * v + radial.y * v * FRACCION_RADIAL + eje.y * fuera;
      vel[i3 + 2] = tangente.z * v + radial.z * v * FRACCION_RADIAL + eje.z * fuera;
      vida[i] = VIDA_MAX_S * (esNiebla ? 0.6 : 1) * (0.8 + Math.random() * 0.4);
      niebla[i] = esNiebla ? 1 : 0;
      tamanoBase[i] = esNiebla
        ? TAMANO_NIEBLA_M.base * (0.7 + Math.random() * 0.6)
        : TAMANO_GOTA_M.base * (1 + (Math.random() * 2 - 1) * TAMANO_GOTA_M.variacion);
      tamano[i] = tamanoBase[i];
      alfa[i] = 1;
    }
  }

  function integrar(p: ParametrosGotas, dt: number) {
    const aGota = -GRAVEDAD - p.downwash;
    const aNiebla = -GRAVEDAD * GRAVEDAD_NIEBLA_FACTOR - p.downwash * 0.5;
    const amortiguarGota = Math.max(0, 1 - p.arrastre * dt);
    const amortiguarNiebla = Math.max(0, 1 - p.arrastre * ARRASTRE_NIEBLA_FACTOR * dt);
    const fondo = p.sueloY - CAIDA_BAJO_SUELO_M;
    for (let i = 0; i < capacidad; i++) {
      if (vida[i] <= 0) continue;
      const i3 = i * 3;
      const esNiebla = niebla[i] > 0.5;
      const amortiguar = esNiebla ? amortiguarNiebla : amortiguarGota;
      vel[i3] *= amortiguar;
      vel[i3 + 1] = vel[i3 + 1] * amortiguar + (esNiebla ? aNiebla : aGota) * dt;
      vel[i3 + 2] *= amortiguar;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      vida[i] -= dt;
      const y = pos[i3 + 1];
      if (vida[i] <= 0 || y <= fondo) {
        vida[i] = 0;
        tamano[i] = 0;
        alfa[i] = 0;
        vivas--;
        continue;
      }
      // Se desvanece al final de su vida y en el ultimo tramo de la caida.
      const porVida = Math.min(1, vida[i] / 0.5);
      const porCaida = Math.min(1, (y - fondo) / (CAIDA_BAJO_SUELO_M * 0.5));
      alfa[i] = porVida * porCaida;
      if (esNiebla) {
        const edad = 1 - vida[i] / (VIDA_MAX_S * 0.6);
        tamano[i] = tamanoBase[i] * (1 + edad * TAMANO_NIEBLA_M.crecimiento);
      }
    }
  }

  return {
    puntos,

    actualizar(discos, p, delta) {
      // Paso acotado y dividido: el resultado no depende de los FPS y un
      // cuadro muy largo no dispara las gotas fuera de la escena.
      const total = Math.min(delta, PASO_MAX_S * PASOS_MAX_POR_CUADRO);
      const pasos = Math.max(1, Math.ceil(total / PASO_MAX_S));
      const dt = total / pasos;

      for (let s = 0; s < pasos; s++) {
        for (const d of discos) {
          const caudal = p.caudalPorBrazo[d.brazo];
          if (caudal <= 0) {
            pendientes.set(d, 0);
            continue;
          }
          const acumulado = (pendientes.get(d) ?? 0) + caudal * dt;
          const cantidad = Math.floor(acumulado);
          pendientes.set(d, acumulado - cantidad);
          if (cantidad > 0) emitir(d, cantidad, p.rpmPorBrazo[d.brazo]);
        }
        if (vivas > 0) integrar(p, dt);
      }

      atrPos.needsUpdate = true;
      atrTamano.needsUpdate = true;
      atrAlfa.needsUpdate = true;
      atrNiebla.needsUpdate = true;
      puntos.visible = vivas > 0;
    },

    vaciar() {
      vida.fill(0);
      tamano.fill(0);
      alfa.fill(0);
      vivas = 0;
      pendientes.clear();
      atrTamano.needsUpdate = true;
      atrAlfa.needsUpdate = true;
      puntos.visible = false;
    },

    liberar() {
      geometria.dispose();
      material.dispose();
    },
  };
}
