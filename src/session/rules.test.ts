import { describe, expect, it } from 'vitest';
import { debriefClaims, sessionScore, sessionStars } from './rules';
import { STEPS } from '../data/steps';
import { SESSIONS } from '../data/sessions';
import { applySave, currentStep, exportSaveCode, migrate, open, parseSaveCode, progress, rankThresholds, state } from '../state';

describe('progress helpers via migrate and STEPS', () => {
  it('STEPS holds every SESSIONS id once, in order, plus wall', () => {
    const sessionIds = SESSIONS.map((s) => s.id);
    expect(STEPS.filter((id) => id !== 'wall')).toEqual(sessionIds);
    expect(new Set(STEPS).size).toBe(STEPS.length);
  });

  it('a blank migrate starts ready for kickoff', () => {
    const s = migrate(null);
    expect(s.v).toBe(2);
    expect(s.maeSeen).toBe('');
    expect(s.sessions).toEqual({});
  });

  it('a new save starts at kickoff; wall needs synth.done', () => {
    const snap = structuredClone(state);
    Object.assign(state, migrate(null));
    expect(currentStep()).toBe('kickoff');
    expect(progress()).toBe(0);
    expect(open('kickoff')).toBe(true);
    expect(open('len')).toBe(false);
    state.sessions.kickoff = { stars: 1, best: 0.5, plays: 1 };
    expect(currentStep()).toBe('len');
    expect(open('len')).toBe(true);
    for (const id of STEPS) {
      if (id === 'wall') state.synth.done = true;
      else state.sessions[id] = { stars: 1, best: 0.5, plays: 1 };
    }
    expect(currentStep()).toBe('done');
    Object.assign(state, snap);
  });

  it('migrate keeps a v1 save’s stars and resets Mae; open keeps cleared visits', () => {
    const snap = structuredClone(state);
    const raw = {
      started: true,
      sessions: {
        rosa: { stars: 2, best: 0.7, plays: 1 },
        theo: { stars: 3, best: 0.9, plays: 2 },
        priya: { stars: 1, best: 0.4, plays: 1 },
      },
      synth: { stars: 2, best: 0.8, plays: 1, done: true },
      insights: ['r1', 't1', 'p1'],
      moves: ['Echo'],
      maeSeen: 4,
      settings: { timer: false, sound: true, music: true, voice: true, narrate: false, voiceRate: 1 },
    };
    const s = migrate(raw);
    expect(s.v).toBe(2);
    expect(s.migrated).toBe(true);
    expect(s.maeSeen).toBe('');
    expect(s.sessions.rosa.stars).toBe(2);
    expect(s.sessions.theo.stars).toBe(3);
    expect(s.sessions.priya.stars).toBe(1);
    expect(s.synth.done).toBe(true);
    expect(s.insights).toEqual(['r1', 't1', 'p1']);
    expect(s.moves).toEqual(['Echo']);
    expect(s.settings.timer).toBe(false);
    Object.assign(state, s);
    expect(currentStep()).toBe('kickoff');
    expect(open('theo')).toBe(true);
    expect(open('priya')).toBe(true);
    expect(open('len')).toBe(false);
    Object.assign(state, snap);
  });
});

describe('ranks', () => {
  it('at MAX_STARS 12, thresholds fall at 12, 9, 6, 3, 0', () => {
    expect(rankThresholds(12).map(([n]) => n)).toEqual([12, 9, 6, 3, 0]);
  });

  it('at MAX_STARS 30, thresholds fall at 30, 23, 15, 8, 0', () => {
    expect(rankThresholds(30).map(([n]) => n)).toEqual([30, 23, 15, 8, 0]);
  });
});

describe('mustFind gate', () => {
  it('a perfect score earns 0 stars when one mustFind insight is missing', () => {
    const { stars, missing } = sessionStars(1, false, ['k1', 'k2', 'k3'], ['k1', 'k2', 'k3', 'k4']);
    expect(stars).toBe(0);
    expect(missing).toEqual(['k4']);
  });

  it('earns stars when mustFind is complete', () => {
    const { stars, missing } = sessionStars(0.9, false, ['k1', 'k2', 'k3', 'k4'], ['k1', 'k2', 'k3', 'k4']);
    expect(stars).toBe(3);
    expect(missing).toEqual([]);
  });

  it('sessionScore clamps insight minus half bias', () => {
    expect(sessionScore(100, 20, 100, false)).toBe(0.9);
    expect(sessionScore(10, 0, 100, true)).toBe(0);
  });
});

describe('portable save codes', () => {
  it('round-trips progress through export and parse', () => {
    const sample = migrate({
      v: 2,
      started: true,
      sessions: { kickoff: { stars: 2, best: 0.8, plays: 1 }, len: { stars: 1, best: 0.4, plays: 2 } },
      synth: { stars: 0, best: 0, plays: 0, done: false },
      insights: ['l1'],
      moves: ['echo'],
      readings: { len: ['len-1'] },
      maeSeen: 'len',
      settings: { timer: false, sound: true, music: false, voice: true, narrate: true, voiceRate: 1.1 },
    });
    const code = exportSaveCode(sample);
    expect(code.startsWith('TLLM2.')).toBe(true);
    const parsed = parseSaveCode(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.save.started).toBe(true);
    expect(parsed.save.sessions.kickoff?.stars).toBe(2);
    expect(parsed.save.sessions.len?.stars).toBe(1);
    expect(parsed.save.insights).toEqual(['l1']);
    expect(parsed.save.moves).toEqual(['echo']);
    expect(parsed.save.readings.len).toEqual(['len-1']);
    expect(parsed.save.maeSeen).toBe('len');
    expect(parsed.save.settings.timer).toBe(false);
    expect(parsed.save.settings.narrate).toBe(true);
  });

  it('accepts whitespace inside a pasted code', () => {
    const sample = migrate({ v: 2, started: true, sessions: { kickoff: { stars: 1, best: 0.5, plays: 1 } } });
    const code = exportSaveCode(sample);
    const broken = `${code.slice(0, 12)}\n  ${code.slice(12)}`;
    const parsed = parseSaveCode(broken);
    expect(parsed.ok).toBe(true);
  });

  it('rejects empty, wrong-prefix and blank progress codes', () => {
    expect(parseSaveCode('').ok).toBe(false);
    expect(parseSaveCode('HELLO.abc').ok).toBe(false);
    const blank = exportSaveCode(migrate(null));
    const empty = parseSaveCode(blank);
    expect(empty.ok).toBe(false);
  });

  it('applySave replaces in-memory progress', () => {
    const snap = structuredClone(state);
    const loaded = migrate({
      v: 2,
      started: true,
      sessions: { kickoff: { stars: 3, best: 1, plays: 1 } },
      maeSeen: 'kickoff',
    });
    applySave(loaded);
    expect(state.sessions.kickoff?.stars).toBe(3);
    expect(state.maeSeen).toBe('kickoff');
    expect(currentStep()).toBe('len');
    Object.assign(state, snap);
  });
});

describe('debrief claim filtering', () => {
  it('shows a claim with needs only if that insight was found', () => {
    const withNeed = debriefClaims('len', ['l1'], []);
    expect(withNeed.some((c) => c.id === 'len-1')).toBe(true);
    const without = debriefClaims('len', [], []);
    expect(without.some((c) => c.id === 'len-1')).toBe(false);
    expect(without.some((c) => c.id === 'len-6')).toBe(true);
  });

  it('skips claims already in readings', () => {
    const pending = debriefClaims('len', ['l1', 'l4', 'l5'], ['len-1', 'len-6']);
    expect(pending.some((c) => c.id === 'len-1')).toBe(false);
    expect(pending.some((c) => c.id === 'len-6')).toBe(false);
    expect(pending.length).toBeGreaterThan(0);
  });

  it('a fully called session gets no debrief claims', () => {
    const all = debriefClaims('len', ['l1', 'l4', 'l5'], [
      'len-1', 'len-2', 'len-3', 'len-4', 'len-5', 'len-6',
    ]);
    expect(all).toEqual([]);
  });
});
