// Spoken dialogue with the browser's built-in speech engine. No audio files.
// Every character gets their own voice (picked from what this device offers) plus a pitch and pace,
// so Mae, Rosa, Theo and the rest sound like different people.
import { state } from './state';
import { music } from './audio';

type Gender = 'f' | 'm' | 'n';
interface Profile { g: Gender; pitch: number; rate: number }

/** Voice character for each speaker. `narrator` reads signs, notes and stage directions. */
const PROFILES: Record<string, Profile> = {
  narrator: { g: 'n', pitch: 1, rate: 1.02 },
  player: { g: 'n', pitch: 1.05, rate: 1.04 },
  mae: { g: 'f', pitch: 0.94, rate: 0.96 },
  rosa: { g: 'f', pitch: 1.06, rate: 1.06 },
  theo: { g: 'm', pitch: 1.02, rate: 1.0 },
  priya: { g: 'f', pitch: 0.98, rate: 1.02 },
  jordan: { g: 'm', pitch: 1.1, rate: 1.1 },
  gus: { g: 'm', pitch: 0.84, rate: 0.94 },
  ivy: { g: 'f', pitch: 1.14, rate: 1.06 },
  pete: { g: 'm', pitch: 0.9, rate: 0.92 },
  nia: { g: 'f', pitch: 1.35, rate: 1.08 },
};

const MOOD_TWEAK: Record<string, { pitch: number; rate: number }> = {
  open: { pitch: 1.04, rate: 1.03 },
  neutral: { pitch: 1, rate: 1 },
  guarded: { pitch: 0.94, rate: 0.95 },
  confused: { pitch: 1.06, rate: 0.96 },
};

// Common voice names on macOS, iOS, Windows, Android and Chrome, sorted by how they sound.
const FEMALE = /samantha|victoria|karen|moira|tessa|fiona|serena|allison|\bava\b|susan|zoe|kate|aria|jenny|michelle|sonia|libby|emma|natasha|clara|zira|hazel|catherine|joanna|salli|kimberly|kendra|nicky|\bflo\b|sandy|shelley|female|woman|ana\b|emily|nora|olivia|sara|amy|kathy|ellie|jessa|molly|sienna|isla/i;
const MALE = /daniel|\balex\b|\btom\b|aaron|arthur|oliver|gordon|rishi|\blee\b|\bguy\b|ryan|christopher|eric|roger|steffan|brian|andrew|davis|\bmale\b|david|mark|george|james|evan|nathan|reed|rocko|eddy|matthew|joey|justin|liam|thomas|william|noah|jason|tony|ralph/i;
// Novelty voices (bells, whispers, robots) that would make lessons hard to follow.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ|fred|junior|grandma|grandpa/i;

const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let assigned: Record<string, SpeechSynthesisVoice | null> = {};
let current: string | null = null;
let pending = 0;
let unlocked = false;
const live = new Set<SpeechSynthesisUtterance>(); // Holds utterances so the browser can't garbage-collect them mid-line.
const waiting = new Set<() => void>();
const listeners = new Set<(who: string | null) => void>();

function quality(v: SpeechSynthesisVoice) {
  const n = v.name;
  let q = 0;
  if (/natural|neural|premium|enhanced|siri|wavenet/i.test(n)) q += 6;
  if (/online/i.test(n)) q += 3;
  if (/google/i.test(n)) q += 3;
  if (/en[-_]us/i.test(v.lang)) q += 2;
  else if (/en[-_](gb|au|ie|ca|nz)/i.test(v.lang)) q += 1;
  if (v.localService) q += 0.5;
  return q;
}
const genderOf = (v: SpeechSynthesisVoice): Gender => (FEMALE.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : 'n');

function assignVoices() {
  if (!synth) return;
  const all = synth.getVoices().filter((v) => /^en/i.test(v.lang) && !NOVELTY.test(v.name));
  if (!all.length) return;
  const byQ = [...all].sort((a, b) => quality(b) - quality(a));
  const pools: Record<Gender, SpeechSynthesisVoice[]> = { f: [], m: [], n: [] };
  for (const v of byQ) pools[genderOf(v)].push(v);
  // Only use voices that sound reasonably good, unless that leaves nothing to choose from.
  for (const g of ['f', 'm', 'n'] as Gender[]) {
    const top = pools[g][0] ? quality(pools[g][0]) : 0;
    pools[g] = pools[g].filter((v) => quality(v) >= top - 3);
  }
  const used: Record<Gender, number> = { f: 0, m: 0, n: 0 };
  assigned = {};
  const best = byQ[0];
  for (const [who, p] of Object.entries(PROFILES)) {
    if (who === 'narrator' || who === 'player') continue;
    const pool = pools[p.g].length ? pools[p.g] : pools.n.length ? pools.n : byQ;
    // Spread characters across the available voices so neighbours don't sound identical.
    assigned[who] = pool[used[p.g]++ % pool.length];
  }
  assigned.narrator = pools.f[0] && /natural|neural|premium|enhanced|siri|google|online/i.test(pools.f[0].name) ? pools.f[0] : best;
  assigned.player = pools.m[0] ?? best;
}
if (synth) {
  assignVoices();
  synth.addEventListener?.('voiceschanged', assignVoices);
}

/** Turns on-screen text into something that sounds natural when read aloud. */
function speakable(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s·\s/g, ', ')
    .replace(/\b([A-Z]{3,})\b/g, (w) => w[0] + w.slice(1).toLowerCase())
    .replace(/(\d+) lbs\b/g, '$1 pounds')
    .replace(/\.{3}|…/g, '... ')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits long text into sentences. Some browsers cut off a single utterance after about 15 seconds. */
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    if (out.length && (out[out.length - 1].length + s.length < 140)) out[out.length - 1] += ' ' + s;
    else out.push(s);
  }
  return out;
}

function setCurrent(who: string | null) {
  if (current === who) return;
  current = who;
  music.duck(!!who);
  listeners.forEach((fn) => fn(who));
}

export interface SayOpts { mood?: string; queue?: boolean; force?: boolean }

export const voice = {
  supported: !!synth,
  /** True when character voices are switched on and this browser can speak. */
  on: () => !!synth && state.settings.voice,
  narrating: () => !!synth && state.settings.voice && state.settings.narrate,

  /**
   * Speaks a line as `who`. Lines wrapped in parentheses are stage directions and are read by the
   * narrator as "<name> <action>". Returns a promise that settles when the line finishes or is cut off.
   */
  say(text: string | null | undefined, who = 'narrator', opts: SayOpts = {}): Promise<void> {
    if (!synth || !text || (!state.settings.voice && !opts.force)) return Promise.resolve();
    let speaker = who in PROFILES ? who : 'narrator';
    let t = text.trim();
    const stage = /^\((.*)\)$/.exec(t);
    if (stage) {
      const name = who in PROFILES && who !== 'narrator' ? who[0].toUpperCase() + who.slice(1) : '';
      t = `${name} ${stage[1]}`.trim();
      speaker = 'narrator';
    } else {
      t = t.replace(/\([^)]*\)/g, ' ');
    }
    t = speakable(t);
    if (!t) return Promise.resolve();
    if (!opts.queue) voice.stop();
    if (!Object.keys(assigned).length) assignVoices();
    const p = PROFILES[speaker];
    const m = MOOD_TWEAK[opts.mood ?? 'neutral'] ?? MOOD_TWEAK.neutral;
    const pace = state.settings.voiceRate ?? 1;
    const parts = chunks(t);
    return new Promise((done) => {
      const resolve = () => { waiting.delete(resolve); done(); };
      waiting.add(resolve);
      let left = parts.length;
      for (const part of parts) {
        const u = new SpeechSynthesisUtterance(part);
        const v = assigned[speaker];
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
        u.pitch = Math.max(0.1, Math.min(2, p.pitch * m.pitch));
        u.rate = Math.max(0.5, Math.min(2, p.rate * m.rate * pace));
        u.volume = 1;
        pending++;
        live.add(u);
        u.onstart = () => setCurrent(stage ? 'narrator' : who);
        const end = () => {
          if (!live.delete(u)) return;
          pending = Math.max(0, pending - 1);
          if (pending === 0) setCurrent(null);
          if (--left === 0) resolve();
        };
        u.onend = end;
        u.onerror = end;
        synth.speak(u);
      }
    });
  },

  /** Call from a click or key press: some browsers (iOS Safari) only allow speech after a user gesture. */
  unlock() {
    if (!synth || unlocked) return;
    unlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  },

  stop() {
    if (!synth) return;
    if (pending || synth.speaking || synth.pending) synth.cancel();
    live.clear();
    pending = 0;
    setCurrent(null);
    [...waiting].forEach((r) => r());
  },

  /** Who is speaking right now (a cast id or "narrator"), or null. */
  current: () => current,
  onChange(fn: (who: string | null) => void) { listeners.add(fn); return () => listeners.delete(fn); },
};

// Stop talking when the tab is hidden, so a line doesn't play to an empty room.
document.addEventListener('visibilitychange', () => { if (document.hidden) voice.stop(); });
