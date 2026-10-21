// ── Core type definitions for ENGINE SIM ────────────────────────────────────

export type LayoutKind = 'inline' | 'v' | 'flat';

export type CamProfileId = 'mild' | 'street' | 'sport' | 'race';
export type InductionId = 'na' | 'turbo' | 'super';
export type InjectionId = 'carb' | 'throttle' | 'mpi' | 'di';
export type FuelTypeId = 'pump' | 'premium' | 'e85' | 'race';
export type ExhaustId = 'cast' | 'header' | 'straight';
export type IgnitionSysId = 'points' | 'hei' | 'cop';

export interface CamConfig {
  profile: CamProfileId;
  intakeCenterDeg: number; // 95..125
  durationDeg: number; // 190..300
}

export interface IgnitionConfig {
  system: IgnitionSysId;
  revLimit: number; // rpm
}

export interface FuelConfig {
  injection: InjectionId;
  fuelType: FuelTypeId;
  targetAfr: number; // 11.5..16
  injectorFlow: number; // cc/min ~ 120..1200
}

export interface InductionConfig {
  type: InductionId;
  boostPsi: number; // for forced induction
}

export interface DrivetrainConfig {
  gearRatios: number[]; // e.g. 5 speeds
  finalDrive: number;
  wheelRadiusM: number;
}

export interface EngineConfig {
  name: string;
  description: string;
  layout: LayoutKind;
  cylinders: number;
  bankAngleDeg: number; // for V and flat
  boreMm: number;
  strokeMm: number;
  compression: number;
  firingOrder: number[]; // 1-based cylinder numbers
  cam: CamConfig;
  ignition: IgnitionConfig;
  fuel: FuelConfig;
  induction: InductionConfig;
  exhaust: ExhaustId;
  drivetrain: DrivetrainConfig;
}

export interface SavedTune {
  // spark map: rows(load kPa, index 0 = low) x cols(rpm)
  spark: number[][];
  fuel: number[][];
  // live learning trims
  learned: boolean;
}

export interface SavedEngine {
  id: string;
  config: EngineConfig;
  tune: SavedTune;
  cost: number; // USD build cost
  peakHp: number; // computed at save
  peakNm: number;
  createdAt: number;
  presetId?: string; // if derived from a preset
  locked?: boolean;
}

export interface PublishedEngine {
  id: string;
  name: string;
  author: string;
  config: EngineConfig;
  displacementL: number;
  cylinders: number;
  layout: LayoutKind;
  peakHp: number;
  peakNm: number;
  cost: number;
  featured?: boolean;
  mine?: boolean;
  createdAt: number;
  hue: number; // thumbnail accent
}

export type ObdCode = {
  code: string;
  desc: string;
  severity: 'info' | 'warn' | 'crit';
};

export interface DynoRun {
  rpm: number[];
  torque: number[];
  power: number[];
  intakeFlow: number[]; // SCFM
  exhaustFlow: number[];
  peakHp: number;
  peakNm: number;
  peakHpRpm: number;
  peakNmRpm: number;
  at: number;
}

export interface LaunchBest {
  target: number; // 60 / 100 / 130 from-60
  timeMs: number;
  engineId: string;
}

// Derived numerics resolved from EngineConfig (computed by builder.ts)
export interface EngineSpec extends EngineConfig {
  displacementL: number;
  boreM: number;
  strokeM: number;
  crankRadiusM: number;
  rodLengthM: number;
  redline: number;
  limiter: number;
  idleRpm: number;
  peakTorqueRpm: number;
  inertia: number; // kg m^2 effective
  cylPhaseDeg: number[]; // crank pin angle per cylinder
  fireEveryDeg: number;
  mbt: number[]; // per spark-map cell MBT values (rows*cols flattened via helper)
  boostCurve: (rpm: number) => number; // manifold pressure ratio
  smoothness: number; // firing order evenness 0..1
}

export const LOAD_ROWS = [30, 45, 60, 75, 90, 100]; // kPa (row 0 = bottom)
export const RPM_COLS = [500, 1200, 2000, 2700, 3500, 4200, 5000, 5700, 6500];

export type LayoutId =
  | 'simple'
  | 'cockpit'
  | 'tuner'
  | 'track'
  | 'diagnostic'
  | 'leaderboard'
  | 'community';
