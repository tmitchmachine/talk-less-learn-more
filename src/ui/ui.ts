// DOM interface drawn over the game canvas. Text stays sharp and readable at any size,
// and every control is a real button for keyboard, mouse, touch and screen readers.
import { SRC, type SrcKey } from '../data/sources';
import { MOVES, SESSIONS, sessionWho, type Choice, type Session } from '../data/sessions';
import { BINS, type BinKey, type SortCard } from '../data/sort';
import { claimsFor } from '../data/claims';
import { DEFINED_STATEMENT, KICKOFF_STATEMENT, OTHER_CYCLE_METHODS } from '../data/steps';
import { PORTRAIT_URL } from '../art/draw';
import { sfx, music } from '../audio';
import { voice } from '../voice';
import { state, save, rank, totalStars, MAX_STARS, objective } from '../state';

const root = document.getElementById('ui')!;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Shows a "speaking" equalizer next to whoever is talking.
voice.onChange((who) => {
  root.querySelectorAll<HTMLElement>('[data-who]').forEach((n) => n.classList.toggle('speaking', !!who && n.dataset.who === who));
});

const SPEAKER_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`;
const EQ = `<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
const listenBtn = (label = 'Listen') => (voice.supported ? `<button class="listen" data-a="listen" aria-label="${label}" title="${label}">${SPEAKER_ICON}</button>` : '');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const arr = <T,>(x: T | T[]) => (Array.isArray(x) ? x : [x]);
export const srcLinks = (src: SrcKey | SrcKey[]) =>
  arr(src).map((k) => `<a href="${SRC[k].u}" target="_blank" rel="noopener">${esc(SRC[k].t)}</a>`).join(' · ');
const stars = (n: number, max = 3) => Array.from({ length: max }, (_, i) => `<i class="star ${i < n ? 'on' : ''}"></i>`).join('');

function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

root.innerHTML = `
  <div id="hud" hidden>
    <div class="hud-left panel slim">
      <div class="hud-rank"><span class="hud-rank-name"></span><span class="hud-stars"></span></div>
      <div class="hud-obj"></div>
    </div>
    <div class="hud-right">
      <button class="pbtn alt small" data-hud="journal" aria-label="Open journal (J)">Journal <kbd>J</kbd></button>
      <button class="pbtn alt small" data-hud="menu" aria-label="Open menu (Esc)">Menu</button>
    </div>
  </div>
  <div id="prompt" hidden></div>
  <div id="joy" hidden><div class="joy-base"></div><div class="joy-knob"></div></div>
  <div id="layer"></div>
  <div id="toasts" aria-live="polite"></div>
  <div id="sr" class="sr-only" aria-live="polite"></div>
`;
const layer = root.querySelector<HTMLElement>('#layer')!;
const hudEl = root.querySelector<HTMLElement>('#hud')!;
const promptEl = root.querySelector<HTMLElement>('#prompt')!;
const joyEl = root.querySelector<HTMLElement>('#joy')!;
const srEl = root.querySelector<HTMLElement>('#sr')!;

/* ---------------- keyboard routing ---------------- */
type KeyFn = (e: KeyboardEvent) => boolean | void;
const keyStack: KeyFn[] = [];
function pushKeys(fn: KeyFn) {
  keyStack.push(fn);
  return () => { const i = keyStack.lastIndexOf(fn); if (i >= 0) keyStack.splice(i, 1); };
}
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if ((e.key === 'Enter' || e.key === ' ') && t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return;
  const fn = keyStack[keyStack.length - 1];
  if (fn && fn(e)) { e.preventDefault(); e.stopPropagation(); }
}, true);

let busyCount = 0;
let lastClose = 0;

/* ---------------- typewriter ---------------- */
interface Typer { finished: boolean; skip: () => void; done: Promise<void> }
function typeInto(node: HTMLElement, text: string, cps = 48): Typer {
  srEl.textContent = text;
  if (reduced || !text) { node.textContent = text; return { finished: true, skip: () => {}, done: Promise.resolve() }; }
  let i = 0;
  let resolve!: () => void;
  const t: Typer = { finished: false, skip: () => finish(), done: new Promise<void>((r) => (resolve = r)) };
  node.textContent = '';
  const id = window.setInterval(() => {
    i += 1;
    node.textContent = text.slice(0, i);
    if (i % 3 === 0 && text[i - 1] !== ' ' && !voice.on()) sfx.blip();
    if (i >= text.length) finish();
  }, 1000 / cps);
  function finish() {
    if (t.finished) return;
    clearInterval(id);
    node.textContent = text;
    t.finished = true;
    resolve();
  }
  return t;
}

/* ---------------- generic modal ---------------- */
function modal(html: string, cls = '', wrapCls = '') {
  busyCount++;
  const wrap = el(`<div class="modal-wrap ${wrapCls}"><div class="modal panel ${cls}" role="dialog" aria-modal="true">${html}</div></div>`);
  layer.append(wrap);
  const box = wrap.firstElementChild as HTMLElement;
  let closed = false;
  return {
    box,
    close: () => {
      if (closed) return;
      closed = true;
      wrap.remove();
      busyCount--;
      lastClose = performance.now();
    },
  };
}

type BoolSetting = 'timer' | 'sound' | 'music' | 'voice' | 'narrate';
const RATES: [number, string][] = [[0.85, 'Relaxed'], [1, 'Normal'], [1.2, 'Brisk']];

function settingsHtml() {
  const row = (k: BoolSetting, label: string, hint: string) =>
    `<label class="toggle"><input type="checkbox" data-set="${k}" ${state.settings[k] ? 'checked' : ''}><span class="tg"></span><span><b>${label}</b><small>${hint}</small></span></label>`;
  const voices = voice.supported
    ? `${row('voice', 'Character voices', 'Everyone speaks their lines out loud, each with their own voice.')}
       ${row('narrate', 'Read everything aloud', 'Also reads scene notes, your own lines, coaching tips and results.')}
       <div class="seg-row"><b>Voice speed</b><div class="seg" role="radiogroup" aria-label="Voice speed">${RATES.map(([v, l]) =>
         `<button role="radio" data-rate="${v}" aria-checked="${state.settings.voiceRate === v}">${l}</button>`).join('')}</div></div>`
    : `<p class="muted">Spoken dialogue isn’t available in this browser.</p>`;
  return `<div class="settings">
    <h3 class="set-h">Audio</h3>
    ${voices}
    ${row('sound', 'Sound effects', 'Chimes and soft clicks.')}
    ${row('music', 'Music', 'A gentle town tune. It gets quieter while people talk.')}
    <h3 class="set-h">Pace</h3>
    ${row('timer', 'Choice timer', 'Answer within 25 seconds, or you stay silent. Turn off for a relaxed pace.')}
  </div>`;
}
function wireSettings(box: HTMLElement) {
  box.querySelectorAll<HTMLInputElement>('input[data-set]').forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.set as BoolSetting;
      state.settings[k] = inp.checked;
      save();
      if (k === 'music') music.sync();
      if (k === 'voice') { if (inp.checked) void voice.say('Voices on.', 'mae'); else voice.stop(); }
      if (k === 'narrate' && inp.checked) void voice.say('I’ll read everything aloud.', 'narrator');
      sfx.select();
    };
  });
  box.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((b) => {
    b.onclick = () => {
      state.settings.voiceRate = Number(b.dataset.rate);
      save();
      box.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      void voice.say('This is how fast I’ll talk.', 'mae', { force: true });
    };
  });
}

/** Lip sync: swaps a portrait to its open-mouth frame while that person's voice is playing. */
function lipSync(img: HTMLImageElement, who: () => string | undefined) {
  let flap = 0;
  const id = window.setInterval(() => {
    const f = who();
    if (!f || !PORTRAIT_URL[`${f}-talk`]) return;
    const k = voice.current() === f && ++flap % 3 !== 0 ? `${f}-talk` : f;
    if (img.dataset.k !== k) { img.src = PORTRAIT_URL[k]; img.dataset.k = k; }
  }, 130);
  return () => clearInterval(id);
}

/** Wires a speaker button to read `text` again on demand. */
function wireListen(scope: HTMLElement, fn: () => void) {
  scope.querySelectorAll<HTMLButtonElement>('[data-a=listen]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); sfx.unlockAudio(); fn(); };
  });
}

/* ---------------- public API ---------------- */
export const ui = {
  busy: () => busyCount > 0,
  justClosed: () => performance.now() - lastClose < 250,
  onReset: (() => {}) as () => void,

  toast(text: string, kind: 'good' | 'info' = 'info') {
    const t = el(`<div class="toast panel slim ${kind}">${esc(text)}</div>`);
    root.querySelector('#toasts')!.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  },

  /* ---------- title ---------- */
  title(opts: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
    const m = modal(`
      <div class="title-logo">
        <div class="title-note" aria-hidden="true"><span></span><span></span><span></span></div>
        <h1>Talk Less,<br><em>Learn More</em></h1>
      </div>
      <p class="title-sub">A pixel RPG about talking to customers. Ask well, listen more, and fill the insight wall.</p>
      ${voice.supported ? `<p class="title-voice">${SPEAKER_ICON}<span>Fully voiced. Turn your sound on.</span></p>` : ''}
      <div class="title-btns">
        ${opts.canContinue ? `<button class="pbtn" data-a="cont">Continue</button>` : ''}
        <button class="pbtn ${opts.canContinue ? 'alt' : ''}" data-a="new">${opts.canContinue ? 'New game' : 'Start'}</button>
        <button class="pbtn alt" data-a="how">How to play</button>
        <button class="pbtn alt" data-a="settings">Settings</button>
      </div>
      <div class="title-panel" hidden></div>
      <p class="title-credit">Every lesson comes from articles by <a href="https://www.nngroup.com" target="_blank" rel="noopener">Nielsen Norman Group</a>. Unofficial study game, not affiliated with NN/g.</p>
    `, 'title', 'title-wrap');
    const panel = m.box.querySelector<HTMLElement>('.title-panel')!;
    const btns = m.box.querySelector<HTMLElement>('.title-btns')!;
    const go = (fn: () => void) => { off(); m.close(); sfx.unlockAudio(); voice.unlock(); music.sync(); sfx.select(); fn(); };
    const confirmNew = () => {
      btns.innerHTML = `<p class="confirm">Start over? Your stars, insights and moves will be erased.</p>
        <button class="pbtn" data-a="yes">Yes, start over</button><button class="pbtn alt" data-a="no">Keep my progress</button>`;
      wire();
    };
    const wire = () => {
      m.box.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => {
        b.onclick = () => {
          const a = b.dataset.a;
          if (a === 'cont') go(opts.onContinue);
          if (a === 'new') { if (opts.canContinue) confirmNew(); else go(opts.onNew); }
          if (a === 'yes') go(opts.onNew);
          if (a === 'no') { off(); m.close(); ui.title(opts); }
          if (a === 'how') {
            panel.hidden = !(panel.hidden || panel.dataset.v !== 'how');
            panel.dataset.v = 'how';
            panel.innerHTML = `<ul class="howto">
              <li><b>Walk</b> with arrow keys or WASD. On a phone, drag anywhere.</li>
              <li><b>Talk</b> with E or Space, or tap the prompt.</li>
              <li><b>In a session</b>, pick what to say with 1–4 or a tap. Silence is often an option.</li>
              <li><b>Openness</b> drops when you lead, pitch or interrupt. At zero, the customer leaves.</li>
              <li><b>Insight</b> rises when customers tell you what really happens. After a session, tell the team or park each note.</li>
              <li><b>Bias</b> rises when your words end up in their mouths. Your score loses half a point for each point of bias.</li>
              <li><b>Start with the problem</b>: who, what, where, when, why — and leave the solution out.</li>
              <li><b>Listen</b> to any line again with the speaker button. Turn on “Read everything aloud” in Settings to hear coaching tips too.</li>
            </ul>`;
          }
          if (a === 'settings') {
            sfx.unlockAudio();
            voice.unlock();
            panel.hidden = !(panel.hidden || panel.dataset.v !== 'settings');
            panel.dataset.v = 'settings';
            panel.innerHTML = settingsHtml();
            wireSettings(panel);
          }
        };
      });
    };
    wire();
    const off = pushKeys((e) => {
      if (e.key === 'Enter') { (m.box.querySelector<HTMLButtonElement>('.title-btns .pbtn'))?.click(); return true; }
      return false;
    });
  },

  /* ---------- HUD ---------- */
  hud(show: boolean, handlers?: { journal: () => void; menu: () => void }) {
    hudEl.hidden = !show;
    if (handlers) {
      hudEl.querySelector<HTMLButtonElement>('[data-hud=journal]')!.onclick = handlers.journal;
      hudEl.querySelector<HTMLButtonElement>('[data-hud=menu]')!.onclick = handlers.menu;
    }
    if (show) ui.hudUpdate();
  },
  hudUpdate() {
    hudEl.querySelector('.hud-rank-name')!.textContent = rank();
    hudEl.querySelector('.hud-stars')!.innerHTML = `<i class="star on"></i> ${totalStars()} / ${MAX_STARS}`;
    hudEl.querySelector('.hud-obj')!.textContent = objective();
  },

  prompt(label: string | null, onTap?: () => void) {
    if (!label) { if (!promptEl.hidden) { promptEl.hidden = true; promptEl.dataset.l = ''; } return; }
    if (promptEl.dataset.l === label && !promptEl.hidden) return;
    promptEl.dataset.l = label;
    promptEl.hidden = false;
    promptEl.innerHTML = `<button class="prompt-btn panel slim"><kbd>E</kbd> ${esc(label)}</button>`;
    promptEl.querySelector('button')!.onclick = () => onTap?.();
  },

  joy(x: number | null, y = 0, kx = 0, ky = 0) {
    if (x === null) { joyEl.hidden = true; return; }
    joyEl.hidden = false;
    joyEl.style.transform = `translate(${x}px, ${y}px)`;
    (joyEl.querySelector('.joy-knob') as HTMLElement).style.transform = `translate(${kx}px, ${ky}px)`;
  },

  /* ---------- NPC dialogue ---------- */
  dialog(pages: { name: string; text: string; face?: string }[]): Promise<void> {
    return new Promise((resolve) => {
      busyCount++;
      const box = el(`<div class="dlg panel" role="dialog" aria-label="Conversation">
        <div class="dlg-face-wrap" hidden><img class="dlg-face" alt=""></div>
        <div class="dlg-body">
          <div class="dlg-head"><div class="dlg-name"></div>${EQ}${listenBtn('Hear this line again')}</div>
          <div class="dlg-text"></div>
        </div>
        <div class="dlg-foot" aria-hidden="true"><span class="dlg-count"></span><span class="dlg-hint">Space / tap</span><span class="dlg-next">▼</span></div>
      </div>`);
      layer.append(box);
      const faceWrap = box.querySelector<HTMLElement>('.dlg-face-wrap')!;
      const img = box.querySelector<HTMLImageElement>('.dlg-face')!;
      const name = box.querySelector<HTMLElement>('.dlg-name')!;
      const text = box.querySelector<HTMLElement>('.dlg-text')!;
      const count = box.querySelector<HTMLElement>('.dlg-count')!;
      let i = 0;
      let tw: Typer | null = null;
      const speak = (force = false) => { const p = pages[i]; void voice.say(p.text, p.face ?? 'narrator', { force }); };
      const show = () => {
        const p = pages[i];
        name.textContent = p.name;
        box.dataset.who = p.face ?? 'narrator';
        count.textContent = pages.length > 1 ? `${i + 1} / ${pages.length}` : '';
        if (p.face && PORTRAIT_URL[p.face]) { img.src = PORTRAIT_URL[p.face]; img.dataset.k = p.face; faceWrap.hidden = false; } else faceWrap.hidden = true;
        box.classList.toggle('noface', faceWrap.hidden);
        box.classList.remove('ready');
        tw = typeInto(text, p.text);
        speak();
        void tw.done.then(() => box.classList.add('ready'));
      };
      wireListen(box, () => speak(true));
      const stopSync = lipSync(img, () => pages[i]?.face);
      const close = () => { off(); stopSync(); voice.stop(); box.remove(); busyCount--; lastClose = performance.now(); resolve(); };
      const advance = () => {
        if (tw && !tw.finished) { tw.skip(); return; }
        i++;
        if (i >= pages.length) close(); else { sfx.blip(); show(); }
      };
      box.addEventListener('click', advance);
      const off = pushKeys((e) => {
        if (e.key === 'Escape') { close(); return true; }
        if (e.key === 'l' || e.key === 'L') { speak(true); return true; }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { advance(); return true; }
        return false;
      });
      show();
    });
  },

  /* ---------- session intro ---------- */
  sessionIntro(s: Session, rec: { stars: number; plays: number } | undefined): Promise<boolean> {
    return new Promise((resolve) => {
      const who = sessionWho(s);
      const workshop = s.mode === 'workshop';
      const startBtn = workshop
        ? `<button class="pbtn" data-a="yes">Start</button>`
        : `<button class="pbtn rec-btn" data-a="yes"><i class="rec-dot"></i>Start recording</button>`;
      const m = modal(`
        <div class="intro-head">
          <img class="intro-face" src="${PORTRAIT_URL[who] ?? ''}" alt="">
          <div>
            <div class="eyebrow">${esc(s.code)} · ${esc(s.kind)} · ${esc(s.place)}</div>
            <h2>${esc(s.name)}</h2>
            <div class="muted">${esc(s.role)}</div>
            ${rec ? `<div class="intro-best">Best: ${stars(rec.stars)}</div>` : ''}
          </div>
        </div>
        <p class="intro-greet"><span>“${esc(s.greet)}”</span>${listenBtn('Hear the briefing')}</p>
        <p>${esc(s.setup)}</p>
        <div class="goal"><b>Research goal</b>${esc(s.goal)}</div>
        ${s.problem ? `<div class="goal"><b>Problem statement</b>${esc(s.problem)}</div>` : ''}
        <div class="chips">${s.skills.map((k) => `<span>${esc(k)}</span>`).join('')}</div>
        <div class="row-end">
          <button class="pbtn alt" data-a="no">Not now</button>
          ${startBtn}
        </div>
      `, 'intro');
      const brief = (force = false) => {
        void voice.say(s.greet, who, { force });
        if (force || voice.narrating()) {
          void voice.say(s.setup, 'narrator', { queue: true, force });
          void voice.say(`Research goal: ${s.goal}`, 'narrator', { queue: true, force });
          if (s.problem) void voice.say(`Problem statement: ${s.problem}`, 'narrator', { queue: true, force });
        }
      };
      brief();
      wireListen(m.box, () => brief(true));
      const stopSync = lipSync(m.box.querySelector<HTMLImageElement>('.intro-face')!, () => who);
      const done = (v: boolean) => { off(); stopSync(); voice.stop(); m.close(); if (v) sfx.talk(); resolve(v); };
      m.box.querySelector<HTMLButtonElement>('[data-a=yes]')!.onclick = () => done(true);
      m.box.querySelector<HTMLButtonElement>('[data-a=no]')!.onclick = () => done(false);
      const off = pushKeys((e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { done(true); return true; }
        if (e.key === 'Escape') { done(false); return true; }
        return false;
      });
    });
  },

  confirm(title: string, body: string, yes: string, no: string): Promise<boolean> {
    return new Promise((resolve) => {
      const m = modal(`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="row-end"><button class="pbtn alt" data-a="no">${esc(no)}</button><button class="pbtn" data-a="yes">${esc(yes)}</button></div>`, 'small');
      const done = (v: boolean) => { off(); m.close(); resolve(v); };
      m.box.querySelector<HTMLButtonElement>('[data-a=yes]')!.onclick = () => done(true);
      m.box.querySelector<HTMLButtonElement>('[data-a=no]')!.onclick = () => done(false);
      const off = pushKeys((e) => {
        if (e.key === 'Enter') { done(true); return true; }
        if (e.key === 'Escape') { done(false); return true; }
        return false;
      });
    });
  },

  pick(title: string, options: { id: string; label: string }[]): Promise<string | null> {
    return new Promise((resolve) => {
      const m = modal(`
        <h2>${esc(title)}</h2>
        <div class="choices" style="margin-top:0.75rem">${options.map((o, i) =>
          `<button class="choice" data-id="${esc(o.id)}"><kbd>${i + 1}</kbd><span>${esc(o.label)}</span></button>`).join('')}</div>
        <div class="row-end" style="margin-top:0.75rem"><button class="pbtn alt" data-a="no">Cancel</button></div>
      `, 'small');
      const done = (v: string | null) => { off(); m.close(); resolve(v); };
      m.box.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.onclick = () => { sfx.select(); done(b.dataset.id!); }));
      m.box.querySelector<HTMLButtonElement>('[data-a=no]')!.onclick = () => done(null);
      const off = pushKeys((e) => {
        if (e.key === 'Escape') { done(null); return true; }
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) { sfx.select(); done(options[n - 1].id); return true; }
        return false;
      });
    });
  },

  /* ---------- journal ---------- */
  journal() {
    let tab: 'insights' | 'moves' | 'articles' = 'insights';
    const m = modal(`
      <div class="j-head"><h2>Research journal</h2><button class="pbtn alt small" data-a="close">Close <kbd>Esc</kbd></button></div>
      <div class="tabs" role="tablist">
        <button role="tab" data-t="insights">Insights</button>
        <button role="tab" data-t="moves">Moves</button>
        <button role="tab" data-t="articles">Articles</button>
      </div>
      <div class="j-body"></div>
    `, 'journal');
    const body = m.box.querySelector<HTMLElement>('.j-body')!;
    const render = () => {
      m.box.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === tab)));
      if (tab === 'insights') {
        body.innerHTML = SESSIONS.map((s) => {
          const keys = Object.keys(s.insights);
          const got = keys.filter((k) => state.insights.includes(k)).length;
          const title = s.mode === 'workshop' ? `${s.code} · ${s.kind}` : `${s.code} · ${s.name}`;
          let extra = '';
          if (s.id === 'define' && state.insights.includes('d5')) {
            extra = `<p class="j-statement"><b>Refined statement</b> ${esc(DEFINED_STATEMENT)}</p>
              <p class="muted"><b>Kickoff (history)</b> ${esc(KICKOFF_STATEMENT)}</p>`;
          } else if (s.id === 'kickoff' && got === keys.length) {
            extra = `<p class="j-statement"><b>Problem statement</b> ${esc(KICKOFF_STATEMENT)}</p>`;
          }
          const claims = claimsFor(s.id);
          const readings = state.readings[s.id] ?? [];
          if (claims.length && s.mode !== 'workshop') {
            const told = claims.filter((c) => c.call === 'tell' && readings.includes(c.id));
            const parked = claims.filter((c) => c.call === 'park' && readings.includes(c.id));
            const n = readings.filter((id) => claims.some((c) => c.id === id)).length;
            extra += `<p class="muted">${n} of ${claims.length} called</p>
              <h4>Told the team</h4><div class="stickies">${told.length ? told.map((c) => `<div class="sticky">${esc(c.text)}</div>`).join('') : '<div class="sticky locked">None yet</div>'}</div>
              <h4>Parked</h4><div class="stickies">${parked.length ? parked.map((c) => `<div class="sticky">${esc(c.text)}</div>`).join('') : '<div class="sticky locked">None yet</div>'}</div>`;
          }
          return `<section class="j-sec"><h3>${esc(title)} <span class="muted">${got}/${keys.length}</span></h3>
            <div class="stickies">${keys.map((k) => state.insights.includes(k)
              ? `<div class="sticky">${esc(s.insights[k])}</div>`
              : `<div class="sticky locked">Not found yet</div>`).join('')}</div>${extra}</section>`;
        }).join('');
      } else if (tab === 'moves') {
        const got = MOVES.filter((mv) => state.moves.includes(mv.tag)).length;
        body.innerHTML = `<p class="muted">${got} of ${MOVES.length} strong moves collected. Use a strong move in a session to learn it.</p>
          <div class="moves">${MOVES.map((mv) => state.moves.includes(mv.tag)
            ? `<div class="move"><b>${esc(mv.tag)}</b><p>${esc(mv.note)}</p><small>${srcLinks(mv.src)}</small></div>`
            : `<div class="move locked"><b>???</b><p>${mv.session.match(/^(Kickoff|Define|Ideate|Next)/) ? `Hidden in Mae’s ${esc(mv.session)}.` : `Hidden in ${esc(mv.session)}’s session.`}</p></div>`).join('')}</div>`;
      } else {
        body.innerHTML = `<p class="muted">Every lesson in this game comes from these Nielsen Norman Group articles.</p>
          <ul class="articles">${(Object.keys(SRC) as SrcKey[]).map((k) => `<li><a href="${SRC[k].u}" target="_blank" rel="noopener">${esc(SRC[k].t)}</a></li>`).join('')}</ul>
          <p class="muted" style="margin-top:1rem">${esc(OTHER_CYCLE_METHODS)}</p>`;
      }
    };
    m.box.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t as typeof tab; sfx.blip(); render(); }));
    const close = () => { off(); m.close(); };
    m.box.querySelector<HTMLButtonElement>('[data-a=close]')!.onclick = close;
    const off = pushKeys((e) => {
      if (e.key === 'Escape' || e.key === 'j' || e.key === 'J') { close(); return true; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const order = ['insights', 'moves', 'articles'] as const;
        tab = order[(order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
        render();
        return true;
      }
      return false;
    });
    render();
  },

  /* ---------- pause menu ---------- */
  menu() {
    const m = modal(`
      <div class="j-head"><h2>Paused</h2><button class="pbtn alt small" data-a="close">Resume <kbd>Esc</kbd></button></div>
      <div class="menu-rank"><b>${esc(rank())}</b> · <i class="star on"></i> ${totalStars()} / ${MAX_STARS}</div>
      ${settingsHtml()}
      <div class="menu-actions">
        <button class="pbtn alt" data-a="journal">Open journal</button>
        <button class="pbtn alt danger" data-a="reset">Start over</button>
      </div>
      <p class="title-credit">Lessons from <a href="https://www.nngroup.com" target="_blank" rel="noopener">nngroup.com</a>. Unofficial study game, not affiliated with Nielsen Norman Group.</p>
    `, 'menu');
    wireSettings(m.box);
    const close = () => { off(); m.close(); };
    m.box.querySelector<HTMLButtonElement>('[data-a=close]')!.onclick = close;
    m.box.querySelector<HTMLButtonElement>('[data-a=journal]')!.onclick = () => { close(); ui.journal(); };
    m.box.querySelector<HTMLButtonElement>('[data-a=reset]')!.onclick = async () => {
      close();
      if (await ui.confirm('Start over?', 'Your stars, insights and collected moves will be erased. Settings are kept.', 'Erase and restart', 'Cancel')) ui.onReset();
    };
    const off = pushKeys((e) => { if (e.key === 'Escape') { close(); return true; } return false; });
  },

  /* ================= conversation ================= */
  convo: null as null | {
    wrap: HTMLElement; phase: 'idle' | 'typing' | 'choose' | 'coach'; typer: Typer | null;
    choose: ((i: number) => void) | null; n: number; cont: (() => void) | null; off: () => void; timer: number | null;
    last: { text: string; who: string; mood?: string } | null;
  },

  convoOpen(s: Session, onQuit: () => void) {
    ui.convoClose();
    busyCount++;
    const workshop = s.mode === 'workshop';
    const wrap = el(`<div id="convo" class="${workshop ? 'workshop' : ''}">
      <div class="cv-top panel slim">
        <div class="cv-id">${workshop ? '' : `<span class="rec"><i></i>REC <b class="cv-t mono">00:00:00</b></span>`}<span class="cv-who">${esc(s.code)} · ${esc(s.kind)} · ${esc(s.name)}</span></div>
        <div class="cv-meters">
          ${workshop ? '' : `<div class="mtr" data-m="open"><span>Openness</span><div class="bar"><i></i></div></div>`}
          <div class="mtr" data-m="ins"><span>Insight <b></b></span><div class="bar"><i></i></div></div>
          <div class="mtr" data-m="bias"><span>Bias <b></b></span><div class="bar"><i></i></div></div>
          <div class="streak" hidden>Flow ×<b></b></div>
        </div>
        <button class="pbtn alt small cv-quit">Leave</button>
      </div>
      <div class="cv-bottom panel">
        <div class="cv-ctx" hidden></div>
        <div class="cv-you" hidden></div>
        <div class="cv-line"><div class="cv-head"><div class="cv-speaker"></div>${EQ}${listenBtn('Hear this line again')}</div><div class="cv-text"></div></div>
        <div class="cv-act"></div>
      </div>
    </div>`);
    layer.append(wrap);
    const c = { wrap, phase: 'idle' as const, typer: null, choose: null, n: 0, cont: null, off: () => {}, timer: null, last: null } as NonNullable<typeof ui.convo>;
    ui.convo = c;
    wireListen(wrap.querySelector<HTMLElement>('.cv-line')!, () => { if (c.last) void voice.say(c.last.text, c.last.who, { mood: c.last.mood, force: true }); });
    wrap.querySelector<HTMLButtonElement>('.cv-quit')!.onclick = async () => {
      if (await ui.confirm('Leave the session?', 'This session won’t be saved. You can start it again any time.', 'Leave', 'Keep going')) onQuit();
    };
    wrap.querySelector<HTMLElement>('.cv-line')!.addEventListener('click', () => { if (c.phase === 'typing') c.typer?.skip(); });
    c.off = pushKeys((e) => {
      if (c.phase === 'typing' && (e.key === ' ' || e.key === 'Enter')) { c.typer?.skip(); return true; }
      if (c.phase === 'choose') {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= c.n) { c.choose?.(n - 1); return true; }
      }
      if (c.phase === 'coach' && (e.key === ' ' || e.key === 'Enter')) { c.cont?.(); return true; }
      if ((e.key === 'l' || e.key === 'L') && c.last) { void voice.say(c.last.text, c.last.who, { mood: c.last.mood, force: true }); return true; }
      if (e.key === 'Escape') { wrap.querySelector<HTMLButtonElement>('.cv-quit')!.click(); return true; }
      return false;
    });
  },

  convoMeters(m: { open: number; ins: number; mx: number; bias: number; streak: number; t: string }) {
    const c = ui.convo;
    if (!c) return;
    const set = (k: string, pct: number, label?: string) => {
      const mtr = c.wrap.querySelector<HTMLElement>(`.mtr[data-m=${k}]`);
      if (!mtr) return;
      mtr.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      if (label !== undefined) mtr.querySelector('b')!.textContent = label;
    };
    set('open', m.open);
    set('ins', m.mx ? (m.ins / m.mx) * 100 : 0, `${m.ins}`);
    set('bias', m.bias, `${m.bias}`);
    c.wrap.querySelector('.mtr[data-m=open]')?.classList.toggle('low', m.open <= 25);
    c.wrap.querySelector('.mtr[data-m=bias]')?.classList.toggle('hot', m.bias >= 50);
    const st = c.wrap.querySelector<HTMLElement>('.streak')!;
    st.hidden = m.streak < 2;
    st.querySelector('b')!.textContent = String(m.streak);
    const tEl = c.wrap.querySelector('.cv-t');
    if (tEl) tEl.textContent = m.t;
  },

  convoLine(o: { ctx?: string; speaker: string; voiceId: string; mood?: string; kind: 'p' | 'obs'; text: string | null }): Promise<void> {
    const c = ui.convo!;
    const w = c.wrap;
    const ctx = w.querySelector<HTMLElement>('.cv-ctx')!;
    ctx.hidden = !o.ctx;
    ctx.textContent = o.ctx ?? '';
    w.querySelector<HTMLElement>('.cv-you')!.hidden = true;
    w.querySelector<HTMLElement>('.cv-act')!.innerHTML = '';
    const line = w.querySelector<HTMLElement>('.cv-line')!;
    line.hidden = !o.text;
    line.className = `cv-line ${o.kind === 'obs' ? 'obs' : ''}`;
    line.dataset.who = o.voiceId;
    w.querySelector('.cv-speaker')!.textContent = o.kind === 'obs' ? `Note from ${o.speaker}` : o.speaker;
    voice.stop();
    if (o.ctx && voice.narrating()) void voice.say(o.ctx, 'narrator');
    if (!o.text) { c.last = null; if (o.ctx) srEl.textContent = o.ctx; return Promise.resolve(); }
    c.last = { text: o.text, who: o.voiceId, mood: o.mood };
    void voice.say(o.text, o.voiceId, { mood: o.mood, queue: true });
    c.phase = 'typing';
    c.typer = typeInto(w.querySelector<HTMLElement>('.cv-text')!, o.text);
    return c.typer.done.then(() => { c.phase = 'idle'; });
  },

  convoChoices(choices: Choice[], ms: number, toWhom: string): Promise<number> {
    const c = ui.convo!;
    const act = c.wrap.querySelector<HTMLElement>('.cv-act')!;
    act.innerHTML = `
      <div class="cv-ask"><span>${esc(toWhom)}</span>${ms ? `<div class="timer" aria-hidden="true"><i style="animation-duration:${ms}ms"></i></div>` : ''}</div>
      <div class="choices">${choices.map((ch, i) => `<button class="choice ${ch.silent ? 'silent' : ''}" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(ch.say)}</span></button>`).join('')}</div>`;
    c.n = choices.length;
    c.phase = 'choose';
    return new Promise((resolve) => {
      const finish = (i: number) => {
        if (c.phase !== 'choose') return;
        c.phase = 'idle';
        if (c.timer) { clearTimeout(c.timer); c.timer = null; }
        act.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.disabled = true));
        voice.stop();
        if (i >= 0) sfx.select();
        resolve(i);
      };
      c.choose = finish;
      act.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.onclick = () => finish(Number(b.dataset.i))));
      if (ms) c.timer = window.setTimeout(() => finish(-1), ms);
    });
  },

  convoReply(o: { you: string; silent?: boolean; toObs?: boolean; speaker: string; voiceId: string; mood?: string; kind: 'p' | 'obs'; text?: string }): Promise<void> {
    const c = ui.convo!;
    const w = c.wrap;
    w.querySelector<HTMLElement>('.cv-ctx')!.hidden = true;
    w.querySelector<HTMLElement>('.cv-act')!.innerHTML = '';
    const you = w.querySelector<HTMLElement>('.cv-you')!;
    you.hidden = false;
    you.className = `cv-you ${o.silent ? 'silent' : ''}`;
    you.innerHTML = o.silent ? esc(o.you) : `<b>${o.toObs ? 'You, to Jordan' : 'You'}</b> ${esc(o.you)}`;
    voice.stop();
    if (voice.narrating() && !o.silent) void voice.say(o.you, 'player');
    const line = w.querySelector<HTMLElement>('.cv-line')!;
    line.hidden = !o.text;
    if (!o.text) { c.last = null; return Promise.resolve(); }
    const stage = /^\(/.test(o.text);
    line.className = `cv-line ${o.kind === 'obs' ? 'obs' : ''} ${stage ? 'stage' : ''}`;
    line.dataset.who = o.voiceId;
    w.querySelector('.cv-speaker')!.textContent = o.kind === 'obs' ? `Note from ${o.speaker}` : o.speaker;
    c.last = { text: o.text, who: o.voiceId, mood: o.mood };
    void voice.say(o.text, o.voiceId, { mood: o.mood, queue: true });
    c.phase = 'typing';
    c.typer = typeInto(w.querySelector<HTMLElement>('.cv-text')!, o.text);
    return c.typer.done.then(() => { c.phase = 'idle'; });
  },

  convoCoach(o: { c: Choice; best?: Choice; timedOut: boolean; unlocked: string | null; newMove: boolean; left: boolean; debrief?: boolean }): Promise<void> {
    const cv = ui.convo!;
    const act = cv.wrap.querySelector<HTMLElement>('.cv-act')!;
    const ch = o.c;
    const cls = ch.v === 'best' ? 'best' : ch.v === 'ok' ? 'ok' : 'bad';
    const mark = ch.v === 'best' ? '✓' : ch.v === 'ok' ? '~' : '✕';
    const delta = o.debrief ? '' : `<span class="delta mono">+${ch.ins} insight · +${ch.bias} bias</span>`;
    const contLabel = o.debrief ? 'Next note' : o.left ? 'End session' : 'Continue';
    act.innerHTML = `<div class="coach">
      <div class="coach-head"><span class="chip ${cls}">${mark} ${esc(ch.tag)}</span>${delta}${listenBtn('Hear the coaching tip')}</div>
      ${o.timedOut ? `<p class="coach-time">Time ran out, so you stayed quiet.</p>` : ''}
      ${o.unlocked ? `<div class="unlock"><i class="mini-note"></i>You heard this: “${esc(o.unlocked)}”</div>` : ''}
      ${o.newMove ? `<div class="newmove">New move for your journal: <b>${esc(ch.tag)}</b></div>` : ''}
      <p class="coach-note">${esc(ch.note)}</p>
      ${ch.quote ? `<blockquote>${esc(ch.quote)}</blockquote>` : ''}
      ${o.best ? `<p class="coach-better"><b>Stronger move (${esc(o.best.tag)}):</b> ${esc(o.best.say)}</p>` : ''}
      <div class="coach-foot"><span class="src">Source: ${srcLinks(ch.src)}</span><button class="pbtn" data-a="cont">${contLabel} <kbd>Space</kbd></button></div>
    </div>`;
    cv.wrap.querySelector<HTMLElement>('.cv-bottom')!.scrollTop = 0;
    cv.phase = 'coach';
    const tip = () => [
      `${ch.v === 'best' ? 'Strong move' : ch.v === 'ok' ? 'Okay move' : 'Weak move'}: ${ch.tag}.`,
      o.unlocked ? `You heard this: ${o.unlocked}.` : '',
      ch.note,
      o.best ? `A stronger move would be ${o.best.tag}: ${o.best.say}` : '',
    ].filter(Boolean).join(' ');
    wireListen(act, () => void voice.say(tip(), 'mae', { force: true }));
    // Coaching waits for the customer to finish their line, then Mae reads it (when narration is on).
    if (voice.narrating()) void voice.say(tip(), 'mae', { queue: true });
    return new Promise((resolve) => {
      const go = () => { if (cv.phase !== 'coach') return; cv.phase = 'idle'; voice.stop(); sfx.blip(); resolve(); };
      cv.cont = go;
      act.querySelector<HTMLButtonElement>('[data-a=cont]')!.onclick = go;
    });
  },

  results(o: { title: string; eyebrow: string; stars: number; headline: string; sub: string; stats: [string, string][]; notesHtml?: string; newBest: boolean }): Promise<'back' | 'retry'> {
    return new Promise((resolve) => {
      const m = modal(`
        <div class="eyebrow">${esc(o.eyebrow)}</div>
        <h2>${esc(o.title)}</h2>
        <div class="res-stars">${stars(0)}</div>
        <p class="res-head"><b>${esc(o.headline)}</b> ${o.newBest ? '<span class="chip best">New best</span>' : ''}${listenBtn('Hear the results')}</p>
        <p class="muted">${esc(o.sub)}</p>
        <div class="stats">${o.stats.map(([v, l]) => `<div class="stat"><b class="mono">${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
        ${o.notesHtml ?? ''}
        <div class="row-end">
          <button class="pbtn alt" data-a="retry">Try again</button>
          <button class="pbtn" data-a="back">Back to town</button>
        </div>
      `, 'results');
      const starEls = m.box.querySelectorAll<HTMLElement>('.res-stars .star');
      for (let i = 0; i < o.stars; i++) {
        setTimeout(() => { starEls[i].classList.add('on', 'pop'); sfx.star(i); }, reduced ? 0 : 450 + i * 380);
      }
      const summary = () => `${o.headline}. ${o.stars} of 3 stars. ${o.sub}`;
      wireListen(m.box, () => void voice.say(summary(), 'mae', { force: true }));
      if (voice.narrating()) void voice.say(summary(), 'mae', { queue: true });
      const done = (v: 'back' | 'retry') => { off(); voice.stop(); m.close(); resolve(v); };
      m.box.querySelector<HTMLButtonElement>('[data-a=back]')!.onclick = () => done('back');
      m.box.querySelector<HTMLButtonElement>('[data-a=retry]')!.onclick = () => done('retry');
      const off = pushKeys((e) => {
        if (e.key === 'Enter' || e.key === ' ') { done('back'); return true; }
        if (e.key === 'r' || e.key === 'R') { done('retry'); return true; }
        return false;
      });
    });
  },

  convoClose() {
    const c = ui.convo;
    if (!c) return;
    voice.stop();
    if (c.timer) clearTimeout(c.timer);
    c.typer?.skip();
    c.off();
    c.wrap.remove();
    ui.convo = null;
    busyCount--;
    lastClose = performance.now();
  },

  /* ================= synthesis ================= */
  synth: null as null | { wrap: HTMLElement; off: () => void; pick: ((k: BinKey | null) => void) | null; cont: (() => void) | null; anim: Animation | null },

  synthOpen(total: number, onQuit: () => void) {
    ui.synthClose();
    busyCount++;
    const keys = Object.keys(BINS) as BinKey[];
    const wrap = el(`<div id="synth">
      <div class="sy-top panel slim">
        <div><b>The Insight Wall</b><span class="muted"> · Which quality component is each note about?</span></div>
        <div class="pips">${Array.from({ length: total }, () => '<i></i>').join('')}</div>
        <button class="pbtn alt small" data-a="quit">Leave</button>
      </div>
      <div class="sy-stage"><div class="sy-note"><span></span>${listenBtn('Read this note aloud')}</div></div>
      <div class="sy-fb panel" hidden></div>
      <div class="sy-bins">${keys.map((k, i) => `<button class="bin" data-b="${k}"><kbd>${i + 1}</kbd><b>${BINS[k].n}</b><small>${BINS[k].d}</small></button>`).join('')}</div>
    </div>`);
    layer.append(wrap);
    const s = { wrap, off: () => {}, pick: null, cont: null, anim: null } as NonNullable<typeof ui.synth>;
    ui.synth = s;
    wrap.querySelector<HTMLButtonElement>('[data-a=quit]')!.onclick = async () => {
      s.anim?.pause();
      if (await ui.confirm('Leave the wall?', 'Your sorting progress won’t be saved.', 'Leave', 'Keep sorting')) onQuit();
      else s.anim?.play();
    };
    wrap.querySelectorAll<HTMLButtonElement>('.bin').forEach((b) => (b.onclick = () => s.pick?.(b.dataset.b as BinKey)));
    s.off = pushKeys((e) => {
      const n = parseInt(e.key, 10);
      if (s.pick && n >= 1 && n <= keys.length) { s.pick(keys[n - 1]); return true; }
      if (s.cont && (e.key === ' ' || e.key === 'Enter')) { s.cont(); return true; }
      if (e.key === 'Escape') { wrap.querySelector<HTMLButtonElement>('[data-a=quit]')!.click(); return true; }
      return false;
    });
  },

  synthCard(card: SortCard, i: number, results: boolean[], ms: number): Promise<BinKey | null> {
    const s = ui.synth!;
    const w = s.wrap;
    w.querySelectorAll<HTMLElement>('.pips i').forEach((p, j) => { p.className = j < results.length ? (results[j] ? 'ok' : 'miss') : j === i ? 'now' : ''; });
    w.querySelector<HTMLElement>('.sy-fb')!.hidden = true;
    w.querySelectorAll<HTMLButtonElement>('.bin').forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
    const note = w.querySelector<HTMLElement>('.sy-note')!;
    note.querySelector('span')!.textContent = card.text;
    srEl.textContent = card.text;
    wireListen(note, () => void voice.say(card.text, 'narrator', { force: true }));
    if (voice.narrating()) void voice.say(card.text, 'narrator');
    const tilt = `${(Math.random() * 4 - 2).toFixed(1)}deg`;
    const stage = w.querySelector<HTMLElement>('.sy-stage')!;
    s.anim?.cancel();
    const drop = Math.max(40, stage.clientHeight - note.offsetHeight - 16);
    s.anim = note.animate([{ transform: `translateY(0) rotate(${tilt})` }, { transform: `translateY(${drop}px) rotate(${tilt})` }], { duration: ms, easing: 'linear', fill: 'forwards' });
    return new Promise((resolve) => {
      let done = false;
      const finish = (k: BinKey | null) => {
        if (done) return;
        done = true;
        s.pick = null;
        s.anim?.pause();
        w.querySelectorAll<HTMLButtonElement>('.bin').forEach((b) => (b.disabled = true));
        const right = w.querySelector<HTMLElement>(`.bin[data-b=${card.a}]`)!;
        right.classList.add('right');
        if (k && k !== card.a) w.querySelector<HTMLElement>(`.bin[data-b=${k}]`)!.classList.add('wrong');
        resolve(k);
      };
      s.pick = finish;
      s.anim!.finished.then(() => finish(null)).catch(() => {});
    });
  },

  synthFeedback(correct: boolean, timedOut: boolean, card: SortCard, last: boolean): Promise<void> {
    const s = ui.synth!;
    const fb = s.wrap.querySelector<HTMLElement>('.sy-fb')!;
    fb.hidden = false;
    fb.innerHTML = `<div class="coach-head"><span class="chip ${correct ? 'best' : 'bad'}">${correct ? '✓ Correct' : timedOut ? '✕ It hit the floor' : '✕ Not quite'}</span><span class="muted">It’s <b>${BINS[card.a].n}</b></span>${listenBtn('Hear why')}</div>
      <p class="coach-note">${esc(card.why)}</p>
      <div class="coach-foot"><span class="src">Source: ${srcLinks('u101')}</span><button class="pbtn" data-a="next">${last ? 'See results' : 'Next note'} <kbd>Space</kbd></button></div>`;
    const why = () => `${correct ? 'Correct' : 'Not quite'}. It's ${BINS[card.a].n}. ${card.why}`;
    wireListen(fb, () => void voice.say(why(), 'mae', { force: true }));
    if (voice.narrating()) void voice.say(why(), 'mae');
    return new Promise((resolve) => {
      const go = () => { s.cont = null; voice.stop(); sfx.blip(); resolve(); };
      s.cont = go;
      fb.querySelector<HTMLButtonElement>('[data-a=next]')!.onclick = go;
    });
  },

  synthClose() {
    const s = ui.synth;
    if (!s) return;
    voice.stop();
    s.anim?.cancel();
    s.off();
    s.wrap.remove();
    ui.synth = null;
    busyCount--;
    lastClose = performance.now();
  },
};

export { stars as starsHtml, esc };
