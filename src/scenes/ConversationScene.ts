import Phaser from 'phaser';
import { SESSIONS, SILENCE, maxIns, type Choice, type Session, type Turn } from '../data/sessions';
import type { Emote, Mood } from '../art/draw';
import { learnMove, recordSession, state } from '../state';
import { esc, ui } from '../ui/ui';
import { sfx } from '../audio';

const OPEN_DELTA = { best: 10, ok: 0, bad: -15 } as const;
const MOOD_EMOTE: Record<Mood, Emote> = { open: 'heart', neutral: 'dots', guarded: 'sweat', confused: 'q' };
const TIMER_MS = 25000;

type Room = Session['room'];
const ROOMS: Record<Room, { wall: number; wall2: number; trim: number; floor: number; floor2: number; frame: number }> = {
  truck: { wall: 0x8a3b2e, wall2: 0x7a3328, trim: 0x4a2a1e, floor: 0x5a4030, floor2: 0x4c3628, frame: 0xe0b33a },
  clinic: { wall: 0xcfe3e0, wall2: 0xbfd6d2, trim: 0x8aa7a2, floor: 0x8a9aa8, floor2: 0x7a8a98, frame: 0xf1efe8 },
  bank: { wall: 0x2d3e66, wall2: 0x283759, trim: 0x1b2540, floor: 0x3a3442, floor2: 0x332e3b, frame: 0xcfcac0 },
};

const wc = (s?: string) => (s && !/^\s*[[(]/.test(s) ? s.trim().split(/\s+/).length : 0);
function shuffle(n: number) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export class ConversationScene extends Phaser.Scene {
  private s!: Session;
  private idx = 0;
  private ti = 0;
  private open = 60;
  private ins = 0;
  private bias = 0;
  private you = 0;
  private them = 0;
  private streak = 0;
  private found: string[] = [];
  private mood: Mood = 'neutral';
  private alive = true;
  private bg!: Phaser.GameObjects.Graphics;
  private fg!: Phaser.GameObjects.Graphics;
  private por!: Phaser.GameObjects.Sprite;
  private jor?: Phaser.GameObjects.Sprite;
  private rec!: Phaser.GameObjects.Rectangle;
  private emote!: Phaser.GameObjects.Sprite;
  private baseY = 0;
  private jorBaseY = 0;
  private ps = 4;

  constructor() { super('Conversation'); }

  create(data: { index: number }) {
    this.idx = data.index;
    this.s = SESSIONS[this.idx];
    this.ti = 0; this.open = 60; this.ins = 0; this.bias = 0; this.you = 0; this.them = 0; this.streak = 0;
    this.found = []; this.mood = 'neutral'; this.alive = true; this.jor = undefined;

    this.cameras.main.setBackgroundColor('#141826');
    this.bg = this.add.graphics();
    if (this.s.observer) this.jor = this.add.sprite(0, 0, 'pt-jordan', 'neutral').setOrigin(0.5, 1).setAlpha(0.5);
    this.por = this.add.sprite(0, 0, `pt-${this.s.id}`, 'neutral').setOrigin(0.5, 1);
    this.fg = this.add.graphics();
    this.rec = this.add.rectangle(0, 0, 4, 4, 0xff5a4e).setOrigin(0, 0);
    this.emote = this.add.sprite(0, 0, 'emotes', 'dots').setVisible(false);
    this.layout();

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.layout, this); this.alive = false; });
    this.time.addEvent({ delay: 2900, loop: true, callback: () => this.blink() });
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.rec.setVisible(!this.rec.visible) });
    this.cameras.main.fadeIn(350);

    ui.convoOpen(this.s, () => this.exit());
    this.meters();
    this.time.delayedCall(450, () => void this.runTurn());
  }

  update(time: number) {
    const bob = Math.sin(time / 650) > 0 ? 0 : this.ps;
    this.por.y = this.baseY + bob;
    if (this.jor) this.jor.y = this.jorBaseY;
  }

  /* ---------------- scene art ---------------- */

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    const narrow = w < 720;
    const u = Math.max(2, Math.floor(Math.min(w / 240, h / 140)));
    // The dialogue panel covers roughly the bottom half, so the customer sits above it.
    const hy = Math.round(h * (narrow ? 0.43 : 0.5));
    const top = narrow ? 120 : 84;
    this.ps = Phaser.Math.Clamp(Math.floor(Math.min(hy - top, w * (narrow ? 0.6 : 0.4)) / 46), 2, 10);
    const px = Math.round(narrow ? w * 0.5 : w * 0.34);
    const spots = this.drawRoom(w, h, hy, u, px, top);
    this.baseY = hy + 4 * u;
    this.por.setScale(this.ps).setPosition(px, this.baseY);
    this.rec.setPosition(spots.rec.x, spots.rec.y).setSize(spots.rec.s, spots.rec.s);
    if (this.jor) {
      const js = Math.max(1, Math.floor(spots.win.h / 52));
      this.jorBaseY = spots.win.y + spots.win.h;
      this.jor.setScale(js).setPosition(spots.win.x + spots.win.w / 2, this.jorBaseY);
    }
    this.emoteScale = Math.max(2, Math.round(this.ps * 0.6));
    this.emote.setScale(this.emoteScale);
  }
  private emoteScale = 2;

  private drawRoom(w: number, h: number, hy: number, u: number, px: number, top: number) {
    const P = ROOMS[this.s.room];
    const bg = this.bg.clear();
    const fg = this.fg.clear();
    bg.fillStyle(P.wall).fillRect(0, 0, w, hy);
    for (let x = Math.round((w / 2) % (28 * u)); x < w; x += 28 * u) bg.fillStyle(P.wall2).fillRect(x, 0, 2 * u, hy);
    bg.fillStyle(P.trim).fillRect(0, hy - 4 * u, w, 4 * u);
    bg.fillStyle(P.floor).fillRect(0, hy, w, h - hy);
    for (let y = hy + 8 * u; y < h; y += 10 * u) bg.fillStyle(P.floor2).fillRect(0, y, w, u);

    // Window (or the one-way mirror in the bank)
    const wy = Math.round(Math.max(hy * 0.18, top));
    const ww = Math.round(Math.min(72 * u, w * 0.3)), wh = Math.round(Math.max(30, Math.min(46 * u, (hy - wy) * 0.6)));
    const wx = Math.round(w * 0.64);
    bg.fillStyle(0x1b1424).fillRect(wx - 3 * u, wy - 3 * u, ww + 6 * u, wh + 6 * u);
    bg.fillStyle(P.frame).fillRect(wx - 2 * u, wy - 2 * u, ww + 4 * u, wh + 4 * u);
    if (this.s.room === 'bank') {
      bg.fillStyle(0x161d2c).fillRect(wx, wy, ww, wh);
      bg.fillStyle(0x23304a);
      for (let i = 0; i < 3; i++) bg.fillRect(wx + (8 + i * 22) * u, wy + 2 * u, 3 * u, wh - 4 * u);
    } else if (this.s.room === 'truck') {
      bg.fillStyle(0xf3c27a).fillRect(wx, wy, ww, wh);
      for (let x = 0; x < ww; x += 8 * u) bg.fillStyle((x / (8 * u)) % 2 ? 0xf4f1ea : 0xd9534f).fillRect(wx + x, wy, Math.min(8 * u, ww - x), 6 * u);
      bg.fillStyle(0x6dad5a).fillRect(wx, wy + wh - 8 * u, ww, 8 * u);
      bg.fillStyle(0x8a5a32).fillRect(wx + 10 * u, wy + wh - 16 * u, 18 * u, 8 * u);
      bg.fillStyle(0xe0457b).fillRect(wx + 40 * u, wy + wh - 14 * u, 14 * u, 6 * u);
    } else {
      bg.fillStyle(0x9fd3e6).fillRect(wx, wy, ww, wh);
      bg.fillStyle(0xf4f8fb).fillRect(wx + 8 * u, wy + 8 * u, 14 * u, 4 * u).fillRect(wx + 12 * u, wy + 5 * u, 7 * u, 3 * u);
      bg.fillStyle(0x6dad5a).fillRect(wx, wy + wh - 9 * u, ww, 9 * u);
      bg.fillStyle(P.frame).fillRect(wx + ww / 2 - u, wy, 2 * u, wh).fillRect(wx, wy + wh / 2 - u, ww, 2 * u);
    }

    // Affinity wall of sticky notes: every research room has one
    const ax = Math.round(w * 0.05), ay = Math.round(Math.max(hy * 0.2, top + 4));
    bg.fillStyle(0x5a3a22).fillRect(ax - 2 * u, ay - 2 * u, 46 * u, 32 * u);
    bg.fillStyle(0xc9a36b).fillRect(ax, ay, 42 * u, 28 * u);
    const cols = [0xf6d865, 0xef8fb0, 0xa9c7ff, 0xf6d865, 0xa9e0b8, 0xf6d865];
    cols.forEach((c, i) => {
      const nx = ax + 3 * u + (i % 3) * 13 * u + (i % 2) * u, ny = ay + 3 * u + Math.floor(i / 3) * 12 * u;
      bg.fillStyle(c).fillRect(nx, ny, 10 * u, 9 * u);
      bg.fillStyle(0x3a2f05, 0.5).fillRect(nx + 2 * u, ny + 3 * u, 6 * u, u).fillRect(nx + 2 * u, ny + 5 * u, 4 * u, u);
    });

    // Table in front of the customer
    const tx = Math.round(w * 0.04), tw = Math.round(w * 0.92), ty = hy - 2 * u;
    fg.fillStyle(0x3e2615).fillRect(tx + 6 * u, ty + 10 * u, 4 * u, h).fillRect(tx + tw - 10 * u, ty + 10 * u, 4 * u, h);
    fg.fillStyle(0x4a2e1a).fillRect(tx, ty + 4 * u, tw, 7 * u);
    fg.fillStyle(0x7a4b2a).fillRect(tx, ty, tw, 5 * u);
    fg.fillStyle(0x8f5b33).fillRect(tx, ty, tw, u);

    // Objects on the table
    const ix = Math.round(px - (w < 720 ? 34 : 48) * u);
    if (this.s.room === 'clinic') {
      fg.fillStyle(0x2a2a33).fillRect(ix, ty - 15 * u, 22 * u, 14 * u);
      fg.fillStyle(0x6aa6e0).fillRect(ix + 2 * u, ty - 13 * u, 18 * u, 10 * u);
      fg.fillStyle(0xf4f8fb).fillRect(ix + 4 * u, ty - 11 * u, 8 * u, 2 * u);
      fg.fillStyle(0x9aa3b0).fillRect(ix - 2 * u, ty - u, 26 * u, 2 * u);
    } else if (this.s.room === 'truck') {
      fg.fillStyle(0xa67a4c).fillRect(ix, ty - 12 * u, 11 * u, 13 * u);
      fg.fillStyle(0xf4f1ea).fillRect(ix + u, ty - 10 * u, 9 * u, 10 * u);
      fg.fillStyle(0x7a8090).fillRect(ix + 2 * u, ty - 8 * u, 6 * u, u).fillRect(ix + 2 * u, ty - 6 * u, 5 * u, u).fillRect(ix + 2 * u, ty - 4 * u, 6 * u, u);
      fg.fillStyle(0x3a3f4a).fillRect(ix + 3 * u, ty - 13 * u, 5 * u, 2 * u);
    } else {
      for (const [ox, col] of [[0, 0x86a6ff], [9, 0xf6d865]] as const) {
        fg.fillStyle(0x1b1424).fillRect(ix + ox * u, ty - 12 * u, 7 * u, 12 * u);
        fg.fillStyle(col).fillRect(ix + (ox + 1) * u, ty - 11 * u, 5 * u, 9 * u);
      }
    }
    const rx = Math.round(Math.min(w - 26 * u, px + 34 * u)), ry = ty - 6 * u;
    fg.fillStyle(0x2a2a33).fillRect(rx, ry, 16 * u, 6 * u);
    fg.fillStyle(0x4a4a58).fillRect(rx + 6 * u, ry + 2 * u, 8 * u, 2 * u);
    return { win: { x: wx, y: wy, w: ww, h: wh }, rec: { x: rx + 2 * u, y: ry + 2 * u, s: 2 * u } };
  }

  /* ---------------- reactions ---------------- */

  private blink() {
    if (!this.alive) return;
    this.por.setFrame(`${this.mood}-b`);
    this.time.delayedCall(130, () => this.alive && this.por.setFrame(this.mood));
  }

  private setMood(m: Mood) {
    this.mood = m;
    this.por.setFrame(m);
    const scale = this.emoteScale;
    this.tweens.killTweensOf(this.emote);
    this.emote.setFrame(MOOD_EMOTE[m]).setVisible(true).setPosition(this.por.x + 16 * this.ps, this.baseY - 44 * this.ps).setScale(0);
    this.tweens.add({ targets: this.emote, scale, duration: 220, ease: 'Back.easeOut' });
    this.time.delayedCall(1600, () => this.alive && this.emote.setVisible(false));
  }

  private jordanPing() {
    if (!this.jor) return;
    this.jor.setAlpha(1);
    this.tweens.add({ targets: this.jor, scaleY: this.jor.scaleY * 1.06, duration: 120, yoyo: true });
    this.time.delayedCall(2200, () => this.alive && this.jor?.setAlpha(0.5));
  }

  private react(v: Choice['v'], unlocked: boolean) {
    if (v === 'best') {
      sfx.good();
      const em = this.add.particles(0, 0, 'spark', { speed: { min: 80, max: 220 }, lifespan: 700, scale: { start: Math.max(1, this.ps / 2), end: 0 }, gravityY: 240, emitting: false });
      em.explode(18, this.por.x, this.baseY - 30 * this.ps);
      this.time.delayedCall(900, () => em.destroy());
      if (unlocked) {
        this.time.delayedCall(300, () => {
          if (!this.alive) return;
          sfx.note();
          const n = this.add.image(this.por.x, this.baseY - 30 * this.ps, 'note').setScale(this.ps);
          this.tweens.add({ targets: n, x: this.scale.width * 0.5, y: 34, scale: this.ps / 2, angle: 360, duration: 750, ease: 'Cubic.easeIn', onComplete: () => n.destroy() });
        });
      }
    } else if (v === 'ok') {
      sfx.ok();
    } else {
      sfx.bad();
      this.cameras.main.shake(160, 0.006);
      this.por.setTintFill(0xff7a63);
      this.time.delayedCall(90, () => this.por.clearTint());
    }
  }

  private meters() {
    const tu = this.s.turns[Math.min(this.ti, this.s.turns.length - 1)];
    ui.convoMeters({ open: this.open, ins: this.ins, mx: maxIns(this.s), bias: this.bias, streak: this.streak, t: tu.t });
  }

  private wait(ms: number) { return new Promise<void>((r) => this.time.delayedCall(ms, r)); }

  /* ---------------- the session loop ---------------- */

  private async runTurn() {
    if (!this.alive) return;
    const tu = this.s.turns[this.ti];
    this.meters();
    if (tu.who === 'obs') this.jordanPing();
    if (tu.who === 'p' && tu.line) this.them += wc(tu.line);
    await ui.convoLine({ ctx: tu.ctx, speaker: tu.who === 'obs' ? this.s.observer! : this.s.name, kind: tu.who, text: tu.line });
    if (!this.alive) return;
    const order = shuffle(tu.choices.length);
    const toWhom = tu.who === 'obs' ? `Reply to ${this.s.observer}` : `What do you say to ${this.s.name}?`;
    const pick = await ui.convoChoices(order.map((i) => tu.choices[i]), state.settings.timer ? TIMER_MS : 0, toWhom);
    if (!this.alive) return;
    const timedOut = pick < 0;
    const c = timedOut ? tu.choices.find((x) => x.silent) ?? SILENCE : tu.choices[order[pick]];
    await this.resolve(tu, c, timedOut);
  }

  private async resolve(tu: Turn, c: Choice, timedOut: boolean) {
    const rwho = c.rwho ?? tu.who;
    const toP = tu.who === 'p' || rwho === 'p';
    if (toP && !c.silent) this.you += wc(c.say);
    if (rwho === 'p') this.them += wc(c.reply);
    this.ins += c.ins;
    this.bias += c.bias;
    if (toP) this.open = Phaser.Math.Clamp(this.open + OPEN_DELTA[c.v], 0, 100);
    this.streak = c.v === 'best' ? this.streak + 1 : 0;
    let unlocked: string | null = null;
    if (c.unlock && !this.found.includes(c.unlock)) { this.found.push(c.unlock); unlocked = this.s.insights[c.unlock]; }
    const newMove = c.v === 'best' ? learnMove(c.tag) : false;
    if (rwho === 'p' && c.mood) this.setMood(c.mood);
    if (rwho === 'obs') this.jordanPing();
    this.react(c.v, !!unlocked);
    this.meters();

    await ui.convoReply({
      you: c.say, silent: c.silent, toObs: tu.who === 'obs' && !c.rwho,
      speaker: rwho === 'obs' ? this.s.observer! : this.s.name, kind: rwho, text: c.reply,
    });
    if (!this.alive) return;
    const left = this.open <= 0;
    const best = c.v !== 'best' ? tu.choices.find((x) => x.v === 'best') : undefined;
    await ui.convoCoach({ c, best, timedOut, unlocked, newMove, left });
    if (!this.alive) return;
    if (left) { await this.leave(); return; }
    this.ti++;
    if (this.ti >= this.s.turns.length) await this.finish(false);
    else await this.runTurn();
  }

  private async leave() {
    this.setMood('guarded');
    sfx.fail();
    await ui.convoLine({ speaker: this.s.name, kind: 'p', text: this.s.leave });
    if (!this.alive) return;
    this.tweens.add({ targets: this.por, alpha: 0, x: this.por.x + 60, duration: 700 });
    await this.wait(1000);
    if (this.alive) await this.finish(true);
  }

  private async finish(early: boolean) {
    const s = this.s;
    const mx = maxIns(s);
    const score = early ? 0 : Phaser.Math.Clamp((this.ins - this.bias * 0.5) / mx, 0, 1);
    const stars = early ? 0 : score >= 0.85 ? 3 : score >= 0.6 ? 2 : score >= 0.35 ? 1 : 0;
    const { newBest } = recordSession(s.id, stars, score, this.found);
    const keys = Object.keys(s.insights);
    const notesHtml = `<div class="res-notes"><h3>Insight wall · ${this.found.length} of ${keys.length}</h3><div class="stickies">${keys
      .map((k) => (this.found.includes(k) ? `<div class="sticky">${esc(s.insights[k])}</div>` : `<div class="sticky missed">Missed: ${esc(s.insights[k])}</div>`))
      .join('')}</div></div>`;
    const talk = this.you + this.them ? Math.round((this.you / (this.you + this.them)) * 100) : 0;
    const headline = early ? `${s.name} left early` : ['Mostly your own opinions', 'Useful but steered', 'Solid, a few fingerprints', 'Clean, rich data'][stars];
    const sub = early
      ? 'Openness hit zero. Leading, pitching and interrupting push people away. Try the quieter, more open moves.'
      : stars === 0
        ? 'You need at least one star to move on. Try the quieter, more open moves.'
        : `Score ${Math.round(score * 100)}%: insight minus half your bias, against the best possible session.`;
    if (stars > 0) sfx.unlock(); else sfx.fail();
    const r = await ui.results({
      eyebrow: `${s.code} · ${s.kind} ${early ? 'ended' : 'complete'}`,
      title: s.name,
      stars,
      headline,
      sub,
      newBest,
      notesHtml,
      stats: [[`${this.ins}/${mx}`, 'Insight'], [`${this.bias}`, 'Bias'], [`${this.found.length}/${keys.length}`, 'Insights found'], [`${talk}%`, 'Words that were yours']],
    });
    if (!this.alive) return;
    if (r === 'retry') { ui.convoClose(); this.scene.restart({ index: this.idx }); }
    else this.exit();
  }

  private exit() {
    ui.convoClose();
    this.alive = false;
    this.scene.resume('Town', { from: 'session' });
    this.scene.stop();
  }
}
