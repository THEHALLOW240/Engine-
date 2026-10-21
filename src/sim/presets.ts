// ── presets.ts: the starter engines + unlockable showroom engines ───────────
import { EngineConfig } from './types';
import { resolveSpec, buildCost, estimatePeak } from './spec';

export interface PresetDef {
  id: string;
  blurb: string;
  unlockCost: number; // 0 = free starter
  config: EngineConfig;
}

const CAR_GEARS_5 = [3.55, 2.05, 1.36, 1.03, 0.78];
const CAR_GEARS_6 = [3.63, 2.19, 1.61, 1.22, 1.0, 0.77];
const BIKE_GEARS_6 = [2.75, 1.94, 1.55, 1.32, 1.15, 1.0];

export const PRESETS: PresetDef[] = [
  {
    id: 'g10',
    blurb: 'The humble 3-pot from the Geo Metro. Flyweight hero. Everyone starts here.',
    unlockCost: 0,
    config: {
      name: 'Geo Metro G10',
      description: '1.0L 3-cylinder workhorse from the 90s metro runabout.',
      layout: 'inline', cylinders: 3, bankAngleDeg: 0,
      boreMm: 74, strokeMm: 77.7, compression: 9.5,
      firingOrder: [1, 2, 3],
      cam: { profile: 'mild', intakeCenterDeg: 108, durationDeg: 208 },
      ignition: { system: 'hei', revLimit: 6000 },
      fuel: { injection: 'throttle', fuelType: 'pump', targetAfr: 13.8, injectorFlow: 190 },
      induction: { type: 'na', boostPsi: 0 },
      exhaust: 'header',
      drivetrain: { gearRatios: CAR_GEARS_5, finalDrive: 4.1, wheelRadiusM: 0.27 },
    },
  },
  {
    id: 'e25',
    blurb: 'Subaru\'s EJ25 flat-four. Turbo rumble, unequal-length soul.',
    unlockCost: 250,
    config: {
      name: 'Subaru EJ257',
      description: '2.5L turbo boxer four with the classic burble.',
      layout: 'flat', cylinders: 4, bankAngleDeg: 180,
      boreMm: 99.5, strokeMm: 79, compression: 8.4,
      firingOrder: [1, 3, 2, 4],
      cam: { profile: 'street', intakeCenterDeg: 106, durationDeg: 232 },
      ignition: { system: 'cop', revLimit: 6700 },
      fuel: { injection: 'mpi', fuelType: 'premium', targetAfr: 12.6, injectorFlow: 550 },
      induction: { type: 'turbo', boostPsi: 14 },
      exhaust: 'header',
      drivetrain: { gearRatios: CAR_GEARS_6, finalDrive: 3.9, wheelRadiusM: 0.32 },
    },
  },
  {
    id: 'jz',
    blurb: 'Toyota 2JZ-GTE. The iron-block legend that eats boost for breakfast.',
    unlockCost: 350,
    config: {
      name: 'Toyota 2JZ-GTE',
      description: '3.0L twin-cam turbo inline-six. Tuner royalty.',
      layout: 'inline', cylinders: 6, bankAngleDeg: 0,
      boreMm: 86, strokeMm: 86, compression: 8.5,
      firingOrder: [1, 5, 3, 6, 2, 4],
      cam: { profile: 'sport', intakeCenterDeg: 104, durationDeg: 248 },
      ignition: { system: 'cop', revLimit: 7600 },
      fuel: { injection: 'mpi', fuelType: 'e85', targetAfr: 12.2, injectorFlow: 800 },
      induction: { type: 'turbo', boostPsi: 19 },
      exhaust: 'straight',
      drivetrain: { gearRatios: CAR_GEARS_6, finalDrive: 3.73, wheelRadiusM: 0.33 },
    },
  },
  {
    id: 'busa',
    blurb: 'Suzuki Hayabusa 1340. Twelve thousand RPM of superbike fury.',
    unlockCost: 200,
    config: {
      name: 'Suzuki Hayabusa',
      description: '1.3L superbike inline-four that screams to 11k.',
      layout: 'inline', cylinders: 4, bankAngleDeg: 0,
      boreMm: 81, strokeMm: 65, compression: 12.5,
      firingOrder: [1, 2, 4, 3],
      cam: { profile: 'race', intakeCenterDeg: 100, durationDeg: 280 },
      ignition: { system: 'cop', revLimit: 11200 },
      fuel: { injection: 'mpi', fuelType: 'premium', targetAfr: 13.1, injectorFlow: 420 },
      induction: { type: 'na', boostPsi: 0 },
      exhaust: 'straight',
      drivetrain: { gearRatios: BIKE_GEARS_6, finalDrive: 2.55, wheelRadiusM: 0.3 },
    },
  },
  {
    id: 'ls3',
    blurb: 'GM LS3 small-block. Pushrod thunder, endless aftermarket.',
    unlockCost: 500,
    config: {
      name: 'Chevrolet LS3',
      description: '6.2L pushrod V8. Big cubes, big torque, big noise.',
      layout: 'v', cylinders: 8, bankAngleDeg: 90,
      boreMm: 103.25, strokeMm: 92, compression: 10.7,
      firingOrder: [1, 8, 7, 2, 6, 5, 4, 3],
      cam: { profile: 'street', intakeCenterDeg: 112, durationDeg: 226 },
      ignition: { system: 'cop', revLimit: 6600 },
      fuel: { injection: 'mpi', fuelType: 'premium', targetAfr: 12.9, injectorFlow: 630 },
      induction: { type: 'na', boostPsi: 0 },
      exhaust: 'header',
      drivetrain: { gearRatios: CAR_GEARS_6, finalDrive: 3.42, wheelRadiusM: 0.34 },
    },
  },
  {
    id: 'r26',
    blurb: 'Nissan RB26DETT. Godzilla\'s heart. Locked for true believers.',
    unlockCost: 700,
    config: {
      name: 'Nissan RB26DETT',
      description: '2.6L twin-turbo inline-six from the GT-R R34.',
      layout: 'inline', cylinders: 6, bankAngleDeg: 0,
      boreMm: 86, strokeMm: 73.7, compression: 8.5,
      firingOrder: [1, 5, 3, 6, 2, 4],
      cam: { profile: 'sport', intakeCenterDeg: 102, durationDeg: 256 },
      ignition: { system: 'cop', revLimit: 8000 },
      fuel: { injection: 'mpi', fuelType: 'race', targetAfr: 12.4, injectorFlow: 740 },
      induction: { type: 'turbo', boostPsi: 16 },
      exhaust: 'straight',
      drivetrain: { gearRatios: CAR_GEARS_6, finalDrive: 3.55, wheelRadiusM: 0.32 },
    },
  },
];

export interface PresetSummary {
  def: PresetDef;
  disp: number;
  hp: number;
  nm: number;
  cost: number;
  redline: number;
}

let cache: PresetSummary[] | null = null;
export function presetSummaries(): PresetSummary[] {
  if (cache) return cache;
  cache = PRESETS.map((def) => {
    const spec = resolveSpec(def.config);
    const est = estimatePeak(spec);
    return {
      def,
      disp: spec.displacementL,
      hp: est.hp,
      nm: est.nm,
      cost: buildCost(def.config),
      redline: spec.redline,
    };
  });
  return cache;
}
