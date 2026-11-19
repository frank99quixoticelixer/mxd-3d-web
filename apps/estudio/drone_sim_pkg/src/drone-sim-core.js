/**
 * drone-sim-core.js — Simulador 6-DOF de multirrotor con controlador en cascada.
 *
 * Independiente de motor gráfico (sin DOM ni three.js). ES module.
 *
 * Convenciones internas:
 *   - Marco inercial NED (n Norte, e Este, d Abajo). Altitud = -d.
 *   - Marco cuerpo FRD (x Frente, y Derecha, z Abajo).
 *   - Cuaternión q = [w, x, y, z], rotación cuerpo -> NED.
 *   - spin = +1 rotor CW visto desde arriba, -1 CCW.
 *   - Unidades SI (m, kg, s, rad, N, N·m).
 *
 * Las ecuaciones están documentadas en MATEMATICAS.md.
 */

export const G = 9.80665;
const FRAME_N = { quadX: 4, hexaX: 6, octoX: 8 };
const D2R = Math.PI / 180;

// ---------------------------------------------------------------------------
// Configuración por defecto. Los perfiles (drone-profiles.js) la sobrescriben.
// Un valor null en "overrides" significa "calcular a partir de los demás".
// ---------------------------------------------------------------------------
export const DEFAULTS = {
  name: 'Sin nombre',
  vehicle: {
    frame: 'quadX',        // 'quadX' | 'hexaX' | 'octoX'
    mtow: 9,               // [kg] masa de despegue
    wheelbase: 900,        // [mm] distancia diagonal motor-motor
    propIn: 21,            // [in] diámetro de hélice
    tmaxKgf: 6,            // [kgf] empuje máximo por motor (datasheet)
    tmaxRefRho: 1.225,     // [kg/m^3] densidad a la que se midió tmaxKgf
    rpmMax: 5500,          // [rpm] RPM a empuje máximo (con carga)
    motorMass: 0.45,       // [kg] masa por brazo: motor + hélice + ESC
    tau: 0,                // [s] constante de tiempo del motor (0 = estimar)
    idleFrac: 0.12,        // [-] Omega de ralentí armado / Omega máx
    // --- Overrides opcionales (null = estimar) ---
    inertia: null,         // [kg m^2] [Jxx, Jyy, Jzz] (p. ej. desde CAD)
    cdA: null,             // [m^2] [x, y, z] área de arrastre en ejes cuerpo
    kQkT: null,            // [m] relación par/empuje de la hélice
    gearHeight: null,      // [m] altura del CG sobre el suelo apoyado
    rotorAboveCG: null,    // [m] altura del plano de rotores sobre el CG
    rotorInertia: null,    // [kg m^2] inercia de cada rotor
    rotors: null,          // [{x, y, spin}] posición FRD [m] y giro; null = X simétrico
  },
  env: {
    altitude: 0,           // [m] sobre el nivel del mar (ISA)
    windSpd: 0,            // [m/s]
    windDir: 0,            // [deg] dirección de la que viene (0 = N, 90 = E)
    gust: 0,               // [m/s] amplitud de ráfaga
    groundEffect: true,
    dynamicThrust: true,
  },
  control: {
    rateMax: 200,          // [deg/s] rate máx. en Acro
    yawRateMax: null,      // [deg/s] yaw en Angle/Posición (null = min(0.5*rateMax, 180))
    tiltMax: 30,           // [deg]
    vMax: 10,              // [m/s] horizontal en Posición
    vzUp: 3,               // [m/s] ascenso máx. en Posición
    vzDown: 2,             // [m/s] descenso máx. en Posición
    aggr: 1,               // [-] escala de ganancias
    expo: 0.35,            // [-] expo de sticks en Acro
  },
  safety: {
    armGesture: true,           // throttle abajo + yaw derecha => armar (estilo PX4)
    armHoldSec: 1.0,            // [s] duración del gesto
    landDisarmHoldSec: 2.0,     // [s] en tierra con "bajar" sostenido => desarmar
    autoDisarmAfterLandSec: null, // [s] desarme automático tras aterrizar (PX4 COM_DISARM_LAND); null = off
    preflightDisarmSec: 10,     // [s] armado sin despegar => desarmar (PX4 COM_DISARM_PRFLT); null = off
    landDetectSec: 0.3,         // [s] contacto continuo para declarar "aterrizado"
    crashVz: 3, crashVh: 3, crashTiltDeg: 45, // umbrales de choque al tocar suelo
    motorFailDetectSec: 0.15,   // [s] latencia de detección de falla de motor
  },
  sim: { dt: 0.001, ctrlDiv: 2, maxSubsteps: 100 },  // física 1 kHz, control 500 Hz
};

/** Fusión profunda de configuraciones (los objetos se fusionan; arreglos y valores se reemplazan). */
export function mergeConfig(...layers) {
  const out = {};
  for (const layer of layers) deepAssign(out, layer || {});
  return out;
}
function deepAssign(dst, src) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) { if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {}; deepAssign(dst[k], v); }
    else dst[k] = Array.isArray(v) ? v.map(x => (x && typeof x === 'object' ? { ...x } : x)) : v;
  }
  return dst;
}

// ---------------------------------------------------------------------------
// Utilidades matemáticas
// ---------------------------------------------------------------------------
export const clamp = (x, a, b) => (x < a ? a : (x > b ? b : x));
export const isaRho = h => 1.225 * Math.pow(1 - 2.25577e-5 * h, 4.2559);
export const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const expoCurve = (x, e) => x * (1 - e) + x * x * x * e;
const deadband = (x, d = 0.05) => (Math.abs(x) < d ? 0 : (x - Math.sign(x) * d) / (1 - d));

export function qmul(a, b) {
  return [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
          a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
          a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
          a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
}
export const qconj = q => [q[0], -q[1], -q[2], -q[3]];
export function qnorm(q) { const n = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0]/n, q[1]/n, q[2]/n, q[3]/n]; }
/** Matriz de rotación (fila mayor, 9 elementos) desde cuaternión. */
export function quatToR(w, x, y, z) {
  return [1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y),
          2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x),
          2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y)];
}
export function rotToQuat(R) {
  const tr = R[0] + R[4] + R[8]; let q;
  if (tr > 0) { const s = 2*Math.sqrt(tr+1); q = [0.25*s, (R[7]-R[5])/s, (R[2]-R[6])/s, (R[3]-R[1])/s]; }
  else if (R[0] > R[4] && R[0] > R[8]) { const s = 2*Math.sqrt(1+R[0]-R[4]-R[8]); q = [(R[7]-R[5])/s, 0.25*s, (R[1]+R[3])/s, (R[2]+R[6])/s]; }
  else if (R[4] > R[8]) { const s = 2*Math.sqrt(1+R[4]-R[0]-R[8]); q = [(R[2]-R[6])/s, (R[1]+R[3])/s, 0.25*s, (R[5]+R[7])/s]; }
  else { const s = 2*Math.sqrt(1+R[8]-R[0]-R[4]); q = [(R[3]-R[1])/s, (R[2]+R[6])/s, (R[5]+R[7])/s, 0.25*s]; }
  return qnorm(q);
}
/** Euler ZYX (roll, pitch, yaw) -> cuaternión cuerpo->NED. */
export function eulToQuat(roll, pitch, yaw) {
  const cr = Math.cos(roll/2), sr = Math.sin(roll/2), cp = Math.cos(pitch/2), sp = Math.sin(pitch/2), cy = Math.cos(yaw/2), sy = Math.sin(yaw/2);
  return [cy*cp*cr + sy*sp*sr, cy*cp*sr - sy*sp*cr, cy*sp*cr + sy*cp*sr, sy*cp*cr - cy*sp*sr];
}
export const eulFromR = R => [Math.atan2(R[7], R[8]), -Math.asin(clamp(R[6], -1, 1)), Math.atan2(R[3], R[0])];

function inv4(A) {
  const n = 4, M = A.map((r, i) => [...r, ...[0,1,2,3].map(j => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c+1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c]; for (let j = 0; j < 2*n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < 2*n; j++) M[r][j] -= f*M[c][j]; }
  }
  return M.map(r => r.slice(n));
}

// ---------------------------------------------------------------------------
// Conversión de marcos para motores gráficos
// ---------------------------------------------------------------------------
export const Frames = {
  /** three.js / Godot / Babylon (Y arriba, -Z = Norte, X = Este). */
  threeVec: (n, e, d) => ({ x: e, y: -d, z: -n }),
  threeQuat: q => ({ x: q[2], y: -q[3], z: -q[1], w: q[0] }),
  /** Unity (izquierda, Y arriba, Z = Norte, X = Este). */
  unityVec: (n, e, d) => ({ x: e, y: -d, z: n }),
  unityQuat: q => ({ x: -q[2], y: q[3], z: -q[1], w: q[0] }),
  /** Unreal (izquierda, Z arriba, X = Norte, Y = Este, centímetros). */
  unrealVec: (n, e, d) => ({ x: 100*n, y: 100*e, z: -100*d }),
  unrealQuat: q => ({ x: -q[1], y: -q[2], z: q[3], w: q[0] }),
};

// ---------------------------------------------------------------------------
// Vehículo: parámetros derivados a partir de la configuración física
// ---------------------------------------------------------------------------
export function buildVehicle(cfg) {
  const V = cfg.vehicle, E = cfg.env, Cc = cfg.control, Sf = cfg.safety;
  const errors = [], warns = [];
  const N = V.rotors ? V.rotors.length : FRAME_N[V.frame];
  if (!N) errors.push(`Marco no soportado: ${V.frame}`);
  for (const k of ['mtow', 'wheelbase', 'propIn', 'tmaxKgf', 'rpmMax', 'motorMass'])
    if (!(V[k] > 0)) errors.push(`vehicle.${k} debe ser > 0`);
  if (errors.length) return { errors, warns };

  const wb = V.wheelbase / 1000, L = wb / 2, D = V.propIn * 0.0254, Rp = D / 2;
  const rho = isaRho(E.altitude);
  const OmMax = V.rpmMax * 2 * Math.PI / 60, OmMin = V.idleFrac * OmMax;
  const kT = V.tmaxKgf * G / (OmMax * OmMax) * rho / V.tmaxRefRho;
  const kQkT = V.kQkT ?? 0.07 * D;              // Q/T = (Cp/Ct)·D/2π, Cp/Ct ≈ 0.44
  const kQ = kQkT * kT;
  const m = V.mtow, mm = V.motorMass, mb = m - N * mm;
  if (mb <= 0.1 * m) errors.push('N × motorMass ≥ 90 % del MTOW.');

  let rx = [], ry = [], spin = [];
  if (V.rotors) { for (const r of V.rotors) { rx.push(r.x); ry.push(r.y); spin.push(r.spin >= 0 ? 1 : -1); } }
  else for (let i = 0; i < N; i++) { const a = i*2*Math.PI/N + Math.PI/N; rx.push(L*Math.cos(a)); ry.push(L*Math.sin(a)); spin.push(i % 2 === 0 ? 1 : -1); }
  const Lr = Math.max(...rx.map((x, i) => Math.hypot(x, ry[i])));
  // traslape de hélices entre rotores vecinos
  let minGap = Infinity;
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) minGap = Math.min(minGap, Math.hypot(rx[i]-rx[j], ry[i]-ry[j]));
  if (minGap < D) warns.push(`Hélices traslapadas: ${(minGap*1000).toFixed(0)} mm entre ejes < ${(D*1000).toFixed(0)} mm de diámetro.`);
  if (spin.reduce((a, b) => a + b, 0) !== 0) warns.push('Número desigual de rotores CW y CCW: habrá par de yaw neto.');

  const s = Math.max(0.35*wb, 0.06), h = 0.3*s;
  let J = V.inertia;
  if (!J) {
    let Jx = mb*(s*s+h*h)/12, Jy = Jx, Jz = mb*(2*s*s)/12;
    for (let i = 0; i < N; i++) { Jx += mm*ry[i]*ry[i]; Jy += mm*rx[i]*rx[i]; Jz += mm*(rx[i]*rx[i]+ry[i]*ry[i]); }
    J = [Jx, Jy, Jz];
  }
  const tau = V.tau > 0 ? V.tau : 0.012 + 0.0025 * V.propIn;
  const TMax = kT*OmMax*OmMax, TMin = kT*OmMin*OmMin, W = m*G, TW = N*TMax/W;
  if (TW < 1) errors.push(`Empuje/peso = ${TW.toFixed(2)}: no puede despegar.`);
  else if (TW < 1.4) warns.push(`Empuje/peso = ${TW.toFixed(2)}: margen de control muy bajo.`);
  const OmHover = Math.sqrt(W / N / kT), hoverThr = (OmHover - OmMin) / (OmMax - OmMin);
  const hGear = V.gearHeight ?? Math.max(0.12*wb, 0.03);

  // Ganancias escaladas con la constante de tiempo del motor
  const KpR = Math.min(0.6/tau*Cc.aggr, 60), KpAtt = Math.min(KpR/3, 12);
  const KpVel = Math.min(KpAtt/2.5, 3), KpVelZ = Math.min(KpR/4, 5);
  const yawRate = (Cc.yawRateMax ?? Math.min(0.5*Cc.rateMax, 180)) * D2R;
  const C = {
    KpRate: [KpR, KpR, 0.6*KpR], KiRate: [0.5*KpR, 0.5*KpR, 0.3*KpR], iRateMax: [0.2*KpR, 0.2*KpR, 0.1*KpR],
    KpAtt, yawW: 0.5,
    rateMax: Cc.rateMax*D2R, yawRateAcro: 0.6*Cc.rateMax*D2R, yawRate,
    rateLim: [Math.min(Cc.rateMax, 400)*D2R, Math.min(Cc.rateMax, 400)*D2R, yawRate],
    tilt: Cc.tiltMax*D2R, expo: Cc.expo,
    KpVel: [KpVel, KpVel, KpVelZ], KiVel: [0.25*KpVel, 0.25*KpVel, 0.5*KpVelZ], iVelMax: [2, 2, 4],
    KpPos: KpVel/2, KpPosZ: KpVelZ/3, vMax: Cc.vMax, vzUp: Cc.vzUp, vzDown: Cc.vzDown,
  };
  return {
    errors, warns, name: cfg.name,
    N, L: Lr, wb, D, Rp, rho, OmMax, OmMin, kT, kQ, kQkT, m, mm, mb, J, rx, ry, spin,
    tau, TMax, TMin, W, TW, OmHover, hoverThr, hGear, bodyS: s, bodyH: h,
    rotorAboveCG: V.rotorAboveCG ?? 0.25*hGear,
    Jr: V.rotorInertia ?? 0.25*mm*Rp*Rp/3,
    CdA: V.cdA ?? [0.25*wb*wb, 0.25*wb*wb, 0.5*wb*wb],
    Kw: 0.01*m*wb*wb,
    rc: Lr + 0.5*Rp,
    ge: !!E.groundEffect, dyn: !!E.dynamicThrust,
    crashVz: Sf.crashVz, crashVh: Sf.crashVh, crashTilt: Sf.crashTiltDeg*D2R,
    dt: cfg.sim.dt, ctrlDiv: cfg.sim.ctrlDiv,
    C,
  };
}

function pinvEff(P, eta) {
  const N = P.N, B = [[], [], [], []];
  for (let i = 0; i < N; i++) { B[0][i] = eta[i]; B[1][i] = -P.ry[i]*eta[i]; B[2][i] = P.rx[i]*eta[i]; B[3][i] = -P.spin[i]*P.kQkT*eta[i]; }
  const A = [0,1,2,3].map(r => [0,1,2,3].map(c => { let s = 0; for (let i = 0; i < N; i++) s += B[r][i]*B[c][i]; return s; }));
  const eps = 1e-8*(A[0][0]+A[1][1]+A[2][2]+A[3][3]);
  for (let r = 0; r < 4; r++) A[r][r] += eps;
  const Ai = inv4(A), Binv = [];
  for (let i = 0; i < N; i++) Binv.push([0,1,2,3].map(c => B[0][i]*Ai[0][c] + B[1][i]*Ai[1][c] + B[2][i]*Ai[2][c] + B[3][i]*Ai[3][c]));
  return Binv;
}

// ---------------------------------------------------------------------------
// Simulador
// ---------------------------------------------------------------------------
export class DroneSim {
  /**
   * @param {object} cfg  configuración completa (ver drone-profiles.js: makeConfig)
   * @param {object} [opts]
   * @param {(n:number,e:number)=>number} [opts.groundHeightAt] altura del terreno [m] sobre el datum
   * @param {Array} [opts.obstacles] cajas NED {name,n0,n1,e0,e1,a0,a1} (a = altitud)
   * @param {(ev:object)=>void} [opts.onEvent] callback de eventos
   */
  constructor(cfg, opts = {}) {
    this.cfg = cfg;
    this.P = buildVehicle(cfg);
    if (this.P.errors.length) throw new Error('Configuración inválida: ' + this.P.errors.join(' | '));
    this.groundHeightAt = opts.groundHeightAt || (() => 0);
    this.obstacles = opts.obstacles || [];
    this.onEvent = opts.onEvent || null;
    const n = 13 + this.P.N;
    this.x = new Float64Array(n);
    this._k = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    this._xt = new Float64Array(n);
    this.OmCmd = new Float64Array(this.P.N);
    this.eta = new Float64Array(this.P.N);
    this.etaEst = new Float64Array(this.P.N);
    this.T = new Float64Array(this.P.N);
    this.wind = [0, 0, 0];
    this.windCfg = { spd: cfg.env.windSpd, dir: cfg.env.windDir, gust: cfg.env.gust };
    this.input = { thr: 0, climb: 0, yaw: 0, pitch: 0, roll: 0 };
    this.mode = 'pos';
    this._acc = 0;
    this.reset();
  }

  /** Reinicia en tierra, desarmado. */
  reset({ n = 0, e = 0, yawDeg = 0 } = {}) {
    const P = this.P, x = this.x;
    x.fill(0);
    x[0] = n; x[1] = e; x[2] = -(this.groundHeightAt(n, e) + P.hGear);
    const y = yawDeg*D2R; x[6] = Math.cos(y/2); x[9] = Math.sin(y/2);
    this.OmCmd.fill(0); this.eta.fill(1); this.etaEst.fill(1);
    this.Binv = pinvEff(P, this.etaEst);
    Object.assign(this, {
      t: 0, k: 0, iVel: [0,0,0], iRate: [0,0,0], yawSp: y, pSp: [x[0], x[1], x[2]], holdXY: false, holdZ: false,
      onGround: true, landed: true, armed: false, crashed: false, crashMsg: '', failT: -1, sat: false, Tcol: 0, wSp: [0,0,0], geF: 1,
      _groundT: 1, _airT: 0, _holdT: 0, _landT: 0, _preT: 0, _armT: 0, _disT: 0, _tookOff: false, _events: [],
    });
  }

  // --- API de control ---
  setInput(inp) { Object.assign(this.input, inp); }
  setWind({ spd, dir, gust }) { if (spd != null) this.windCfg.spd = spd; if (dir != null) this.windCfg.dir = dir; if (gust != null) this.windCfg.gust = gust; }
  setMode(mode) {
    if (!['acro', 'angle', 'pos'].includes(mode)) throw new Error('Modo inválido: ' + mode);
    const R = quatToR(this.x[6], this.x[7], this.x[8], this.x[9]);
    this.mode = mode; this.iVel = [0,0,0]; this.yawSp = Math.atan2(R[3], R[0]); this.holdXY = false; this.holdZ = false;
    this._emit('mode', { mode });
  }
  arm({ force = false } = {}) {
    if (this.armed || this.crashed) return false;
    if (!this.landed && !force) return false;
    this.armed = true; this._tookOff = false; this._preT = 0; this._holdT = 0; this._landT = 0;
    this.iVel = [0,0,0]; this.iRate = [0,0,0];
    const R = quatToR(this.x[6], this.x[7], this.x[8], this.x[9]);
    this.yawSp = Math.atan2(R[3], R[0]); this.pSp = [this.x[0], this.x[1], this.x[2]];
    this._emit('armed', {});
    return true;
  }
  disarm(reason = 'manual') {
    if (!this.armed) return false;
    this.armed = false; this.OmCmd.fill(0); this.iVel = [0,0,0]; this.iRate = [0,0,0];
    this._emit('disarmed', { reason });
    return true;
  }
  failMotor(i = 0, residual = 0) { if (this.failT < 0) { this.eta[i] = residual; this.failT = this.t; this._emit('motorFailure', { motor: i }); } }

  /**
   * Avanza la simulación dtFrame segundos con pasos fijos de cfg.sim.dt.
   * @returns {Array} eventos ocurridos en este avance
   */
  step(dtFrame) {
    this._events = [];
    if (this.crashed) return this._events;
    const P = this.P;
    this._acc += Math.min(dtFrame, P.dt * this.cfg.sim.maxSubsteps);
    while (this._acc >= P.dt) {
      this._stepFixed();
      this._acc -= P.dt;
      if (this.crashed) { this._acc = 0; break; }
    }
    if (!this.crashed) this._checkObstacles();
    return this._events;
  }

  /** Estado para render/HUD/telemetría. */
  getState() {
    const x = this.x, P = this.P, R = quatToR(x[6], x[7], x[8], x[9]), eul = eulFromR(R);
    const gh = this.groundHeightAt(x[0], x[1]);
    const rotorOmega = Array.from(x.slice(13, 13 + P.N));
    return {
      t: this.t,
      ned: { n: x[0], e: x[1], d: x[2] },
      altitude: -x[2], agl: -x[2] - gh - P.hGear,
      velNed: { n: x[3], e: x[4], d: x[5] },
      q: [x[6], x[7], x[8], x[9]],
      euler: { roll: eul[0], pitch: eul[1], yaw: eul[2] },
      rates: { p: x[10], q: x[11], r: x[12] },
      rotorOmega, rotorRpm: rotorOmega.map(o => o*60/(2*Math.PI)),
      rotorThrust: Array.from(this.T), rotorThrustFrac: Array.from(this.T, t => t / P.TMax),
      rotorFailed: Array.from(this.eta, e => e < 1),
      armed: this.armed, landed: this.landed, onGround: this.onGround, crashed: this.crashed, crashMsg: this.crashMsg,
      mode: this.mode, saturated: this.sat, groundEffectFactor: this.geF, wind: [...this.wind],
      throttleCmd: this.input.thr, hoverThrottle: P.hoverThr,
    };
  }

  // ---------------- internos ----------------
  _emit(type, data) { const ev = { type, t: this.t, ...data }; this._events.push(ev); if (this.onEvent) this.onEvent(ev); }

  _stepFixed() {
    const P = this.P;
    if (this.failT >= 0 && this.t >= this.failT + this.cfg.safety.motorFailDetectSec && this.etaEst.some((v, i) => v !== this.eta[i])) {
      this.etaEst.set(this.eta); this.Binv = pinvEff(P, this.etaEst);
    }
    if (this.k % P.ctrlDiv === 0) { const dtc = P.dt * P.ctrlDiv; this._armingLogic(dtc); this._control(dtc); }
    this._windAt();
    this._rk4(P.dt);
    this._groundContact();
    this._landDetector(P.dt);
    this.t += P.dt; this.k++;
  }

  _downCmd() { return this.mode === 'pos' ? this.input.climb < -0.5 : this.input.thr < 0.05; }

  /** Máquina de armado/desarmado estilo PX4/QGroundControl. */
  _armingLogic(dt) {
    const S = this.cfg.safety, down = this._downCmd();
    if (!this.armed) {
      if (S.armGesture && this.landed && down && this.input.yaw > 0.8) { this._armT += dt; if (this._armT >= S.armHoldSec) { this._armT = 0; this.arm(); } }
      else this._armT = 0;
      return;
    }
    if (!this.landed) { this._holdT = this._landT = this._disT = 0; return; }
    // 1) Mantener "bajar" en tierra => apagar motores
    if (down && Math.abs(this.input.yaw) < 0.8) { this._holdT += dt; if (this._holdT >= S.landDisarmHoldSec) return void this.disarm('land-hold'); }
    else this._holdT = 0;
    // 2) Gesto de desarme: bajar + yaw izquierda
    if (S.armGesture && down && this.input.yaw < -0.8) { this._disT += dt; if (this._disT >= S.armHoldSec) return void this.disarm('gesture'); }
    else this._disT = 0;
    // 3) Desarme automático tras aterrizar
    if (S.autoDisarmAfterLandSec != null && this._tookOff) { this._landT += dt; if (this._landT >= S.autoDisarmAfterLandSec) return void this.disarm('auto-land'); }
    // 4) Armado sin despegar
    if (S.preflightDisarmSec != null && !this._tookOff) { this._preT += dt; if (this._preT >= S.preflightDisarmSec) return void this.disarm('preflight-timeout'); }
  }

  _landDetector(dt) {
    const sd = this.cfg.safety.landDetectSec;
    if (this.onGround) { this._groundT += dt; this._airT = 0; if (!this.landed && this._groundT >= sd) { this.landed = true; this._landT = 0; this._emit('landed', {}); } }
    else { this._airT += dt; this._groundT = 0; if (this.landed && this._airT >= 0.2) { this.landed = false; this._tookOff = true; this._emit('takeoff', {}); } }
  }

  _windAt() {
    const c = this.windCfg, t = this.t, from = c.dir*D2R;
    const wn = -c.spd*Math.cos(from), we = -c.spd*Math.sin(from);
    this.wind[0] = wn + c.gust*Math.sin(2*Math.PI*0.13*t) + 0.5*c.gust*Math.sin(2*Math.PI*0.41*t + 2);
    this.wind[1] = we + c.gust*Math.sin(2*Math.PI*0.07*t + 1) + 0.5*c.gust*Math.sin(2*Math.PI*0.37*t + 4);
    this.wind[2] = 0.3*c.gust*Math.sin(2*Math.PI*0.21*t + 2);
  }

  _deriv(x, dx) {
    const P = this.P, N = P.N, w = this.wind;
    const qw = x[6], qx = x[7], qy = x[8], qz = x[9], p = x[10], q = x[11], r = x[12];
    const R = quatToR(qw, qx, qy, qz);
    const ux = x[3]-w[0], uy = x[4]-w[1], uz = x[5]-w[2];
    const vbx = R[0]*ux + R[3]*uy + R[6]*uz, vby = R[1]*ux + R[4]*uy + R[7]*uz, vbz = R[2]*ux + R[5]*uy + R[8]*uz;
    let fge = 1;
    if (P.ge) {
      const zr = Math.max(-x[2] - this.groundHeightAt(x[0], x[1]) + P.rotorAboveCG, 0.6*P.Rp);
      const k = P.Rp/(4*zr); fge = Math.min(1/(1 - k*k), 1.3);
    }
    this.geF = fge;
    let Tsum = 0, Mx = 0, My = 0, Mz = 0, hz = 0, dhz = 0;
    for (let i = 0; i < N; i++) {
      const Om = Math.max(x[13+i], 0), e = this.eta[i];
      let fdyn = 1;
      if (P.dyn) { const n = Om/(2*Math.PI); fdyn = clamp(1 - (-vbz)/(n*P.D + 1e-3)/0.75, 0, 1.15); }
      const Ti = e*P.kT*Om*Om*fge*fdyn, Qi = e*P.kQ*Om*Om*fdyn;
      this.T[i] = Ti;
      Tsum += Ti; Mx -= P.ry[i]*Ti; My += P.rx[i]*Ti; Mz -= P.spin[i]*Qi;
      const dOm = (this.OmCmd[i] - Om)/P.tau;
      dx[13+i] = dOm;
      hz += P.spin[i]*e*Om; dhz += P.spin[i]*e*dOm;
    }
    hz *= P.Jr; dhz *= P.Jr;
    const hr = 0.5*P.rho;
    const Fbx = -hr*P.CdA[0]*Math.abs(vbx)*vbx, Fby = -hr*P.CdA[1]*Math.abs(vby)*vby, Fbz = -Tsum - hr*P.CdA[2]*Math.abs(vbz)*vbz;
    Mx += -q*hz - P.Kw*p; My += p*hz - P.Kw*q; Mz += -dhz - P.Kw*r;
    const [Jx, Jy, Jz] = P.J;
    dx[0] = x[3]; dx[1] = x[4]; dx[2] = x[5];
    dx[3] = (R[0]*Fbx + R[1]*Fby + R[2]*Fbz)/P.m;
    dx[4] = (R[3]*Fbx + R[4]*Fby + R[5]*Fbz)/P.m;
    dx[5] = (R[6]*Fbx + R[7]*Fby + R[8]*Fbz)/P.m + G;
    dx[6] = 0.5*(-qx*p - qy*q - qz*r);
    dx[7] = 0.5*( qw*p + qy*r - qz*q);
    dx[8] = 0.5*( qw*q + qz*p - qx*r);
    dx[9] = 0.5*( qw*r + qx*q - qy*p);
    dx[10] = (Mx - (Jz - Jy)*q*r)/Jx;
    dx[11] = (My - (Jx - Jz)*r*p)/Jy;
    dx[12] = (Mz - (Jy - Jx)*p*q)/Jz;
  }

  _rk4(dt) {
    const x = this.x, n = x.length, [k1, k2, k3, k4] = this._k, xt = this._xt;
    this._deriv(x, k1);
    for (let i = 0; i < n; i++) xt[i] = x[i] + 0.5*dt*k1[i]; this._deriv(xt, k2);
    for (let i = 0; i < n; i++) xt[i] = x[i] + 0.5*dt*k2[i]; this._deriv(xt, k3);
    for (let i = 0; i < n; i++) xt[i] = x[i] + dt*k3[i];     this._deriv(xt, k4);
    for (let i = 0; i < n; i++) x[i] += dt/6*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i]);
    const qn = Math.hypot(x[6], x[7], x[8], x[9]); x[6] /= qn; x[7] /= qn; x[8] /= qn; x[9] /= qn;
    this._deriv(x, k1);   // actualiza empuje por rotor con el estado final
  }

  _groundContact() {
    const P = this.P, x = this.x, hg = this.groundHeightAt(x[0], x[1]) + P.hGear;
    if (-x[2] <= hg) {
      const R = quatToR(x[6], x[7], x[8], x[9]);
      const tilt = Math.acos(clamp(R[8], -1, 1)), vz = x[5], vh = Math.hypot(x[3], x[4]);
      if (!this.onGround && (vz > P.crashVz || vh > P.crashVh || tilt > P.crashTilt)) {
        this._crash(`Impacto contra el suelo: ${vz.toFixed(1)} m/s vertical, ${vh.toFixed(1)} m/s horizontal, inclinación ${(tilt/D2R).toFixed(0)}°.`);
      }
      x[2] = -hg;
      if (x[5] > 0) {
        x[3] = x[4] = x[5] = 0; x[10] = x[11] = x[12] = 0;
        const psi = Math.atan2(R[3], R[0]);
        x[6] = Math.cos(psi/2); x[7] = 0; x[8] = 0; x[9] = Math.sin(psi/2);
      }
      this.onGround = true;
    } else this.onGround = false;
  }

  _checkObstacles() {
    const x = this.x, n = x[0], e = x[1], a = -x[2], r = this.P.rc;
    for (const o of this.obstacles) {
      const dn = n - clamp(n, o.n0, o.n1), de = e - clamp(e, o.e0, o.e1), da = a - clamp(a, o.a0, o.a1);
      if (dn*dn + de*de + da*da < r*r) { this._crash(`Colisión con ${o.name || 'obstáculo'} a ${Math.hypot(x[3], x[4], x[5]).toFixed(1)} m/s.`); return; }
    }
  }

  _crash(msg) { this.crashed = true; this.crashMsg = msg; this.disarm('crash'); this._emit('crash', { message: msg }); }

  // ---------------- controlador ----------------
  _attitudeCtrl(q, R, qSp, out) {
    const C = this.P.C;
    const ez = [R[2], R[5], R[8]];
    const Rd = quatToR(qSp[0], qSp[1], qSp[2], qSp[3]);
    const ezd = [Rd[2], Rd[5], Rd[8]];
    let qSh = [1 + ez[0]*ezd[0] + ez[1]*ezd[1] + ez[2]*ezd[2],
               ez[1]*ezd[2] - ez[2]*ezd[1], ez[2]*ezd[0] - ez[0]*ezd[2], ez[0]*ezd[1] - ez[1]*ezd[0]];
    qSh = qSh[0] < 1e-6 ? [0, 1, 0, 0] : qnorm(qSh);
    const qRed = qmul(qSh, q);
    let qMix = qmul(qconj(qRed), qSp); if (qMix[0] < 0) qMix = qMix.map(v => -v);
    const a0 = clamp(qMix[0], -1, 1), a3 = clamp(qMix[3], -1, 1);
    const qd = qmul(qRed, [Math.cos(C.yawW*Math.acos(a0)), 0, 0, Math.sin(C.yawW*Math.asin(a3))]);
    let qe = qmul(qconj(q), qd); if (qe[0] < 0) qe = qe.map(v => -v);
    for (let i = 0; i < 3; i++) out[i] = clamp(2*C.KpAtt*qe[i+1], -C.rateLim[i], C.rateLim[i]);
  }

  _thrToT(thr) { const P = this.P, Om = P.OmMin + clamp(thr, 0, 1)*(P.OmMax - P.OmMin); return P.N*P.kT*Om*Om; }

  _control(dt) {
    if (!this.armed) { this.OmCmd.fill(0); this.Tcol = 0; return; }
    const P = this.P, C = P.C, x = this.x, inp = this.input;
    const q = [x[6], x[7], x[8], x[9]], w = [x[10], x[11], x[12]];
    const R = quatToR(q[0], q[1], q[2], q[3]);
    const yaw = Math.atan2(R[3], R[0]);
    const wSp = this.wSp; let Tcol, qSp = null;

    if (this.mode === 'acro') {
      wSp[0] = expoCurve(inp.roll, C.expo)*C.rateMax; wSp[1] = -expoCurve(inp.pitch, C.expo)*C.rateMax; wSp[2] = expoCurve(inp.yaw, C.expo)*C.yawRateAcro;
      Tcol = this._thrToT(inp.thr); this.yawSp = yaw;
    } else if (this.mode === 'angle') {
      this.yawSp = wrapPi(this.yawSp + inp.yaw*C.yawRate*dt);
      qSp = eulToQuat(inp.roll*C.tilt, -inp.pitch*C.tilt, this.yawSp);
      Tcol = this._thrToT(inp.thr);
    } else {
      const p = [x[0], x[1], x[2]], v = [x[3], x[4], x[5]];
      this.yawSp = wrapPi(this.yawSp + deadband(inp.yaw)*C.yawRate*dt);
      const c = Math.cos(yaw), s = Math.sin(yaw), fwd = deadband(inp.pitch), rgt = deadband(inp.roll), clb = deadband(inp.climb);
      const vSp = [0, 0, 0];
      if (fwd !== 0 || rgt !== 0) { this.holdXY = false; vSp[0] = (fwd*c - rgt*s)*C.vMax; vSp[1] = (fwd*s + rgt*c)*C.vMax; }
      else {
        if (!this.holdXY && Math.hypot(v[0], v[1]) < 0.3) { this.holdXY = true; this.pSp[0] = p[0]; this.pSp[1] = p[1]; }
        if (this.holdXY) {
          vSp[0] = C.KpPos*(this.pSp[0] - p[0]); vSp[1] = C.KpPos*(this.pSp[1] - p[1]);
          const nn = Math.hypot(vSp[0], vSp[1]); if (nn > C.vMax) { vSp[0] *= C.vMax/nn; vSp[1] *= C.vMax/nn; }
        }
      }
      if (clb !== 0) { this.holdZ = false; vSp[2] = clb > 0 ? -clb*C.vzUp : -clb*C.vzDown; }
      else {
        if (!this.holdZ && Math.abs(v[2]) < 0.2) { this.holdZ = true; this.pSp[2] = p[2]; }
        if (this.holdZ) vSp[2] = clamp(C.KpPosZ*(this.pSp[2] - p[2]), -C.vzUp, C.vzDown);
      }
      const a = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        const e = vSp[i] - v[i], lim = C.iVelMax[i]/C.KiVel[i];
        this.iVel[i] = clamp(this.iVel[i] + e*dt, -lim, lim);
        a[i] = C.KpVel[i]*e + C.KiVel[i]*this.iVel[i];
      }
      const F = [P.m*a[0], P.m*a[1], P.m*(a[2] - G)];
      F[2] = Math.min(F[2], -0.1*P.m*G);
      const Fh = Math.hypot(F[0], F[1]), FhMax = Math.abs(F[2])*Math.tan(C.tilt);
      if (Fh > FhMax) { F[0] *= FhMax/Fh; F[1] *= FhMax/Fh; }
      const Fn = Math.hypot(F[0], F[1], F[2]);
      const zB = [-F[0]/Fn, -F[1]/Fn, -F[2]/Fn];
      Tcol = Math.max(-(F[0]*R[2] + F[1]*R[5] + F[2]*R[8]), 0);
      const xC = [Math.cos(this.yawSp), Math.sin(this.yawSp), 0];
      let yB = [zB[1]*xC[2] - zB[2]*xC[1], zB[2]*xC[0] - zB[0]*xC[2], zB[0]*xC[1] - zB[1]*xC[0]];
      const yn = Math.hypot(yB[0], yB[1], yB[2]); yB = yB.map(v2 => v2/yn);
      const xB = [yB[1]*zB[2] - yB[2]*zB[1], yB[2]*zB[0] - yB[0]*zB[2], yB[0]*zB[1] - yB[1]*zB[0]];
      qSp = rotToQuat([xB[0], yB[0], zB[0], xB[1], yB[1], zB[1], xB[2], yB[2], zB[2]]);
      // En tierra y sin pedir subir: ralentí (spool-down), como el land detector de PX4
      if (this.onGround && clb <= 0) { Tcol = P.N*P.TMin; this.iVel = [0,0,0]; this.holdXY = false; this.holdZ = false; }
    }

    if (qSp) this._attitudeCtrl(q, R, qSp, wSp);
    if (this.onGround && Tcol < 0.8*P.W) this.iRate = [0, 0, 0];

    const J = P.J, al = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const e = wSp[i] - w[i], lim = C.iRateMax[i]/C.KiRate[i];
      this.iRate[i] = clamp(this.iRate[i] + e*dt, -lim, lim);
      al[i] = C.KpRate[i]*e + C.KiRate[i]*this.iRate[i];
    }
    const M = [J[0]*al[0] + (J[2]-J[1])*w[1]*w[2], J[1]*al[1] + (J[0]-J[2])*w[2]*w[0], J[2]*al[2] + (J[1]-J[0])*w[0]*w[1]];
    this.Tcol = Tcol;
    this._allocate(Tcol, M);
  }

  /** Asignación: roll/pitch con prioridad, desplazamiento de colectivo (airmode), yaw al final. */
  _allocate(T, M) {
    const P = this.P, N = P.N, B = this.Binv, lo = P.TMin, hi = P.TMax, act = this.etaEst;
    const u = new Array(N), urp = new Array(N), uy = new Array(N);
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < N; i++) {
      urp[i] = B[i][1]*M[0] + B[i][2]*M[1]; uy[i] = B[i][3]*M[2];
      if (act[i] > 0) { mn = Math.min(mn, urp[i]); mx = Math.max(mx, urp[i]); }
    }
    const krp = (mx - mn) > (hi - lo) ? (hi - lo)/(mx - mn) : 1;
    mn = Infinity; mx = -Infinity;
    for (let i = 0; i < N; i++) { u[i] = B[i][0]*T + krp*urp[i]; if (act[i] > 0) { mn = Math.min(mn, u[i]); mx = Math.max(mx, u[i]); } }
    const shift = mn < lo ? lo - mn : (mx > hi ? hi - mx : 0);
    let ky = 1;
    for (let i = 0; i < N; i++) {
      if (act[i] <= 0) continue;
      u[i] += shift;
      if (uy[i] > 0) ky = Math.min(ky, (hi - u[i])/uy[i]); else if (uy[i] < 0) ky = Math.min(ky, (lo - u[i])/uy[i]);
    }
    ky = Math.max(ky, 0);
    for (let i = 0; i < N; i++) {
      const ui = clamp(u[i] + ky*uy[i], lo, hi);
      this.OmCmd[i] = clamp(Math.sqrt(ui/P.kT), P.OmMin, P.OmMax);
    }
    this.sat = krp < 1 || ky < 0.999 || shift < 0;
  }
}
