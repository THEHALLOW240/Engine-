// ── HPattern.tsx: interactive H-gate shifter ────────────────────────────────
import React, { useState, useEffect } from 'react';
import { sim } from '../sim/core';

// gear gate positions in a 100x140 viewBox: (col,row) — col 0..2, row 0..1, neutral mid
const GATE = {
  0: { x: 50, y: 70 },   // N center
  1: { x: 22, y: 26 },
  2: { x: 22, y: 114 },
  3: { x: 50, y: 26 },
  4: { x: 50, y: 114 },
  5: { x: 78, y: 26 },
  6: { x: 78, y: 114 },
};

export function HPattern() {
  const [gear, setGear] = useState(sim.gear);

  useEffect(() => {
    return sim.subscribe(() => {
      if (gear !== sim.gear) {
        setGear(sim.gear);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gear]);

  const n = sim.spec?.drivetrain.gearRatios.length ?? 5;
  const cols = n >= 6 ? [22, 50, 78] : n >= 5 ? [22, 50, 78] : [28, 72];
  const pos = GATE[Math.min(gear, 6) as keyof typeof GATE] ?? GATE[0];

  const clickGear = (g: number) => { sim.setGear(g); setGear(g); };

  const slots: React.ReactElement[] = [];
  // vertical rails
  cols.forEach((x) => {
    slots.push(
      <rect key={`v${x}`} x={x - 5.5} y={18} width={11} height={104} rx={5.5} fill="#0a0a0c" stroke="#232328" strokeWidth={1.5}
        style={{ cursor: 'pointer' }} />,
    );
  });
  // cross bar (neutral)
  slots.push(
    <rect key="h" x={cols[0]} y={64.5} width={cols[cols.length - 1] - cols[0]} height={11} rx={5.5} fill="#0a0a0c" stroke="#232328" strokeWidth={1.5} />,
  );

  // clickable gear end positions
  const targets: React.ReactElement[] = [];
  for (let g = 1; g <= n; g++) {
    const p = GATE[Math.min(g, 6) as keyof typeof GATE];
    const x = cols.length === 2 ? (g % 2 === 1 ? 28 : 72) : p.x;
    const y = g % 2 === 1 ? 22 : 118;
    targets.push(
      <text key={`t${g}`} x={x} y={y + 3} textAnchor="middle" fontSize={8.5} fill="#3d3d46" fontWeight={700}
        style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => clickGear(g)}>
        {g}
      </text>,
    );
    targets.push(
      <circle key={`c${g}`} cx={x} cy={y} r={12} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => clickGear(g)} />,
    );
  }
  // neutral center click zone
  targets.push(
    <circle key="n0" cx={50} cy={70} r={14} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => clickGear(0)} />,
  );

  const knobX = gear === 0 ? 50 : cols.length === 2 ? (gear % 2 === 1 ? 28 : 72) : pos.x;
  const knobY = gear === 0 ? 70 : gear % 2 === 1 ? 26 : 114;

  return (
    <div className="hpattern-wrap">
      <svg viewBox="0 0 100 140" style={{ maxWidth: 220 }}>
        <rect x={0} y={0} width={100} height={140} rx={12} fill="#16161a" stroke="#26262c" strokeWidth={1.5} />
        {slots}
        {targets}
        {/* knob */}
        <g style={{ transition: 'transform 0.18s cubic-bezier(.3,1.4,.5,1)' }} transform={`translate(${knobX},${knobY})`}>
          <line x1={0} y1={gear === 0 ? 0 : gear % 2 === 1 ? 10 : -10} x2={0} y2={gear % 2 === 1 ? 26 : gear === 0 ? 0 : -26} stroke="#2c2c33" strokeWidth={7} strokeLinecap="round" />
          <circle r={13.5} fill="#2b2b32" stroke="#4a4a55" strokeWidth={1.5} />
          <circle r={4.5} fill="#b9b9c1" />
        </g>
      </svg>
    </div>
  );
}
