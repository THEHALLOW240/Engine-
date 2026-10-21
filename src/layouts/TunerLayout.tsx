// ── TunerLayout.tsx: ignition/fuel map editor + analysis charts ─────────────
import React, { useEffect, useMemo, useState } from 'react';
import { sim } from '../sim/core';
import { LOAD_ROWS, RPM_COLS } from '../sim/types';
import { defaultTune } from '../sim/spec';
import { resolveSpec, mbtLookup } from '../sim/spec';
import { saveTuneForCurrentEngine, useApp } from '../state/store';
import { Gauge } from '../components/Gauge';
import { DynoPowerChart, SparkChart, CylPressureChart, PVDiagramChart } from '../components/Chart';
import { mapScale } from '../sim/scales';

type Mode = 'ignition' | 'fuel';

export function TunerLayout() {
  const mapS = mapScale(sim.spec ? sim.spec.induction.boostPsi : 0);
  const [mode, setMode] = useState<Mode>('ignition');
  const [sel, setSel] = useState<[number, number]>([LOAD_ROWS.length - 1, 0]);
  const [, force] = useState(0);
  const [painting, setPainting] = useState(false);
  const engines = useApp((s) => s.engines);
  const selectedId = useApp((s) => s.selectedId);

  useEffect(() => sim.subscribe(() => force((v) => v + 1)), []);

  const map = useMemo(() => {
    if (!sim.tune) return [];
    return mode === 'ignition' ? sim.tune.spark : sim.tune.fuel;
  }, [mode, sim.tune, engines, selectedId]);

  const mutate = (fn: (m: number[][]) => void) => {
    if (!sim.tune) return;
    const m = mode === 'ignition' ? sim.tune.spark : sim.tune.fuel;
    fn(m);
    sim.emit();
    saveTuneForCurrentEngine(JSON.parse(JSON.stringify(sim.tune)));
  };

  const paint = (delta: number) => mutate((m) => {
    const [r, c] = sel;
    m[r][c] = round1(clampv(m[r][c] + delta, mode === 'ignition' ? -10 : 8, mode === 'ignition' ? 45 : 19));
  });
  const allMap = (delta: number) => mutate((m) => {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      m[r][c] = round1(clampv(m[r][c] + delta, mode === 'ignition' ? -10 : 8, mode === 'ignition' ? 45 : 19));
    }
  });
  const smooth = () => mutate((m) => {
    const src = m.map((row) => [...row]);
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      let sum = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < m.length && cc >= 0 && cc < m[r].length) { sum += src[rr][cc]; n++; }
      }
      m[r][c] = round1(sum / n);
    }
  });
  const bad = () => mutate((m) => {
    // deliberately rough map: random ±9° — test the knock detector!
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      m[r][c] = round1(clampv(m[r][c] + (Math.random() - 0.35) * 12, mode === 'ignition' ? -10 : 8, mode === 'ignition' ? 45 : 19));
    }
  });
  const reset = () => {
    const fresh = defaultTune(resolveSpec(sim.spec));
    sim.tune.spark = fresh.spark;
    sim.tune.fuel = fresh.fuel;
    sim.emit();
    saveTuneForCurrentEngine(JSON.parse(JSON.stringify(sim.tune)));
  };

  const cellColor = (v: number, r: number, c: number): string => {
    if (!sim.spec) return '#43b45e';
    if (mode === 'ignition') {
      const mbt = sim.spec.mbt[r * RPM_COLS.length + c];
      const dev = Math.abs(v - mbt);
      if (v > mbt + 6) return '#e07b39';     // over-advanced — knock country
      if (dev < 1.5) return '#43b45e';
      if (dev < 4) return '#58b968';
      if (dev < 8) return '#8fc256';
      return '#c9b84a';
    }
    const lean = v - sim.spec.fuel.targetAfr;
    if (Math.abs(lean) < 0.4) return '#43b45e';
    if (lean > 0) return lean > 1.5 ? '#c9a44a' : '#8fc256';
    return lean < -1.5 ? '#4aa5c9' : '#54b98f';
  };

  const [r, c] = sel;
  const selVal = map?.[r]?.[c] ?? 0;
  const mbtHere = sim.spec ? mbtLookup(sim.spec, LOAD_ROWS[r], RPM_COLS[c]) : 0;

  return (
    <div className="grid-tuner layout-view">
      {/* ── the map ── */}
      <div className="panel-card map">
        <div className="panel-title">{mode === 'ignition' ? 'IGNITION MAP — SPARK ADVANCE (°BTDC)' : 'FUEL MAP — TARGET AFR'}</div>
        <div className="map-wrap">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="map-axis">LOAD kPa</span>
            <span className="map-axis" style={{ marginLeft: 'auto' }}>
              {mode === 'ignition' ? `CELL ${fmtv(selVal)}° · MBT ${fmtv(mbtHere)}°` : `CELL ${fmtv(selVal)} AFR`}
            </span>
          </div>
          <div style={{ display: 'flex', flex: 1, minHeight: 0, marginTop: 6 }}>
            <div className="map-rows" style={{ width: 38 }}>
              {[...LOAD_ROWS].reverse().map((ld) => <div key={ld}>{ld}</div>)}
            </div>
            <div
              className="map-grid"
              style={{
                gridTemplateRows: `repeat(${LOAD_ROWS.length}, 1fr)`,
                gridTemplateColumns: `repeat(${RPM_COLS.length}, 1fr)`,
              }}
              onPointerLeave={() => setPainting(false)}
            >
              {[...LOAD_ROWS].reverse().map((ld) => {
                const ri = LOAD_ROWS.indexOf(ld);
                return RPM_COLS.map((rpm, ci) => {
                  const v = map?.[ri]?.[ci] ?? 0;
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={`map-cell ${sel[0] === ri && sel[1] === ci ? 'sel' : ''} ${v < 0 ? 'negative' : ''}`}
                      style={{ background: cellColor(v, ri, ci) }}
                      onPointerDown={(e) => { setSel([ri, ci]); setPainting(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
                      onPointerEnter={() => { if (painting) setSel([ri, ci]); }}
                      onPointerUp={() => setPainting(false)}
                      onDoubleClick={() => paint(mode === 'ignition' ? 0.5 : -0.1)}
                      title={`${ld} kPa @ ${rpm} rpm: ${fmtv(v)}${mode === 'ignition' ? '°' : ' AFR'}`}
                    >
                      {mode === 'ignition' ? fmtv(v) : v.toFixed(1)}
                    </div>
                  );
                });
              })}
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 38 }} />
            <div className="map-cols" style={{ flex: 1, gridTemplateColumns: `repeat(${RPM_COLS.length}, 1fr)` }}>
              {RPM_COLS.map((v2) => <div key={v2}>{v2 >= 1000 ? (v2 / 1000).toFixed(1) + 'k' : v2}</div>)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }} className="map-axis">RPM</div>
        </div>
      </div>

      <DynoPowerChart onStart={() => sim.startDyno()} />
      <SparkChart />
      <CylPressureChart />
      <PVDiagramChart />

      {/* ── tuner controls ── */}
      <div className="panel-card tunecontrols">
        <div className="tune-controls">
          <span className="tc-label">PAINT CELLS</span>
          <button className="tc-btn" onClick={() => paint(mode === 'ignition' ? -5 : -1)}>{mode === 'ignition' ? '-5.0°' : '-1.0'}</button>
          <button className="tc-btn" onClick={() => paint(mode === 'ignition' ? -0.5 : -0.1)}>{mode === 'ignition' ? '-0.5°' : '-0.1'}</button>
          <button className="tc-btn" onClick={() => paint(mode === 'ignition' ? 0.5 : 0.1)}>{mode === 'ignition' ? '+0.5°' : '+0.1'}</button>
          <button className="tc-btn" onClick={() => paint(mode === 'ignition' ? 5 : 1)}>{mode === 'ignition' ? '+5.0°' : '+1.0'}</button>
          <div className="tc-divider" />
          <span className="tc-label">WHOLE MAP</span>
          <button className="tc-btn" onClick={() => allMap(mode === 'ignition' ? -1 : -0.2)}>-ALL</button>
          <button className="tc-btn" onClick={() => allMap(mode === 'ignition' ? 1 : 0.2)}>+ALL</button>
          <button className="tc-btn" onClick={smooth}>SMOOTH</button>
          <button className="tc-btn bad" onClick={bad}>BAD</button>
          <button className="tc-btn" onClick={reset}>RESET</button>
          <div className="tc-divider" />
          <button
            className={`tc-btn ${mode === 'ignition' ? 'blue' : ''}`}
            onClick={() => setMode('ignition')}
          >
            IGNITION
          </button>
          <button
            className={`tc-btn ${mode === 'fuel' ? 'blue' : ''}`}
            onClick={() => setMode('fuel')}
          >
            FUEL
          </button>
          <div className="tc-spacer" />
          <div className="tc-status">
            <span className="live"><i />ENGINE {sim.running ? 'ON' : 'OFF'}</span>
            <span>SPARK TIMING…</span>
          </div>
        </div>
      </div>

      {/* ── bottom gauges ── */}
      <div className="panel-card gauge-panel">
        <Gauge
          value={() => sim.afr} min={0} max={45}
          ticks={[0, 15, 30, 45]}
          label="INTAKE AFR" unit="" unitColor="#9dc3ff" needleColor="#e8e8ea"
          zones={[{ from: 10, to: 16, color: '#e8e8ea' }, { from: 15.5, to: 18, color: '#ff8d2e' }, { from: 18, to: 22, color: '#e5484d' }]}
          minorTicks={5} digits={0}
          startAngle={200} sweep={160}
        />
        <div className="gauge-label">INTAKE AFR</div>
      </div>
      <div className="panel-card gauge-panel">
        <Gauge
          value={() => sim.manifoldInHg} min={mapS.min} max={mapS.max}
          ticks={mapS.ticks}
          label="MANIFOLD PRESSURE" unit="inHg" unitColor="#9dc3ff" needleColor="#9dc3ff"
          zones={[{ from: -28, to: -12, color: '#2c6fd6' }, { from: mapS.max * 0.6, to: mapS.max, color: '#ff8d2e' }]}
          minorTicks={4} digits={0}
          startAngle={200} sweep={200}
        />
        <div className="gauge-label">MANIFOLD PRESSURE</div>
      </div>
    </div>
  );
}

function fmtv(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}
function round1(v: number) { return Math.round(v * 10) / 10; }
function clampv(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
