// DOM interface drawn over the game canvas. Text stays sharp and readable at any size,
// and every control is a real button for keyboard, mouse, touch and screen readers.
import { SRC, type SrcKey } from '../data/sources';
import { MOVES, SESSIONS, type Choice, type Session } from '../data/sessions';
import { BINS, type BinKey, type SortCard } from '../data/sort';
import { PORTRAIT_URL } from '../art/draw';
import { sfx, music } from '../audio';
import { state, save, rank, totalStars, MAX_STARS, objective } from '../state';

const root = document.getElementById('ui')!;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    if (i % 3 === 0 && text[i - 1] !== ' ') sfx.blip();
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

function settingsHtml() {
  const row = (k: keyof typeof state.settings, label: string, hint: string) =>
    `<label class="toggle"><input type="checkbox" data-set="${k}" ${state.settings[k] ? 'checked' : ''}><span class="tg"></span><span><b>${label}</b><small>${hint}</small></span></label>`;
  return `<div class="settings">
    ${row('timer', 'Choice timer', 'Answer within 25 seconds, or you stay silent. Turn off for a relaxed pace.')}
    ${row('sound', 'Sound effects', 'Blips, chimes and buzzes.')}
    ${row('music', 'Music', 'A gentle town tune.')}
  </div>`;
}
function wireSettings(box: HTMLElement) {
  box.querySelectorAll<HTMLInputElement>('input[data-set]').forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.set as keyof typeof state.settings;
      state.settings[k] = inp.checked;
      save();
      if (k === 'music') music.sync();
      sfx.select();
    };
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
    const go = (fn: () => void) => { off(); m.close(); sfx.unlockAudio(); music.sync(); sfx.select(); fn(); };
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
              <li><b>Insight</b> rises when customers tell you what really happens. Strong moves pin sticky notes to your wall.</li>
              <li><b>Bias</b> rises when your words end up in their mouths. Your score loses half a point for each point of bias.</li>
            </ul>`;
          }
          if (a === 'settings') {
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
        <img class="dlg-face" alt="" hidden>
        <div class="dlg-body"><div class="dlg-name"></div><div class="dlg-text"></div></div>
        <div class="dlg-next" aria-hidden="true">▼</div>
        <span class="dlg-hint">Space / tap</span>
      </div>`);
      layer.append(box);
      const img = box.querySelector<HTMLImageElement>('.dlg-face')!;
      const name = box.querySelector<HTMLElement>('.dlg-name')!;
      const text = box.querySelector<HTMLElement>('.dlg-text')!;
      let i = 0;
      let tw: Typer | null = null;
      const show = () => {
        const p = pages[i];
        name.textContent = p.name;
        if (p.face && PORTRAIT_URL[p.face]) { img.src = PORTRAIT_URL[p.face]; img.hidden = false; } else img.hidden = true;
        box.classList.remove('ready');
        tw = typeInto(text, p.text);
        void tw.done.then(() => box.classList.add('ready'));
      };
      const close = () => { off(); box.remove(); busyCount--; lastClose = performance.now(); resolve(); };
      const advance = () => {
        if (tw && !tw.finished) { tw.skip(); return; }
        i++;
        if (i >= pages.length) close(); else { sfx.blip(); show(); }
      };
      box.addEventListener('click', advance);
      const off = pushKeys((e) => {
        if (e.key === 'Escape') { close(); return true; }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { advance(); return true; }
        return false;
      });
      show();
    });
  },

  /* ---------- session intro ---------- */
  sessionIntro(s: Session, rec: { stars: number; plays: number } | undefined): Promise<boolean> {
    return new Promise((resolve) => {
      const m = modal(`
        <div class="intro-head">
          <img class="intro-face" src="${PORTRAIT_URL[s.id]}" alt="">
          <div>
            <div class="eyebrow">${esc(s.code)} · ${esc(s.kind)} · ${esc(s.place)}</div>
            <h2>${esc(s.name)}</h2>
            <div class="muted">${esc(s.role)}</div>
            ${rec ? `<div class="intro-best">Best: ${stars(rec.stars)}</div>` : ''}
          </div>
        </div>
        <p class="intro-greet">“${esc(s.greet)}”</p>
        <p>${esc(s.setup)}</p>
        <div class="goal"><b>Research goal</b>${esc(s.goal)}</div>
        <div class="chips">${s.skills.map((k) => `<span>${esc(k)}</span>`).join('')}</div>
        <div class="row-end">
          <button class="pbtn alt" data-a="no">Not now</button>
          <button class="pbtn" data-a="yes">Start recording ●</button>
        </div>
      `, 'intro');
      const done = (v: boolean) => { off(); m.close(); if (v) sfx.talk(); resolve(v); };
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
          return `<section class="j-sec"><h3>${esc(s.code)} · ${esc(s.name)} <span class="muted">${got}/${keys.length}</span></h3>
            <div class="stickies">${keys.map((k) => state.insights.includes(k)
              ? `<div class="sticky">${esc(s.insights[k])}</div>`
              : `<div class="sticky locked">Not found yet</div>`).join('')}</div></section>`;
        }).join('');
      } else if (tab === 'moves') {
        const got = MOVES.filter((mv) => state.moves.includes(mv.tag)).length;
        body.innerHTML = `<p class="muted">${got} of ${MOVES.length} strong moves collected. Use a strong move in a session to learn it.</p>
          <div class="moves">${MOVES.map((mv) => state.moves.includes(mv.tag)
            ? `<div class="move"><b>${esc(mv.tag)}</b><p>${esc(mv.note)}</p><small>${srcLinks(mv.src)}</small></div>`
            : `<div class="move locked"><b>???</b><p>Hidden in ${esc(mv.session)}’s session.</p></div>`).join('')}</div>`;
      } else {
        body.innerHTML = `<p class="muted">Every lesson in this game comes from these Nielsen Norman Group articles.</p>
          <ul class="articles">${(Object.keys(SRC) as SrcKey[]).map((k) => `<li><a href="${SRC[k].u}" target="_blank" rel="noopener">${esc(SRC[k].t)}</a></li>`).join('')}</ul>`;
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
  },

  convoOpen(s: Session, onQuit: () => void) {
    ui.convoClose();
    busyCount++;
    const wrap = el(`<div id="convo">
      <div class="cv-top panel slim">
        <div class="cv-id"><span class="rec"><i></i>REC <b class="cv-t mono">00:00:00</b></span><span class="cv-who">${esc(s.code)} · ${esc(s.kind)} · ${esc(s.name)}</span></div>
        <div class="cv-meters">
          <div class="mtr" data-m="open"><span>Openness</span><div class="bar"><i></i></div></div>
          <div class="mtr" data-m="ins"><span>Insight <b></b></span><div class="bar"><i></i></div></div>
          <div class="mtr" data-m="bias"><span>Bias <b></b></span><div class="bar"><i></i></div></div>
          <div class="streak" hidden>Flow ×<b></b></div>
        </div>
        <button class="pbtn alt small cv-quit">Leave</button>
      </div>
      <div class="cv-bottom panel">
        <div class="cv-ctx" hidden></div>
        <div class="cv-you" hidden></div>
        <div class="cv-line"><div class="cv-speaker"></div><div class="cv-text"></div></div>
        <div class="cv-act"></div>
      </div>
    </div>`);
    layer.append(wrap);
    const c = { wrap, phase: 'idle' as const, typer: null, choose: null, n: 0, cont: null, off: () => {}, timer: null } as NonNullable<typeof ui.convo>;
    ui.convo = c;
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
      if (e.key === 'Escape') { wrap.querySelector<HTMLButtonElement>('.cv-quit')!.click(); return true; }
      return false;
    });
  },

  convoMeters(m: { open: number; ins: number; mx: number; bias: number; streak: number; t: string }) {
    const c = ui.convo;
    if (!c) return;
    const set = (k: string, pct: number, label?: string) => {
      const mtr = c.wrap.querySelector<HTMLElement>(`.mtr[data-m=${k}]`)!;
      mtr.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      if (label !== undefined) mtr.querySelector('b')!.textContent = label;
    };
    set('open', m.open);
    set('ins', (m.ins / m.mx) * 100, `${m.ins}`);
    set('bias', m.bias, `${m.bias}`);
    c.wrap.querySelector('.mtr[data-m=open]')!.classList.toggle('low', m.open <= 25);
    c.wrap.querySelector('.mtr[data-m=bias]')!.classList.toggle('hot', m.bias >= 50);
    const st = c.wrap.querySelector<HTMLElement>('.streak')!;
    st.hidden = m.streak < 2;
    st.querySelector('b')!.textContent = String(m.streak);
    c.wrap.querySelector('.cv-t')!.textContent = m.t;
  },

  convoLine(o: { ctx?: string; speaker: string; kind: 'p' | 'obs'; text: string | null }): Promise<void> {
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
    w.querySelector('.cv-speaker')!.textContent = o.kind === 'obs' ? `Note from ${o.speaker}` : o.speaker;
    if (!o.text) { if (o.ctx) srEl.textContent = o.ctx; return Promise.resolve(); }
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
        if (i >= 0) sfx.select();
        resolve(i);
      };
      c.choose = finish;
      act.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.onclick = () => finish(Number(b.dataset.i))));
      if (ms) c.timer = window.setTimeout(() => finish(-1), ms);
    });
  },

  convoReply(o: { you: string; silent?: boolean; toObs?: boolean; speaker: string; kind: 'p' | 'obs'; text?: string }): Promise<void> {
    const c = ui.convo!;
    const w = c.wrap;
    w.querySelector<HTMLElement>('.cv-ctx')!.hidden = true;
    w.querySelector<HTMLElement>('.cv-act')!.innerHTML = '';
    const you = w.querySelector<HTMLElement>('.cv-you')!;
    you.hidden = false;
    you.className = `cv-you ${o.silent ? 'silent' : ''}`;
    you.innerHTML = o.silent ? esc(o.you) : `<b>${o.toObs ? 'You, to Jordan' : 'You'}:</b> ${esc(o.you)}`;
    const line = w.querySelector<HTMLElement>('.cv-line')!;
    line.hidden = !o.text;
    if (!o.text) return Promise.resolve();
    const stage = /^\(/.test(o.text);
    line.className = `cv-line ${o.kind === 'obs' ? 'obs' : ''} ${stage ? 'stage' : ''}`;
    w.querySelector('.cv-speaker')!.textContent = o.kind === 'obs' ? `Note from ${o.speaker}` : o.speaker;
    c.phase = 'typing';
    c.typer = typeInto(w.querySelector<HTMLElement>('.cv-text')!, o.text);
    return c.typer.done.then(() => { c.phase = 'idle'; });
  },

  convoCoach(o: { c: Choice; best?: Choice; timedOut: boolean; unlocked: string | null; newMove: boolean; left: boolean }): Promise<void> {
    const cv = ui.convo!;
    const act = cv.wrap.querySelector<HTMLElement>('.cv-act')!;
    const ch = o.c;
    const cls = ch.v === 'best' ? 'best' : ch.v === 'ok' ? 'ok' : 'bad';
    const mark = ch.v === 'best' ? '✓' : ch.v === 'ok' ? '~' : '✕';
    act.innerHTML = `<div class="coach">
      <div class="coach-head"><span class="chip ${cls}">${mark} ${esc(ch.tag)}</span><span class="delta mono">+${ch.ins} insight · +${ch.bias} bias</span></div>
      ${o.timedOut ? `<p class="coach-time">Time ran out, so you stayed quiet.</p>` : ''}
      ${o.unlocked ? `<div class="unlock"><i class="mini-note"></i>Pinned to your wall: “${esc(o.unlocked)}”</div>` : ''}
      ${o.newMove ? `<div class="newmove">New move for your journal: <b>${esc(ch.tag)}</b></div>` : ''}
      <p class="coach-note">${esc(ch.note)}</p>
      ${ch.quote ? `<blockquote>${esc(ch.quote)}</blockquote>` : ''}
      ${o.best ? `<p class="coach-better"><b>Stronger move (${esc(o.best.tag)}):</b> ${esc(o.best.say)}</p>` : ''}
      <div class="coach-foot"><span class="src">Source: ${srcLinks(ch.src)}</span><button class="pbtn" data-a="cont">${o.left ? 'End session' : 'Continue'} <kbd>␣</kbd></button></div>
    </div>`;
    cv.wrap.querySelector<HTMLElement>('.cv-bottom')!.scrollTop = 0;
    cv.phase = 'coach';
    return new Promise((resolve) => {
      const go = () => { if (cv.phase !== 'coach') return; cv.phase = 'idle'; sfx.blip(); resolve(); };
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
        <p class="res-head"><b>${esc(o.headline)}</b> ${o.newBest ? '<span class="chip best">New best</span>' : ''}</p>
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
      const done = (v: 'back' | 'retry') => { off(); m.close(); resolve(v); };
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
      <div class="sy-stage"><div class="sy-note"><span></span></div></div>
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
    fb.innerHTML = `<div class="coach-head"><span class="chip ${correct ? 'best' : 'bad'}">${correct ? '✓ Correct' : timedOut ? '✕ It hit the floor' : '✕ Not quite'}</span><span class="muted">It’s <b>${BINS[card.a].n}</b></span></div>
      <p class="coach-note">${esc(card.why)}</p>
      <div class="coach-foot"><span class="src">Source: ${srcLinks('u101')}</span><button class="pbtn" data-a="next">${last ? 'See results' : 'Next note'} <kbd>␣</kbd></button></div>`;
    return new Promise((resolve) => {
      const go = () => { s.cont = null; sfx.blip(); resolve(); };
      s.cont = go;
      fb.querySelector<HTMLButtonElement>('[data-a=next]')!.onclick = go;
    });
  },

  synthClose() {
    const s = ui.synth;
    if (!s) return;
    s.anim?.cancel();
    s.off();
    s.wrap.remove();
    ui.synth = null;
    busyCount--;
    lastClose = performance.now();
  },
};

export { stars as starsHtml, esc };
