// ── scales.ts: gauge ranges that adapt to the active engine ────────────────
import { EngineSpec } from './types';

export function rpmScale(limiter: number) {
  const nice = [5500, 6000, 6500, 7000, 7500, 8000, 9000, 10000, 11000, 12000, 13000];
  const max = nice.find((n) => n >= limiter + 300) ?? 13000;
  const steps = [1000, 1500, 2000, 2500, 3000];
  const step = steps.find((st) => max / st <= 9) ?? 3000;
  const ticks: number[] = [0];
  for (let v = step; v <= max; v += step) ticks.push(v);
  return { max, ticks, minors: step >= 2000 ? 4 : 3 };
}

export function rpmZones(spec: EngineSpec) {
  const red = spec.redline;
  return [
    { from: Math.max(0, red - 900), to: red + 200, color: '#ff8d2e' },
    { from: red + 200, to: spec.limiter + 600, color: '#e5484d' },
  ];
}

export function mapScale(boostPsi: number) {
  const posMax = boostPsi > 0 ? Math.max(10, Math.ceil((boostPsi * 2.036 + 6) / 10) * 10) : 15;
  const max = posMax;
  const ticks: number[] = [-30, -15];
  ticks.push(0);
  for (let v = Math.min(15, max); v <= max; v += Math.min(15, max)) ticks.push(v);
  // dedupe + sort
  const t = [...new Set(ticks)].sort((a, b) => a - b);
  return { min: -30, max, ticks: t };
}
