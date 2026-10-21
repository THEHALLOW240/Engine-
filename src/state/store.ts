// ── store.ts: app-level state, persistence, community & unlock economy ──────
import { create } from 'zustand';
import {
  EngineConfig, SavedEngine, SavedTune, PublishedEngine, LayoutId, DrivetrainConfig,
} from '../sim/types';
import { resolveSpec, defaultTune, buildCost, estimatePeak } from '../sim/spec';
import { PRESETS, presetSummaries } from '../sim/presets';
import { sim } from '../sim/core';

const LS_KEY = 'enginesim:v1';

export interface Wallet { coins: number; }

interface PersistShape {
  engines: SavedEngine[];
  selectedId: string;
  unlocked: string[];
  coins: number;
  myPublishes: PublishedEngine[];
  bests: Record<string, number>;
  seenIntro?: boolean;
}

interface AppState extends PersistShape {
  layout: LayoutId;
  builderOpen: boolean;
  builderDraft: EngineConfig | null;
  settingsOpen: boolean;
  publishChooserOpen: boolean;
  showroomOpen: boolean;
  inspectId: string | null; // published engine modal
  audioOn: boolean;
  hiContrast: boolean;

  setLayout(l: LayoutId): void;
  openBuilder(existing?: EngineConfig | null): void;
  closeBuilder(): void;
  updateDraft(cfg: EngineConfig): void;
  saveEngineFromBuilder(cfg: EngineConfig, existingId?: string): SavedEngine;
  deleteEngine(id: string): void;
  selectEngine(id: string): void;
  setSettingsOpen(b: boolean): void;
  setPublishChooser(b: boolean): void;
  setShowroom(b: boolean): void;
  setInspect(id: string | null): void;
  setAudio(b: boolean): void;
  setHiContrast(b: boolean): void;
  addCoins(n: number): void;
  unlockPreset(pid: string): boolean;
  publishEngine(engineId: string): PublishedEngine | null;
  importPublished(p: PublishedEngine): void;
  resetAll(): void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// ── community seeds (deterministic) ─────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AUTHORS = ['APEXWORKS', 'TORQUE_SHADOW', 'MOTO_MAVEN', 'LOBECRAFT', 'GRIDAPEX', 'PISTON-POET', 'TUNERDAME', 'VELOCISTA', 'DRIFTLINE', 'WRENCHWOLF', 'BOOST_BARN', 'KAMIKAZE-K', 'HALFTHROTTLE', 'SPARKY-88', 'CANARDLYS', 'NANDO-V', 'TEAM_SLIP', 'OHC_DAN'];

function communitySeeds(): PublishedEngine[] {
  const rnd = mulberry32(1337);
  const out: PublishedEngine[] = [];
  const configs: Array<{ layout: 'inline' | 'v' | 'flat'; cyl: number; boost: boolean; disp: [number, number]; name: string[] }> = [
    { layout: 'inline', cyl: 3, boost: false, disp: [0.8, 1.2], name: ['City Bee', 'Tri-Clutch', 'Pocket Rocket'] },
    { layout: 'inline', cyl: 4, boost: true, disp: [1.2, 2.4], name: ['Hot Hatch Heart', 'Boost Bug', 'Daily Ripper', 'RS-Clone Four'] },
    { layout: 'inline', cyl: 6, boost: true, disp: [2.4, 3.4], name: ['Silk Six', 'Godzilla Diet', 'Boostline 3.0', 'Twinscroll Terry'] },
    { layout: 'v', cyl: 8, boost: false, disp: [4.0, 6.4], name: ['Small-Block Sunday', 'Thunder Chicken', 'Quarter Miler', 'Pushrod Party'] },
    { layout: 'flat', cyl: 4, boost: true, disp: [1.8, 2.6], name: ['Rumble Bee', 'Rally Heart', 'Flat Bread Turbo'] },
    { layout: 'v', cyl: 12, boost: false, disp: [5.0, 6.8], name: ['Velvet Hammer', 'Twelve Course', 'Silken Dozen'] },
    { layout: 'v', cyl: 6, boost: false, disp: [2.8, 3.8], name: ['Six-Shooter V', 'Alfresco V6'] },
  ];
  let i = 0;
  for (const c of configs) {
    const n = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) {
      const dispL = c.disp[0] + rnd() * (c.disp[1] - c.disp[0]);
      const boreMm = Math.round(Math.cbrt((dispL * 1e6 * 1.05) / ((Math.PI / 4) * c.cyl)) / 0.5) * 0.5;
      const strokeMm = Math.round((dispL * 1e6) / ((Math.PI / 4) * boreMm * boreMm * c.cyl) / 0.5) * 0.5;
      const boosted = c.boost && rnd() > 0.35;
      const cfg: EngineConfig = {
        name: '', description: '',
        layout: c.layout, cylinders: c.cyl,
        bankAngleDeg: c.layout === 'flat' ? 180 : c.layout === 'v' ? 90 : 0,
        boreMm: Math.max(68, Math.min(108, boreMm)),
        strokeMm: Math.max(58, Math.min(102, strokeMm)),
        compression: boosted ? 8.5 + rnd() : 9.5 + rnd() * 2.5,
        firingOrder: c.layout === 'v' && c.cyl === 8 ? [1, 8, 4, 3, 6, 5, 7, 2]
          : c.layout === 'flat' && c.cyl === 4 ? [1, 3, 2, 4]
          : Array.from({ length: c.cyl }, (_, x) => x + 1),
        cam: { profile: rnd() > 0.6 ? 'sport' : rnd() > 0.5 ? 'street' : 'mild', intakeCenterDeg: 100 + rnd() * 12, durationDeg: 200 + rnd() * 70 },
        ignition: { system: rnd() > 0.5 ? 'cop' : 'hei', revLimit: 6000 + rnd() * 2200 },
        fuel: { injection: rnd() > 0.4 ? 'mpi' : rnd() > 0.5 ? 'di' : 'carb', fuelType: boosted ? 'e85' : rnd() > 0.5 ? 'premium' : 'pump', targetAfr: 12.2 + rnd() * 2, injectorFlow: 250 + rnd() * 600 },
        induction: boosted ? { type: 'turbo', boostPsi: 8 + rnd() * 14 } : { type: rnd() > 0.9 ? 'super' : 'na', boostPsi: rnd() > 0.9 ? 7 : 0 },
        exhaust: rnd() > 0.5 ? 'header' : 'straight',
        drivetrain: { gearRatios: [3.5, 2.1, 1.4, 1.05, 0.8], finalDrive: 3.7, wheelRadiusM: 0.31 },
      };
      const spec = resolveSpec(cfg);
      const est = estimatePeak(spec);
      const nm = est.nm;
      const name = c.name[k % c.name.length] + ' ' + dispL.toFixed(1);
      out.push({
        id: 'seed-' + (i++),
        name,
        author: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
        config: cfg,
        displacementL: spec.displacementL,
        cylinders: c.cyl, layout: c.layout,
        peakHp: est.hp, peakNm: nm,
        cost: buildCost(cfg),
        featured: est.hp > 380 || rnd() > 0.86,
        createdAt: Date.now() - Math.floor(rnd() * 90) * 86400_000,
        hue: Math.floor(rnd() * 360),
      });
    }
  }
  return out.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
}
export const COMMUNITY_SEEDS = communitySeeds();

// ── persistence ─────────────────────────────────────────────────────────────
function loadPersist(): Partial<PersistShape> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function makeStarterEngines(): { engines: SavedEngine[]; selectedId: string } {
  const engines: SavedEngine[] = [];
  for (const p of PRESETS) {
    const spec = resolveSpec(p.config);
    const est = estimatePeak(spec);
    engines.push({
      id: 'eng-' + p.id,
      config: p.config,
      tune: defaultTune(spec),
      cost: buildCost(p.config),
      peakHp: est.hp,
      peakNm: est.nm,
      createdAt: Date.now(),
      presetId: p.id,
      locked: p.unlockCost > 0,
    });
  }
  return { engines, selectedId: 'eng-g10' };
}

export const useApp = create<AppState>((set, get) => {
  const persist = loadPersist();
  const starter = makeStarterEngines();
  const initial: PersistShape = {
    engines: persist.engines?.length ? persist.engines : starter.engines,
    selectedId: persist.selectedId ?? starter.selectedId,
    unlocked: persist.unlocked ?? ['g10'],
    coins: persist.coins ?? 250,
    myPublishes: persist.myPublishes ?? [],
    bests: persist.bests ?? {},
    seenIntro: persist.seenIntro ?? false,
  };

  const save = () => {
    const s = get();
    const data: PersistShape = {
      engines: s.engines, selectedId: s.selectedId, unlocked: s.unlocked,
      coins: s.coins, myPublishes: s.myPublishes, bests: s.bests, seenIntro: s.seenIntro,
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  };

  return {
    ...initial,
    layout: 'simple',
    builderOpen: false,
    builderDraft: null,
    settingsOpen: false,
    publishChooserOpen: false,
    showroomOpen: false,
    inspectId: null,
    audioOn: true,
    hiContrast: false,

    setLayout: (layout) => set({ layout }),

    openBuilder: (existing) => {
      const draft: EngineConfig = existing ? JSON.parse(JSON.stringify(existing)) : {
        name: 'Untitled Engine',
        description: '',
        layout: 'inline', cylinders: 4, bankAngleDeg: 0,
        boreMm: 86, strokeMm: 86, compression: 10.5,
        firingOrder: [1, 3, 4, 2],
        cam: { profile: 'street', intakeCenterDeg: 106, durationDeg: 232 },
        ignition: { system: 'cop', revLimit: 7000 },
        fuel: { injection: 'mpi', fuelType: 'premium', targetAfr: 13.4, injectorFlow: 440 },
        induction: { type: 'na', boostPsi: 0 },
        exhaust: 'header',
        drivetrain: { gearRatios: [3.55, 2.05, 1.36, 1.03, 0.78], finalDrive: 3.9, wheelRadiusM: 0.31 },
      } as EngineConfig;
      set({ builderOpen: true, builderDraft: draft });
    },
    closeBuilder: () => set({ builderOpen: false, builderDraft: null }),
    updateDraft: (cfg) => set({ builderDraft: cfg }),

    saveEngineFromBuilder: (cfg, existingId) => {
      const spec = resolveSpec(cfg);
      const est = estimatePeak(spec);
      const eng: SavedEngine = {
        id: existingId ?? 'eng-' + uid(),
        config: JSON.parse(JSON.stringify(cfg)),
        tune: defaultTune(spec),
        cost: buildCost(cfg),
        peakHp: est.hp, peakNm: est.nm,
        createdAt: Date.now(),
      };
      const engines = existingId
        ? get().engines.map((e) => (e.id === existingId ? { ...eng, id: existingId, tune: e.tune } : e))
        : [...get().engines.filter((e) => !e.locked), eng, ...get().engines.filter((e) => e.locked)];
      set({ engines, selectedId: eng.id, builderOpen: false, builderDraft: null });
      save();
      // hot-load into sim
      sim.loadEngine(eng.id, spec, eng.tune);
      return eng;
    },

    deleteEngine: (id) => {
      if (id.startsWith('eng-eng') || PRESETS.some((p) => 'eng-' + p.id === id)) return; // presets stay
      const engines = get().engines.filter((e) => e.id !== id);
      const selectedId = get().selectedId === id ? 'eng-g10' : get().selectedId;
      set({ engines, selectedId });
      save();
    },

    selectEngine: (id) => {
      const eng = get().engines.find((e) => e.id === id);
      if (!eng || eng.locked) return;
      set({ selectedId: id });
      sim.loadEngine(eng.id, resolveSpec(eng.config), eng.tune);
      save();
    },

    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setPublishChooser: (publishChooserOpen) => set({ publishChooserOpen }),
    setShowroom: (showroomOpen) => set({ showroomOpen }),
    setInspect: (inspectId) => set({ inspectId }),
    setAudio: (audioOn) => { set({ audioOn }); sim.audioOn = audioOn; },
    setHiContrast: (hiContrast) => set({ hiContrast }),

    addCoins: (n) => { set({ coins: Math.max(0, get().coins + n) }); save(); },

    unlockPreset: (pid) => {
      const p = presetSummaries().find((x) => x.def.id === pid);
      if (!p || get().unlocked.includes(pid) || get().coins < p.def.unlockCost) return false;
      const engines = get().engines.map((e) =>
        e.presetId === pid ? { ...e, locked: false } : e,
      );
      set({ coins: get().coins - p.def.unlockCost, unlocked: [...get().unlocked, pid], engines });
      save();
      return true;
    },

    publishEngine: (engineId) => {
      const eng = get().engines.find((e) => e.id === engineId);
      if (!eng || eng.locked) return null;
      const spec = resolveSpec(eng.config);
      const pub: PublishedEngine = {
        id: 'pub-' + uid(),
        name: eng.config.name,
        author: 'HALLOW',
        config: eng.config,
        displacementL: spec.displacementL,
        cylinders: spec.cylinders,
        layout: spec.layout,
        peakHp: sim.dynoData && sim.engineId === engineId ? sim.dynoData.peakHp : eng.peakHp,
        peakNm: sim.dynoData && sim.engineId === engineId ? sim.dynoData.peakNm : eng.peakNm,
        cost: eng.cost,
        mine: true,
        createdAt: Date.now(),
        hue: 28,
      };
      set({ myPublishes: [pub, ...get().myPublishes], publishChooserOpen: false });
      save();
      return pub;
    },

    importPublished: (p) => {
      const spec = resolveSpec(p.config);
      const eng: SavedEngine = {
        id: 'eng-' + uid(),
        config: JSON.parse(JSON.stringify(p.config)),
        tune: defaultTune(spec),
        cost: p.cost,
        peakHp: p.peakHp,
        peakNm: p.peakNm,
        createdAt: Date.now(),
      };
      set({ engines: [...get().engines.filter((e) => !e.locked), eng, ...get().engines.filter((e) => e.locked)], selectedId: eng.id });
      sim.loadEngine(eng.id, spec, eng.tune);
      save();
    },

    resetAll: () => {
      localStorage.removeItem(LS_KEY);
      location.reload();
    },
  };
});

// Boot the sim with the selected engine
export function bootSim() {
  const s = useApp.getState();
  const eng = s.engines.find((e) => e.id === s.selectedId) ?? s.engines[0];
  const spec = resolveSpec(eng.config);
  sim.loadEngine(eng.id, spec, eng.tune);
  sim.audioOn = s.audioOn;
  sim.bests = s.bests;
  sim.onLaunchDone = (ms) => {
    useApp.setState({ bests: { ...sim.bests } });
    s.addCoins(120);
  };
  sim.onDynoDone = () => {
    const st = useApp.getState();
    st.addCoins(180);
    if (sim.dynoData) {
      // update engine's stored peak numbers
      const engines = st.engines.map((e) =>
        e.id === sim.engineId ? { ...e, peakHp: sim.dynoData!.peakHp, peakNm: sim.dynoData!.peakNm } : e,
      );
      useApp.setState({ engines });
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          engines, selectedId: st.selectedId, unlocked: st.unlocked,
          coins: st.coins, myPublishes: st.myPublishes, bests: st.bests, seenIntro: st.seenIntro,
        }));
      } catch { /* ignore */ }
    }
  };
}

// persist tune edits from Tuner layout
export function saveTuneForCurrentEngine(tune: SavedTune) {
  const st = useApp.getState();
  const engines = st.engines.map((e) => (e.id === st.selectedId ? { ...e, tune } : e));
  useApp.setState({ engines });
  try { localStorage.setItem(LS_KEY, JSON.stringify({
    engines, selectedId: st.selectedId, unlocked: st.unlocked,
    coins: st.coins, myPublishes: st.myPublishes, bests: st.bests, seenIntro: st.seenIntro,
  })); } catch { /* ignore */ }
}

export { presetSummaries, PRESETS };
