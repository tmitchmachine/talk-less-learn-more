import Phaser from 'phaser';
import { SESSIONS, sessionWho, type Choice, type Session } from '../data/sessions';
import type { Emote, Mood } from '../art/draw';
import { ui } from '../ui/ui';
import { sfx } from '../audio';
import { voice } from '../voice';
import { runSession, type SessionView } from '../session/runner';

const MOOD_EMOTE: Record<Mood, Emote> = { open: 'heart', neutral: 'dots', guarded: 'sweat', confused: 'q' };

type Room = Session['room'];
const ROOMS: Record<Room, { wall: number; wall2: number; trim: number; floor: number; floor2: number; frame: number }> = {
  truck: { wall: 0x8a3b2e, wall2: 0x7a3328, trim: 0x4a2a1e, floor: 0x5a4030, floor2: 0x4c3628, frame: 0xe0b33a },
  clinic: { wall: 0xcfe3e0, wall2: 0xbfd6d2, trim: 0x8aa7a2, floor: 0x8a9aa8, floor2: 0x7a8a98, frame: 0xf1efe8 },
  bank: { wall: 0x2d3e66, wall2: 0x283759, trim: 0x1b2540, floor: 0x3a3442, floor2: 0x332e3b, frame: 0xcfcac0 },
  lab: { wall: 0x5a3a22, wall2: 0x4a2e1a, trim: 0x3a2414, floor: 0xb08850, floor2: 0xa07a45, frame: 0xc9a36b },
};

export class ConversationScene extends Phaser.Scene {
  private s!: Session;
  private idx = 0;
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
  private light!: Phaser.GameObjects.Graphics;
  private spot!: Phaser.GameObjects.Image;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private blinking = false;

  constructor() { super('Conversation'); }

  create(data: { index: number }) {
    this.idx = data.index;
    this.s = SESSIONS[this.idx];
    this.mood = 'neutral'; this.alive = true; this.jor = undefined;
    const who = sessionWho(this.s);
    const workshop = this.s.mode === 'workshop';

    document.body.dataset.scene = 'convo';
    this.cameras.main.setBackgroundColor('#141826');
    this.bg = this.add.graphics();
    // A gentle depth-of-field: the room softens so the person you're talking to stands out.
    this.bg.postFX?.addBlur(0, 1, 1, 0.9);
    this.spot = this.add.image(0, 0, 'glow').setTint(0xffe6b0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28);
    if (this.s.observer) this.jor = this.add.sprite(0, 0, 'pt-jordan', 'neutral').setOrigin(0.5, 1).setAlpha(0.5);
    this.por = this.add.sprite(0, 0, `pt-${who}`, 'neutral').setOrigin(0.5, 1);
    this.fg = this.add.graphics();
    this.light = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.motes = this.add.particles(0, 0, 'mote', {
      lifespan: { min: 4000, max: 7000 }, speedX: { min: -6, max: 6 }, speedY: { min: -4, max: 8 },
      scale: { min: 0.15, max: 0.4 }, alpha: { values: [0, 0.6, 0], interpolation: 'linear' },
      tint: 0xfff2cc, blendMode: Phaser.BlendModes.ADD, frequency: 140, maxAliveParticles: 40,
    });
    this.rec = this.add.rectangle(0, 0, 4, 4, 0xff5a4e).setOrigin(0, 0).setVisible(!workshop);
    this.emote = this.add.sprite(0, 0, 'emotes', 'dots').setVisible(false);
    this.layout();

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.layout, this); this.alive = false; voice.stop(); });
    this.time.addEvent({ delay: 2900, loop: true, callback: () => this.blink() });
    if (!workshop) this.time.addEvent({ delay: 500, loop: true, callback: () => this.rec.setVisible(!this.rec.visible) });
    this.cameras.main.fadeIn(350);

    ui.convoOpen(this.s, () => this.exit());
    this.time.delayedCall(450, () => void this.startRunner());
  }

  update(time: number) {
    const bob = Math.sin(time / 650) > 0 ? 0 : this.ps;
    this.por.y = this.baseY + bob;
    if (this.jor) this.jor.y = this.jorBaseY;
    const who = voice.current();
    const face = sessionWho(this.s);
    const flap = Math.floor(time / 130) % 3 !== 2;
    if (!this.blinking) this.por.setFrame(who === face && flap ? `${this.mood}-t` : this.mood);
    if (this.jor) this.jor.setFrame(who === 'jordan' && flap ? 'neutral-t' : 'neutral');
  }

  private async startRunner() {
    const view: SessionView = {
      setMood: (m) => this.setMood(m),
      react: (v, unlocked) => this.react(v, unlocked),
      pingObserver: () => this.jordanPing(),
      walkOut: async () => {
        this.tweens.add({ targets: this.por, alpha: 0, x: this.por.x + 60, duration: 700 });
        await this.wait(1000);
      },
      dim: (on) => { this.por.setAlpha(on ? 0.35 : 1); },
      alive: () => this.alive,
    };
    const r = await runSession(this.idx, view);
    if (!this.alive) return;
    if (r === 'retry') { ui.convoClose(); this.scene.restart({ index: this.idx }); }
    else this.exit();
  }

  /* ---------------- scene art ---------------- */

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    const narrow = w < 720;
    const u = Math.max(2, Math.floor(Math.min(w / 240, h / 140)));
    // The dialogue panel covers roughly the bottom half, so the customer sits above it.
    const hy = Math.round(h * (narrow ? 0.4 : 0.46));
    const top = narrow ? 120 : 84;
    this.ps = Phaser.Math.Clamp(Math.floor(Math.min(hy - top, w * (narrow ? 0.6 : 0.4)) / 46), 2, 10);
    const px = Math.round(narrow ? w * 0.5 : w * 0.34);
    const spots = this.drawRoom(w, h, hy, u, px, top);
    this.baseY = hy + 4 * u;
    this.por.setScale(this.ps).setPosition(px, this.baseY);
    this.spot.setPosition(px, this.baseY - 26 * this.ps).setDisplaySize(110 * this.ps, 90 * this.ps);
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
    const light = this.light.clear();
    bg.fillStyle(P.wall).fillRect(0, 0, w, hy);
    for (let x = Math.round((w / 2) % (28 * u)); x < w; x += 28 * u) bg.fillStyle(P.wall2).fillRect(x, 0, 2 * u, hy);
    // Ceiling shade fading down the wall
    bg.fillGradientStyle(0x0b0d18, 0x0b0d18, 0x0b0d18, 0x0b0d18, 0.45, 0.45, 0, 0).fillRect(0, 0, w, hy * 0.6);
    bg.fillStyle(P.trim).fillRect(0, hy - 4 * u, w, 4 * u);
    bg.fillStyle(P.floor).fillRect(0, hy, w, h - hy);
    for (let y = hy + 8 * u; y < h; y += 10 * u) bg.fillStyle(P.floor2).fillRect(0, y, w, u);
    bg.fillGradientStyle(0x000000, 0x000000, 0x0b0d18, 0x0b0d18, 0.25, 0.25, 0.6, 0.6).fillRect(0, hy, w, h - hy);

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
    } else if (this.s.room === 'lab') {
      bg.fillStyle(0xd4b896).fillRect(wx, wy, ww, wh);
      bg.fillStyle(0x5a3a22).fillRect(wx + 4 * u, wy + 4 * u, ww - 8 * u, wh - 8 * u);
      const cards = [0xf6d865, 0xef8fb0, 0xa9c7ff, 0xa9e0b8];
      cards.forEach((c, i) => bg.fillStyle(c).fillRect(wx + 6 * u + (i % 2) * 14 * u, wy + 6 * u + Math.floor(i / 2) * 12 * u, 12 * u, 10 * u));
    } else {
      bg.fillStyle(0x9fd3e6).fillRect(wx, wy, ww, wh);
      bg.fillStyle(0xf4f8fb).fillRect(wx + 8 * u, wy + 8 * u, 14 * u, 4 * u).fillRect(wx + 12 * u, wy + 5 * u, 7 * u, 3 * u);
      bg.fillStyle(0x6dad5a).fillRect(wx, wy + wh - 9 * u, ww, 9 * u);
      bg.fillStyle(P.frame).fillRect(wx + ww / 2 - u, wy, 2 * u, wh).fillRect(wx, wy + wh / 2 - u, ww, 2 * u);
    }
    // Sunlight falling from the window across the room (the bank's one-way mirror stays dark)
    if (this.s.room !== 'bank') {
      const c = this.s.room === 'truck' ? 0xffd8a0 : this.s.room === 'lab' ? 0xffe8c0 : 0xe8f4ff;
      const x0 = wx, x1 = wx + ww, yb = h, spread = w * 0.22;
      light.fillGradientStyle(c, c, c, c, 0.16, 0.16, 0, 0);
      light.fillTriangle(x0, wy + wh, x1, wy + wh, x0 - spread, yb);
      light.fillTriangle(x1, wy + wh, x1 - spread, yb, x0 - spread, yb);
      light.fillStyle(c, 0.08).fillRect(wx, wy, ww, wh);
    }
    this.motes.clearEmitZones();
    this.motes.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(wx - w * 0.15, wy, ww + w * 0.1, h - wy) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource });

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
    fg.fillStyle(0x9a6a3e).fillRect(tx, ty, tw, u);
    fg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.35, 0.35).fillRect(tx, ty + u, tw, 4 * u);
    fg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0.4, 0, 0).fillRect(tx, ty + 11 * u, tw, 10 * u);

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
    } else if (this.s.room === 'lab') {
      for (const [ox, col] of [[0, 0xf6d865], [8, 0xa9c7ff], [16, 0xef8fb0]] as const) {
        fg.fillStyle(col).fillRect(ix + ox * u, ty - 10 * u, 7 * u, 9 * u);
        fg.fillStyle(0x3a2f05, 0.35).fillRect(ix + (ox + 1) * u, ty - 7 * u, 5 * u, u);
      }
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
    this.blinking = true;
    this.por.setFrame(`${this.mood}-b`);
    this.time.delayedCall(130, () => { this.blinking = false; });
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

  private wait(ms: number) { return new Promise<void>((r) => this.time.delayedCall(ms, r)); }

  private exit() {
    voice.stop();
    ui.convoClose();
    this.alive = false;
    this.scene.resume('Town', { from: 'session' });
    this.scene.stop();
  }
}
