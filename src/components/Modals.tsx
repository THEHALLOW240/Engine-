// ── Modals.tsx: settings, showroom, publish chooser, inspect, help ─────────
import React, { useMemo, useState } from 'react';
import { useApp, COMMUNITY_SEEDS } from '../state/store';
import { presetSummaries } from '../sim/presets';
import { engineAudio } from '../audio/engineSound';
import { resolveSpec } from '../sim/spec';
import { sim } from '../sim/core';
import { ThumbEngine } from './icons';

export function SettingsModal() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const close = () => setOpen(false);
  const audioOn = useApp((s) => s.audioOn);
  const setAudio = useApp((s) => s.setAudio);
  const hiContrast = useApp((s) => s.hiContrast);
  const setHiContrast = useApp((s) => s.setHiContrast);
  const resetAll = useApp((s) => s.resetAll);
  const [vol, setVol] = useState(engineAudio.volume);

  if (!open) return null;
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>SETTINGS</h2>
        <div className="row">
          <span>Engine audio</span>
          <button className={`btn mini ${audioOn ? 'primary' : ''}`} onClick={() => setAudio(!audioOn)}>
            {audioOn ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="row">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={vol} style={{ width: 180 }}
            onChange={(e) => { setVol(+e.target.value); engineAudio.setVolume(+e.target.value); }} />
        </div>
        <div className="row">
          <span>High contrast</span>
          <button className={`btn mini ${hiContrast ? 'primary' : ''}`} onClick={() => {
            setHiContrast(!hiContrast);
            document.body.classList.toggle('hi-contrast', !hiContrast);
          }}>
            {hiContrast ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="row">
          <span>Reset all progress</span>
          <button className="btn mini bad" style={{ color: '#ff8080', borderColor: '#54323a' }}
            onClick={() => { if (confirm('Wipe everything — engines, coins, tunes?')) resetAll(); }}>
            WIPE
          </button>
        </div>
        <h2 style={{ marginTop: 22 }}>KEYBOARD</h2>
        <div className="row"><span><kbd>W</kbd> / <kbd>S</kbd> throttle</span><span><kbd>E</kbd>/<kbd>Q</kbd> shift up/dn</span></div>
        <div className="row"><span><kbd>C</kbd> clutch</span><span><kbd>B</kbd> brake (hold)</span></div>
        <div className="row"><span><kbd>Enter</kbd> crank (hold)</span><span><kbd>I</kbd> ignition</span></div>
        <div className="row"><span><kbd>1..7</kbd> layouts</span><span><kbd>M</kbd> mute</span></div>
        <div className="modal-actions">
          <button className="btn primary" onClick={close}>DONE</button>
        </div>
      </div>
    </div>
  );
}

export function ShowroomModal() {
  const open = useApp((s) => s.showroomOpen);
  const setOpen = useApp((s) => s.setShowroom);
  const close = () => setOpen(false);
  const unlocked = useApp((s) => s.unlocked);
  const unlockPreset = useApp((s) => s.unlockPreset);
  const coins = useApp((s) => s.coins);
  const selectEngine = useApp((s) => s.selectEngine);
  const presets = presetSummaries();

  if (!open) return null;
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" style={{ width: 'min(720px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>SHOWROOM — UNLOCK ENGINES <span style={{ float: 'right', color: '#ff8d2e' }}>◎ {coins}</span></h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {presets.map(({ def, disp, hp, nm, cost, redline }) => {
            const isUnlocked = unlocked.includes(def.id);
            const afford = coins >= def.unlockCost;
            return (
              <div key={def.id} className="opt-card" style={{ cursor: 'default' }}>
                <div className="oh">{def.config.name}</div>
                <div className="od" style={{ minHeight: 34 }}>{def.blurb}</div>
                <div className="od" style={{ fontFamily: 'var(--mono)', lineHeight: 1.7 }}>
                  {disp.toFixed(1)}L · {def.config.cylinders}cyl · <b style={{ color: '#ff8d2e' }}>{hp} hp</b> · {nm} Nm<br />
                  redline {redline} · build US${cost.toLocaleString()}
                </div>
                {isUnlocked ? (
                  <button className="btn mini primary" style={{ marginTop: 10 }} onClick={() => { selectEngine('eng-' + def.id); close(); }}>
                    DRIVE IT
                  </button>
                ) : (
                  <button className={`btn mini ${afford ? 'primary' : ''}`} style={{ marginTop: 10 }} disabled={!afford}
                    onClick={() => unlockPreset(def.id)}>
                    UNLOCK — ◎{def.unlockCost}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-actions">
          <span style={{ marginRight: 'auto', color: 'var(--dim)', fontSize: 12 }}>
            Earn coins with dyno runs (+180) and launches (+120).
          </span>
          <button className="btn" onClick={close}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

export function PublishChooserModal() {
  const open = useApp((s) => s.publishChooserOpen);
  const setOpen = useApp((s) => s.setPublishChooser);
  const close = () => setOpen(false);
  const engines = useApp((s) => s.engines);
  const publish = useApp((s) => s.publishEngine);

  if (!open) return null;
  const usable = engines.filter((e) => !e.locked);
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>PUBLISH TO COMMUNITY</h2>
        {usable.length === 0 && <p style={{ color: 'var(--dim)' }}>You need a built engine first.</p>}
        {usable.map((e) => {
          const spec = resolveSpec(e.config);
          return (
            <div key={e.id} className="row">
              <div>
                <div style={{ fontWeight: 700 }}>{e.config.name}</div>
                <div style={{ color: 'var(--dim2)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                  {spec.displacementL.toFixed(1)}L · {spec.cylinders} cyl · {e.peakHp} hp · US${e.cost.toLocaleString()}
                </div>
              </div>
              <button className="btn mini primary" onClick={() => publish(e.id)}>PUBLISH</button>
            </div>
          );
        })}
        <div className="modal-actions">
          <button className="btn" onClick={close}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

export function InspectModal() {
  const inspectId = useApp((s) => s.inspectId);
  const setInspect = useApp((s) => s.setInspect);
  const close = () => setInspect(null);
  const myPublishes = useApp((s) => s.myPublishes);
  const importPublished = useApp((s) => s.importPublished);

  const pub = useMemo(
    () => [...myPublishes, ...COMMUNITY_SEEDS].find((p) => p.id === inspectId) ?? null,
    [inspectId, myPublishes],
  );
  if (!pub) return null;
  const spec = resolveSpec(pub.config);
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{pub.name.toUpperCase()}</h2>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px' }}>
          <ThumbEngine hue={pub.hue} layout={pub.layout} cyl={pub.cylinders} />
        </div>
        <div className="row"><span>Author</span><b>{pub.author}</b></div>
        <div className="row"><span>Configuration</span><b>{(pub.layout === 'inline' ? 'Inline' : pub.layout === 'v' ? 'V' : 'Flat')}-{pub.cylinders}</b></div>
        <div className="row"><span>Displacement</span><b>{spec.displacementL.toFixed(2)} L</b></div>
        <div className="row"><span>Bore × Stroke</span><b>{pub.config.boreMm.toFixed(1)} × {pub.config.strokeMm.toFixed(1)} mm</b></div>
        <div className="row"><span>Compression</span><b>{pub.config.compression.toFixed(1)}:1</b></div>
        <div className="row"><span>Peak power</span><b style={{ color: '#ff8d2e' }}>{pub.peakHp} hp</b></div>
        <div className="row"><span>Peak torque</span><b>{pub.peakNm} Nm</b></div>
        <div className="row"><span>Redline</span><b>{spec.redline} rpm</b></div>
        <div className="row"><span>Build cost</span><b>US${pub.cost.toLocaleString()}</b></div>
        <div className="modal-actions">
          <button className="btn" onClick={close}>CLOSE</button>
          <button className="btn primary" onClick={() => { importPublished(pub); close(); }}>
            USE THIS ENGINE
          </button>
        </div>
      </div>
    </div>
  );
}
