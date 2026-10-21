// ── Sidebar.tsx: layouts list, engines list, user row ───────────────────────
import React from 'react';
import { useApp } from '../state/store';
import { LayoutId } from '../sim/types';
import { EngineMark, BuildIcon, CoinIcon, LockIcon, GearIcon } from './icons';
import { presetSummaries } from '../sim/presets';
import { resolveSpec } from '../sim/spec';

const LAYOUTS: Array<{ id: LayoutId; label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'tuner', label: 'Tuner' },
  { id: 'track', label: 'Track' },
  { id: 'diagnostic', label: 'Diagnostic' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'community', label: 'Community' },
];

export function Sidebar() {
  const layout = useApp((s) => s.layout);
  const setLayout = useApp((s) => s.setLayout);
  const engines = useApp((s) => s.engines);
  const selectedId = useApp((s) => s.selectedId);
  const selectEngine = useApp((s) => s.selectEngine);
  const openBuilder = useApp((s) => s.openBuilder);
  const coins = useApp((s) => s.coins);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setShowroom = useApp((s) => s.setShowroom);

  const presets = presetSummaries();

  return (
    <aside className="sidebar">
      <div className="brand">
        <EngineMark />
        ENGINE SIM
      </div>

      <div className="side-section">LAYOUTS</div>
      <div className="side-list">
        {LAYOUTS.map((l) => (
          <div
            key={l.id}
            className={`side-item ${layout === l.id ? 'active' : ''}`}
            onClick={() => {
              setLayout(l.id);
              document.querySelector('.app')?.classList.remove('drawer-open');
            }}
          >
            <span className="dot" />
            {l.label}
          </div>
        ))}
      </div>

      <div className="side-engines">
        <div className="side-section">ENGINES</div>
        <button className="build-btn" onClick={() => {
          openBuilder(null);
          document.querySelector('.app')?.classList.remove('drawer-open');
        }}>
          <BuildIcon />
          Build New Engine
        </button>
        <div className="side-list">
          {engines.map((e) => {
            const spec = resolveSpec(e.config);
            const locked = !!e.locked;
            const preset = e.presetId ? presets.find((p) => p.def.id === e.presetId) : null;
            return (
              <div
                key={e.id}
                className={`side-item engine-item ${selectedId === e.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => {
                  if (locked) setShowroom(true);
                  else selectEngine(e.id);
                  document.querySelector('.app')?.classList.remove('drawer-open');
                }}
                title={locked ? `Unlock in showroom for ${preset?.def.unlockCost ?? 0} coins` : preset?.def.blurb ?? e.config.description}
              >
                <div className="row1">
                  <span className="dot" />
                  <span className="ename">{e.config.name}</span>
                  {locked && (
                    <span className="lock">
                      <LockIcon /> {preset?.def.unlockCost}
                    </span>
                  )}
                </div>
                <div className="spec">
                  {spec.displacementL.toFixed(1)}L · {spec.cylinders} cyl
                  {e.presetId ? '' : ' · custom'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-user">
        <div className="avatar">H</div>
        <span className="uname">HALLOW</span>
        <span className="coins"><CoinIcon /> {coins}</span>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
          <GearIcon />
        </button>
      </div>
    </aside>
  );
}
