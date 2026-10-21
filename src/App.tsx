// ── App.tsx: shell — sidebar, topbar, layout host, overlays ────────────────
import React, { useEffect } from 'react';
import { useApp } from './state/store';
import { sim } from './sim/core';
import { engineAudio } from './audio/engineSound';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { SimpleLayout } from './layouts/SimpleLayout';
import { CockpitLayout } from './layouts/CockpitLayout';
import { TunerLayout } from './layouts/TunerLayout';
import { TrackLayout } from './layouts/TrackLayout';
import { DiagnosticLayout } from './layouts/DiagnosticLayout';
import { LeaderboardLayout } from './layouts/LeaderboardLayout';
import { CommunityLayout } from './layouts/CommunityLayout';
import { Builder } from './builder/Builder';
import { SettingsModal, ShowroomModal, PublishChooserModal, InspectModal } from './components/Modals';
import { ToastHost, toast } from './components/Toast';
import { LayoutId } from './sim/types';

const ORDER: LayoutId[] = ['simple', 'cockpit', 'tuner', 'track', 'diagnostic', 'leaderboard', 'community'];

export default function App() {
  const layout = useApp((s) => s.layout);
  const setLayout = useApp((s) => s.setLayout);
  const builderOpen = useApp((s) => s.builderOpen);
  const builderDraft = useApp((s) => s.builderDraft);
  const setAudio = useApp((s) => s.setAudio);
  const engineKey = useApp((s) => s.selectedId);

  // coin / event notifications wired once
  useEffect(() => {
    const prevDyno = sim.onDynoDone;
    sim.onDynoDone = (run) => {
      prevDyno?.(run);
      toast(`Dyno complete: ${run.peakHp} hp / ${run.peakNm} Nm — +180¢`, 'good');
    };
    const prevLaunch = sim.onLaunchDone;
    sim.onLaunchDone = (ms) => {
      prevLaunch?.(ms);
      toast(`Launch ${(ms / 1000).toFixed(2)} s — +120¢`, 'good');
    };
    return () => { sim.onDynoDone = prevDyno; sim.onLaunchDone = prevLaunch; };
  }, []);

  // keyboard controls
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (builderOpen) return;
      switch (e.key.toLowerCase()) {
        case 'w': sim.nudgeThrottle(0.07); break;
        case 's': sim.nudgeThrottle(-0.07); break;
        case 'e': sim.shiftUp(); break;
        case 'q': sim.shiftDown(); break;
        case 'c': sim.toggleClutch(); break;
        case 'b': sim.setBrake(true); break;
        case 'enter': engineAudio.ensure(); sim.setCrank(true); e.preventDefault(); break;
        case 'i': engineAudio.ensure(); sim.toggleIgnition(); break;
        case 'm': { const on = !useApp.getState().audioOn; setAudio(on); toast(on ? 'Audio on' : 'Audio muted'); break; }
        case '1': case '2': case '3': case '4': case '5': case '6': case '7': {
          const l = ORDER[+e.key - 1];
          if (l) setLayout(l);
          break;
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (builderOpen) return;
      switch (e.key.toLowerCase()) {
        case 'b': sim.setBrake(false); break;
        case 'enter': sim.setCrank(false); break;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [builderOpen, setLayout, setAudio]);

  return (
    <div className="app">
      <Sidebar />
      <TopBar />
      <main className="main">
        {/* key=remount on engine change so gauges/scales adapt */}
        {layout === 'simple' && <SimpleLayout key={engineKey} />}
        {layout === 'cockpit' && <CockpitLayout key={engineKey} />}
        {layout === 'tuner' && <TunerLayout key={engineKey} />}
        {layout === 'track' && <TrackLayout key={engineKey} />}
        {layout === 'diagnostic' && <DiagnosticLayout key={engineKey} />}
        {layout === 'leaderboard' && <LeaderboardLayout key={engineKey} />}
        {layout === 'community' && <CommunityLayout key={engineKey} />}
        {!builderOpen && (
          <div className="hint-strip">
            <kbd>W</kbd>/<kbd>S</kbd> throttle · <kbd>E</kbd>/<kbd>Q</kbd> shift · <kbd>Enter</kbd> crank · <kbd>I</kbd> ignition · <kbd>C</kbd> clutch · <kbd>B</kbd> brake
          </div>
        )}
      </main>

      {builderOpen && builderDraft && <Builder />}
      <SettingsModal />
      <ShowroomModal />
      <PublishChooserModal />
      <InspectModal />
      <ToastHost />
    </div>
  );
}
