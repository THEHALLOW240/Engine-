// ── Gauge.tsx: canvas analog gauge with zones, ticks and glowing needle ─────
import React, { useEffect, useRef } from 'react';

export interface GaugeZone { from: number; to: number; color: string; }

interface GaugeProps {
  value: () => number;     // live getter, polled per frame
  min: number;
  max: number;
  ticks: number[];         // labeled major ticks
  label: string;
  unit: string;
  unitColor?: string;
  needleColor?: string;
  zones?: GaugeZone[];     // painted arcs
  startAngle?: number;     // degrees, default 210
  sweep?: number;          // degrees, default 240
  digital?: boolean;       // big center number
  digits?: number;         // decimals on digital display
  size?: number;
  majorEvery?: number;     // how many minor ticks between majors
  minorTicks?: number;     // minors per major
}

export function Gauge(p: GaugeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    let displayed = p.min;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth, h = parent.clientHeight;
      if (w < 20 || h < 20) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const size = Math.min(w, h);
      const cx = w / 2, cy = h / 2 + size * 0.02;
      const R = size * 0.38;
      const a0 = ((p.startAngle ?? 210) - 90) * Math.PI / 180;
      const sweepT = (p.sweep ?? 240) * Math.PI / 180;

      const raw = clamp(p.value(), p.min, p.max);
      // needle smoothing
      displayed += (raw - displayed) * 0.24;

      const vToA = (v: number) => a0 + ((clamp(v, p.min, p.max) - p.min) / (p.max - p.min)) * sweepT;

      // zones
      (p.zones ?? []).forEach((z) => {
        ctx.beginPath();
        ctx.strokeStyle = z.color;
        ctx.lineWidth = size * 0.045;
        ctx.lineCap = 'butt';
        ctx.arc(cx, cy, R + size * 0.01, vToA(z.from), vToA(z.to));
        ctx.stroke();
      });

      // ticks
      const ticks = p.ticks;
      const nMaj = ticks.length;
      const minor = p.minorTicks ?? 4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < nMaj; i++) {
        const a = vToA(ticks[i]);
        const c = Math.cos(a), s = Math.sin(a);
        // major tick
        ctx.strokeStyle = '#d7d7dd';
        ctx.lineWidth = Math.max(1.5, size * 0.008);
        ctx.beginPath();
        ctx.moveTo(cx + c * (R - size * 0.045), cy + s * (R - size * 0.045));
        ctx.lineTo(cx + c * R, cy + s * R);
        ctx.stroke();
        // minor ticks
        if (i < nMaj - 1) {
          for (let m = 1; m < minor; m++) {
            const v = ticks[i] + ((ticks[i + 1] - ticks[i]) * m) / minor;
            const am = vToA(v);
            const cm = Math.cos(am), sm = Math.sin(am);
            ctx.strokeStyle = '#7d7d86';
            ctx.lineWidth = Math.max(1, size * 0.004);
            ctx.beginPath();
            ctx.moveTo(cx + cm * (R - size * 0.028), cy + sm * (R - size * 0.028));
            ctx.lineTo(cx + cm * R, cy + sm * R);
            ctx.stroke();
          }
        }
        // label
        const lr = R - size * 0.115;
        ctx.fillStyle = '#b9b9c1';
        ctx.font = `600 ${Math.max(8, size * 0.052)}px Inter, system-ui, sans-serif`;
        ctx.fillText(formatTick(ticks[i]), cx + c * lr, cy + s * lr);
      }

      // digital reading
      if (p.digital !== false) {
        const dv = p.digits === 0 ? Math.round(displayed) : displayed.toFixed(p.digits ?? 1);
        ctx.fillStyle = '#f2f2f5';
        ctx.font = `800 ${size * 0.17}px Inter, system-ui, sans-serif`;
        ctx.fillText(String(dv), cx, cy + size * 0.1);
        ctx.fillStyle = p.unitColor ?? '#e5484d';
        ctx.font = `italic 700 ${size * 0.058}px Inter, system-ui, sans-serif`;
        ctx.fillText(p.unit, cx, cy + size * 0.185);
      }

      // needle
      const na = vToA(displayed);
      const nc = Math.cos(na), ns = Math.sin(na);
      const needleColor = p.needleColor ?? '#e5484d';
      ctx.save();
      ctx.shadowColor = needleColor;
      ctx.shadowBlur = size * 0.03;
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = Math.max(2, size * 0.014);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - nc * size * 0.055, cy - ns * size * 0.055);
      ctx.lineTo(cx + nc * (R - size * 0.035), cy + ns * (R - size * 0.035));
      ctx.stroke();
      ctx.restore();

      // hub
      ctx.beginPath();
      ctx.fillStyle = '#c9c9cf';
      ctx.arc(cx, cy, size * 0.032, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#1b1b20';
      ctx.arc(cx, cy, size * 0.016, 0, Math.PI * 2);
      ctx.fill();
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K';
  return String(v);
}

// ── preset gauge configurations used across layouts ─────────────────────────
export const RPMGauge = ({ get, size }: { get: () => number; size?: number }) => {
  const redline = 9000;
  return (
    <Gauge
      value={get} min={0} max={redline}
      ticks={[0, 1500, 3000, 4500, 6000, 7500, 9000]}
      label="ENGINE SPEED" unit="rpm" unitColor="#e5484d" needleColor="#e5484d"
      zones={[{ from: 6800, to: 7800, color: '#ff8d2e' }, { from: 7800, to: 9000, color: '#e5484d' }]}
      minorTicks={5} digits={0}
    />
  );
};
