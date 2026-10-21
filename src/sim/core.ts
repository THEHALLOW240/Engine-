// ── core.ts: the real-time engine simulation singleton ──────────────────────
// A fixed-timestep physics model: combustion torque, crank kinematics, vehicle
// driveline, thermal system, wear/damage, OBD codes, dyno and launch modes.

import {
  EngineSpec, SavedTune, ObdCode, DynoRun, LaunchBest, LOAD_ROWS, RPM_COLS,
} from './types';
import {
  clamp, lerp, FUELS, INJECTION, mapLookup, mbtLookup,
  sparkEff, fuelEff, buildCost, estimatePeak, bmepNet, veCurve,
} from './spec';

export interface FireEvent { cyl: number; time: number; }

export type SimListener = () => void;

export class EngineSim {
  spec!: EngineSpec;
  tune!: SavedTune;
  engineId = '';

  // ── control inputs (set by UI) ──
  throttleTarget = 0;
  ignitionOn = false;
  clutchEngaged = true;
  brakeHeld = false;
  cranking = false;
  gear = 0; // 0=N
  panelOpen = true;
  audioOn = true;
  cylEnabled: boolean[] = [];
  coolantPump = true;
  oilPump = true;

  // ── runtime state ──
  rpm = 0;
  throttlePos = 0; // actual, smoothed
  crankAngleDeg = 0; // 0..720
  running = false;
  stalled = false;
  vehicleSpeed = 0; // m/s
  vehicleSpeedMph = 0;
  clutchSync = 1; // 1 = fully coupled
  loadKpa = 30;
  manifoldInHg = -20;
  afr = 14.7;
  sparkNow = 20;
  torque = 0;
  powerKw = 0;

  coolantC = 24;
  oilC = 24;
  oilPressure = 0;
  fuelFlowKgH = 0;
  health = 100;
  knocking = false;
  misfiring: boolean[] = [];
  limiting = false;
  overheating = false;
  lowOil = false;
  codes: ObdCode[] = [];
  checkLight = false;

  // firing event ring buffer — consumed by 3D + audio
  fires: FireEvent[] = [];
  firesTotal = 0;
  timeSec = 0;

  // dyno
  dynoActive = false;
  dynoSweepRpm = 1000;
  dynoData: DynoRun | null = null;
  private dynoSamples: { rpm: number[]; tq: number[]; pin: number[]; pex: number[] } = { rpm: [], tq: [], pin: [], pex: [] };
  private lastSampleRpm = 0;

  // track / launch
  trackArmed = false;
  trackTarget = 60; // mph
  trackRunning = false;
  trackT0 = 0;
  trackElapsed = 0;
  trackFinished = false;
  bests: Record<string, number> = {}; // key `${engineId}:${target}` -> ms
  onLaunchDone: ((ms: number) => void) | null = null;
  onDynoDone: ((run: DynoRun) => void) | null = null;

  shiftLightRpm = 6369; // optimal shift point, computed

  private listeners = new Set<SimListener>();
  private notifyAcc = 0;
  private rng = Math.random;

  subscribe(fn: SimListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() { this.listeners.forEach((f) => f()); }

  // ── engine loading ─────────────────────────────────────────────────────────
  loadEngine(id: string, spec: EngineSpec, tune: SavedTune) {
    this.engineId = id;
    this.spec = spec;
    this.tune = tune;
    this.cylEnabled = Array(spec.cylinders).fill(true);
    this.misfiring = Array(spec.cylinders).fill(false);
    this.gear = 0;
    this.rpm = 0;
    this.running = false;
    this.stalled = false;
    this.vehicleSpeed = 0;
    this.throttleTarget = 0;
    this.throttlePos = 0;
    this.health = 100;
    this.codes = [];
    this.coolantC = 24;
    this.oilC = 24;
    this.dynoActive = false;
    this.trackArmed = false;
    this.trackRunning = false;
    this.trackFinished = false;
    this.fires = [];
    this.computeShiftPoint();
    this.emit();
  }

  computeShiftPoint() {
    // optimal shift: rpm at which next gear's wheel-force exceeds current
    const s = this.spec;
    const gr = s.drivetrain.gearRatios;
    if (gr.length < 2) { this.shiftLightRpm = s.redline * 0.9; return; }
    let best = s.redline * 0.9;
    // find crossing for 1->2 as representative
    const tq = (rpm: number) => Math.max(0, bmepNet(s, rpm));
    for (let rpm = 2000; rpm < s.limiter; rpm += 25) {
      const next = (gr[1] / gr[0]) * rpm;
      if (next < 500) continue;
      if (tq(rpm) * gr[0] < tq(next) * gr[1]) { best = rpm - 100; break; }
    }
    this.shiftLightRpm = clamp(best, 2500, s.limiter - 200);
  }

  setTune(tune: SavedTune) { this.tune = tune; this.emit(); }

  // ── controls ───────────────────────────────────────────────────────────────
  setThrottle(v: number) { this.throttleTarget = clamp(v, 0, 1); this.emit(); }
  nudgeThrottle(dv: number) { this.setThrottle(this.throttleTarget + dv); }
  toggleIgnition() {
    this.ignitionOn = !this.ignitionOn;
    if (!this.ignitionOn) { this.running = false; }
    this.emit();
  }
  toggleClutch() { this.clutchEngaged = !this.clutchEngaged; this.emit(); }
  setBrake(b: boolean) { this.brakeHeld = b; this.emit(); }
  setCrank(b: boolean) { this.cranking = b; this.emit(); }
  shiftUp() { this.setGear(this.gear + 1); }
  shiftDown() { this.setGear(this.gear - 1); }
  setGear(g: number) {
    const n = this.spec.drivetrain.gearRatios.length;
    this.gear = clamp(g, 0, n);
    this.emit();
  }
  toggleCyl(i: number) { this.cylEnabled[i] = !this.cylEnabled[i]; this.emit(); }
  repair() {
    this.health = 100;
    this.codes = [];
    this.coolantC = 70;
    this.oilC = 70;
    this.checkLight = false;
    this.emit();
  }
  clearCodes() { this.codes = []; this.checkLight = false; this.emit(); }

  // ── dyno ───────────────────────────────────────────────────────────────────
  startDyno() {
    this.dynoActive = true;
    this.dynoSweepRpm = Math.max(800, this.rpm, 900);
    this.dynoSamples = { rpm: [], tq: [], pin: [], pex: [] };
    this.lastSampleRpm = 0;
    this.ignitionOn = true;
    this.gear = 0;
    this.clutchEngaged = true;
    this.emit();
  }
  stopDyno(save = true) {
    if (!this.dynoActive) return;
    this.dynoActive = false;
    if (save && this.dynoSamples.rpm.length > 5) {
      const { rpm, tq } = this.dynoSamples;
      const power = rpm.map((r, i) => (tq[i] * r) / 9549); // kW
      let peakKw = 0, peakNm = 0, hpRpm = 0, nmRpm = 0;
      power.forEach((p, i) => { if (p > peakKw) { peakKw = p; hpRpm = rpm[i]; } });
      tq.forEach((t, i) => { if (t > peakNm) { peakNm = t; nmRpm = rpm[i]; } });
      const run: DynoRun = {
        rpm: [...rpm], torque: [...tq], power,
        intakeFlow: [...this.dynoSamples.pin],
        exhaustFlow: [...this.dynoSamples.pex],
        peakHp: Math.round(peakKw * 1.341), peakNm: Math.round(peakNm),
        peakHpRpm: Math.round(hpRpm), peakNmRpm: Math.round(nmRpm),
        at: Date.now(),
      };
      this.dynoData = run;
      this.onDynoDone?.(run);
    }
    this.emit();
  }

  // ── track ──────────────────────────────────────────────────────────────────
  armTrack(target: number) {
    this.trackTarget = target;
    this.trackArmed = true;
    this.trackRunning = false;
    this.trackFinished = false;
    this.trackElapsed = 0;
    this.emit();
  }
  resetTrack() {
    this.trackArmed = false;
    this.trackRunning = false;
    this.trackFinished = false;
    this.trackElapsed = 0;
    this.emit();
  }

  // ── main step ──────────────────────────────────────────────────────────────
  step(dt: number) {
    if (!this.spec) return;
    const s = this.spec;
    this.timeSec += dt;

    // throttle plate smoothing
    const plateRate = this.dynoActive ? 6 : 8;
    this.throttlePos += clamp(this.throttleTarget - this.throttlePos, -plateRate * dt, plateRate * dt);
    if (this.dynoActive) this.throttleTarget = 1;

    const inGear = this.gear > 0;
    const ratio = inGear ? s.drivetrain.gearRatios[this.gear - 1] * s.drivetrain.finalDrive : 0;

    // wheel-imposed rpm when clutch couples
    const wheelRps = this.vehicleSpeed / s.drivetrain.wheelRadiusM;
    const wheelRpm = wheelRps * 60 * ratio / (2 * Math.PI);

    if (this.clutchEngaged && inGear && !this.dynoActive) {
      // blend engine rpm toward wheel rpm (clutch slip model)
      const diff = wheelRpm - this.rpm;
      const slip = clamp(Math.abs(diff) / 1200, 0, 1);
      this.clutchSync = 1 - slip;
      this.rpm += diff * clamp(dt * (3 + 6 * this.clutchSync), 0, 1);
    } else if (!this.dynoActive) {
      this.clutchSync = 0;
    }

    // starter motor
    if (this.cranking && !this.running) {
      this.rpm += (420 - this.rpm) * clamp(dt * 3.2, 0, 1);
    }

    // manifold load model
    const veFlow = clamp(this.rpm / s.redline, 0, 1.2) * this.throttlePos;
    const targetKpa = 30 + 70 * clamp(this.throttlePos * (0.35 + 0.65 * (1 - this.rpm / s.redline)) + 0.15, 0, 1)
      * (s.boostCurve(this.rpm) > 1.02 ? 1.25 : 1);
    this.loadKpa += (clamp(targetKpa, 25, s.induction.type === 'na' ? 100 : 118) - this.loadKpa) * clamp(dt * 5, 0, 1);

    const boostRatio = s.boostCurve(this.rpm);
    const mapBar = (this.loadKpa / 100) * (0.4 + 0.6 * this.throttlePos) * boostRatio;
    this.manifoldInHg = lerp(this.manifoldInHg, (mapBar - 1) * 29.53, clamp(dt * 6, 0, 1));

    // ignition & combustion
    const sparkCell = mapLookup(this.tune.spark, this.loadKpa, clamp(this.rpm, 500, 6500));
    const mbtCell = mbtLookup(s, this.loadKpa, clamp(this.rpm, 500, 6500));
    const dev = sparkCell - mbtCell;
    const oct = FUELS[s.fuel.fuelType].oct;
    const seff = sparkEff(dev, oct, this.loadKpa, boostRatio);
    this.knocking = seff.knock && this.ignitionOn && this.rpm > 1500;
    this.sparkNow = sparkCell;

    // AFR model: target, wander under misfire / cheap injection
    const fuelCell = mapLookup(this.tune.fuel, this.loadKpa, clamp(this.rpm, 500, 6500));
    const inj = INJECTION[s.fuel.injection];
    const wander = inj.flow < 0.95 ? Math.sin(this.timeSec * 2.3) * 0.5 : Math.sin(this.timeSec * 3.1) * 0.15;
    const anyMisfire = this.cylEnabled.some((c, i) => !c);
    const targetAfr = fuelCell + (anyMisfire ? 1.2 : 0) + wander;
    this.afr += (targetAfr - this.afr) * clamp(dt * 3, 0, 1);
    const feff = fuelEff(this.afr, s.fuel.fuelType);

    // limiter
    this.limiting = this.rpm >= s.limiter;

    // active cylinders
    const activeFrac = this.cylEnabled.filter(Boolean).length / s.cylinders;

    // torque model (net bmep from shared curve)
    const bmep = bmepNet(s, this.rpm, seff.eff * feff);
    let tq = Math.max(0.01, bmep * 1e5) * (s.displacementL / 1000) / (4 * Math.PI);
    tq *= 0.45 + 0.55 * this.health / 100;
    tq *= (0.25 + 0.75 * activeFrac) * (this.limiting ? 0.3 : 1);
    if (!this.ignitionOn || this.rpm < 380) tq = 0;
    else tq *= clamp(this.throttlePos * 1.6 + 0.05, 0, 1.15); // part-throttle fill

    // idle regulation governor
    if (this.ignitionOn && this.throttlePos < 0.06 && this.rpm > 200) {
      tq += 24 * clamp((s.idleRpm - this.rpm) / 260, -1, 1);
    }
    this.torque = tq;
    this.powerKw = (tq * this.rpm) / 9549;

    // running detection
    if (this.ignitionOn && this.rpm > 430) this.running = true;
    if (!this.ignitionOn) this.running = false;

    // engine speed dynamics
    if (this.dynoActive) {
      // dyno water brake holds a rising sweep — measure net torque at WOT
      this.dynoSweepRpm += 800 * dt;
      this.rpm += clamp(this.dynoSweepRpm - this.rpm, -2000 * dt, 2000 * dt);
      if (this.rpm >= s.limiter - 150 || this.health <= 0) this.stopDyno();
    } else if (this.clutchEngaged && inGear) {
      // driveline: vehicle accelerates
      const wheelTq = this.torque * ratio * 0.92 * this.clutchSyncFactor();
      const mass = 1050 + s.cylinders * 40;
      const drag = 0.42 * this.vehicleSpeed * this.vehicleSpeed * 0.0045 * mass;
      const rr = 0.012 * mass * 9.81;
      const brakeF = this.brakeHeld ? mass * 9.81 * 0.9 : 0;
      const f = wheelTq / s.drivetrain.wheelRadiusM - drag - rr - brakeF;
      const dv = clamp(f / mass, -9.81 * dt * 4, 40) * dt;
      this.vehicleSpeed = Math.max(0, this.vehicleSpeed + dv);
      // spin down when engine off / stalls
      if (!this.running && !this.cranking) {
        const req = wheelRpm;
        this.rpm += (req - this.rpm) * clamp(dt * 2.5, 0, 1);
        if (req < s.idleRpm * 0.6 && this.throttlePos < 0.1 && !this.brakeHeld) {
          // stall
          if (this.rpm < 280) { this.stalled = true; this.running = false; this.vehicleSpeed = Math.max(0, this.vehicleSpeed - 2 * dt); }
        }
      }
    } else {
      // free rev (neutral or clutch disengaged): dRpm = (T_comb - T_fric)/I
      const coulomb = 8;
      const viscous = 0.004 * this.rpm;
      const quad = 9 * (this.rpm / s.redline) ** 2;
      const Tfr = coulomb + viscous + quad;
      const Tc = this.ignitionOn ? this.torque : 0;
      const dRpm = ((Tc - Tfr) / (s.inertia * 2.2)) * 9.549 * dt;
      this.rpm += dRpm;
      if (this.cranking && !this.ignitionOn) this.rpm = Math.min(this.rpm, 400);
      // vehicle coasts
      const drag = 0.004 * this.vehicleSpeed * this.vehicleSpeed + 0.4;
      const brake = this.brakeHeld ? 7 : 0;
      this.vehicleSpeed = Math.max(0, this.vehicleSpeed - (drag + brake) * dt);
    }
    if (!this.cranking && !this.ignitionOn && this.rpm < 60) this.rpm = Math.max(0, this.rpm - 40 * dt);
    if (this.rpm < 0) this.rpm = 0;
    if (this.stalled && this.throttlePos > 0.15 && this.cranking) this.stalled = false;

    this.vehicleSpeedMph = this.vehicleSpeed * 2.23694;

    // crank angle advance
    this.crankAngleDeg = (this.crankAngleDeg + (this.rpm / 60) * 360 * dt) % 720;

    // fire events: when a cylinder crosses its power-TDC
    if (this.running || (this.cranking && this.ignitionOn && this.rpm > 300)) {
      for (let c = 0; c < s.cylinders; c++) {
        if (!this.cylEnabled[c]) continue;
        const phase = s.cylPhaseDeg[c % s.cylPhaseDeg.length];
        const orderIdx = s.firingOrder.indexOf(c + 1);
        const fireAt = (phase + orderIdx * (720 / s.cylinders) + 720 - phase) % 720; // = power TDC angle
        const prev = (this.crankAngleDeg - (this.rpm / 60) * 360 * dt + 720) % 720;
        if (crossedAngle(prev, this.crankAngleDeg, fireAt)) {
          this.fires.push({ cyl: c, time: this.timeSec });
          if (this.fires.length > 16) this.fires.shift();
          this.firesTotal++;
        }
      }
    }

    // ── thermal system ──
    // gen: combustion heat; cool: radiator+oil loop — equilibria tuned so a
    // healthy engine sits ~88°C at idle and ~94°C at cruise, and overheats
    // within ~a minute when the coolant pump is off under load.
    const loadFrac = this.throttlePos * clamp(this.rpm / s.redline, 0, 1);
    const rf = clamp(this.rpm / s.redline, 0, 1);
    const genHeat = this.running
      ? 0.42 + 1.0 * loadFrac + (this.afr > 15.2 ? (this.afr - 15.2) * 0.25 : 0)
      : 0;
    const flowK = this.coolantPump ? 1 : 0.08;
    const coolRate = (this.coolantC - 24) * (0.006 + 0.008 * flowK * rf);
    this.coolantC += (genHeat - coolRate) * dt;
    this.coolantC = clamp(this.coolantC, 20, 150);
    // oil follows coolant + friction heat
    const oilTarget = this.coolantC + (this.running ? 8 + loadFrac * 30 : -8) + (this.knocking ? 8 : 0);
    this.oilC += (oilTarget - this.oilC) * clamp(dt * (this.oilPump ? 0.07 : 0.02), 0, 1);
    this.oilC = clamp(this.oilC, 20, 170);

    // oil pressure
    const wear = 1 - this.health / 100;
    const targetPsi = this.oilPump
      ? clamp(10 + this.rpm * 0.011, 0, 62) * (1 - wear * 0.55) * clamp(1 - (this.oilC - 105) * 0.004, 0.5, 1)
      : 1.5;
    this.oilPressure = lerp(this.oilPressure, this.running ? targetPsi : 0, clamp(dt * 4, 0, 1));
    this.lowOil = this.running && this.rpm > 2200 && this.oilPressure < 10;
    this.overheating = this.coolantC > 116;

    // ── damage ──
    let dmg = 0;
    if (this.knocking) dmg += 1.4;
    if (this.overheating) dmg += (this.coolantC - 116) * 0.12;
    if (this.lowOil) dmg += 2.2;
    if (this.rpm > s.limiter + 350) dmg += 0.9;
    if (dmg > 0) {
      this.health = Math.max(0, this.health - dmg * dt);
      this.checkLight = true;
    }

    // ── OBD codes ──
    const addCode = (code: string, desc: string, severity: ObdCode['severity']) => {
      if (!this.codes.some((c) => c.code === code)) this.codes.push({ code, desc, severity });
    };
    if (this.knocking) addCode('P0326', 'Knock sensor — detonation detected', 'crit');
    if (this.overheating) addCode('P0217', 'Engine coolant over-temperature', 'crit');
    if (this.lowOil) addCode('P0521', 'Engine oil pressure below range', 'crit');
    for (let c = 0; c < s.cylinders; c++) {
      this.misfiring[c] = !this.cylEnabled[c] && this.running;
      if (this.misfiring[c]) addCode(`P030${c + 1}`, `Cylinder ${c + 1} misfire detected`, 'warn');
    }
    if (this.afr > 15.6 && this.running && this.throttlePos > 0.3) addCode('P2177', 'System too lean off idle', 'warn');
    if (this.afr < 11.6 && this.running && this.throttlePos > 0.5) addCode('P2172', 'System too rich, high load', 'warn');
    if (this.health < 35) addCode('P0300', 'Random/multiple cylinder misfire', 'crit');
    if (this.codes.length > 0) this.checkLight = true;

    // ── dyno sampling ──
    if (this.dynoActive && this.rpm > 1000) {
      if (this.rpm - this.lastSampleRpm >= 50) {
        this.lastSampleRpm = this.rpm;
        this.dynoSamples.rpm.push(this.rpm);
        this.dynoSamples.tq.push(Math.max(0, this.torque));
        const flow = 2.2 * s.displacementL * 0.001 * this.rpm / 2 * veCurve(s, this.rpm) * 2.83; // ~SCFM-ish
        this.dynoSamples.pin.push(flow / 10);
        this.dynoSamples.pex.push(flow / 10 * (1 + 0.25 * (1 - this.afr / 15)));
      }
    }

    // ── launch timer ──
    if (this.trackArmed && !this.trackRunning && this.vehicleSpeedMph > 1.5) {
      this.trackRunning = true;
      this.trackFinished = false;
      this.trackT0 = this.timeSec;
    }
    if (this.trackRunning) {
      this.trackElapsed = (this.timeSec - this.trackT0) * 1000;
      const v = this.vehicleSpeedMph;
      const done =
        (this.trackTarget === 60 && v >= 60) ||
        (this.trackTarget === 100 && v >= 100) ||
        (this.trackTarget === 130 && v >= 130);
      if (done) {
        this.trackRunning = false;
        this.trackFinished = true;
        const key = `${this.engineId}:${this.trackTarget}`;
        const t = this.trackElapsed;
        if (!this.bests[key] || t < this.bests[key]) this.bests[key] = t;
        this.onLaunchDone?.(t);
      }
      if (v < 0.5) { this.trackRunning = false; }
    }

    // low-rate notification for text UI (12 Hz)
    this.notifyAcc += dt;
    if (this.notifyAcc > 0.083) {
      this.notifyAcc = 0;
      this.emit();
    }
  }

  private clutchSyncFactor(): number {
    // when slipping, partial torque passes
    return clamp(0.35 + 0.65 * this.clutchSync, 0, 1);
  }
}

function crossedAngle(prev: number, now: number, target: number): boolean {
  if (now < prev) now += 720; // wrapped
  let t = target;
  if (t < prev) t += 720;
  return prev <= t && now >= t;
}

// ── Global singleton ────────────────────────────────────────────────────────
export const sim = new EngineSim();

// Drive the sim from a single rAF loop (started in main.tsx)
let lastT = 0;
let acc = 0;
const FIXED = 1 / 120;
export function simTick(nowMs: number) {
  const now = nowMs / 1000;
  if (!lastT) lastT = now;
  let dt = Math.min(0.1, now - lastT);
  lastT = now;
  acc += dt;
  let n = 0;
  while (acc >= FIXED && n < 24) {
    sim.step(FIXED);
    acc -= FIXED;
    n++;
  }
}

export { buildCost, estimatePeak };
