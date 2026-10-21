// ── TopBar.tsx: persistent control strip (panel/ignition/starter/clutch/…) ──
import React, { useEffect, useRef, useState } from 'react';
import { sim } from '../sim/core';
import { useApp } from '../state/store';
import { engineAudio } from '../audio/engineSound';
import { PanelIcon, ClutchIcon, BrakeIcon, CheckEngineIcon } from './icons';

export function TopBar() {
  const layout = useApp((s) => s.layout);
  const setLayout = useApp((s) => s.setLayout);
  const [, force] = useState(0);
  const throttlePctRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [fault, setFault] = useState(false);

  useEffect(() => {
    const unsubs = sim.subscribe(() => {
      force((v) => v + 1); // cheap: TopBar rerenders ≤12Hz, mirrors sim control states
      setFault(sim.checkLight);
      if (throttlePctRef.current) {
        const pct = Math.round(sim.throttleTarget * 100);
        throttlePctRef.current.textContent = pct + '%';
      }
      if (fillRef.current) fillRef.current.style.width = `${sim.throttleTarget * 100}%`;
      if (handleRef.current) handleRef.current.style.left = `${sim.throttleTarget * 100}%`;
      if (gearRef.current) {
        const g = sim.gear === 0 ? 'N' : String(sim.gear);
        if (gearRef.current.textContent !== g) {
          gearRef.current.textContent = g;
          gearRef.current.className = `gear-value ${sim.gear === 0 ? 'n' : ''}`;
        }
      }
    });
    return unsubs;
  }, []);

  const throttlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const set = (clientX: number) => {
      sim.setThrottle((clientX - rect.left) / rect.width);
    };
    set(e.clientX);
    el.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => set(ev.clientX);
    el.addEventListener('pointermove', mv);
    const up = () => el.removeEventListener('pointermove', mv);
    el.addEventListener('pointerup', up, { once: true });
    el.addEventListener('pointercancel', up, { once: true });
  };

  const crankHold = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      engineAudio.ensure();
      sim.setCrank(true);
    },
    onPointerUp: () => sim.setCrank(false),
    onPointerLeave: () => sim.setCrank(false),
    onPointerCancel: () => sim.setCrank(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  const brakeHold = {
    onPointerDown: () => sim.setBrake(true),
    onPointerUp: () => sim.setBrake(false),
    onPointerLeave: () => sim.setBrake(false),
    onPointerCancel: () => sim.setBrake(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return (
    <header className="topbar">
      <div className="tb-group">
        <button
          className={`tb-btn ${collapsed ? '' : 'ign-on'}`}
          onClick={() => {
            const app = document.querySelector('.app');
            if (!app) return;
            if (window.matchMedia('(max-width: 900px)').matches) {
              app.classList.toggle('drawer-open');
            } else {
              const c = !collapsed;
              setCollapsed(c);
              app.classList.toggle('panel-collapsed', c);
            }
          }}
          title="Toggle panel"
        >
          <PanelIcon />
        </button>
        <span className="tb-label">PANEL</span>
      </div>

      <div className="tb-group">
        <button
          className={`tb-btn ${sim.ignitionOn ? 'ign-on' : ''}`}
          onClick={() => { engineAudio.ensure(); sim.toggleIgnition(); }}
        >
          <span className="stack">
            <span className={sim.ignitionOn ? 'run' : ''}>RUN</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{sim.ignitionOn ? 'ON' : 'OFF'}</span>
          </span>
        </button>
        <span className="tb-label">IGNITION</span>
      </div>

      <div className="tb-group">
        <button className={`tb-btn crank ${sim.cranking ? 'holding' : ''}`} {...crankHold}>
          CRANK
        </button>
        <span className="tb-label">STARTER</span>
      </div>

      <div className="tb-group">
        <button
          className={`tb-btn clutch ${!sim.clutchEngaged ? 'on' : ''}`}
          onClick={() => sim.toggleClutch()}
          title="Clutch (lit = pedal pressed / disengaged)"
        >
          <ClutchIcon />
        </button>
        <span className="tb-label">CLUTCH</span>
      </div>

      <div className="tb-group">
        <button className={`tb-btn brake ${sim.brakeHeld ? 'holding' : ''}`} {...brakeHold}>
          <BrakeIcon />
        </button>
        <span className="tb-label">BRAKE</span>
      </div>

      <div className="tb-group">
        <button
          className={`tb-btn check ${fault ? 'fault' : ''}`}
          onClick={() => setLayout('diagnostic')}
          title="Check engine / diagnostics"
        >
          <CheckEngineIcon />
        </button>
        <span className="tb-label">CHECK</span>
      </div>

      <div className="tb-group gear-box" style={{ marginLeft: 12 }}>
        <span className="tb-label">GEAR</span>
        <div ref={gearRef} className={`gear-value ${sim.gear === 0 ? 'n' : ''}`}>
          {sim.gear === 0 ? 'N' : sim.gear}
        </div>
        <span className="tb-label" style={{ fontSize: 8.5 }}>{sim.spec ? sim.spec.drivetrain.gearRatios.length : 5}-SPD</span>
      </div>

      <div className="tb-group throttle-wrap">
        <div className="throttle-head">
          <span className="tb-label">THROTTLE</span>
          <span ref={throttlePctRef} className="throttle-pct">0%</span>
        </div>
        <div className="throttle-track" onPointerDown={throttlePointer}>
          <div ref={fillRef} className="throttle-fill" />
          <div ref={handleRef} className="throttle-handle" />
        </div>
      </div>

      <div className="shift-col">
        <div className="tb-group">
          <button className="tb-btn shift" onClick={() => sim.shiftUp()} title="Shift up">↑</button>
          <span className="tb-label">SHIFT UP</span>
        </div>
        <div className="tb-group">
          <button className="tb-btn shift" onClick={() => sim.shiftDown()} title="Shift down">↓</button>
          <span className="tb-label">SHIFT DN</span>
        </div>
      </div>
    </header>
  );
}
