// ── main.tsx: boot sequence — load sim, start loops, mount React ───────────
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { bootSim } from './state/store';
import { simTick } from './sim/core';
import { engineAudio } from './audio/engineSound';
import './styles/global.css';

bootSim();

// single master rAF: physics (fixed-step) + audio
function loop(t: number) {
  requestAnimationFrame(loop);
  simTick(t);
  engineAudio.update();
}
requestAnimationFrame(loop);

// lazily unlock audio on the first user gesture anywhere
const unlock = () => {
  engineAudio.ensure();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// PWA service worker (prod only — avoids stale caches in dev)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
