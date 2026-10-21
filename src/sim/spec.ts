// ── spec.ts: resolve EngineConfig → EngineSpec (derived numerics), costs,
//    default tunes, torque model helpers shared by sim, builder & community ──

import {
  EngineConfig, EngineSpec, SavedTune, LOAD_ROWS, RPM_COLS, CamProfileId,
} from './types';

const DEG = Math.PI / 180;

// ── Cam profiles ────────────────────────────────────────────────────────────
export const CAMS: Record<CamProfileId, {
  label: string; desc: string; price: number;
  redlineBase: number; peakTShift: number; idle: number; lope: number;
}> = {
  mild:   { label: 'Economy Grind',  desc: 'Small lift, glass-smooth idle, best mpg.',        price: 420,  redlineBase: 5600, peakTShift: -450, idle: 800,  lope: 0.0 },
  street: { label: 'Street Grind',   desc: 'Daily-drivable torque cam with mild chop.',       price: 890,  redlineBase: 6300, peakTShift: -150, idle: 850,  lope: 0.15 },
  sport:  { label: 'Sport Grind',    desc: 'Noticeable lope, strong midrange, pulls to red.', price: 1650, redlineBase: 7100, peakTShift: 250,  idle: 950,  lope: 0.35 },
  race:   { label: 'Race Grind',     desc: 'Huge duration, angry idle, all top-end.',         price: 2900, redlineBase: 8000, peakTShift: 650,  idle: 1150, lope: 0.6 },
};

export const INDUCTION = {
  na:    { label: 'Naturally Aspirated', desc: 'Individual throttle response, zero lag.', price: 0,    psi: 0 },
  turbo: { label: 'Turbocharger',        desc: 'Exhaust-driven boost. Spools mid-range.',  price: 3400, psi: 9 },
  super: { label: 'Supercharger',        desc: 'Belt-driven boost from idle. Whine free.', price: 4100, psi: 7 },
} as const;

export const INJECTION = {
  carb:     { label: 'Carburetor',       desc: 'Classic. Simple, cheap, sloppy metering.', price: 280,  flow: 0.88 },
  throttle: { label: 'Throttle Body',    desc: 'Early EFI. Better than a carb, barely.',   price: 640,  flow: 0.94 },
  mpi:      { label: 'Multi-Port EFI',   desc: 'Per-runner injectors. The modern default.',price: 1150, flow: 1.0 },
  di:       { label: 'Direct Injection', desc: 'In-cylinder spray. Best knock resistance.',price: 1950, flow: 1.05 },
} as const;

export const FUELS = {
  pump:    { label: '91 Pump Gas',  desc: 'Everyday petrol. Limited timing tolerance.',  price: 0,   oct: 91 },
  premium: { label: '98 Premium',   desc: 'High octane pump fuel. Good all-rounder.',    price: 120, oct: 98 },
  e85:     { label: 'E85 Ethanol',  desc: 'Cool burning, huge octane, thirsty.',         price: 220, oct: 105 },
  race:    { label: 'C16 Race Gas', desc: 'Maximum octane. Maximum wallet pain.',        price: 450, oct: 116 },
} as const;

export const EXHAUSTS = {
  cast:     { label: 'Cast Manifolds', desc: 'Quiet, restrictive, cheap.',             price: 340,  flow: 0.9 },
  header:   { label: 'Tubular Headers',desc: 'Equal-length runners, free flow.',       price: 980,  flow: 1.0 },
  straight: { label: 'Straight Pipes', desc: 'No silencing. Loud. Fast.',              price: 720,  flow: 1.03 },
} as const;

export const IGNITIONS = {
  points: { label: 'Points Distributor', desc: 'Vintage spark, fades above 6k.',         price: 190,  spark: 0.93 },
  hei:    { label: 'HEI Distributor',    desc: 'Hot single-coil spark, reliable.',       price: 520,  spark: 0.98 },
  cop:    { label: 'Coil-On-Plug',       desc: 'Per-cylinder coils. Fire at any rpm.',   price: 1150, spark: 1.0 },
} as const;

// Suggested firing orders per configuration
export function firingOrderSuggestions(cyl: number, layout: EngineConfig['layout']): number[][] {
  const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  switch (layout) {
    case 'inline':
      if (cyl === 3) return [[1, 2, 3], [1, 3, 2]];
      if (cyl === 4) return [[1, 3, 4, 2], [1, 2, 4, 3]];
      if (cyl === 5) return [[1, 2, 4, 5, 3]];
      if (cyl === 6) return [[1, 5, 3, 6, 2, 4], [1, 4, 2, 6, 3, 5]];
      if (cyl === 7) return [[1, 3, 5, 7, 2, 4, 6]];
      if (cyl === 2) return [[1, 2], [1, 2]];
      return [seq(cyl)];
    case 'v':
      if (cyl === 6) return [[1, 4, 3, 6, 2, 5]];
      if (cyl === 8) return [[1, 8, 4, 3, 6, 5, 7, 2], [1, 5, 4, 8, 6, 3, 7, 2]];
      if (cyl === 10) return [[1, 6, 5, 10, 2, 7, 3, 8, 4, 9]];
      if (cyl === 12) return [[1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10]];
      return [seq(cyl)];
    case 'flat':
      if (cyl === 4) return [[1, 3, 2, 4]];
      if (cyl === 6) return [[1, 6, 3, 2, 5, 4]];
      return [seq(cyl)];
  }
}

// Evenness score 0..1 of a firing order (spacing variance between fired cylinders' TDCs)
export function orderSmoothness(order: number[], cyl: number, layout: EngineConfig['layout']): number {
  if (order.length < 2) return 0.5;
  // approximate crank TDC angle of each cylinder (inline: 720/cyl apart by index)
  const gap = 720 / cyl;
  const angles = order.map((c, i) => i * gap); // event angle
  const spacings = angles.slice(1).map((a, i) => a - angles[i]);
  const mean = spacings.reduce((a, b) => a + b, 0) / spacings.length;
  const varr = spacings.reduce((a, b) => a + (b - mean) ** 2, 0) / spacings.length;
  return Math.max(0.2, 1 - Math.sqrt(varr) / mean);
}

// ── Resolve a full EngineSpec from a config ─────────────────────────────────
export function resolveSpec(cfg: EngineConfig): EngineSpec {
  const boreM = cfg.boreMm / 1000;
  const strokeM = cfg.strokeMm / 1000;
  const dispL = (Math.PI / 4) * cfg.boreMm ** 2 * cfg.strokeMm * cfg.cylinders / 1e6;
  const cam = CAMS[cfg.cam.profile];

  // redline: cam base, shortened by stroke length, ignition system caps;
  // the builder-set rev limiter is authoritative for the fuel cut.
  let camRedline = cam.redlineBase - (cfg.strokeMm - 80) * 26 + (cfg.cam.durationDeg - 240) * 6;
  if (cfg.ignition.system === 'points') camRedline = Math.min(camRedline, 6200);
  camRedline = clamp(Math.round(camRedline / 100) * 100, 4000, 9800);
  const limiter = clamp(cfg.ignition.revLimit, 4200, 12000);
  const redline = Math.min(camRedline, limiter - 400);
  const peakTorqueRpm = clamp(redline * 0.68 + cam.peakTShift, 1800, Math.max(2000, redline - 600));

  const idleRpm = clamp(cam.idle + (cfg.induction.type === 'turbo' ? 50 : 0), 650, 1400);

  // crank pin angles for modelled visuals + fire spacing
  const cylPhaseDeg: number[] = [];
  if (cfg.layout === 'inline') {
    // classic even-fire crank patterns
    const patterns: Record<number, number[]> = {
      2: [0, 180],
      3: [0, 120, 240],
      4: [0, 180, 180, 0],
      5: [0, 144, 288, 72, 216],
      6: [0, 120, 240, 240, 120, 0],
      7: [0, 103, 206, 309, 52, 155, 258],
    };
    const p = patterns[cfg.cylinders] ?? Array.from({ length: cfg.cylinders }, (_, i) => i * (360 / cfg.cylinders));
    cylPhaseDeg.push(...p);
  } else if (cfg.layout === 'v') {
    const perBank = cfg.cylinders / 2;
    for (let i = 0; i < cfg.cylinders; i++) {
      const pair = Math.floor(i / 2);
      cylPhaseDeg.push(pair * (360 / perBank) + (i % 2) * cfg.bankAngleDeg * 0.0);
    }
  } else {
    const perBank = cfg.cylinders / 2;
    for (let i = 0; i < cfg.cylinders; i++) {
      const pair = Math.floor(i / 2);
      cylPhaseDeg.push(pair * (360 / perBank) + (i % 2) * 180);
    }
  }

  const fireEveryDeg = 720 / cfg.cylinders;

  // MBT base timing value for each map cell (flattened rows x cols)
  const mbt: number[] = [];
  for (let r = 0; r < LOAD_ROWS.length; r++) {
    for (let c = 0; c < RPM_COLS.length; c++) {
      const load = LOAD_ROWS[r];
      const rpm = RPM_COLS[c];
      let v = 22 + (rpm / 1000) * 2.2 - load * 0.12;
      v += FUELS[cfg.fuel.fuelType].oct > 98 ? 2 : 0;
      mbt.push(clamp(v, 6, 40));
    }
  }

  const smoothness = orderSmoothness(cfg.firingOrder, cfg.cylinders, cfg.layout);

  // inertia scales with rotating mass
  const inertia = 0.06 + cfg.cylinders * 0.012 + (cfg.boreMm * cfg.strokeMm / 10000) * 0.01;

  // manifold pressure ratio vs rpm for this induction
  const boostCurve = (rpm: number): number => {
    if (cfg.induction.type === 'na') return 1;
    const psi = cfg.induction.boostPsi;
    if (cfg.induction.type === 'turbo') {
      const spool = 2600 + psi * 40;
      const s = 1 / (1 + Math.exp(-(rpm - spool) / 500));
      return 1 + (psi / 14.7) * s * clamp(rpm / redline, 0.3, 1.15);
    }
    // supercharger: linear with rpm
    return 1 + (psi / 14.7) * (0.35 + 0.65 * clamp(rpm / redline, 0, 1));
  };

  return {
    ...cfg,
    displacementL: dispL,
    boreM,
    strokeM,
    crankRadiusM: strokeM / 2,
    rodLengthM: strokeM * 0.85,
    redline, limiter, idleRpm, peakTorqueRpm,
    inertia,
    cylPhaseDeg,
    fireEveryDeg,
    mbt,
    smoothness,
    boostCurve,
  } as EngineSpec;
}

export function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ── Torque model (shared): VE curve + net bmep ──────────────────────────────
// Single source of truth for the "breathing curve" of an engine, used by the
// live sim, static estimates, dyno math and the shift-point solver.

export function veCurve(spec: EngineSpec, rpm: number): number {
  const cam = CAMS[spec.cam.profile];
  const inj = INJECTION[spec.fuel.injection];
  const exh = EXHAUSTS[spec.exhaust];
  const ign = IGNITIONS[spec.ignition.system];
  const r = rpm / spec.peakTorqueRpm;
  const loDip = r < 1 ? 0.34 * ((1 - r) * 1.15) ** 2 : 0;
  const hiFall = r > 1 ? 0.55 * ((r - 1) * 0.9) ** 2 : 0;
  let ve = Math.max(0.28, 1 - loDip - hiFall);
  ve *= inj.flow * exh.flow * (0.92 + 0.08 * ign.spark);
  if (rpm < 2200) ve *= 1 - cam.lope * 0.35 * (1 - rpm / 2200);
  return ve;
}

export function frictionBar(spec: EngineSpec, rpm: number): number {
  return 0.9 + (rpm / spec.redline) ** 2 * 1.6;
}

// net bmep (bar) at given pure-geometry efficiency multiplier (spark·fuel etc.)
export function bmepNet(spec: EngineSpec, rpm: number, eff = 1): number {
  return 13.6 * veCurve(spec, rpm) * spec.boostCurve(rpm) * eff - frictionBar(spec, rpm);
}

export function torqueNm(spec: EngineSpec, rpm: number, eff = 1): number {
  return Math.max(0.01, bmepNet(spec, rpm, eff) * 1e5) * (spec.displacementL / 1000) / (4 * Math.PI);
}

export interface TorqueCtx {
  spec: EngineSpec;
  rpm: number;
  throttle: number; // 0..1 actual manifold demand
  sparkAdv: number; // current cell advance (deg) — eff vs MBT
  afr: number;
  activeFrac: number; // fraction of cylinders firing
  health: number; // 0..100
  limiting: boolean;
}

export function computeTorque(ctx: TorqueCtx): number {
  const s = ctx.spec;
  const cam = CAMS[s.cam.profile];
  const inj = INJECTION[s.fuel.injection];
  const exh = EXHAUSTS[s.exhaust];
  const ign = IGNITIONS[s.ignition.system];

  const r = ctx.rpm / s.peakTorqueRpm;
  // VE curve: peak near peakTorqueRpm, falloff both sides
  const loDip = r < 1 ? 0.34 * ((1 - r) * 1.15) ** 2 : 0;
  const hiFall = r > 1 ? 0.55 * ((r - 1) * 0.9) ** 2 : 0;
  let ve = Math.max(0.28, 1 - loDip - hiFall);
  ve *= inj.flow * exh.flow * (0.92 + 0.08 * ign.spark);

  const boost = s.boostCurve(ctx.rpm);
  // big cam hurts low rpm
  if (ctx.rpm < 2200) ve *= 1 - cam.lope * 0.35 * (1 - ctx.rpm / 2200);

  // spark efficiency vs MBT (flattened map lookup done by caller)
  const dev = ctx.sparkAdv; // passed as absolute; caller knows mbt
  // caller passes sparkAdv already adjusted; we model eff inside sim.

  const bmepBar =
    11.4 * ve * boost - (1.05 + (ctx.rpm / s.redline) ** 2 * 3.4);

  let tq = (bmepBar * 1e5) * (s.displacementL / 1000) / (4 * Math.PI); // N·m
  tq *= 0.45 + 0.55 * ctx.health / 100;
  tq *= 0.4 + 0.6 * ctx.activeFrac;
  if (ctx.limiting) tq *= 0.25;
  return tq;
}

// Spark efficiency given advance deviation from MBT (deg)
export function sparkEff(dev: number, fuelOctane: number, loadKpa: number, boostRatio: number): { eff: number; knock: boolean } {
  // knock tolerance scales with octane
  const tol = 2 + (fuelOctane - 87) * 0.22 - loadKpa * 0.012 - (boostRatio - 1) * 5;
  const over = dev - tol;
  if (over > 0) {
    return { eff: Math.max(0.55, 1 - 0.0022 * dev * dev - over * 0.02), knock: over > 2.5 };
  }
  return { eff: Math.max(0.55, 1 - 0.0022 * dev * dev), knock: false };
}

export function fuelEff(afr: number, fuel: keyof typeof FUELS): number {
  const lean = fuel === 'e85' ? 9.8 : 14.7;
  const best = lean * 0.88;
  const d = (afr - best) / lean * 14.7;
  let eff = 1 - 0.0026 * d * d * (fuel === 'e85' ? 0.6 : 1);
  // running very lean on E85 is fine; on petrol it cooks things (handled in sim)
  return clamp(eff, 0.7, 1.04);
}

// Static WOT estimate of peak power / torque (builder + community previews)
export function estimatePeak(spec: EngineSpec): { hp: number; nm: number } {
  let hp = 0, nm = 0;
  const feff = fuelEff(spec.fuel.targetAfr, spec.fuel.fuelType);
  for (let rpm = 1200; rpm <= spec.redline; rpm += 100) {
    const tq = torqueNm(spec, rpm, feff);
    const kW = (tq * rpm) / 9549;
    if (kW * 1.341 > hp) hp = kW * 1.341;
    if (tq > nm) nm = tq;
  }
  return { hp: Math.round(hp), nm: Math.round(nm) };
}

// ── Build cost model ────────────────────────────────────────────────────────
export function buildCost(cfg: EngineConfig): number {
  let cost = 5200; // machining + block
  cost += cfg.cylinders * 640; // pistons/rods/valves per cyl
  cost += cfg.cylinders >= 5 && cfg.layout !== 'inline' ? 2600 : 0;
  cost += cfg.layout === 'flat' ? 1400 : 0;
  cost += cfg.layout === 'v' ? 1800 : 0;
  if (cfg.boreMm >= 95) cost += 900;
  if (cfg.compression > 11) cost += 750;
  cost += CAMS[cfg.cam.profile].price;
  cost += INDUCTION[cfg.induction.type].price * cfg.induction.boostPsi * 0.06 + INDUCTION[cfg.induction.type].price;
  cost += INJECTION[cfg.fuel.injection].price;
  cost += FUELS[cfg.fuel.fuelType].price;
  cost += EXHAUSTS[cfg.exhaust].price;
  cost += IGNITIONS[cfg.ignition.system].price;
  cost += 400 * (cfg.fuel.injectorFlow / 250);
  cost += 850 + cfg.drivetrain.gearRatios.length * 220; // gearbox
  return Math.round(cost);
}

// ── Default tune maps (like the screenshot's green table) ───────────────────
export function defaultTune(spec: EngineSpec): SavedTune {
  const rows = LOAD_ROWS.length, cols = RPM_COLS.length;
  const spark: number[][] = [];
  const fuel: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const sr: number[] = [];
    const fr: number[] = [];
    for (let c = 0; c < cols; c++) {
      sr.push(Math.round(spec.mbt[r * cols + c] * 2) / 2);
      fr.push(Math.round(spec.fuel.targetAfr * 10) / 10);
    }
    spark.push(sr);
    fuel.push(fr);
  }
  return { spark, fuel, learned: false };
}

// bilinear lookup into a map (rows = load ascending, cols = rpm ascending)
export function mapLookup(map: number[][], loadKpa: number, rpm: number): number {
  const rows = LOAD_ROWS, cols = RPM_COLS;
  let ri = 0;
  while (ri < rows.length - 2 && loadKpa > rows[ri + 1]) ri++;
  let ci = 0;
  while (ci < cols.length - 2 && rpm > cols[ci + 1]) ci++;
  const r0 = rows[ri], r1 = rows[ri + 1];
  const c0 = cols[ci], c1 = cols[ci + 1];
  const tr = clamp((loadKpa - r0) / (r1 - r0), 0, 1);
  const tc = clamp((rpm - c0) / (c1 - c0), 0, 1);
  const a = map[ri][ci] * (1 - tc) + map[ri][ci + 1] * tc;
  const b = map[ri + 1][ci] * (1 - tc) + map[ri + 1][ci + 1] * tc;
  return a * (1 - tr) + b * tr;
}

export function mbtLookup(spec: EngineSpec, loadKpa: number, rpm: number): number {
  const rows = LOAD_ROWS, cols = RPM_COLS;
  let ri = 0;
  while (ri < rows.length - 2 && loadKpa > rows[ri + 1]) ri++;
  let ci = 0;
  while (ci < cols.length - 2 && rpm > cols[ci + 1]) ci++;
  const i = ri * cols.length + ci;
  return spec.mbt[i];
}

export const deg = DEG;
