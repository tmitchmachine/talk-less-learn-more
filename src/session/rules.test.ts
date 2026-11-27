import { describe, expect, it } from 'vitest';
import { debriefClaims, sessionScore, sessionStars } from './rules';
import { STEPS } from '../data/steps';
import { SESSIONS } from '../data/sessions';
import { currentStep, migrate, open, progress, rankThresholds, state } from '../state';

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
