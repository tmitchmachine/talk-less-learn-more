// Tiny procedural audio: chiptune blips and a gentle town loop. No audio files.
import { state } from './state';

let ac: AudioContext | null = null;
let master: GainNode | null = null;

function ctx(): AudioContext | null {
  if (!ac) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
    } catch {
      return null;
    }
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function tone(f: number, d: number, type: OscillatorType = 'square', v = 0.04, delay = 0, f2?: number, force = false) {
  if (!state.settings.sound && !force) return;
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + d + 0.03);
}

export const sfx = {
  unlockAudio: () => { ctx(); },
  blip: () => tone(900, 0.025, 'square', 0.012),
  select: () => { tone(520, 0.05, 'square', 0.03); tone(780, 0.07, 'square', 0.03, 0.05); },
  good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.13, 'square', 0.035, i * 0.08)),
  ok: () => { tone(440, 0.09, 'triangle', 0.06); tone(415, 0.12, 'triangle', 0.06, 0.11); },
  bad: () => tone(220, 0.32, 'sawtooth', 0.03, 0, 110),
  unlock: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, 'square', 0.035, i * 0.09)),
  note: () => { tone(1046, 0.08, 'square', 0.03); tone(1318, 0.12, 'square', 0.03, 0.07); },
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.18)),
  star: (i: number) => tone(660 + i * 220, 0.18, 'square', 0.04),
  talk: () => tone(320, 0.07, 'triangle', 0.05, 0, 560),
  tick: () => tone(1200, 0.02, 'square', 0.015),
  poof: () => tone(180, 0.25, 'triangle', 0.05, 0, 60),
};

// --- Music: a looping pentatonic tune, scheduled ahead with the audio clock. ---
const MELODY = [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0, 79, 0, 81, 79, 0, 76, 74, 0, 72, 74, 76, 0, 74, 0, 72, 0];
const BASS = [48, 0, 0, 0, 55, 0, 0, 0, 57, 0, 0, 0, 53, 0, 0, 0, 48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
let musicTimer: number | null = null;
let step = 0;
let nextTime = 0;
const STEP = 0.24;

export const music = {
  start() {
    if (musicTimer !== null || !state.settings.music) return;
    const a = ctx();
    if (!a) return;
    nextTime = a.currentTime + 0.1;
    musicTimer = window.setInterval(() => {
      const a2 = ctx();
      if (!a2 || !master) return;
      while (nextTime < a2.currentTime + 0.4) {
        const delay = nextTime - a2.currentTime;
        const m = MELODY[step % MELODY.length];
        const b = BASS[step % BASS.length];
        if (m) tone(midi(m), STEP * 1.6, 'triangle', 0.018, delay, undefined, true);
        if (b) tone(midi(b), STEP * 3.5, 'sine', 0.03, delay, undefined, true);
        step++;
        nextTime += STEP;
      }
    }, 100);
  },
  stop() {
    if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
  },
  sync() {
    if (state.settings.music) this.start(); else this.stop();
  },
};
