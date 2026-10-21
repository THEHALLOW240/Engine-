// ── CockpitLayout.tsx: full driving view — 3 gauges, dyno pair, shifter ────
import React from 'react';
import { Engine3D } from '../components/Engine3D';
import { HPattern } from '../components/HPattern';
import { Gauge } from '../components/Gauge';
import { DynoPowerChart, FlowChart } from '../components/Chart';
import { sim } from '../sim/core';
import { DynoStand } from './bits';
import { rpmScale, rpmZones, mapScale } from '../sim/scales';

export function CockpitLayout() {
  const spec = sim.spec;
  const rpmS = rpmScale(spec ? spec.limiter : 9600);
  const mapS = mapScale(spec ? spec.induction.boostPsi : 0);
  return (
    <div className="grid-cockpit layout-view">
      <Engine3D className="v3d" />

      <div className="panel-card gauge-panel g-rpm">
        <Gauge
          value={() => sim.rpm} min={0} max={rpmS.max}
          ticks={rpmS.ticks}
          label="ENGINE SPEED" unit="rpm" unitColor="#e5484d" needleColor="#e5484d"
          zones={spec ? rpmZones(spec) : []}
          minorTicks={rpmS.minors} digits={0}
        />
        <div className="gauge-label">ENGINE SPEED</div>
      </div>

      <div className="panel-card gauge-panel g-map">
        <Gauge
          value={() => sim.manifoldInHg} min={mapS.min} max={mapS.max}
          ticks={mapS.ticks}
          label="MANIFOLD PRESSURE" unit="inHg" unitColor="#9dc3ff" needleColor="#9dc3ff"
          zones={[
            { from: -28, to: -12, color: '#2c6fd6' },
            { from: mapS.max * 0.6, to: mapS.max, color: '#ff8d2e' },
          ]}
          minorTicks={4} digits={0}
        />
        <div className="gauge-label">MANIFOLD PRESSURE</div>
      </div>

      <div className="panel-card gauge-panel g-speed">
        <Gauge
          value={() => sim.vehicleSpeedMph} min={0} max={195}
          ticks={[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195]}
          label="VEHICLE SPEED" unit="mph" unitColor="#5c9dff" needleColor="#5c9dff"
          minorTicks={1} digits={0}
          startAngle={215} sweep={250}
        />
        <div className="gauge-label">VEHICLE SPEED</div>
      </div>

      <div className="panel-card dyno-bay">
        <div className="panel-title">DYNO BAY</div>
        <DynoStand />
      </div>

      <div className="panel-card hpat">
        <div className="panel-title">SHIFTER</div>
        <HPattern />
      </div>

      <DynoPowerChart className="c-dyno" onStart={() => sim.startDyno()} />
      <FlowChart className="c-flow" />
    </div>
  );
}
