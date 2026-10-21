// ── Engine3D.tsx: React wrapper over the Three.js EngineRenderer ────────────
import React, { useEffect, useRef } from 'react';
import { EngineRenderer } from '../three/EngineRender';
import { sim } from '../sim/core';
import { resolveSpec } from '../sim/spec';
import { useApp } from '../state/store';

interface Props {
  wireframe?: boolean;
  className?: string;
  label?: string;
  black?: boolean;
}

export function Engine3D({ wireframe = false, className = '', label, black = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendRef = useRef<EngineRenderer | null>(null);
  const hiContrast = useApp((s) => s.hiContrast);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const rend = new EngineRenderer(canvas);
    rendRef.current = rend;
    if (sim.spec) rend.build(resolveSpec(sim.spec));
    rend.setWireframe(wireframe);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      rend.update(dt);
    };
    raf = requestAnimationFrame(loop);

    // rebuild when the sim's engine changes
    let lastId = sim.engineId;
    let lastCyl = sim.spec?.cylinders;
    const unsub = sim.subscribe(() => {
      if (rendRef.current && sim.spec && (sim.engineId !== lastId || sim.spec.cylinders !== lastCyl)) {
        lastId = sim.engineId;
        lastCyl = sim.spec.cylinders;
        rendRef.current.build(resolveSpec(sim.spec));
        rendRef.current.setWireframe(wireframe);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      rend.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  return (
    <div className={`panel-card view3d-wrap ${black ? 'black' : ''} ${className}`} style={{ minHeight: 0 }}>
      {label && <div className="panel-title">{label}</div>}
      <canvas ref={canvasRef} className="engine3d" style={{ opacity: hiContrast ? 1 : 1 }} />
    </div>
  );
}
