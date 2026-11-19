/**
 * three-adapter.js — Une un DroneSim con un Object3D de three.js (p. ej. un GLB).
 *
 * No importa three.js: recibe la instancia THREE para funcionar con cualquier versión
 * (probado con r128). Para Godot/Babylon usa las mismas fórmulas de Frames.threeVec/threeQuat.
 */
import { Frames } from './drone-sim-core.js';

const D2R = Math.PI / 180;

/**
 * @param {object} THREE    módulo three.js
 * @param {DroneSim} sim
 * @param {THREE.Object3D} object3D  raíz del modelo (p. ej. gltf.scene)
 * @param {object} [opts]
 * @param {number} [opts.yawOffsetDeg=0]   corrección si el frente del GLB no mira a -Z
 *                                         (frente en +Z => 180; frente en +X => 90; frente en -X => -90)
 * @param {number} [opts.pitchOffsetDeg=0]
 * @param {number} [opts.rollOffsetDeg=0]
 * @param {number[]} [opts.cgOffset=[0,0,0]]  vector del origen del GLB al CG, en coordenadas locales del modelo [m]
 * @param {number} [opts.scale=1]            escala del modelo (si el GLB no está en metros)
 * @param {(string|THREE.Object3D)[]} [opts.propNodes=[]]  nodos de hélice EN EL ORDEN DE ROTORES del simulador
 * @param {'x'|'y'|'z'} [opts.propAxis='y']  eje local de giro de cada hélice
 * @param {number} [opts.propSpinSign=1]     invierte el sentido visual si tu modelo tiene el eje al revés
 * @param {number} [opts.propVisualMax=30]   [rad/s] velocidad visual máxima (evita efecto estroboscópico)
 */
export function bindThreeObject(THREE, sim, object3D, opts = {}) {
  const o = { yawOffsetDeg: 0, pitchOffsetDeg: 0, rollOffsetDeg: 0, cgOffset: [0, 0, 0], scale: 1,
              propNodes: [], propAxis: 'y', propSpinSign: 1, propVisualMax: 30, ...opts };
  object3D.scale.setScalar(o.scale);
  const qOff = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.pitchOffsetDeg*D2R, o.yawOffsetDeg*D2R, o.rollOffsetDeg*D2R, 'YXZ'));
  const cg = new THREE.Vector3(...o.cgOffset).multiplyScalar(o.scale);
  const props = o.propNodes.map(n => (typeof n === 'string' ? object3D.getObjectByName(n) : n));
  props.forEach((p, i) => { if (!p) console.warn(`[three-adapter] No se encontró el nodo de hélice #${i}: ${o.propNodes[i]}`); });
  if (props.length && props.length !== sim.P.N) console.warn(`[three-adapter] ${props.length} nodos de hélice para ${sim.P.N} rotores.`);
  const qSim = new THREE.Quaternion(), vTmp = new THREE.Vector3();

  return {
    props,
    /** Llamar una vez por frame, después de sim.step(dt). */
    update(dt) {
      const x = sim.x, P = sim.P;
      const p = Frames.threeVec(x[0], x[1], x[2]), q = Frames.threeQuat([x[6], x[7], x[8], x[9]]);
      qSim.set(q.x, q.y, q.z, q.w);
      object3D.quaternion.copy(qSim).multiply(qOff);
      vTmp.copy(cg).applyQuaternion(object3D.quaternion);
      object3D.position.set(p.x, p.y, p.z).sub(vTmp);
      for (let i = 0; i < props.length; i++) {
        const node = props[i]; if (!node) continue;
        const om = x[13 + i], fr = om / P.OmMax;
        const vis = Math.min(om, o.propVisualMax * (0.3 + 0.7*fr));
        // CW visto desde arriba (spin = +1) = rotación negativa alrededor del eje "arriba" local
        node.rotation[o.propAxis] -= o.propSpinSign * P.spin[i] * vis * dt;
      }
    },
  };
}

/** Cámara de persecución suavizada (alineada con el yaw del dron). */
export function makeChaseCamera(THREE, camera, sim, { distance, height, stiffness = 4 } = {}) {
  const d = distance ?? 1.5 + 3.2*sim.P.wb, h = height ?? 0.6 + 1.0*sim.P.wb;
  let pos = null;
  const qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  return function update(dt) {
    const x = sim.x, p = Frames.threeVec(x[0], x[1], x[2]);
    const yaw = Math.atan2(2*(x[6]*x[9] + x[7]*x[8]), 1 - 2*(x[8]*x[8] + x[9]*x[9]));
    qy.setFromAxisAngle(up, -yaw);
    const des = new THREE.Vector3(0, h, d).applyQuaternion(qy).add(new THREE.Vector3(p.x, p.y, p.z));
    if (!pos) pos = des.clone(); else pos.lerp(des, 1 - Math.exp(-dt*stiffness));
    camera.position.copy(pos);
    camera.lookAt(p.x, p.y, p.z);
  };
}
