// ── engineSound.ts: fully procedural engine audio via Web Audio ─────────────
// Firing-frequency-locked oscillator bank + intake/exhaust noise + starter.

import { sim } from '../sim/core';
import { CAMS } from '../sim/spec';

class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private amGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  // starter
  private starterGain: GainNode | null = null;
  private starterOsc: OscillatorNode | null = null;
  private starterLfo: OscillatorNode | null = null;
  private started = false;
  volume = 0.85;

  ensure() {
    if (this.ctx) { this.ctx.resume().catch(() => undefined); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.master.gain.value = this.volume;

      // engine voice: 3 detuned saws through lowpass with AM at firing rate
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 500;
      this.filter.Q.value = 1.1;
      this.amGain = ctx.createGain();
      this.amGain.gain.value = 1;
      const parts: Array<[OscillatorType, number, number]> = [
        ['sawtooth', 1.0, 0.5],
        ['sawtooth', 1.005, 0.34],
        ['square', 0.5, 0.3],
      ];
      parts.forEach(([type, mul, g]) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        const gain = ctx.createGain();
        gain.gain.value = g;
        osc.connect(gain);
        gain.connect(this.filter!);
        osc.start();
        this.oscs.push(osc);
        this.oscGains.push(gain);
        (osc as any).__mul = mul;
      });
      this.subOsc = ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subGain = ctx.createGain();
      this.subGain.gain.value = 0.4;
      this.subOsc.connect(this.subGain);
      this.subGain.connect(this.filter);
      this.subOsc.start();

      this.filter.connect(this.amGain);
      this.amGain.connect(this.engineGain);
      this.engineGain.connect(this.master);

      // AM at firing frequency for combustion chug
      this.lfo = ctx.createOscillator();
      this.lfo.type = 'sine';
      this.lfoGain = ctx.createGain();
      this.lfoGain.gain.value = 0.0;
      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.amGain.gain);
      this.lfo.start();

      // noise bed (intake/exhaust)
      const noiseLen = 2 * ctx.sampleRate;
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      this.noiseFilter = ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.value = 900;
      this.noiseFilter.Q.value = 0.8;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0;
      noise.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      noise.start();

      // starter motor: AM buzz
      this.starterGain = ctx.createGain();
      this.starterGain.gain.value = 0;
      this.starterOsc = ctx.createOscillator();
      this.starterOsc.type = 'sawtooth';
      this.starterOsc.frequency.value = 160;
      this.starterLfo = ctx.createOscillator();
      this.starterLfo.type = 'square';
      this.starterLfo.frequency.value = 28;
      const slg = ctx.createGain();
      slg.gain.value = 0.5;
      const sBase = ctx.createGain();
      sBase.gain.value = 0.5;
      this.starterOsc.connect(sBase);
      this.starterLfo.connect(slg);
      slg.connect(sBase.gain);
      sBase.connect(this.starterGain);
      this.starterGain.connect(this.master);
      this.starterOsc.start();
      this.starterLfo.start();

      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  private smooth(param: AudioParam, value: number, tc = 0.08) {
    param.setTargetAtTime(value, this.ctx!.currentTime, tc);
  }

  update() {
    if (!this.ctx || !this.started || !sim.spec) return;
    if (!sim.audioOn) {
      this.smooth(this.master!.gain, 0, 0.1);
      return;
    }
    this.smooth(this.master!.gain, this.volume, 0.1);
    const rpm = sim.rpm;
    const cyl = sim.spec.cylinders;
    const fFire = (rpm / 120) * cyl; // 4-stroke firing rate Hz
    const fBase = Math.max(26, fFire * 0.5);
    const load = sim.throttlePos * 0.7 + 0.3;
    const cam = CAMS[sim.spec.cam.profile];

    // pitch stack
    this.oscs.forEach((o) => {
      const mul = (o as any).__mul as number;
      this.smooth(o.frequency, fBase * mul * (1 - cam.lope * 0.06 * Math.sin(sim.timeSec * 9)), 0.03);
    });
    this.smooth(this.subOsc!.frequency, Math.max(18, fBase * 0.5), 0.05);

    // AM depth: big cams lope hard at low rpm
    const lopeAmt = cam.lope * Math.max(0, 1 - rpm / 2800) * 0.8 + 0.25;
    this.smooth(this.lfo!.frequency, Math.max(6, fFire / cyl), 0.06);
    this.smooth(this.lfoGain!.gain, lopeAmt * 0.5, 0.1);

    // tone
    const cutoff = 260 + rpm * 0.55 + sim.throttlePos * 700;
    this.smooth(this.filter!.frequency, Math.min(4200, cutoff), 0.06);

    // level: idle rumble + load swell + limiter stutter
    let g = sim.running || rpm > 200 ? 0.16 + load * 0.38 : 0;
    if (sim.limiting && sim.running) g *= 0.55 + 0.45 * (Math.sin(sim.timeSec * 55) > 0 ? 1 : 0.2);
    const misf = sim.cylEnabled.filter((c) => !c).length;
    if (misf > 0) g *= 1 - misf / sim.spec.cylinders * 0.5;
    this.smooth(this.engineGain!.gain, g, 0.05);

    // noise
    const nf = 350 + rpm * 0.8 + sim.throttlePos * 900;
    this.smooth(this.noiseFilter!.frequency, Math.min(4500, nf), 0.08);
    this.smooth(this.noiseGain!.gain, sim.running ? 0.015 + sim.throttlePos * 0.11 + (sim.spec.induction.type !== 'na' ? clamp01((rpm - 1800) / 4000) * 0.05 : 0) : 0, 0.09);

    // starter
    const cranking = sim.cranking && !sim.running;
    this.smooth(this.starterGain!.gain, cranking ? 0.16 : 0, 0.05);
    if (cranking) {
      this.smooth(this.starterOsc!.frequency, 130 + rpm * 0.25, 0.05);
      this.smooth(this.starterLfo!.frequency, Math.max(18, (rpm / 60) * cyl), 0.05);
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.master) this.smooth(this.master.gain, v, 0.05);
  }
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }

export const engineAudio = new EngineAudio();
