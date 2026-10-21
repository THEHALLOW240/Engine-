// ── icons.tsx: hand-drawn SVG icon set ──────────────────────────────────────
import React from 'react';

export const EngineMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <path fill="#ff8d2e" d="M16 24h30a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H35l-6.5 6.5h-9L24 48h-8a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5z"/>
    <path fill="#b45f10" d="M22 16h6v8h-6zM33 12h6v12h-6z"/>
    <circle cx="31" cy="36" r="7" fill="#14151a"/>
    <circle cx="31" cy="36" r="3.2" fill="#ffd7ac"/>
    <rect x="42" y="30" width="4" height="10" rx="1.5" fill="#8a4c0e"/>
  </svg>
);

export const PanelIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="5" width="17" height="14" rx="2"/>
    <line x1="10" y1="5" x2="10" y2="19"/>
    <rect x="6" y="8" width="1.6" height="6" rx="0.8" fill="currentColor" stroke="none"/>
  </svg>
);

export const ClutchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
    {[...Array(6)].map((_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return <line key={i} x1={12 + Math.cos(a) * 4.6} y1={12 + Math.sin(a) * 4.6} x2={12 + Math.cos(a) * 7} y2={12 + Math.sin(a) * 7} stroke="currentColor" strokeWidth="1.4"/>;
    })}
    <path d="M8 12a4 4 0 0 1 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

export const BrakeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="8.4"/>
    <circle cx="12" cy="12" r="2.4"/>
    <circle cx="12" cy="6.8" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="7.5" cy="14.6" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="16.5" cy="14.6" r="0.9" fill="currentColor" stroke="none"/>
  </svg>
);

export const CheckEngineIcon = () => (
  <svg className="lamp" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 8h3l2 2h4v3h2v3h-2v2H9l-2-2H5v-2H3v-2h2V9z" strokeLinejoin="round"/>
    <path d="M9 6h4"/>
    <path d="M13 2.5l2 1.5" strokeLinecap="round"/>
    <path d="M17.5 5.5h3" strokeLinecap="round"/>
  </svg>
);

export const GearIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="3.2"/>
    <path d="M12 2.8v2.5M12 18.7v2.5M2.8 12h2.5M18.7 12h2.5M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" strokeLinecap="round"/>
  </svg>
);

export const BuildIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="4" width="7" height="7" rx="1.5"/>
    <rect x="13" y="4" width="7" height="7" rx="1.5"/>
    <rect x="4" y="13" width="7" height="7" rx="1.5"/>
    <path d="M16.5 13v7M13 16.5h7" strokeLinecap="round"/>
  </svg>
);

export const CoinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke="#ff8d2e" strokeWidth="2"/>
    <path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4.5" stroke="#ff8d2e" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
  </svg>
);

export const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="11" width="14" height="9" rx="2"/>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
  </svg>
);

export const ThumbEngine = ({ hue = 28, layout = 'inline', cyl = 4 }: { hue?: number; layout?: string; cyl?: number }) => {
  const main = `hsl(${hue}, 78%, 58%)`;
  const dark = `hsl(${hue}, 55%, 30%)`;
  const pistons: React.ReactElement[] = [];
  const n = Math.min(cyl, 6);
  for (let i = 0; i < n; i++) {
    const x = 26 + i * 26;
    pistons.push(
      <g key={i}>
        <rect x={x} y={30 - (i % 2) * 7} width={16} height={13} rx={2} fill="#c9cdd6"/>
        <rect x={x} y={33 - (i % 2) * 7} width={16} height={2} fill="#54575f"/>
        <line x1={x + 8} y1={42 - (i % 2) * 7} x2={x + 10 + (i % 2) * 5 - 2} y2={60} stroke="#9aa0ab" strokeWidth={4.5} strokeLinecap="round"/>
      </g>,
    );
  }
  return (
    <svg width="150" height="92" viewBox="0 0 210 100" fill="none">
      <rect x="18" y="16" width={20 + n * 26} height={14} rx={3} fill={dark} opacity={0.8}/>
      <rect x={16} y={64} width={26 + n * 26} height={22} rx={4} fill={main} opacity={0.28}/>
      {pistons}
      <circle cx={30} cy={70} r={9} fill={main}/>
      <circle cx={30 + (n - 1) * 13} cy={74} r={7} fill={dark}/>
      {layout !== 'inline' && <circle cx={58} cy={66} r={7} fill={main} opacity={0.7}/>}
      {layout === 'flat' && <circle cx={150} cy={66} r={7} fill={main} opacity={0.7}/>}
      <rect x={20 + n * 26 + 6} y={52} width={10} height={18} rx={2} fill={dark}/>
    </svg>
  );
};

export const SoundIcon = ({ on }: { on: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round"/>
    {on ? (
      <>
        <path d="M16 9a4.5 4.5 0 0 1 0 6"/>
        <path d="M18.5 6.5a8 8 0 0 1 0 11"/>
      </>
    ) : (
      <path d="M16 9l6 6M22 9l-6 6"/>
    )}
  </svg>
);
