// ── LeaderboardLayout.tsx: ranked published engines ─────────────────────────
import React, { useMemo, useState } from 'react';
import { useApp, COMMUNITY_SEEDS } from '../state/store';
import { PublishedEngine } from '../sim/types';

type SortKey = 'hp' | 'nm' | 'cost' | 'disp';
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'hp', label: 'Most Power' },
  { id: 'nm', label: 'Most Torque' },
  { id: 'cost', label: 'Costliest Build' },
  { id: 'disp', label: 'Biggest Displacement' },
];

export function LeaderboardLayout() {
  const myPublishes = useApp((s) => s.myPublishes);
  const [sort, setSort] = useState<SortKey>('hp');

  const all = useMemo(() => {
    const merged: PublishedEngine[] = [...COMMUNITY_SEEDS, ...myPublishes];
    const key = (p: PublishedEngine) =>
      sort === 'hp' ? p.peakHp : sort === 'nm' ? p.peakNm : sort === 'cost' ? p.cost : p.displacementL;
    return merged.sort((a, b) => key(b) - key(a)).slice(0, 40);
  }, [myPublishes, sort]);

  const layoutTag = (p: PublishedEngine) =>
    (p.layout === 'inline' ? 'I' : p.layout === 'v' ? 'V' : 'F') + p.cylinders;

  return (
    <div className="layout-view">
      <div className="list-layout">
        <div className="list-head">
          <span className="list-title">GLOBAL LEADERBOARD</span>
          <div className="chip-row">
            {SORTS.map((s) => (
              <button key={s.id} className={`chip ${sort === s.id ? 'sel' : ''}`} onClick={() => setSort(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <table className="lb-table">
          <thead>
            <tr>
              <th>RANK</th><th>ENGINE</th><th>CONFIG</th><th>DISP</th>
              <th>POWER</th><th>TORQUE</th><th>BUILD COST</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p, i) => (
              <tr key={p.id}>
                <td className={`lb-rank ${i < 3 ? 'r' + (i + 1) : ''}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}</td>
                <td>
                  <div className="lb-name">{p.name} {p.mine && <span className="lb-mine">YOURS</span>}</div>
                  <div className="lb-author">by {p.author}</div>
                </td>
                <td><span className="tagchip">{layoutTag(p)}</span></td>
                <td className="lb-num">{p.displacementL.toFixed(2)}L</td>
                <td className="lb-num" style={{ color: '#ff8d2e', fontWeight: 700 }}>{p.peakHp} hp</td>
                <td className="lb-num">{p.peakNm} Nm</td>
                <td className="lb-num">US${p.cost.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
