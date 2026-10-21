// ── CommunityLayout.tsx: marketplace browse + publish ───────────────────────
import React, { useMemo, useState } from 'react';
import { useApp, COMMUNITY_SEEDS } from '../state/store';
import { PublishedEngine } from '../sim/types';
import { ThumbEngine } from '../components/icons';

type Filter = 'featured' | 'newest' | 'hp' | 'nm' | 'cheap';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'newest', label: 'Newest' },
  { id: 'hp', label: 'Most Power' },
  { id: 'nm', label: 'Most Torque' },
  { id: 'cheap', label: 'Cheapest' },
];

const CONFIG_CHIPS = ['ALL', 'I3', 'I4', 'I5', 'I6', 'V6', 'V8', 'V12', 'F4', 'F6'];

export function CommunityLayout() {
  const myPublishes = useApp((s) => s.myPublishes);
  const engines = useApp((s) => s.engines);
  const setPublishChooser = useApp((s) => s.setPublishChooser);
  const setInspect = useApp((s) => s.setInspect);
  const importPublished = useApp((s) => s.importPublished);

  const [filter, setFilter] = useState<Filter>('featured');
  const [chip, setChip] = useState('ALL');

  const list = useMemo(() => {
    let items: PublishedEngine[] = [...myPublishes, ...COMMUNITY_SEEDS];
    if (chip !== 'ALL') {
      items = items.filter((p) => {
        const tag = (p.layout === 'inline' ? 'I' : p.layout === 'v' ? 'V' : 'F') + p.cylinders;
        return tag === chip;
      });
    }
    switch (filter) {
      case 'featured': items = items.filter((p) => p.featured || p.mine); break;
      case 'newest': items = [...items].sort((a, b) => b.createdAt - a.createdAt); break;
      case 'hp': items = [...items].sort((a, b) => b.peakHp - a.peakHp); break;
      case 'nm': items = [...items].sort((a, b) => b.peakNm - a.peakNm); break;
      case 'cheap': items = [...items].sort((a, b) => a.cost - b.cost); break;
    }
    return items;
  }, [myPublishes, filter, chip]);

  const hasOwn = engines.some((e) => !e.locked);

  return (
    <div className="layout-view">
      <div className="list-layout">
        <div className="community-publish-bar">
          {hasOwn ? (
            <>
              <span><b>Select one of your own engines to publish</b> — share your tune with the grid.</span>
              <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setPublishChooser(true)}>
                PUBLISH ENGINE
              </button>
            </>
          ) : (
            <span>Build your own engine to share it with the community.</span>
          )}
        </div>

        <div className="list-head">
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip ${filter === f.id ? 'sel' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="chip-row">
            {CONFIG_CHIPS.map((c) => (
              <button key={c} className={`chip ${chip === c ? 'sel' : ''}`} onClick={() => setChip(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="community-grid">
          {list.map((p) => (
            <div key={p.id} className="card" style={{ ['--thumb' as any]: `hsl(${p.hue},70%,55%)` }}>
              <div className="card-thumb">
                <ThumbEngine hue={p.hue} layout={p.layout} cyl={p.cylinders} />
              </div>
              <div className="card-body">
                <div className="card-name">
                  {p.name}
                  {p.mine && <span className="lb-mine">YOURS</span>}
                </div>
                <div className="card-author">
                  {p.featured && <span className="featured">★ FEATURED · </span>}
                  by {p.author}
                </div>
                <div className="card-stats">
                  <span>{p.displacementL.toFixed(1)}L</span>
                  <span>{(p.layout === 'inline' ? 'I' : p.layout === 'v' ? 'V' : 'F')}{p.cylinders}</span>
                  <span><b>{p.peakHp}</b> hp</span>
                  <span><b>{p.peakNm}</b> Nm</span>
                </div>
                <div className="card-foot">
                  <span className="card-cost">US${p.cost.toLocaleString()}</span>
                  <span className="card-use">
                    <button className="btn mini" onClick={() => setInspect(p.id)}>INSPECT</button>
                  </span>
                  <button className="btn mini primary" onClick={() => importPublished(p)}>
                    USE THIS ENGINE
                  </button>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ color: 'var(--dim)', padding: 30 }}>
              No engines match this configuration yet — publish yours first.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
