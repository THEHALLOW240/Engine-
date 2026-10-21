// ── TrackLayout.tsx: shift lights, launch timer, speed/rpm gauges ───────────
import React, { useEffect, useRef, useState } from 'react';
import { sim } from '../sim/core';
import { Engine3D } from '../components/Engine3D';
import { HPattern } from '../components/HPattern';
import { Gauge } from '../components/Gauge';
import { BrakeDisc, DynoStand } from './bits';
import { rpmScale, rpmZones } from '../sim/scales';

const LEDS = 20;

export function TrackLayout() {
  const rpmS = rpmScale(sim.spec ? sim.spec.limiter : 9600);
  const [target, setTarget] = useState<number>(60);
  const [, force] = useState(0);
  const ledsRef = useRef<Array<HTMLDivElement | null>>([]);
  const timeRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const metaRpmRef = useRef<HTMLSpanElement>(null);
  const metaGearRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<HTMLSpanElement>(null);

  useEffect(() => sim.subscribe(() => force((v) => v + 1)), []);

  // live LED + timer painting on rAF (bypasses react state for 60fps bits)
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!sim.spec) return;
      const rpm = sim.rpm;
      const optimum = sim.shiftLightRpm;
      const limiter = sim.spec.limiter;
      for (let i = 0; i < LEDS; i++) {
        const el = ledsRef.current[i];
        if (!el) continue;
        const ledRpm = (rpm / limiter) * LEDS;
        const lit = i < ledRpm && rpm > 200;
        const frac = i / (LEDS - 1);
        const ledZone = frac < 0.5 ? 'g' : frac < 0.75 ? 'y' : 'r';
        const colors: Record<string, string> = {
          g: 'rgba(34,224,122,0.95)', y: 'rgba(255,210,61,0.95)', r: 'rgba(229,72,77,0.95)',
        };
        const glows: Record<string, string> = {
          g: '0 0 8px rgba(34,224,122,0.7)', y: '0 0 8px rgba(255,210,61,0.7)', r: '0 0 8px rgba(229,72,77,0.8)',
        };
        const flash = rpm >= optimum && (Math.floor(performance.now() / 90) % 2 === 0);
        el.style.background = lit ? (flash ? '#fff' : colors[ledZone]) : '#181818';
        el.style.boxShadow = lit ? glows[ledZone] : 'none';
      }
      if (timeRef.current) {
        timeRef.current.innerHTML = `<b>${(sim.trackElapsed / 1000).toFixed(2)}</b><small> s</small>`;
      }
      if (speedRef.current) {
        speedRef.current.innerHTML = `<b>${Math.round(sim.vehicleSpeedMph)}</b><small> mph</small>`;
      }
      if (metaRpmRef.current) metaRpmRef.current.textContent = String(Math.round(rpm));
      if (metaGearRef.current) metaGearRef.current.textContent = sim.gear === 0 ? 'N' : String(sim.gear);
      if (stateRef.current) {
        const st = sim.dynoActive ? 'DYNO' : sim.trackRunning ? 'RUNNING' : sim.trackArmed ? 'ARMED' : 'STANDBY';
        if (stateRef.current.textContent !== st) stateRef.current.textContent = st;
        stateRef.current.style.color =
          st === 'RUNNING' ? '#22e07a' : st === 'ARMED' ? '#ffd23d' : st === 'DYNO' ? '#ff8d2e' : '#63636d';
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const best = sim.bests[`${sim.engineId}:${target}`];

  return (
    <div className="grid-track layout-view">
      {/* shift light bar */}
      <div className="panel-card shiftbar shiftlight-panel">
        <div className="shift-meta">
          <span style={{ letterSpacing: 2, fontSize: 10.5, fontWeight: 700 }}>SHIFT LIGHT</span>
          <span style={{ flex: 1 }} />
          <span>RPM <b ref={metaRpmRef}>0</b></span>
          <span>OPTIMAL <b className="opt">{Math.round(sim.shiftLightRpm)}</b></span>
          <span>GEAR <b ref={metaGearRef} style={{ color: '#22e07a' }}>N</b></span>
          <span className="state" ref={stateRef}>STANDBY</span>
        </div>
        <div className="shift-leds">
          {Array.from({ length: LEDS }, (_, i) => (
            <div key={i} ref={(el) => { ledsRef.current[i] = el; }} className="shift-led" />
          ))}
        </div>
      </div>

      {/* launch timer */}
      <div className="panel-card launch launch-panel">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="tb-label">LAUNCH TIMER</span>
          <span className="tb-label" style={{ marginLeft: 'auto', color: sim.trackArmed ? '#22e07a' : '#63636d' }}>
            {sim.trackArmed ? 'READY' : 'IDLE'}
          </span>
        </div>
        <div className="launch-targets">
          {[60, 100, 130].map((t) => (
            <button key={t} className={`launch-tgt ${target === t ? 'sel' : ''}`}
              onClick={() => { setTarget(t); if (sim.trackArmed) sim.armTrack(t); }}>
              {t === 130 ? '60 → 130' : `0 → ${t}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <div ref={timeRef} className="launch-time"><b>0.00</b><small> s</small></div>
          <div ref={speedRef} className="launch-speed"><b>0</b><small> mph</small></div>
        </div>
        <div className="launch-hint">
          {sim.trackFinished ? 'Nice run! RESET to go again.' : 'Pick a target, then ARM.'}
        </div>
        <div className="launch-btns">
          <button className="btn primary" onClick={() => sim.armTrack(target)} disabled={sim.trackArmed && !sim.trackRunning}>
            ARM
          </button>
          <button className="btn" onClick={() => sim.resetTrack()}>RESET</button>
        </div>
        {best !== undefined && (
          <div className="launch-best">BEST {target === 130 ? '60–130' : `0–${target}`}: <b>{(best / 1000).toFixed(2)} s</b></div>
        )}
      </div>

      <Engine3D className="v3d" />

      <div className="panel-card gauge-panel gspeed">
        <Gauge
          value={() => sim.vehicleSpeedMph} min={0} max={195}
          ticks={[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195]}
          label="VEHICLE SPEED" unit="mph" unitColor="#5c9dff" needleColor="#5c9dff"
          minorTicks={1} digits={0} startAngle={215} sweep={250}
        />
        <div className="gauge-label">VEHICLE SPEED</div>
      </div>

      <div className="panel-card gauge-panel grpm">
        <Gauge
          value={() => sim.rpm} min={0} max={rpmS.max}
          ticks={rpmS.ticks}
          label="ENGINE SPEED" unit="rpm" unitColor="#e5484d" needleColor="#e5484d"
          zones={sim.spec ? rpmZones(sim.spec) : []}
          minorTicks={rpmS.minors} digits={0}
        />
        <div className="gauge-label">ENGINE SPEED</div>
      </div>

      <div className="panel-card hpat">
        <div className="panel-title">SHIFTER</div>
        <HPattern />
      </div>
      <div className="panel-card brake">
        <div className="panel-title">BRAKE ROTOR</div>
        <BrakeDisc />
      </div>
      <div className="panel-card stand">
        <div className="panel-title">DYNO BAY</div>
        <DynoStand />
      </div>
    </div>
  );
}
