// Pruebas del núcleo: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { DroneSim, Frames, quatToR, buildVehicle } from '../src/drone-sim-core.js';
import { makeConfig } from '../src/drone-profiles.js';

/** Corre la simulación con un guion de entradas; regresa eventos y muestras. */
function run(sim, T, script, dt = 1/60) {
  const events = [], log = [];
  for (let t = 0; t < T; t += dt) {
    script(t, sim);
    for (const ev of sim.step(dt)) events.push(ev);
    log.push({ t, ...sim.getState() });
  }
  return { events, log };
}
const evt = (events, type) => events.find(e => e.type === type);

test('perfiles válidos y valores derivados del MX80', () => {
  const P = buildVehicle(makeConfig('mx80'));
  assert.deepEqual(P.errors, []);
  assert.equal(P.N, 4);
  assert.ok(P.TW > 1.5 && P.TW < 2.2, `T/W fuera de rango: ${P.TW}`);
  const Pc = buildVehicle(makeConfig('custom'));
  assert.deepEqual(Pc.errors, []);
});

test('configuración inválida lanza error', () => {
  assert.throws(() => new DroneSim(makeConfig('custom', { vehicle: { mtow: 100 } })), /despegar|90 %/);
});

test('MX80: armar, despegar, mantener altura, aterrizar con S sostenida y desarmar', () => {
  const sim = new DroneSim(makeConfig('mx80'));
  sim.setMode('pos');
  assert.equal(sim.arm(), true);
  const { events, log } = run(sim, 30, (t, s) => {
    s.setInput({ climb: t < 4 ? 1 : (t < 10 ? 0 : -1) });   // sube 4 s, mantiene, baja y sigue presionando
  });
  // Sube 4 s a la velocidad maxima de ascenso del perfil (vzUp): la altura
  // esperada sale del perfil, no de un numero fijo.
  const tope = 4 * makeConfig('mx80').control.vzUp;
  const s8 = log.find(l => l.t >= 8);
  assert.ok(s8.agl > 0.6 * tope && s8.agl < 1.15 * tope, `altura a 8 s: ${s8.agl} (tope ${tope} m)`);
  const s9 = log.find(l => l.t >= 9.5);
  assert.ok(Math.abs(s9.agl - s8.agl) < 0.3, 'no mantiene altura');
  const landed = evt(events, 'landed'), dis = evt(events, 'disarmed');
  assert.ok(landed, 'no aterrizó');
  assert.ok(dis && dis.reason === 'land-hold', 'no desarmó por mantener S');
  const dtDis = dis.t - landed.t;
  assert.ok(dtDis > 1.9 && dtDis < 2.2, `desarme ${dtDis.toFixed(2)} s después de aterrizar`);
  assert.ok(!evt(events, 'crash'), 'chocó');
  const end = log.at(-1);
  assert.equal(end.armed, false);
  assert.ok(Math.max(...end.rotorRpm) < 50, 'los motores no se apagaron');
});

test('soltar S antes del tiempo no desarma', () => {
  const sim = new DroneSim(makeConfig('mx80'));
  sim.setMode('pos'); sim.arm();
  let tLand = null;
  const { events } = run(sim, 25, (t, s) => {
    if (tLand === null && s.landed && t > 6) tLand = t;
    const holdingS = t >= 6 && (tLand === null || t < tLand + 1.0);   // suelta S 1 s después de aterrizar
    s.setInput({ climb: t < 3 ? 1 : (holdingS ? -1 : 0) });
  });
  assert.ok(tLand !== null, 'no aterrizó');
  const dis = evt(events, 'disarmed');
  assert.ok(!dis, `desarmó indebidamente: ${dis && dis.reason}`);
  assert.equal(sim.armed, true);
});

test('gesto de armado (abajo + yaw derecha) y timeout sin despegar', () => {
  const sim = new DroneSim(makeConfig('custom'));
  sim.setMode('pos');
  const { events } = run(sim, 13, (t, s) => s.setInput({ climb: t < 1.2 ? -1 : 0, yaw: t < 1.2 ? 1 : 0 }));
  const armed = evt(events, 'armed'), dis = evt(events, 'disarmed');
  assert.ok(armed && armed.t >= 0.95 && armed.t <= 1.1, 'no armó con el gesto');
  assert.ok(dis && dis.reason === 'preflight-timeout', 'no desarmó por timeout');
  assert.ok(Math.abs(dis.t - armed.t - 10) < 0.1);
});

test('modo Angle con throttle a hover sostiene; Acro estable sin entradas', () => {
  const sim = new DroneSim(makeConfig('custom'));
  sim.setMode('angle'); sim.arm();
  const hov = sim.P.hoverThr;
  const { log, events } = run(sim, 6, (t, s) => s.setInput({ thr: t < 1.5 ? hov + 0.15 : hov }));
  assert.ok(!evt(events, 'crash'));
  const a = log.find(l => l.t >= 3);
  assert.ok(a.agl > 0.5, 'no despegó');
  // Angle no sostiene altura: el throttle va directo. Solo se verifica que la velocidad vertical no se dispare.
  assert.ok(log.filter(l => l.t > 3).every(l => Math.abs(l.velNed.d) < 3), 'velocidad vertical fuera de rango');
  sim.setMode('acro');
  const r = run(sim, 2, (t, s) => s.setInput({ thr: hov }));
  const e = r.log.at(-1).euler;
  assert.ok(Math.abs(e.roll) < 0.2 && Math.abs(e.pitch) < 0.2, 'acro inestable');
});

test('octo X tolera falla de motor; MX80 (quad) no', () => {
  const run1 = (profile, ov) => {
    const sim = new DroneSim(makeConfig(profile, ov)); sim.setMode('pos'); sim.arm();
    return run(sim, 14, (t, s) => { s.setInput({ climb: t < 4 ? 1 : 0 }); if (t > 7) s.failMotor(0); });
  };
  const octo = run1('custom', { vehicle: { frame: 'octoX', mtow: 35, wheelbase: 2050, propIn: 30, tmaxKgf: 12.2, rpmMax: 4010, motorMass: 1.0, tau: 0.06 } });
  assert.ok(!evt(octo.events, 'crash'), 'el octo no debía caer');
  const quad = run1('mx80');
  assert.ok(evt(quad.events, 'crash'), 'un quad con un motor perdido debería caer');
});

test('conversiones de marcos: R\' = M R Mᵀ', () => {
  const q = (() => { const a = [0.3, -0.5, 0.7, 0.2]; const n = Math.hypot(...a); return a.map(v => v / n); })();
  const R = quatToR(...q);
  const mul = (A, B) => { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[3*i+j] += A[3*i+k]*B[3*k+j]; return C; };
  const T = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  const cases = {
    three: [[0,1,0, 0,0,-1, -1,0,0], Frames.threeQuat],
    unity: [[0,1,0, 0,0,-1, 1,0,0], Frames.unityQuat],
    unreal: [[1,0,0, 0,1,0, 0,0,-1], Frames.unrealQuat],
  };
  for (const [name, [M, fq]] of Object.entries(cases)) {
    const Rexp = mul(mul(M, R), T(M));
    const qq = fq(q), Rgot = quatToR(qq.w, qq.x, qq.y, qq.z);
    Rexp.forEach((v, i) => assert.ok(Math.abs(v - Rgot[i]) < 1e-9, `${name}: elemento ${i}`));
  }
  // yaw 90° => nariz al Este en cada motor
  const qy = [Math.cos(Math.PI/4), 0, 0, Math.sin(Math.PI/4)];
  const fwdThree = (() => { const t = Frames.threeQuat(qy), R3 = quatToR(t.w, t.x, t.y, t.z); return [-R3[2], -R3[5], -R3[8]]; })(); // local -Z
  assert.ok(Math.abs(fwdThree[0] - 1) < 1e-9, 'three: el frente debe apuntar a +X (Este)');
});
