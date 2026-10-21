// ── Builder.tsx: multi-step engine construction wizard ──────────────────────
import React, { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { EngineConfig, LayoutKind, CamProfileId } from '../sim/types';
import {
  CAMS, INDUCTION, INJECTION, FUELS, EXHAUSTS, IGNITIONS,
  resolveSpec, buildCost, estimatePeak, firingOrderSuggestions, clamp,
} from '../sim/spec';

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'layout', label: 'Layout' },
  { id: 'sizing', label: 'Sizing' },
  { id: 'timing', label: 'Timing' },
  { id: 'camshaft', label: 'Camshaft' },
  { id: 'firing', label: 'Firing Order' },
  { id: 'ignfuel', label: 'Ignition · Fuel' },
  { id: 'airfuel', label: 'Air & Fuel' },
  { id: 'induction', label: 'Induction' },
  { id: 'exhaust', label: 'Exhaust' },
  { id: 'drivetrain', label: 'Drivetrain' },
];

const GEARBOXES: Array<{ label: string; desc: string; ratios: number[] }> = [
  { label: '4-Speed Classic', desc: 'Wide-gated vintage box.', ratios: [3.7, 2.2, 1.4, 1.0] },
  { label: '5-Speed Manual', desc: 'The everyday hero.', ratios: [3.55, 2.05, 1.36, 1.03, 0.78] },
  { label: '6-Speed Close', desc: 'Close-ratio track box.', ratios: [3.63, 2.19, 1.61, 1.22, 1.0, 0.77] },
  { label: '6-Speed Bike', desc: 'Motorcycle sequential ratios.', ratios: [2.75, 1.94, 1.55, 1.32, 1.15, 1.0] },
];

export function Builder() {
  const draft = useApp((s) => s.builderDraft)!;
  const updateDraft = useApp((s) => s.updateDraft);
  const closeBuilder = useApp((s) => s.closeBuilder);
  const saveEngine = useApp((s) => s.saveEngineFromBuilder);
  const selectedId = useApp((s) => s.selectedId);
  const [step, setStep] = useState(0);

  const set = (patch: Partial<EngineConfig>) => updateDraft({ ...draft, ...patch });
  const spec = useMemo(() => resolveSpec(draft), [draft]);
  const est = useMemo(() => estimatePeak(spec), [spec]);
  const cost = useMemo(() => buildCost(draft), [draft]);

  const cylOptions = (layout: LayoutKind): number[] =>
    layout === 'inline' ? [1, 2, 3, 4, 5, 6, 7] :
    layout === 'v' ? [2, 4, 6, 8, 10, 12] : [2, 4, 6];

  const StepBody = () => {
    switch (STEPS[step].id) {
      case 'identity': return (
        <>
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <span className="field-label" style={{ marginTop: 0 }}>ENGINE NAME</span>
              <input
                className="text-input" value={draft.name} maxLength={34}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Turbo Terror 2000"
              />
              <span className="field-label">DESCRIPTION (OPTIONAL)</span>
              <textarea
                className="text-input" value={draft.description} maxLength={180}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="A short story for the community card…"
              />
            </div>
            <div style={{ opacity: 0.9, paddingTop: 10 }}>
              <PistonArt />
            </div>
          </div>
        </>
      );
      case 'layout': return (
        <>
          <span className="field-label" style={{ marginTop: 0 }}>ARCHITECTURE</span>
          <div className="opt-grid">
            {([
              { id: 'inline', label: 'Inline', desc: 'Cylinders in a row. Simple, smooth, cheap to machine.' },
              { id: 'v', label: 'V-Configuration', desc: 'Two banks in a V. Compact and charismatic.' },
              { id: 'flat', label: 'Boxer / Flat', desc: 'Opposed pistons. Low center of gravity, wide.' },
            ] as Array<{ id: LayoutKind; label: string; desc: string }>).map((o) => (
              <div key={o.id} className={`opt-card ${draft.layout === o.id ? 'sel' : ''}`}
                onClick={() => {
                  const cyls = cylOptions(o.id);
                  const cyl = cyls.includes(draft.cylinders) ? draft.cylinders : cyls[Math.min(2, cyls.length - 1)];
                  set({
                    layout: o.id, cylinders: cyl,
                    bankAngleDeg: o.id === 'flat' ? 180 : o.id === 'v' ? 90 : 0,
                    firingOrder: firingOrderSuggestions(cyl, o.id)[0],
                  });
                }}>
                <div className="oh">{o.label}</div>
                <div className="od">{o.desc}</div>
                <div style={{ marginTop: 10 }}><LayoutGlyph kind={o.id} sel={draft.layout === o.id} /></div>
              </div>
            ))}
          </div>
          <span className="field-label">CYLINDERS — {(draft.layout === 'inline' ? 'I' : draft.layout === 'v' ? 'V' : 'F') + draft.cylinders}</span>
          <div className="opt-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
            {cylOptions(draft.layout).map((n) => (
              <div key={n} className={`opt-card ${draft.cylinders === n ? 'sel' : ''}`} style={{ padding: 12, textAlign: 'center' }}
                onClick={() => set({ cylinders: n, firingOrder: firingOrderSuggestions(n, draft.layout)[0] })}>
                <div className="oh" style={{ justifyContent: 'center', fontSize: 19 }}>
                  {(draft.layout === 'inline' ? 'I' : draft.layout === 'v' ? 'V' : 'F') + n}
                </div>
              </div>
            ))}
          </div>
          {draft.layout === 'v' && (
            <>
              <span className="field-label">BANK ANGLE — {draft.bankAngleDeg}°</span>
              <div className="slider-row">
                <label>V angle</label>
                <input type="range" min={45} max={120} step={5} value={draft.bankAngleDeg}
                  onChange={(e) => set({ bankAngleDeg: +e.target.value })} />
                <output>{draft.bankAngleDeg}°</output>
              </div>
            </>
          )}
        </>
      );
      case 'sizing': return (
        <>
          <div className="slider-row">
            <label>Bore — {draft.boreMm.toFixed(1)} mm</label>
            <input type="range" min={60} max={110} step={0.5} value={draft.boreMm}
              onChange={(e) => set({ boreMm: +e.target.value })} />
            <output>{draft.boreMm.toFixed(1)} mm</output>
          </div>
          <div className="slider-row">
            <label>Stroke — {draft.strokeMm.toFixed(1)} mm</label>
            <input type="range" min={50} max={105} step={0.5} value={draft.strokeMm}
              onChange={(e) => set({ strokeMm: +e.target.value })} />
            <output>{draft.strokeMm.toFixed(1)} mm</output>
          </div>
          <div className="slider-row">
            <label>Compression — {draft.compression.toFixed(1)}:1</label>
            <input type="range" min={8} max={13.5} step={0.1} value={draft.compression}
              onChange={(e) => set({ compression: +e.target.value })} />
            <output>{draft.compression.toFixed(1)}:1</output>
          </div>
          <div className="od" style={{ color: 'var(--dim)', maxWidth: 560, lineHeight: 1.6 }}>
            {draft.boreMm > draft.strokeMm
              ? 'Oversquare engine — loves to rev, peaky power.'
              : draft.boreMm < draft.strokeMm
                ? 'Undersquare (long stroke) — torquey low-end, calmer redline.'
                : 'Square engine — balanced manners everywhere.'}
            {' '}Displacement: <b style={{ color: 'var(--text)' }}>{spec.displacementL.toFixed(2)} L</b>
            {' '}({Math.round(draft.boreMm / draft.strokeMm * 100) / 100} B/S ratio).
          </div>
        </>
      );
      case 'timing': return (
        <>
          <div className="slider-row">
            <label>Intake center — {draft.cam.intakeCenterDeg}°</label>
            <input type="range" min={95} max={125} step={1} value={draft.cam.intakeCenterDeg}
              onChange={(e) => set({ cam: { ...draft.cam, intakeCenterDeg: +e.target.value } })} />
            <output>{draft.cam.intakeCenterDeg}°</output>
          </div>
          <div className="slider-row">
            <label>Duration — {draft.cam.durationDeg}°</label>
            <input type="range" min={190} max={300} step={2} value={draft.cam.durationDeg}
              onChange={(e) => set({ cam: { ...draft.cam, durationDeg: +e.target.value } })} />
            <output>{draft.cam.durationDeg}°</output>
          </div>
          <div className="od" style={{ color: 'var(--dim)', maxWidth: 560, lineHeight: 1.6 }}>
            Advancing the intake center builds low-end torque; retarding it feeds top-end breathing.
            Long duration means overlap, lope, and a harder top-end charge.
          </div>
        </>
      );
      case 'camshaft': return (
        <div className="opt-grid">
          {(Object.keys(CAMS) as CamProfileId[]).map((id) => {
            const c = CAMS[id];
            return (
              <div key={id} className={`opt-card ${draft.cam.profile === id ? 'sel' : ''}`}
                onClick={() => set({ cam: { ...draft.cam, profile: id } })}>
                <div className="oh">{c.label}<span className="op">+US${c.price.toLocaleString()}</span></div>
                <div className="od">{c.desc}</div>
                <div className="od" style={{ marginTop: 8, fontFamily: 'var(--mono)' }}>
                  redline ≈ {c.redlineBase} · idle {c.idle} rpm
                </div>
              </div>
            );
          })}
        </div>
      );
      case 'firing': {
        const sugg = firingOrderSuggestions(draft.cylinders, draft.layout);
        return (
          <>
            <span className="field-label" style={{ marginTop: 0 }}>FIRING ORDER</span>
            <div className="firing-viz">
              {draft.firingOrder.map((c, i) => (
                <React.Fragment key={i}>
                  <div className="firing-dot">{c}</div>
                  {i < draft.firingOrder.length - 1 && <span className="firing-arrow">→</span>}
                </React.Fragment>
              ))}
              <span style={{ marginLeft: 14, color: 'var(--dim)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                every {(720 / draft.cylinders).toFixed(0)}° of crank
              </span>
            </div>
            <div className="opt-grid">
              {sugg.map((seq, i) => (
                <div key={i} className={`opt-card ${draft.firingOrder.join() === seq.join() ? 'sel' : ''}`}
                  onClick={() => set({ firingOrder: seq })}>
                  <div className="oh">Order {seq.join('-')}</div>
                  <div className="od">{i === 0 ? 'Factory standard for this layout.' : 'Alternate pattern — different soundtrack.'}</div>
                </div>
              ))}
            </div>
            <div className="od" style={{ color: 'var(--dim)', marginTop: 12 }}>
              Smoothness index: <b style={{ color: 'var(--text)' }}>{Math.round(spec.smoothness * 100)}%</b>
            </div>
          </>
        );
      }
      case 'ignfuel': return (
        <>
          <span className="field-label" style={{ marginTop: 0 }}>IGNITION SYSTEM</span>
          <div className="opt-grid">
            {(Object.keys(IGNITIONS) as Array<keyof typeof IGNITIONS>).map((id) => {
              const s2 = IGNITIONS[id];
              return (
                <div key={id} className={`opt-card ${draft.ignition.system === id ? 'sel' : ''}`}
                  onClick={() => set({ ignition: { ...draft.ignition, system: id } })}>
                  <div className="oh">{s2.label}<span className="op">+US${s2.price.toLocaleString()}</span></div>
                  <div className="od">{s2.desc}</div>
                </div>
              );
            })}
          </div>
          <div className="slider-row" style={{ marginTop: 22 }}>
            <label>Rev limiter — {draft.ignition.revLimit} rpm</label>
            <input type="range" min={4500} max={12000} step={100} value={draft.ignition.revLimit}
              onChange={(e) => set({ ignition: { ...draft.ignition, revLimit: +e.target.value } })} />
            <output>{draft.ignition.revLimit}</output>
          </div>
          <span className="field-label">FUEL SYSTEM</span>
          <div className="opt-grid">
            {(Object.keys(INJECTION) as Array<keyof typeof INJECTION>).map((id) => {
              const s2 = INJECTION[id];
              return (
                <div key={id} className={`opt-card ${draft.fuel.injection === id ? 'sel' : ''}`}
                  onClick={() => set({ fuel: { ...draft.fuel, injection: id } })}>
                  <div className="oh">{s2.label}<span className="op">+US${s2.price.toLocaleString()}</span></div>
                  <div className="od">{s2.desc}</div>
                </div>
              );
            })}
          </div>
          <span className="field-label">FUEL TYPE</span>
          <div className="opt-grid">
            {(Object.keys(FUELS) as Array<keyof typeof FUELS>).map((id) => {
              const s2 = FUELS[id];
              return (
                <div key={id} className={`opt-card ${draft.fuel.fuelType === id ? 'sel' : ''}`}
                  onClick={() => set({ fuel: { ...draft.fuel, fuelType: id } })}>
                  <div className="oh">{s2.label}<span className="op">+US${s2.price.toLocaleString()}</span></div>
                  <div className="od">{s2.desc} · {s2.oct} octane</div>
                </div>
              );
            })}
          </div>
        </>
      );
      case 'airfuel': return (
        <>
          <div className="slider-row">
            <label>Target AFR — {draft.fuel.targetAfr.toFixed(1)}</label>
            <input type="range" min={11.5} max={16} step={0.1} value={draft.fuel.targetAfr}
              onChange={(e) => set({ fuel: { ...draft.fuel, targetAfr: +e.target.value } })} />
            <output>{draft.fuel.targetAfr.toFixed(1)}</output>
          </div>
          <div className="slider-row">
            <label>Injector flow — {draft.fuel.injectorFlow} cc/min</label>
            <input type="range" min={120} max={1200} step={10} value={draft.fuel.injectorFlow}
              onChange={(e) => set({ fuel: { ...draft.fuel, injectorFlow: +e.target.value } })} />
            <output>{draft.fuel.injectorFlow} cc</output>
          </div>
          <div className="od" style={{ color: 'var(--dim)', maxWidth: 560, lineHeight: 1.6 }}>
            Best power usually lives near AFR 12.6–13.2. Leaner cruises cooler on plugs but hotter in
            the chamber — watch EGTs under boost. You can fine-tune cell-by-cell later in the Tuner.
          </div>
        </>
      );
      case 'induction': return (
        <>
          <div className="opt-grid">
            {(Object.keys(INDUCTION) as Array<keyof typeof INDUCTION>).map((id) => {
              const s2 = INDUCTION[id];
              return (
                <div key={id} className={`opt-card ${draft.induction.type === id ? 'sel' : ''}`}
                  onClick={() => set({ induction: { type: id, boostPsi: id === 'na' ? 0 : INDUCTION[id].psi } })}>
                  <div className="oh">{s2.label}<span className="op">+US${s2.price.toLocaleString()}</span></div>
                  <div className="od">{s2.desc}</div>
                </div>
              );
            })}
          </div>
          {draft.induction.type !== 'na' && (
            <div className="slider-row" style={{ marginTop: 22 }}>
              <label>Boost — {draft.induction.boostPsi} psi</label>
              <input type="range" min={4} max={28} step={1} value={draft.induction.boostPsi}
                onChange={(e) => set({ induction: { ...draft.induction, boostPsi: +e.target.value } })} />
              <output>{draft.induction.boostPsi} psi</output>
            </div>
          )}
        </>
      );
      case 'exhaust': return (
        <div className="opt-grid">
          {(Object.keys(EXHAUSTS) as Array<keyof typeof EXHAUSTS>).map((id) => {
            const s2 = EXHAUSTS[id];
            return (
              <div key={id} className={`opt-card ${draft.exhaust === id ? 'sel' : ''}`}
                onClick={() => set({ exhaust: id })}>
                <div className="oh">{s2.label}<span className="op">+US${s2.price.toLocaleString()}</span></div>
                <div className="od">{s2.desc}</div>
              </div>
            );
          })}
        </div>
      );
      case 'drivetrain': return (
        <>
          <span className="field-label" style={{ marginTop: 0 }}>GEARBOX</span>
          <div className="opt-grid">
            {GEARBOXES.map((g) => (
              <div key={g.label} className={`opt-card ${draft.drivetrain.gearRatios.length === g.ratios.length && Math.abs(draft.drivetrain.gearRatios[0] - g.ratios[0]) < 0.01 ? 'sel' : ''}`}
                onClick={() => set({ drivetrain: { ...draft.drivetrain, gearRatios: [...g.ratios] } })}>
                <div className="oh">{g.label}</div>
                <div className="od">{g.desc}</div>
                <div className="od" style={{ fontFamily: 'var(--mono)', marginTop: 6 }}>{g.ratios.join(' / ')}</div>
              </div>
            ))}
          </div>
          <div className="slider-row" style={{ marginTop: 22 }}>
            <label>Final drive — {draft.drivetrain.finalDrive.toFixed(2)}</label>
            <input type="range" min={2.5} max={4.6} step={0.05} value={draft.drivetrain.finalDrive}
              onChange={(e) => set({ drivetrain: { ...draft.drivetrain, finalDrive: +e.target.value } })} />
            <output>{draft.drivetrain.finalDrive.toFixed(2)}</output>
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="builder">
      <div className="builder-nav">
        <div className="brand" style={{ padding: '4px 10px 18px', fontSize: 15 }}>
          ENGINE BUILDER
        </div>
        {STEPS.map((s, i) => (
          <div key={s.id} className={`nav-step ${i === step ? 'sel' : ''}`} onClick={() => setStep(i)}>
            <span className="num">{i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      <div className="builder-top">
        <button className="btn" onClick={closeBuilder}>✕ CANCEL</button>
        <span style={{ color: 'var(--dim)', fontSize: 13 }}>
          Step {step + 1} of {STEPS.length} — {STEPS[step].label}
        </span>
        <div className="builder-cost">
          <small>BUILD COST</small>
          US${cost.toLocaleString()}
        </div>
        <button className="btn primary" style={{ marginLeft: 22 }} onClick={() => saveEngine(draft)}>
          SAVE ENGINE
        </button>
      </div>

      <div className="builder-main">
        <div className="step-title">{STEPS[step].label}</div>
        <div className="step-sub">
          {{
            identity: 'Name your creation — it appears in your garage and on community cards.',
            layout: 'Pick the architecture and cylinder count.',
            sizing: 'Bore, stroke and compression define character.',
            timing: 'Set the base cam timing and duration.',
            camshaft: 'The cam profile sets peak personality.',
            firing: 'Firing order shapes sound and smoothness.',
            ignfuel: 'Spark delivery and fuel metering hardware.',
            airfuel: 'Mixture targets the ECU will chase.',
            induction: 'How the engine swallows air.',
            exhaust: 'How it exhales.',
            drivetrain: 'Getting power to the ground.',
          }[STEPS[step].id]}
        </div>

        <div className="spec-panel">
          <div><div className="sk">DISPLACEMENT</div><div className="sv">{spec.displacementL.toFixed(2)} L</div></div>
          <div><div className="sk">EST. POWER</div><div className="sv" style={{ color: '#ff8d2e' }}>{est.hp} hp</div></div>
          <div><div className="sk">EST. TORQUE</div><div className="sv">{est.nm} Nm</div></div>
          <div><div className="sk">REDLINE</div><div className="sv">{spec.redline} rpm</div></div>
          <div><div className="sk">IDLE</div><div className="sv">{spec.idleRpm} rpm</div></div>
        </div>

        {StepBody()}

        <div className="builder-foot">
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← BACK</button>
          <button className="btn primary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>
            NEXT →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── line-art piston for the identity step ────────────────────────────────────
function PistonArt() {
  return (
    <svg width="190" height="210" viewBox="0 0 120 140" fill="none" stroke="#3f8cff" strokeWidth="1.6" opacity="0.85">
      <rect x="28" y="14" width="64" height="34" rx="3"/>
      <line x1="30" y1="22" x2="90" y2="22"/><line x1="30" y1="27" x2="90" y2="27"/><line x1="30" y1="32" x2="90" y2="32"/>
      <circle cx="60" cy="60" r="8"/>
      <path d="M52 46 L70 46 L76 78 L66 112 L54 112 L44 78 Z" stroke="#5f9dff"/>
      <circle cx="60" cy="60" r="3" fill="#3f8cff" stroke="none"/>
      <path d="M34 118a44 44 0 0 1 52 0" stroke="#2c4a80"/>
      <line x1="20" y1="126" x2="100" y2="126" stroke="#2c4a80"/>
      <line x1="34" y1="132" x2="86" y2="132" stroke="#22385f"/>
    </svg>
  );
}

function LayoutGlyph({ kind, sel }: { kind: LayoutKind; sel: boolean }) {
  const c = sel ? '#9dc3ff' : '#4a4a55';
  if (kind === 'inline') {
    return (
      <svg width="70" height="40" viewBox="0 0 70 40" stroke={c} fill="none" strokeWidth="1.6">
        {[0, 1, 2, 3].map((i) => <rect key={i} x={8 + i * 14} y={6} width={9} height={18} rx={1.5} />)}
        <line x1="6" y1="30" x2="64" y2="30" />
      </svg>
    );
  }
  if (kind === 'v') {
    return (
      <svg width="70" height="40" viewBox="0 0 70 40" stroke={c} fill="none" strokeWidth="1.6">
        <rect x="12" y="4" width="9" height="18" rx={1.5} transform="rotate(-28 16 13)" />
        <rect x="24" y="4" width="9" height="18" rx={1.5} transform="rotate(-28 28 13)" />
        <rect x="38" y="4" width="9" height="18" rx={1.5} transform="rotate(28 42 13)" />
        <rect x="50" y="4" width="9" height="18" rx={1.5} transform="rotate(28 54 13)" />
        <line x1="30" y1="32" x2="40" y2="32" />
      </svg>
    );
  }
  return (
    <svg width="70" height="40" viewBox="0 0 70 40" stroke={c} fill="none" strokeWidth="1.6">
      <rect x="2" y="12" width="18" height="9" rx={1.5} />
      <rect x="2" y="26" width="18" height="9" rx={1.5} />
      <rect x="50" y="12" width="18" height="9" rx={1.5} />
      <rect x="50" y="26" width="18" height="9" rx={1.5} />
      <circle cx="35" cy="22" r="4" />
    </svg>
  );
}
