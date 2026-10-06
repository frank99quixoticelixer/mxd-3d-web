"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useVisor } from "./estado";
import { registroPiezas } from "./registro";
import { perteneceAlSku } from "./resolverPiezas";

/**
 * Contorno de seleccion en pantalla, estilo Blender (en verde neon).
 *
 * Se dibuja sobre la imagen 2D final, siguiendo exactamente la silueta
 * visible de la pieza seleccionada:
 *
 *   1. MASCARA: se renderiza la escena en negro (solo para tener la
 *      profundidad) y encima la pieza seleccionada en blanco. Asi la mascara
 *      contiene solo la parte de la pieza que realmente se ve en pantalla.
 *      El render usa MSAA para que el borde salga suavizado.
 *   2. BORDE: un cuadro a pantalla completa busca los pixeles que estan
 *      FUERA de la mascara pero a menos de N pixeles de ella, y los pinta
 *      de verde. El resultado es un marco fino pegado a la silueta.
 *
 * Este componente toma el control del render (useFrame con prioridad 1).
 */

export const CONTORNO = {
  /** Verde neon (fosforescente). */
  color: "#39FF14",
  /** Grosor del borde, en pixeles de pantalla. */
  grosor: 2,
  /** Resplandor tenue alrededor del borde (0 = sin resplandor). */
  resplandor: 0.35,
  /** Alcance del resplandor, en pixeles. */
  alcanceResplandor: 5,
} as const;

/** Capa de three.js reservada para la pieza seleccionada. */
const CAPA_SELECCION = 10;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D mascara;
  uniform vec2 texel;
  uniform float grosor;
  uniform float alcance;
  uniform float resplandor;
  uniform vec3 color;
  varying vec2 vUv;

  const int MUESTRAS = 24;

  void main() {
    float dentro = texture2D(mascara, vUv).r;
    float borde = 0.0;
    float halo = 0.0;
    for (int i = 0; i < MUESTRAS; i++) {
      float a = float(i) * 6.2831853 / float(MUESTRAS);
      vec2 d = vec2(cos(a), sin(a)) * texel;
      borde = max(borde, texture2D(mascara, vUv + d * grosor).r);
      borde = max(borde, texture2D(mascara, vUv + d * grosor * 0.5).r);
      halo = max(halo, texture2D(mascara, vUv + d * alcance).r * 0.6);
    }
    // Solo por fuera de la silueta, como en Blender.
    float fuera = 1.0 - dentro;
    float alfa = max(borde, halo * resplandor) * fuera;
    if (alfa < 0.003) discard;
    gl_FragColor = vec4(color, alfa);
  }
`;

export function ContornoPantalla() {
  const gl = useThree((s) => s.gl);

  const recursos = useMemo(() => {
    const destino = new THREE.WebGLRenderTarget(1, 1, {
      samples: 4,
      depthBuffer: true,
    });
    const negro = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blanco = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthFunc: THREE.LessEqualDepth,
    });

    const material = new THREE.ShaderMaterial({
      uniforms: {
        mascara: { value: destino.texture },
        texel: { value: new THREE.Vector2(1, 1) },
        grosor: { value: CONTORNO.grosor },
        alcance: { value: CONTORNO.alcanceResplandor },
        resplandor: { value: CONTORNO.resplandor },
        color: { value: new THREE.Color(CONTORNO.color) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const cuadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    cuadro.frustumCulled = false;
    const escenaCuadro = new THREE.Scene();
    escenaCuadro.add(cuadro);
    const camaraCuadro = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      destino,
      negro,
      blanco,
      material,
      escenaCuadro,
      camaraCuadro,
      tamanio: new THREE.Vector2(),
      marcadas: new Set<THREE.Object3D>(),
      colorPrevio: new THREE.Color(),
    };
  }, []);

  useEffect(() => {
    return () => {
      recursos.destino.dispose();
      recursos.negro.dispose();
      recursos.blanco.dispose();
      recursos.material.dispose();
    };
  }, [recursos]);

  useFrame(({ scene, camera }) => {
    // Render normal de la escena.
    gl.render(scene, camera);

    const r = recursos;
    const seleccion = useVisor.getState().seleccion;
    const piezas = seleccion
      ? registroPiezas.actual.filter((p) => perteneceAlSku(p, seleccion))
      : [];

    // Marcar en la capa de seleccion solo las mallas de la pieza elegida.
    const actuales = new Set<THREE.Object3D>();
    for (const p of piezas) {
      p.objeto.traverse((n) => {
        if ((n as THREE.Mesh).isMesh) actuales.add(n);
      });
    }
    for (const n of r.marcadas) {
      if (!actuales.has(n)) n.layers.disable(CAPA_SELECCION);
    }
    for (const n of actuales) n.layers.enable(CAPA_SELECCION);
    r.marcadas = actuales;

    if (actuales.size === 0) return;

    // Ajustar la mascara al tamanio real del lienzo (incluye la densidad de pixeles).
    gl.getDrawingBufferSize(r.tamanio);
    if (
      r.destino.width !== r.tamanio.x ||
      r.destino.height !== r.tamanio.y
    ) {
      r.destino.setSize(r.tamanio.x, r.tamanio.y);
    }
    const dpr = gl.getPixelRatio();
    r.material.uniforms.texel.value.set(1 / r.tamanio.x, 1 / r.tamanio.y);
    r.material.uniforms.grosor.value = CONTORNO.grosor * dpr;
    r.material.uniforms.alcance.value = CONTORNO.alcanceResplandor * dpr;

    // Guardar el estado del renderizador.
    const autoClear = gl.autoClear;
    const alfaPrevio = gl.getClearAlpha();
    gl.getClearColor(r.colorPrevio);
    const fondo = scene.background;
    const sobrescrito = scene.overrideMaterial;
    const capasCamara = camera.layers.mask;
    const aislar = useVisor.getState().aislar;

    // 1. Mascara.
    gl.autoClear = false;
    gl.setRenderTarget(r.destino);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    scene.background = null;

    // Con "aislar" las demas piezas son translucidas: no deben tapar el contorno.
    if (!aislar) {
      scene.overrideMaterial = r.negro;
      gl.render(scene, camera);
    }
    scene.overrideMaterial = r.blanco;
    camera.layers.set(CAPA_SELECCION);
    gl.render(scene, camera);

    // Restaurar.
    camera.layers.mask = capasCamara;
    scene.overrideMaterial = sobrescrito;
    scene.background = fondo;
    gl.setRenderTarget(null);
    gl.setClearColor(r.colorPrevio, alfaPrevio);

    // 2. Borde encima de la imagen final.
    gl.render(r.escenaCuadro, r.camaraCuadro);
    gl.autoClear = autoClear;
  }, 1);

  return null;
}
