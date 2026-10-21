// ── DiagnosticLayout.tsx: X-ray engine, health gauges, switches, OBD-II ────
import React, { useEffect, useState } from 'react';
import { sim } from '../sim/core';
import { Engine3D } from '../components/Engine3D';
import { Gauge } from '../components/Gauge';
import { useApp } from '../state/store';

export function DiagnosticLayout() {
  const [, force] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const addCoins = useApp((s) => s.addCoins);
  const coins = useApp((s) => s.coins);

  useEffect(() => sim.subscribe(() => force((v) => v + 1)), []);

  const runScan = () => {
    setScanning(true);
    setScanned(false);
    setTimeout(() => { setScanning(false); setScanned(true); }, 2600);
  };

  const health = sim.health;
  const codes = sim.codes;

  return (
    <div className="grid-diagnostic layout-view">
      <Engine3D className="v3d" wireframe black label="X-RAY VIEW" />

      {/* ignition kill switches */}
      <div className="panel-card ignbank ignbank-panel">
        <span className="tb-label" style={{ padding: '4px 2px' }}>IGNITION</span>
        {sim.spec && Array.from({ length: sim.spec.cylinders }, (_, i) => (
          <div className="sw-row" key={i}>
            <button
              className={`pwr-switch ${sim.cylEnabled[i] ? 'on' : ''}`}
              onClick={() => sim.toggleCyl(i)}
            >
              <span className="state-on">ON</span>
              <span className="state-off">OFF</span>
              <span className="status-dot" />
            </button>
            <span className="sw-label">CYL {i + 1}</span>
          </div>
        ))}
      </div>

      {/* health */}
      <div className="panel-card health health-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="health-title">ENGINE HEALTH</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: health > 70 ? '#22e07a' : health > 35 ? '#ffd23d' : '#e5484d' }}>
            {Math.round(health)}%
          </span>
          <div style={{ flex: 1, height: 6, background: '#1b1b21', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${health}%`, height: '100%',
              background: health > 70 ? '#22e07a' : health > 35 ? '#ffd23d' : '#e5484d',
              transition: 'width 0.4s',
            }} />
          </div>
        </div>
        <div className="health-gauges">
          <div>
            <Gauge
              value={() => sim.coolantC} min={0} max={130}
              ticks={[0, 68, 87, 120]}
              label="" unit="°C" unitColor="#9dc3ff" needleColor="#e8e8ea"
              zones={[
                { from: 66, to: 87, color: '#22e07a' },
                { from: 87, to: 110, color: '#22e07a' },
                { from: 110, to: 130, color: '#e5484d' },
              ]}
              minorTicks={4} digits={0} startAngle={200} sweep={220}
            />
            <div className="gauge-label" style={{ textAlign: 'center' }}>COOLANT</div>
          </div>
          <div>
            <Gauge
              value={() => sim.oilC} min={0} max={150}
              ticks={[0, 80, 150]}
              label="" unit="°C" unitColor="#9dc3ff" needleColor="#e8e8ea"
              zones={[{ from: 75, to: 105, color: '#22e07a' }, { from: 120, to: 150, color: '#e5484d' }]}
              minorTicks={4} digits={0} startAngle={200} sweep={220}
            />
            <div className="gauge-label" style={{ textAlign: 'center' }}>OIL TEMP</div>
          </div>
          <div>
            <Gauge
              value={() => sim.oilPressure} min={0} max={80}
              ticks={[0, 60, 80]}
              label="" unit="psi" unitColor="#9dc3ff" needleColor="#e8e8ea"
              zones={[{ from: 0, to: 12, color: '#e5484d' }, { from: 15, to: 62, color: '#22e07a' }]}
              minorTicks={4} digits={0} startAngle={200} sweep={220}
            />
            <div className="gauge-label" style={{ textAlign: 'center' }}>OIL PRESS</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div className="sw-row">
            <button className={`pwr-switch ${sim.coolantPump ? 'on' : ''}`} onClick={() => { sim.coolantPump = !sim.coolantPump; sim.emit(); }}>
              <span className="state-on">ON</span><span className="state-off">OFF</span><span className="status-dot" />
            </button>
            <span className="sw-label">COOLANT PUMP</span>
          </div>
          <div className="sw-row">
            <button className={`pwr-switch ${sim.oilPump ? 'on' : ''}`} onClick={() => { sim.oilPump = !sim.oilPump; sim.emit(); }}>
              <span className="state-on">ON</span><span className="state-off">OFF</span><span className="status-dot" />
            </button>
            <span className="sw-label">OIL PUMP</span>
          </div>
          <div className="sw-row">
            <button
              className="pwr-switch"
              disabled={coins < 150}
              onClick={() => {
                if (coins >= 150) { addCoins(-150); sim.repair(); }
              }}
              title={coins < 150 ? 'Need 150 coins' : 'Full rebuild — 150 coins'}
            >
              <span style={{ fontSize: 17 }}>🛠</span>
              <span className="status-dot" />
            </button>
            <span className="sw-label">REPAIR<br />-150¢</span>
          </div>
        </div>
      </div>

      {/* OBD-II */}
      <div className="panel-card obd obd-panel">
        <div className="obd-head">
          <span className="obd-title"><i />OBD-II SCAN</span>
          <span className={`obd-status ${codes.length === 0 ? 'ok' : 'bad'}`}>
            {codes.length === 0 ? 'NO CODES' : `${codes.length} CODE${codes.length > 1 ? 'S' : ''}`}
          </span>
          <button className="btn mini obd-clear" onClick={() => sim.clearCodes()}>CLEAR CODES</button>
          <button className="btn mini obd-clear" onClick={runScan} disabled={scanning}>
            {scanning ? 'SCANNING…' : 'SCAN'}
          </button>
        </div>
        <div className="obd-screen">
          {scanning ? (
            <div className="obd-scanning">
              <div className="big">SCANNING ECU…</div>
              <div className="sub">READING FREEZE FRAMES</div>
            </div>
          ) : codes.length === 0 ? (
            <>
              <div className="big">NO ACTIVE CODES</div>
              <div className="sub">SYSTEM NOMINAL</div>
            </>
          ) : (
            <>
              {codes.map((cd) => (
                <div key={cd.code} className={`code-line ${cd.severity}`}>
                  {cd.code} — {cd.desc}
                </div>
              ))}
              <div className="sub">MODE $03 — {codes.length} STORED</div>
            </>
          )}
          {scanned && !scanning && (
            <div className="sub" style={{ marginTop: 10, opacity: 0.6 }}>SCAN COMPLETE — {new Date().toLocaleTimeString()}</div>
          )}
        </div>
      </div>
    </div>
  );
}
