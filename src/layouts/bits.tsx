// ── bits.tsx: small decorative widgets (dyno stand, brake disc…) ────────────
import React, { useEffect, useRef } from 'react';
import { sim } from '../sim/core';

// Stylized intake manifold / dyno rig with a live "hot throat" glow by throttle
export function DynoStand() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth, h = parent.clientHeight;
      if (w < 20 || h < 20) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const s = Math.min(w, h);
      const cx = w / 2;
      const base = h * 0.88;
      const gray = '#2c2c33';
      const light = '#3a3a42';

      // base plate
      ctx.fillStyle = gray;
      round(ctx, cx - s * 0.38, base, s * 0.76, s * 0.06, 4); ctx.fill();
      // three runners
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = i === 0 ? light : gray;
        round(ctx, cx + i * s * 0.17 - s * 0.07, base - s * 0.34, s * 0.14, s * 0.34, 3);
        ctx.fill();
      }
      // plenum
      ctx.fillStyle = light;
      round(ctx, cx - s * 0.26, base - s * 0.44, s * 0.52, s * 0.12, 4); ctx.fill();
      // throttle neck
      ctx.fillStyle = gray;
      round(ctx, cx - s * 0.035, base - s * 0.62, s * 0.07, s * 0.2, 2); ctx.fill();
      // live heat glow in neck
      const g = sim.throttlePos;
      if (g > 0.02) {
        ctx.save();
        ctx.shadowColor = '#ff6a1a';
        ctx.shadowBlur = 12 * g;
        ctx.fillStyle = `rgba(255,${Math.round(120 + 60 * (1 - g))},26,${0.25 + 0.65 * g})`;
        round(ctx, cx - s * 0.028, base - s * 0.6, s * 0.056, s * 0.16, 2);
        ctx.fill();
        ctx.restore();
      }
      // cap
      ctx.fillStyle = light;
      round(ctx, cx - s * 0.05, base - s * 0.66, s * 0.1, s * 0.05, 2); ctx.fill();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

// Brake disc with caliper; heat ring follows brake usage & speed
export function BrakeDisc() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    let heat = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth, h = parent.clientHeight;
      if (w < 20 || h < 20) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      heat += ((sim.brakeHeld && sim.vehicleSpeedMph > 3 ? 1 : 0) - heat) * 0.02;

      const s = Math.min(w, h) * 0.8;
      const cx = w / 2, cy = h / 2;
      const R = s / 2;

      // disc
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#26262c';
      ctx.fill();
      // heat ring
      if (heat > 0.02) {
        ctx.save();
        ctx.shadowColor = '#ff4d2a'; ctx.shadowBlur = 18 * heat;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,${Math.round(90 + 80 * (1 - heat))},42,${0.75 * heat})`;
        ctx.lineWidth = R * 0.3;
        ctx.stroke();
        ctx.restore();
      }
      // vents
      ctx.strokeStyle = '#34343c';
      ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + sim.vehicleSpeed * 0.02;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.62, a, a + 0.12);
        ctx.stroke();
      }
      // drilled holes
      ctx.fillStyle = '#1b1b20';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + sim.vehicleSpeed * 0.02;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * 0.46, cy + Math.sin(a) * R * 0.46, R * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      // hub
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#1f1f25'; ctx.fill();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * 0.13, cy + Math.sin(a) * R * 0.13, R * 0.028, 0, Math.PI * 2);
        ctx.fillStyle = '#3f3f48'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = '#54545e'; ctx.fill();
      // caliper
      ctx.save();
      ctx.translate(cx + R * 0.62, cy - R * 0.78);
      ctx.rotate(0.3);
      ctx.fillStyle = sim.brakeHeld ? '#e5484d' : '#9c2e33';
      round(ctx, -R * 0.1, -R * 0.16, R * 0.2, R * 0.42, R * 0.05);
      ctx.fill();
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
