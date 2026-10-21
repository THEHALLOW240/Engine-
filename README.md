# ENGINE SIM

A high-fidelity, dark-themed, real-time **3D engine simulation & tuning** web app.
Build, run, diagnose, tune, race and share virtual internal-combustion engines —
all in the browser, all procedurally generated, no assets to download.

![theme](https://img.shields.io/badge/theme-dark%20neon-0a0a0c) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Three.js%20%2B%20Zustand-3b8cff) ![physics](https://img.shields.io/badge/physics-fixed%20120Hz-ff8d2e)

## Quick start

```bash
npm install
npm run dev        # dev server on :5173
npm run build      # production build → dist/
npm run preview    # serve production build on :3000
npm run typecheck  # tsc --noEmit
```

## What's inside

### Seven layouts
| Layout | Contents |
| --- | --- |
| **Simple** | Live 3D cutaway engine + H-pattern shifter + tach |
| **Cockpit** | 3D engine, RPM / manifold / speed gauges, dyno charts, H-gate |
| **Tuner** | Interactive ignition & fuel map editor (paint cells, whole-map ops, smooth/bad/reset), dyno overlay, spark advance, cylinder pressure, P-V diagram, AFR + manifold gauges |
| **Track** | 20-LED shift light with optimal shift marker, launch timer (0–60 / 0–100 / 60–130) with ARM/RESET and per-engine bests, brake rotor heat view |
| **Diagnostic** | Neon wireframe X-ray engine, health gauges (coolant/oil temp/oil pressure), per-cylinder ignition kills, coolant/oil pump switches, repair, animated OBD-II scanner with live fault codes |
| **Leaderboard** | Global ranking of published engines by power / torque / cost / displacement |
| **Community** | Marketplace with filters (Featured/Newest/Most Power/Most Torque/Cheapest), config chips (I3–V12/F4/F6), inspect modal, one-click *Use This Engine*, and a publish flow for your own builds |

### Engine builder
An 11-step wizard — Identity → Layout → Sizing → Timing → Camshaft → Firing
Order → Ignition·Fuel → Air & Fuel → Induction → Exhaust → Drivetrain — with
live build cost (US$), displacement, estimated power/torque and redline. Every
part choice has real consequences in the physics model and the 3D view (bore,
stroke, cylinder count, firing order, cam profile, turbo/supercharger…).

### Simulation core (`src/sim/`)
- **120 Hz fixed-step physics**: combustion torque from a volumetric-efficiency
  curve × boost curve × spark-efficiency × fuel-efficiency model, crank
  kinematics, driveline with gear ratios & clutch slip, stall detection.
- **Tuning matters**: the 6×9 spark map is compared cell-by-cell against MBT;
  over-advance detonates (P0326), retarding costs power. AFR map feeds fuel
  efficiency and heat.
- **Thermal & wear systems**: coolant/oil temperatures reach realistic
  equilibria; kill a pump and watch OBD codes P0217/P0521 pile up while health
  drains. Limiter bashing, lean conditions and knock all wear the engine.
- **Dyno mode** sweeps RPM under a water-brake and plots measured torque/power
  & air-flow curves; the numbers feed your engine's card and the leaderboard.
- **Launch timer**: ARM, launch, and bank best times per engine per target.

### 3D engine (`src/three/EngineRender.ts`)
Procedurally built from the engine spec: pistons with rings, connecting rods,
crankshaft with counterweights, valves + springs + cam lobes at half-speed,
transparent block, header stubs with heat glow, cooling fan — inline, V and
boxer layouts, 1–12 cylinders. Combustion flashes fire in the real firing
order. Solid and neon wireframe (X-ray) render modes. Drag to orbit, wheel to
zoom; gentle turntable when the engine is off.

### Audio (`src/audio/engineSound.ts`)
Fully procedural Web Audio: an oscillator bank locked to the firing frequency
per cylinder count, cam-lope amplitude modulation, intake/exhaust noise bed,
limiter stutter and starter motor. No samples.

### Progression
Starter engines ship free; showroom engines (EJ257, 2JZ-GTE, Hayabusa, LS3,
RB26DETT) unlock with coins earned from dyno runs (+180) and launches (+120).
Repairs cost 150. Everything persists in `localStorage`.

## Controls

| Input | Action |
| --- | --- |
| `W` / `S` | throttle up / down |
| `E` / `Q` (or ⇧ buttons / H-gate tap) | shift up / down |
| `Enter` (hold) | starter crank |
| `I` | ignition on/off |
| `C` | clutch |
| `B` (hold) | brake |
| `1–7` | switch layouts |
| `M` | mute |

## PWA

Ships with a manifest and a tiny cache-first service worker — add it to your
home screen for an app-like experience on mobile.
