"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { Frames } from "../../../drone_sim_pkg/src/drone-sim-core.js";
import { makeChaseCamera } from "../../../drone_sim_pkg/src/three-adapter.js";
import { useEstudio, type ModoVuelo } from "../estado";
import { entornoPorClave } from "../config";
import { crearSimulador, type EventoSimulador } from "./simulador";
import { cargarSuelo, SUELO_PLANO, type AlturaSuelo } from "./terreno";

/**
 * Pilotaje del MX80 en el campo con el simulador 6-DOF de drone_sim_pkg
 * (perfil 'mx80', ver drone_sim_pkg/src/drone-profiles.js).
 *
 * Cada cuadro: lee el teclado, avanza la fisica (1 kHz interna, independiente
 * de los FPS), coloca el dron, manda el empuje real a los rotores y mueve la
 * camara. La interfaz recibe la telemetria a 10 Hz (no cada cuadro).
 *
 * Teclas (las mismas del ejemplo del paquete):
 *   Enter armar/desarmar · W/S subir/bajar (S sostenida en tierra 2 s apaga)
 *   A/D girar · flechas mover · 1/2/3 modo Acro/Angulo/Posicion · R reiniciar
 */

const R2D = 180 / Math.PI;

/**
 * El frente del MX80 en el GLB mira a -X (la carcasa frontal esta en -X y la
 * derecha del dron es -Z). El simulador pone el frente en -Z: se corrige con
 * un giro de -90 grados en yaw (convencion de three-adapter.js).
 */
const CORRECCION_FRENTE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0, "YXZ"));

const AVISOS: Record<string, (ev: EventoSimulador) => string> = {
  armed: () => "Motores armados",
  disarmed: (ev) =>
    ev.reason === "land-hold"
      ? "Motores apagados: aterrizaje con S sostenida"
      : ev.reason === "preflight-timeout"
        ? "Motores apagados: no despegó a tiempo"
        : "Motores apagados",
  takeoff: () => "Despegue",
  landed: () => "En tierra",
  crash: (ev) => `Choque${ev.msg ? `: ${ev.msg}` : ""}. R para reiniciar`,
  motorFailure: (ev) => `Falla del motor ${(ev.motor ?? 0) + 1}`,
};

/** Cambia el suelo del simulador (fuera del componente: es mutacion del contenedor). */
function fijarSuelo(contenedor: { current: AlturaSuelo }, suelo: AlturaSuelo) {
  contenedor.current = suelo;
}

/** Teclas que no deben mover la pagina mientras se pilota. */
const TECLAS_PROPIAS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

export function Piloto({
  cuerpo,
  encendidoRef,
}: {
  /** Grupo que lleva al dron: el simulador lo mueve. */
  cuerpo: React.RefObject<THREE.Group | null>;
  /** Empuje medio de los rotores para el giro visual de las helices. */
  encendidoRef: React.RefObject<number | null>;
}) {
  const litros = useEstudio((s) => s.litros);
  const alturasMapa = useEstudio((s) => entornoPorClave(s.entorno).alturas);
  const persecucion = useEstudio((s) => s.persecucion);
  const setTelemetria = useEstudio((s) => s.setTelemetria);
  const setAvisoVuelo = useEstudio((s) => s.setAvisoVuelo);
  const setPiloto = useEstudio((s) => s.setPiloto);
  const camara = useThree((s) => s.camera);
  const controles = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;

  // Un simulador nuevo cuando cambia la carga: la masa es parte del vehiculo.
  // Cada simulador lleva su contenedor de suelo, que se llena al llegar el
  // relieve del mapa.
  const { sim, crudo, suelo } = useMemo(() => {
    const contenedor = { current: SUELO_PLANO };
    const creado = crearSimulador(
      litros,
      (ev) => {
        const texto = AVISOS[ev.type]?.(ev);
        if (texto) setAvisoVuelo(texto);
      },
      contenedor,
    );
    return { ...creado, suelo: contenedor };
  }, [litros, setAvisoVuelo]);

  // Suelo del mapa: plano hasta que llega la rejilla de alturas (la zona de
  // despegue es plana en los dos mapas, asi que se puede volar desde ya).
  useEffect(() => {
    let vigente = true;
    fijarSuelo(suelo, SUELO_PLANO);
    cargarSuelo(alturasMapa)
      .then((f) => {
        if (vigente) fijarSuelo(suelo, f);
      })
      .catch(() => setAvisoVuelo("No se pudo cargar el relieve del mapa: se vuela sobre suelo plano"));
    return () => {
      vigente = false;
    };
  }, [suelo, alturasMapa, setAvisoVuelo]);

  const persigue = useMemo(() => makeChaseCamera(THREE, camara, crudo), [camara, crudo]);
  const teclas = useRef<Record<string, boolean>>({});
  const acelerador = useRef(0);
  const ultimaTelemetria = useRef(0);
  const posAnterior = useRef<THREE.Vector3 | null>(null);
  const tmp = useMemo(
    () => ({ q: new THREE.Quaternion(), cg: new THREE.Vector3(), p: new THREE.Vector3() }),
    [],
  );

  // Ordenes de la interfaz.
  useEffect(() => {
    setPiloto({
      armar: () => sim.arm(),
      desarmar: () => sim.disarm("manual"),
      reiniciar: () => {
        sim.reset();
        acelerador.current = 0;
        setAvisoVuelo(null);
      },
      setModo: (modo: ModoVuelo) => sim.setMode(modo),
    });
    return () => setPiloto(null);
  }, [sim, setPiloto, setAvisoVuelo]);

  // Teclado.
  useEffect(() => {
    const enCampoDeTexto = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
    const abajo = (e: KeyboardEvent) => {
      if (enCampoDeTexto(e)) return;
      if (TECLAS_PROPIAS.has(e.code)) e.preventDefault();
      if (teclas.current[e.code]) return;
      teclas.current[e.code] = true;
      if (e.code === "Enter") {
        if (sim.armed) sim.disarm("manual");
        else if (!sim.arm()) setAvisoVuelo("Solo se puede armar en tierra");
      }
      if (e.code === "Digit1") sim.setMode("acro");
      if (e.code === "Digit2") sim.setMode("angle");
      if (e.code === "Digit3") sim.setMode("pos");
      if (e.code === "KeyR") {
        sim.reset();
        acelerador.current = 0;
        setAvisoVuelo(null);
      }
      if (e.code === "Space") acelerador.current = sim.P.hoverThr;
    };
    const arriba = (e: KeyboardEvent) => {
      teclas.current[e.code] = false;
    };
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    return () => {
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
      teclas.current = {};
    };
  }, [sim, setAvisoVuelo]);

  // Al dejar de pilotar, el dron vuelve a su lugar y los rotores a escena.encendido.
  useEffect(() => {
    const grupo = cuerpo.current;
    const encendido = encendidoRef;
    return () => {
      grupo?.position.set(0, 0, 0);
      grupo?.quaternion.identity();
      encendido.current = null;
      setTelemetria(null);
    };
  }, [cuerpo, encendidoRef, setTelemetria]);

  useFrame((_, dtCuadro) => {
    const dt = Math.min(dtCuadro, 0.05);
    const k = (c: string) => (teclas.current[c] ? 1 : 0);
    acelerador.current = Math.min(1, Math.max(0, acelerador.current + (k("KeyW") - k("KeyS")) * 0.45 * dt));
    sim.setInput({
      thr: sim.mode === "pos" ? 0 : acelerador.current,
      climb: k("KeyW") - k("KeyS"),
      yaw: k("KeyD") - k("KeyA"),
      pitch: k("ArrowUp") - k("ArrowDown"),
      roll: k("ArrowRight") - k("ArrowLeft"),
    });
    sim.step(dt);

    // Pose: el simulador da el CG; el grupo del dron tiene su origen en el
    // punto mas bajo del modelo, que esta hGear por debajo del CG.
    const x = sim.x;
    const p = Frames.threeVec(x[0], x[1], x[2]);
    const q = Frames.threeQuat([x[6], x[7], x[8], x[9]]);
    const grupo = cuerpo.current;
    if (grupo) {
      tmp.q.set(q.x, q.y, q.z, q.w).multiply(CORRECCION_FRENTE);
      grupo.quaternion.copy(tmp.q);
      tmp.cg.set(0, sim.P.hGear, 0).applyQuaternion(tmp.q);
      grupo.position.set(p.x, p.y, p.z).sub(tmp.cg);
    }

    // Rotores: empuje medio real (0..1).
    let suma = 0;
    for (let i = 0; i < sim.P.N; i++) suma += x[13 + i] / sim.P.OmMax;
    encendidoRef.current = sim.armed ? suma / sim.P.N : 0;

    // Camara: persecucion, o libre siguiendo al dron.
    tmp.p.set(p.x, p.y, p.z);
    if (persecucion) {
      persigue(dt);
    } else if (controles) {
      if (posAnterior.current) {
        const delta = tmp.p.clone().sub(posAnterior.current);
        camara.position.add(delta);
        controles.target.add(delta);
        controles.update();
      } else {
        controles.target.copy(tmp.p);
        controles.update();
      }
    }
    posAnterior.current = posAnterior.current ? posAnterior.current.copy(tmp.p) : tmp.p.clone();

    // Telemetria a 10 Hz.
    const ahora = performance.now();
    if (ahora - ultimaTelemetria.current > 100) {
      ultimaTelemetria.current = ahora;
      const s = sim.getState();
      setTelemetria({
        armado: s.armed,
        enTierra: s.landed,
        chocado: s.crashed,
        modo: s.mode,
        altura: Math.max(0, s.agl),
        velocidad: Math.hypot(s.velNed.n, s.velNed.e),
        vertical: -s.velNed.d,
        empuje: s.rotorThrustFrac.reduce((a, b) => a + b, 0) / s.rotorThrustFrac.length,
        rumbo: (((s.euler.yaw * R2D) % 360) + 360) % 360,
        masa: sim.P.m,
      });
    }
  });

  return null;
}
