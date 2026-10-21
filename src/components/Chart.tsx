// ── Chart.tsx: canvas line charts for dyno curves & live traces ─────────────
import React, { useEffect, useRef } from 'react';
import { sim } from '../sim/core';
import { LOAD_ROWS, RPM_COLS } from '../sim/types';
import { mbtLookup } from '../sim/spec';

export interface Series {
  name: string;
  color: string;
  data: () => Array<[number, number]>;
}

interface ChartProps {
  title: string;
  xLabel: string;
  yLabel: string;
  y2Label?: string;
  series: Series[];
  xMin?: number; xMax?: number;
  yMin: number | (() => number); yMax: number | (() => number);
  y2Min?: number; y2Max?: number;
  onOverlayClick?: () => void;
  overlay?: { text: string; active: () => boolean } | null;
  className?: string;
  xMaxFn?: () => number;
}

export function Chart(p: ChartProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth, h = parent.clientHeight;
      if (w < 40 || h < 40) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const padL = 30, padR = p.y2Label ? 34 : 12, padT = 20, padB = 24;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const yMin = typeof p.yMin === 'function' ? p.yMin() : p.yMin;
      const yMax = typeof p.yMax === 'function' ? p.yMax() : p.yMax;

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH * i) / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      }
      for (let i = 0; i <= 5; i++) {
        const x = padL + (plotW * i) / 5;
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
      }

      // y labels
      ctx.fillStyle = '#8b8b95';
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const v = yMax - (i / 4) * (yMax - yMin);
        ctx.fillText(fmt(v), padL - 5, padT + (plotH * i) / 4);
      }
      if (p.y2Label && p.y2Min !== undefined && p.y2Max !== undefined) {
        ctx.textAlign = 'left';
        for (let i = 0; i <= 4; i++) {
          const v = p.y2Max - (i / 4) * (p.y2Max - p.y2Min);
          ctx.fillText(fmt(v), w - padR + 5, padT + (plotH * i) / 4);
        }
      }

      // axis captions
      ctx.fillStyle = '#63636d';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '700 9.5px Inter, system-ui, sans-serif';
      ctx.fillText(p.yLabel, 2, 12);
      if (p.y2Label) {
        ctx.textAlign = 'right';
        ctx.fillText(p.y2Label, w - 2, 12);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = '#63636d';
      ctx.fillText(p.xLabel, w - padR, h - 4);

      // legend
      let lx = padL + 6;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      p.series.forEach((s) => {
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(lx + 4, 12, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c6c6ce';
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.fillText(s.name, lx + 11, 12);
        lx += 11 + ctx.measureText(s.name).width + 16;
      });

      // series
      const xMin = p.xMin ?? autoMin(p.series[0], 0);
      const xMax = p.xMaxFn ? p.xMaxFn() : p.xMax ?? autoMax(p.series[0], 1);
      p.series.forEach((s, si) => {
        const data = s.data();
        if (data.length < 2) return;
        const useY2 = si === 1 && p.y2Label;
        const sYMin = useY2 ? p.y2Min! : yMin;
        const sYMax = useY2 ? p.y2Max! : yMax;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        data.forEach(([xv, yv], i) => {
          const x = padL + ((xv - xMin) / (xMax - xMin || 1)) * plotW;
          const y = padT + plotH - ((yv - sYMin) / (sYMax - sYMin || 1)) * plotH;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayActive = p.overlay ? p.overlay.active() : false;

  return (
    <div className={`panel-card ${p.className ?? ''}`}>
      <div className="panel-title">{p.title}</div>
      <div className="chart-wrap">
        <canvas ref={ref} />
        {p.overlay && (
          <Overlay p={p} />
        )}
      </div>
    </div>
  );
}

function Overlay({ p }: { p: ChartProps }) {
  // force re-render at low rate so overlay visibility tracks sim
  return <OverlayInner p={p} />;
}

function OverlayInner({ p }: { p: ChartProps }) {
  const [, setTick] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);
  if (!p.overlay) return null;
  const active = p.overlay.active();
  if (!active) return null;
  return (
    <div className="chart-overlay">
      <button
        className={`pill ${sim.dynoActive ? 'running' : ''}`}
        onClick={p.onOverlayClick}
      >
        {sim.dynoActive ? `DYNO RUN ${Math.round(sim.rpm)} RPM` : p.overlay.text}
      </button>
    </div>
  );
}

function autoMin(s: Series, fallback: number): number {
  const d = s?.data();
  if (!d?.length) return fallback;
  return Math.min(...d.map(([x]) => x));
}
function autoMax(s: Series, fallback: number): number {
  const d = s?.data();
  if (!d?.length) return fallback;
  return Math.max(...d.map(([x]) => x));
}
function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return v.toFixed(1);
}

// ── composite dyno chart used by Cockpit + Tuner ────────────────────────────
export function DynoPowerChart({ onStart, showOverlay = true, className = '' }: { onStart: () => void; showOverlay?: boolean; className?: string }) {
  return (
    <Chart
      className={className}
      title="DYNO — POWER & TORQUE"
      xLabel="RPM / Nm, hp"
      yLabel="Nm"
      y2Label="hp"
      yMin={0} yMax={() => Math.max(80, (sim.dynoData?.peakNm ?? 100) * 1.25)}
      y2Min={0} y2Max={Math.max(60, (sim.dynoData?.peakHp ?? 80) * 1.25)}
      xMin={0}
      xMaxFn={() => (sim.spec ? Math.ceil(sim.spec.limiter / 1000) * 1000 : 7000)}
      series={[
        { name: 'Torque', color: '#ff8d2e', data: () => (sim.dynoData ? sim.dynoData.rpm.map((r, i) => [r, sim.dynoData!.torque[i]] as [number, number]) : []) },
        { name: 'Power', color: '#ff4d6d', data: () => (sim.dynoData ? sim.dynoData.rpm.map((r, i) => [r, sim.dynoData!.power[i] * 1.341] as [number, number]) : []) },
      ]}
      overlay={showOverlay ? { text: 'TAP TO START DYNO', active: () => !sim.dynoData || sim.dynoActive } : null}
      onOverlayClick={onStart}
    />
  );
}

export function FlowChart({ className = '' }: { className?: string }) {
  return (
    <Chart
      className={className}
      title="AIR FLOW"
      xLabel="Cycle / SCFM"
      yLabel="Exh"
      y2Label="Intake"
      yMin={-10} yMax={6} y2Min={-10} y2Max={6}
      xMin={0}
      xMaxFn={() => (sim.spec ? Math.ceil(sim.spec.limiter / 1000) * 1000 : 7000)}
      series={[
        { name: 'Exhaust Flow', color: '#ff8d2e', data: () => (sim.dynoData ? sim.dynoData.rpm.map((r, i) => [r, sim.dynoData!.exhaustFlow[i] - 2] as [number, number]) : []) },
        { name: 'Intake Flow', color: '#9dc3ff', data: () => (sim.dynoData ? sim.dynoData.rpm.map((r, i) => [r, sim.dynoData!.intakeFlow[i] - 2] as [number, number]) : []) },
      ]}
    />
  );
}

export function SparkChart() {
  return (
    <Chart
      title="SPARK ADVANCE"
      xLabel="RPM / deg"
      yLabel="deg"
      yMin={0} yMax={40}
      xMin={0} xMax={7000}
      series={[
        {
          name: 'Spark Advance', color: '#ff8d2e',
          data: () => {
            if (!sim.spec || !sim.tune) return [];
            return RPM_COLS.map((r) => [r, sim.tune.spark[LOAD_ROWS.length - 1][RPM_COLS.indexOf(r)]] as [number, number]);
          },
        },
        {
          name: 'MBT', color: '#3b8cff',
          data: () => (sim.spec ? RPM_COLS.map((r) => [r, mbtLookup(sim.spec, 100, r)] as [number, number]) : []),
        },
      ]}
    />
  );
}

export function CylPressureChart() {
  return (
    <Chart
      title="CYLINDER PRESSURE"
      xLabel="Cycle / sqrt(PSI)"
      yLabel="PSI"
      yMin={-10} yMax={220}
      xMin={0} xMax={720}
      series={[
        {
          name: 'Cylinder Pressure', color: '#ff8d2e',
          data: () => pressureTrace(),
        },
      ]}
    />
  );
}

export function PVDiagramChart() {
  return (
    <Chart
      title="P-V DIAGRAM"
      xLabel="L / sqrt(PSI)"
      yLabel="PSI"
      yMin={-10} yMax={220}
      xMin={0} xMax={1.1}
      series={[
        { name: 'P-V Diagram', color: '#ff8d2e', data: () => pvLoop() },
      ]}
    />
  );
}

// polytropic compression + combustion bump trace for current conditions
function pressureTrace(): Array<[number, number]> {
  if (!sim.spec) return [];
  const CR = sim.spec.compression;
  const pts: Array<[number, number]> = [];
  for (let a = 0; a <= 720; a += 12) {
    // volume ratio vs crank angle (0=TDC firing)
    const th = (a * Math.PI) / 180;
    const eps = 0.28; // r/l
    const vr = 1 + ((CR - 1) / 2) * (1 - Math.cos(th) + (1 / eps) * (1 - Math.sqrt(1 - eps * eps * Math.sin(th) ** 2)));
    let press = 14.7 * Math.max(0.08, (sim.loadKpa / 100)) * Math.pow(Math.max(1, CR / vr), 1.32);
    if (a < 90) press += (sim.running ? sim.torque / Math.max(20, sim.spec.displacementL * 60) : 0) * Math.sin((a / 90) * Math.PI) * 8;
    pts.push([a, Math.min(240, press)]);
  }
  return pts;
}
function pvLoop(): Array<[number, number]> {
  if (!sim.spec) return [];
  const CR = sim.spec.compression;
  const pts: Array<[number, number]> = [];
  for (let a = 540; a <= 540 + 720; a += 10) {
    const aa = a % 720;
    const th = (aa * Math.PI) / 180;
    const eps = 0.28;
    const vr = 1 + ((CR - 1) / 2) * (1 - Math.cos(th) + (1 / eps) * (1 - Math.sqrt(1 - eps * eps * Math.sin(th) ** 2)));
    const vol = 1 / vr;
    let press = 14.7 * Math.max(0.08, sim.loadKpa / 100) * Math.pow(Math.max(1, CR / vr), 1.32);
    const powerPart = aa < 90 ? Math.sin((aa / 90) * Math.PI) * (sim.running ? sim.torque / Math.max(20, sim.spec.displacementL * 60) : 0) * 8 : 0;
    pts.push([vol, Math.min(240, press + powerPart)]);
  }
  return pts;
}
