import { CLAIMS, type Claim } from '../data/claims';
import { SESSIONS, SILENCE, type Choice, type Mood, type Session, type Turn, sessionWho } from '../data/sessions';
import { learnMove, recordReading, recordSession, state } from '../state';
import { esc, ui } from '../ui/ui';
import { sfx } from '../audio';
import { debriefClaims, scoreSession } from './rules';

const OPEN_DELTA = { best: 10, ok: 0, bad: -15 } as const;
const TIMER_MS = 25000;

const wc = (s?: string) => (s && !/^\s*[[(]/.test(s) ? s.trim().split(/\s+/).length : 0);
function shuffle(n: number) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export interface SessionView {
  setMood(m: Mood): void;
  react(verdict: Choice['v'], unlocked: boolean): void;
  pingObserver(): void;
  walkOut(): Promise<void>;
  dim(on: boolean): void;
  alive(): boolean;
}

export async function runSession(index: number, view: SessionView): Promise<'retry' | 'back'> {
  const s = SESSIONS[index];
  const workshop = s.mode === 'workshop';
  let ti = 0;
  let openMeter = workshop ? 100 : 60;
  let ins = 0;
  let bias = 0;
  let you = 0;
  let them = 0;
  let streak = 0;
  const found: string[] = [];
  let mood: Mood = 'neutral';

  const whoId = sessionWho(s);
  const voiceId = (who: 'p' | 'obs') =>
    who === 'obs' ? (s.observer ?? 'jordan').toLowerCase() : whoId;

  const meters = () => {
    if (workshop) {
      ui.convoMeters({ open: 100, ins, mx: scoreSession(s, ins, bias, false, found).mx, bias, streak, t: s.turns[Math.min(ti, s.turns.length - 1)]?.t ?? '' });
      return;
    }
    const tu = s.turns[Math.min(ti, s.turns.length - 1)];
    ui.convoMeters({ open: openMeter, ins, mx: scoreSession(s, ins, bias, false, found).mx, bias, streak, t: tu.t });
  };

  const runTurn = async (): Promise<'retry' | 'back' | 'continue'> => {
    if (!view.alive()) return 'back';
    const tu = s.turns[ti];
    meters();
    if (tu.who === 'obs') view.pingObserver();
    if (tu.who === 'p' && tu.line) them += wc(tu.line);
    await ui.convoLine({
      ctx: tu.ctx,
      speaker: tu.who === 'obs' ? s.observer! : s.name,
      voiceId: voiceId(tu.who),
      mood,
      kind: tu.who,
      text: tu.line,
    });
    if (!view.alive()) return 'back';
    const order = shuffle(tu.choices.length);
    const toWhom = tu.who === 'obs' ? `Reply to ${s.observer}` : `What do you say to ${s.name}?`;
    const timer = workshop || !state.settings.timer ? 0 : TIMER_MS;
    const pick = await ui.convoChoices(order.map((i) => tu.choices[i]), timer, toWhom);
    if (!view.alive()) return 'back';
    const timedOut = pick < 0;
    const c = timedOut ? tu.choices.find((x) => x.silent) ?? SILENCE : tu.choices[order[pick]];
    return resolve(tu, c, timedOut);
  };

  const resolve = async (tu: Turn, c: Choice, timedOut: boolean): Promise<'retry' | 'back' | 'continue'> => {
    const rwho = c.rwho ?? tu.who;
    const toP = tu.who === 'p' || rwho === 'p';
    if (toP && !c.silent) you += wc(c.say);
    if (rwho === 'p') them += wc(c.reply);
    ins += c.ins;
    bias += c.bias;
    if (!workshop && toP) openMeter = Math.max(0, Math.min(100, openMeter + OPEN_DELTA[c.v]));
    streak = c.v === 'best' ? streak + 1 : 0;
    let unlocked: string | null = null;
    if (c.unlock && !found.includes(c.unlock)) {
      found.push(c.unlock);
      unlocked = s.insights[c.unlock];
    }
    const newMove = c.v === 'best' ? learnMove(c.tag) : false;
    if (rwho === 'p' && c.mood) { mood = c.mood; view.setMood(c.mood); }
    if (rwho === 'obs') view.pingObserver();
    view.react(c.v, !!unlocked);
    meters();

    await ui.convoReply({
      you: c.say, silent: c.silent, toObs: tu.who === 'obs' && !c.rwho,
      speaker: rwho === 'obs' ? s.observer! : s.name,
      voiceId: voiceId(rwho), mood, kind: rwho, text: c.reply,
    });
    if (!view.alive()) return 'back';
    const left = !workshop && openMeter <= 0;
    const best = c.v !== 'best' ? tu.choices.find((x) => x.v === 'best') : undefined;
    await ui.convoCoach({ c, best, timedOut, unlocked, newMove, left });
    if (!view.alive()) return 'back';
    if (left) return leave();
    ti++;
    if (ti >= s.turns.length) return finish(false);
    return 'continue';
  };

  const leave = async (): Promise<'retry' | 'back'> => {
    view.setMood('guarded');
    sfx.fail();
    await ui.convoLine({ speaker: s.name, voiceId: whoId, mood: 'guarded', kind: 'p', text: s.leave ?? 'I need to go.' });
    if (!view.alive()) return 'back';
    await view.walkOut();
    if (!view.alive()) return 'back';
    return finish(true);
  };

  const runDebrief = async (stars: number): Promise<void> => {
    if (workshop || stars < 1) return;
    const already = state.readings[s.id] ?? [];
    const pending = debriefClaims(s.id, found, already);
    if (!pending.length) return;
    view.dim(true);
    for (const claim of pending) {
      if (!view.alive()) break;
      await ui.convoLine({
        speaker: 'Your notes',
        voiceId: 'mae',
        mood: 'neutral',
        kind: 'p',
        text: claim.text,
      });
      if (!view.alive()) break;
      const choices = debriefChoices(claim);
      const pick = await ui.convoChoices(choices, 0, 'Tell the team, or park it?');
      if (!view.alive()) break;
      const c = choices[Math.max(0, pick)];
      const right = c.tag === (claim.call === 'tell' ? 'Tell the team' : 'Park it');
      if (right) recordReading(s.id, claim.id);
      await ui.convoCoach({
        c: { ...c, note: right ? claim.why : `Missed. ${claim.why}`, src: claim.src, v: right ? 'best' : 'bad', ins: 0, bias: 0, say: c.say },
        timedOut: false,
        unlocked: null,
        newMove: false,
        left: false,
        debrief: true,
      });
    }
    view.dim(false);
  };

  const finish = async (early: boolean): Promise<'retry' | 'back'> => {
    const { mx, score, stars, missing } = scoreSession(s, ins, bias, early, found);
    const { newBest } = recordSession(s.id, stars, score, found);
    if (!early && stars >= 1) await runDebrief(stars);
    if (!view.alive()) return 'back';

    const keys = Object.keys(s.insights);
    const wallLabel = s.wallTitle ?? 'What you heard';
    const readings = state.readings[s.id] ?? [];
    const sessionClaims = CLAIMS.filter((c) => c.session === s.id);
    const told = sessionClaims.filter((c) => c.call === 'tell' && readings.includes(c.id));
    const parked = sessionClaims.filter((c) => c.call === 'park' && readings.includes(c.id));
    const calledRight = readings.filter((id) => sessionClaims.some((c) => c.id === id)).length;

    let notesHtml = `<div class="res-notes"><h3>${esc(wallLabel)} · ${found.length} of ${keys.length}</h3><div class="stickies">${keys
      .map((k) => (found.includes(k) ? `<div class="sticky">${esc(s.insights[k])}</div>` : `<div class="sticky missed">Missed: ${esc(s.insights[k])}</div>`))
      .join('')}</div>`;
    if (!workshop && sessionClaims.length) {
      notesHtml += `<h3>Told the team</h3><div class="stickies">${told.length ? told.map((c) => `<div class="sticky">${esc(c.text)}</div>`).join('') : '<div class="sticky locked">None yet</div>'}</div>`;
      notesHtml += `<h3>Parked</h3><div class="stickies">${parked.length ? parked.map((c) => `<div class="sticky">${esc(c.text)}</div>`).join('') : '<div class="sticky locked">None yet</div>'}</div>`;
    }
    notesHtml += '</div>';

    const talk = you + them ? Math.round((you / (you + them)) * 100) : 0;
    const headline = early
      ? `${s.name} left early`
      : missing.length
        ? `Not on the wall yet: ${missing.map((id) => labelInsight(s, id)).join(', ')}`
        : ['Mostly your own opinions', 'Useful but steered', 'Solid, a few fingerprints', 'Clean, rich data'][stars];
    const sub = early
      ? 'Openness hit zero. Leading, pitching and interrupting push people away. Try the quieter, more open moves.'
      : missing.length
        ? 'You need the required pieces on the wall to earn a star. Try again and aim for the strong moves.'
        : stars === 0
          ? 'You need at least one star to move on. Try the quieter, more open moves.'
          : `Score ${Math.round(score * 100)}%: insight minus half your bias, against the best possible session.`;
    if (stars > 0) sfx.unlock(); else sfx.fail();

    const stats: [string, string][] = [
      [`${ins}/${mx}`, 'Insight'],
      [`${bias}`, 'Bias'],
      [`${found.length}/${keys.length}`, 'Insights found'],
    ];
    if (!workshop) {
      stats.push([`${talk}%`, 'Words that were yours']);
      if (sessionClaims.length) stats.push([`${calledRight}/${sessionClaims.length}`, 'Called right']);
    }

    const r = await ui.results({
      eyebrow: `${s.code} · ${s.kind} ${early ? 'ended' : 'complete'}`,
      title: s.name,
      stars,
      headline,
      sub,
      newBest,
      notesHtml,
      stats,
    });
    return r;
  };

  // Main loop
  while (view.alive()) {
    const result = await runTurn();
    if (result === 'continue') continue;
    return result;
  }
  return 'back';
}

function labelInsight(s: Session, id: string): string {
  const text = s.insights[id] ?? id;
  const short = text.split(/[:.]/)[0]?.trim();
  return short && short.length < 40 ? short : id;
}

function debriefChoices(claim: Claim): Choice[] {
  const tell: Choice = {
    v: claim.call === 'tell' ? 'best' : 'bad',
    tag: 'Tell the team',
    say: 'Tell the team.',
    ins: 0, bias: 0,
    note: claim.why,
    src: claim.src,
  };
  const park: Choice = {
    v: claim.call === 'park' ? 'best' : 'bad',
    tag: 'Park it',
    say: 'Park it.',
    ins: 0, bias: 0,
    note: claim.why,
    src: claim.src,
  };
  return [tell, park];
}
