import { SESSIONS } from './data/sessions';

const KEY = 'talk-less-learn-more/save/v1';

export interface Record_ { stars: number; best: number; plays: number }

export interface Save {
  started: boolean;
  sessions: Record<string, Record_>;
  synth: Record_ & { done: boolean };
  insights: string[];
  moves: string[];
  maeSeen: number;
  settings: { timer: boolean; sound: boolean; music: boolean; voice: boolean; narrate: boolean; voiceRate: number };
}

const blank = (): Save => ({
  started: false,
  sessions: {},
  synth: { stars: 0, best: 0, plays: 0, done: false },
  insights: [],
  moves: [],
  maeSeen: -1,
  settings: { timer: true, sound: true, music: true, voice: true, narrate: false, voiceRate: 1 },
});

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw) as Partial<Save>;
    const b = blank();
    return { ...b, ...data, synth: { ...b.synth, ...data.synth }, settings: { ...b.settings, ...data.settings } };
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

/** Number of sessions completed in order (with at least one star). */
export function stage(): number {
  let n = 0;
  for (const s of SESSIONS) {
    if ((state.sessions[s.id]?.stars ?? 0) >= 1) n++;
    else break;
  }
  return n;
}

/** Story stage used for Mae's dialogue: 0–3 sessions, 4 once the wall is sorted. */
export const storyStage = () => stage() + (state.synth.done ? 1 : 0);

export const isUnlocked = (i: number) => i <= stage();

export const MAX_STARS = SESSIONS.length * 3 + 3;

export function totalStars() {
  return SESSIONS.reduce((t, s) => t + (state.sessions[s.id]?.stars ?? 0), 0) + state.synth.stars;
}

const RANKS: [number, string][] = [
  [12, 'Quiet Expert'],
  [9, 'Senior Researcher'],
  [6, 'Researcher'],
  [3, 'Junior Researcher'],
  [0, 'Research Intern'],
];
export const rank = () => RANKS.find(([min]) => totalStars() >= min)![1];

export function recordSession(id: string, stars: number, score: number, found: string[]) {
  const prev = state.sessions[id] ?? { stars: 0, best: 0, plays: 0 };
  state.sessions[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score), plays: prev.plays + 1 };
  for (const f of found) if (!state.insights.includes(f)) state.insights.push(f);
  save();
  return { prevStars: prev.stars, newBest: stars > prev.stars };
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
  if (state.maeSeen < 0) return 'Talk to Mae outside the lab.';
  const st = stage();
  if (st === 0) return 'Interview Rosa at the taco truck (southwest market).';
  if (st === 1) return 'Run a usability test with Theo at the vet clinic (east).';
  if (st === 2) return 'Meet Priya at Kite Bank (southeast).';
  if (!state.synth.done) return 'Go into the lab and sort the insight wall.';
  if (state.maeSeen < 4) return 'Tell Mae what you learned.';
  return 'Replay sessions to earn every star.';
}
