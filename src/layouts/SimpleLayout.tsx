// ── SimpleLayout.tsx: engine + shifter + tach, nothing else ────────────────
import React from 'react';
import { Engine3D } from '../components/Engine3D';
import { HPattern } from '../components/HPattern';
import { Gauge } from '../components/Gauge';
import { sim } from '../sim/core';
import { rpmScale, rpmZones } from '../sim/scales';

export function SimpleLayout() {
  const spec = sim.spec;
  const { max, ticks, minors } = rpmScale(spec ? spec.limiter : 9600);
  return (
    <div className="grid-simple layout-view">
      <Engine3D className="a" />
      <div className="panel-card">
        <div className="panel-title">SHIFTER</div>
        <HPattern />
      </div>
      <div className="panel-card gauge-panel">
        <div className="panel-title">TACHOMETER</div>
        <Gauge
          value={() => sim.rpm}
          min={0} max={max}
          ticks={ticks}
          label="ENGINE SPEED" unit="rpm" unitColor="#e5484d" needleColor="#e5484d"
          zones={spec ? rpmZones(spec) : []}
          minorTicks={minors} digits={0}
        />
        <div className="gauge-label">ENGINE SPEED</div>
      </div>
    </div>
  );
}
