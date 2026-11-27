import { SESSIONS } from './data/sessions';
import { OBJECTIVE, STEPS, type StepId } from './data/steps';

const KEY = 'talk-less-learn-more/save/v1';

export interface Record_ { stars: number; best: number; plays: number }

export interface Save {
  v: 2;
  started: boolean;
  sessions: Record<string, Record_>;
  synth: Record_ & { done: boolean };
  insights: string[];
  moves: string[];
  readings: Record<string, string[]>;
  /** Step Mae last briefed. '' means you haven't met her. */
  maeSeen: StepId | 'done' | '';
  migrated?: boolean;
  settings: {
    timer: boolean; sound: boolean; music: boolean; voice: boolean; narrate: boolean; voiceRate: number;
    /** Used by the three.js renderer when present. */
    graphics?: 'auto' | 'low' | 'medium' | 'high';
  };
}

const blank = (): Save => ({
  v: 2,
  started: false,
  sessions: {},
  synth: { stars: 0, best: 0, plays: 0, done: false },
  insights: [],
  moves: [],
  readings: {},
  maeSeen: '',
  settings: { timer: true, sound: true, music: true, voice: true, narrate: false, voiceRate: 1 },
});

/** Pure migration from a raw save object. A save without `v` is treated as v1. */
export function migrate(raw: unknown): Save {
  const b = blank();
  if (!raw || typeof raw !== 'object') return b;
  const data = raw as Partial<Save> & { maeSeen?: number | string };
  if (data.v === 2) {
    return {
      ...b,
      ...data,
      v: 2,
      synth: { ...b.synth, ...data.synth },
      settings: { ...b.settings, ...data.settings },
      readings: data.readings ?? {},
      maeSeen: typeof data.maeSeen === 'string' ? data.maeSeen as Save['maeSeen'] : '',
    };
  }
  // v1: keep progress, reset Mae briefing so she explains the new path
  return {
    ...b,
    started: !!data.started,
    sessions: data.sessions ?? {},
    synth: { ...b.synth, ...data.synth },
    insights: data.insights ?? [],
    moves: data.moves ?? [],
    readings: {},
    maeSeen: '',
    migrated: true,
    settings: { ...b.settings, ...data.settings },
  };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return migrate(JSON.parse(raw));
  } catch {
    return blank();
  }
}

export const state: Save = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: play continues without saving */ }
}

export function resetSave() {
  const keepSettings = state.settings;
  Object.assign(state, blank(), { settings: keepSettings });
  save();
}

/** Replace in-memory state and persist it. Used when loading a save code. */
export function applySave(next: Save) {
  Object.assign(state, blank(), next, { v: 2 as const });
  save();
}

const SAVE_PREFIX = 'TLLM2.';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Portable save code for another browser or device. Progress already auto-saves on this one. */
export function exportSaveCode(s: Save = state): string {
  const json = JSON.stringify(s);
  return SAVE_PREFIX + bytesToBase64Url(new TextEncoder().encode(json));
}

export function parseSaveCode(code: string): { ok: true; save: Save } | { ok: false; error: string } {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!trimmed) return { ok: false, error: 'Paste a save code first.' };
  if (!/^TLLM2\./i.test(trimmed)) {
    return { ok: false, error: 'That doesn’t look like a Talk Less, Learn More save code. It should start with TLLM2.' };
  }
  try {
    const raw = new TextDecoder().decode(base64UrlToBytes(trimmed.slice(SAVE_PREFIX.length)));
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'That save code is empty or damaged.' };
    const saveData = migrate(parsed);
    if (!saveData.started && !Object.keys(saveData.sessions).length && !saveData.synth.done) {
      return { ok: false, error: 'That save code has no progress yet.' };
    }
    return { ok: true, save: saveData };
  } catch {
    return { ok: false, error: 'That save code couldn’t be read. Copy it again in one piece.' };
  }
}

const done = (id: StepId) => (id === 'wall' ? state.synth.done : (state.sessions[id]?.stars ?? 0) >= 1);

/** How many leading steps are cleared. */
export function progress() {
  let n = 0;
  while (n < STEPS.length && done(STEPS[n])) n++;
  return n;
}

export const currentStep = (): StepId | 'done' => STEPS[progress()] ?? 'done';

export const reached = (id: StepId) => STEPS.indexOf(id) <= progress();

/** Playable: reached in order, or already cleared in an older save. */
export const open = (id: StepId) => reached(id) || done(id);

export const MAX_STARS = SESSIONS.length * 3 + 3;

export function totalStars() {
  return SESSIONS.reduce((t, s) => t + (state.sessions[s.id]?.stars ?? 0), 0) + state.synth.stars;
}

/** Rank thresholds as fractions of MAX_STARS: 1, 0.75, 0.5, 0.25, 0. */
export function rankThresholds(max = MAX_STARS): [number, string][] {
  return [
    [Math.ceil(max * 1), 'Quiet Expert'],
    [Math.ceil(max * 0.75), 'Senior Researcher'],
    [Math.ceil(max * 0.5), 'Researcher'],
    [Math.ceil(max * 0.25), 'Junior Researcher'],
    [0, 'Research Intern'],
  ];
}

export const rank = () => rankThresholds().find(([min]) => totalStars() >= min)![1];

export function recordSession(id: string, stars: number, score: number, found: string[]) {
  const prev = state.sessions[id] ?? { stars: 0, best: 0, plays: 0 };
  state.sessions[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score), plays: prev.plays + 1 };
  for (const f of found) if (!state.insights.includes(f)) state.insights.push(f);
  save();
  return { prevStars: prev.stars, newBest: stars > prev.stars };
}

export function recordReading(sessionId: string, claimId: string) {
  const list = state.readings[sessionId] ?? [];
  if (!list.includes(claimId)) {
    state.readings[sessionId] = [...list, claimId];
    save();
  }
}

export function recordSynth(stars: number, score: number) {
  const prev = state.synth;
  state.synth = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score), plays: prev.plays + 1, done: prev.done || stars >= 1 };
  save();
  return { prevStars: prev.stars, firstClear: !prev.done && stars >= 1 };
}

export function learnMove(tag: string): boolean {
  if (state.moves.includes(tag)) return false;
  state.moves.push(tag);
  save();
  return true;
}

export function objective(): string {
  if (state.maeSeen === '') return 'Talk to Mae outside the lab.';
  const step = currentStep();
  if (step === 'done') return 'Replay sessions to earn every star.';
  return OBJECTIVE[step];
}
