import Phaser from 'phaser';
import { buildTown, H, T, W, type Facing } from '../world/map';
import { SOLID_TILES, TILE, TREE_KINDS, makeGroundDetail, mulberry32, type Emote } from '../art/draw';
import { CAST } from '../data/cast';
import { SESSIONS } from '../data/sessions';
import { NOTICEBOARD, TOWNSFOLK, maeLines } from '../data/townsfolk';
import { isUnlocked, objective, rank, resetSave, save, stage, state, storyStage } from '../state';
import { ui } from '../ui/ui';
import { music, sfx } from '../audio';

interface Item {
  id: string;
  x: number;
  y: number;
  label: string;
  act: () => void | Promise<void>;
  npc?: Phaser.GameObjects.Sprite;
  marker?: Phaser.GameObjects.Sprite;
}

type GateName = 'east' | 'south';
type Keys = Record<'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'W' | 'A' | 'S' | 'D' | 'E' | 'SPACE' | 'ENTER' | 'J' | 'ESC', Phaser.Input.Keyboard.Key>;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = 74;
const REACH = 22;
const IDLE: Record<Facing, string> = { down: '0', up: '3', left: '6', right: '6' };

const TIPS = [
  'When in doubt, count to 10 silently. People fill the quiet.',
  'Ask about the last time something happened, not what usually happens.',
  'Questions that start with “did,” “was” or “is” tend to lead. Try “how” or “what.”',
  'Echo their last words. Boomerang their questions. Trail off like Columbo.',
  'Watch what people do. Don’t believe what they say they do, or will do.',
  'Start broad, then narrow. That’s the funnel.',
];

export class TownScene extends Phaser.Scene {
  private town = buildTown();
  private player!: Phaser.Physics.Arcade.Sprite;
  private pShadow!: Phaser.GameObjects.Image;
  private keys!: Keys;
  private facing: Facing = 'down';
  private items: Item[] = [];
  private near: Item | null = null;
  private attract = false;
  private cine = false;
  private wired = false;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private gates: Record<GateName, { img: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone }[]> = { east: [], south: [] };
  private gateOpen: Record<GateName, boolean> = { east: false, south: false };
  private joy = { on: false, sx: 0, sy: 0, dx: 0, dy: 0, t: 0, moved: false };
  private labMarker!: Phaser.GameObjects.Sprite;
  private tipIndex = 0;
  private clouds!: Phaser.GameObjects.TileSprite;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustT = 0;
  private glowing: Phaser.GameObjects.Sprite | null = null;
  private glowFx: Phaser.FX.Glow | null = null;

  constructor() { super('Town'); }

  create(data: { attract?: boolean }) {
    this.attract = !!data.attract;
    this.cine = false;
    this.items = [];
    this.near = null;
    this.gates = { east: [], south: [] };
    this.gateOpen = { east: false, south: false };
    this.glowing = null;
    this.glowFx = null;
    document.body.dataset.scene = 'town';
    const town = this.town;

    // Ground
    const map = this.make.tilemap({ data: town.tiles, tileWidth: T, tileHeight: T });
    const ts = map.addTilesetImage('tiles', 'tiles', T, T, 0, 0)!;
    const layer = map.createLayer(0, ts, 0, 0)!;
    layer.setCollision(SOLID_TILES);
    layer.setDepth(-10);
    this.time.addEvent({
      delay: 650, loop: true,
      callback: () => layer.forEachTile((t) => {
        if (t.index === TILE.water) t.index = TILE.water2;
        else if (t.index === TILE.water2) t.index = TILE.water;
      }),
    });
    this.physics.world.setBounds(0, 0, W * T, H * T);
    this.solids = this.physics.add.staticGroup();

    // Grass fringes, shorelines and tufts over the tile grid
    if (!this.textures.exists('ground-fx')) makeGroundDetail(this, town.tiles, T);
    this.add.image(0, 0, 'ground-fx').setOrigin(0, 0).setDepth(-9);

    // Trees: tall sprites sorted by their base, so you can walk behind the canopy
    const trnd = mulberry32(31);
    const water: [number, number][] = [];
    const flowers: [number, number][] = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const v = town.tiles[ty][tx];
      if (v === TILE.water) water.push([tx, ty]);
      if (v === TILE.flowers) flowers.push([tx, ty]);
      if (v !== TILE.tree) continue;
      const edge = tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2;
      const r = trnd();
      const kind = edge ? (r < 0.5 ? TREE_KINDS[0] : r < 0.78 ? TREE_KINDS[1] : TREE_KINDS[3]) : (r < 0.45 ? TREE_KINDS[0] : r < 0.65 ? TREE_KINDS[2] : r < 0.85 ? TREE_KINDS[1] : TREE_KINDS[3]);
      const x = tx * T + 8 + Math.round((trnd() - 0.5) * 2), y = ty * T + 15;
      this.add.image(x + 2, y - 1, 'softshadow').setDisplaySize(26, 9).setAlpha(0.42).setDepth(-5);
      this.add.image(x, y, kind).setOrigin(0.5, 1).setDepth(y).setFlipX(trnd() < 0.5);
    }

    // Buildings
    for (const b of town.buildings) {
      const img = this.add.image(b.tx * T, b.ty * T, b.key).setOrigin(0, 0);
      img.setDepth(img.y + img.height);
      this.add.image(img.x + img.width / 2 + 4, img.y + img.height - 3, 'softshadow').setDisplaySize(img.width * 1.15, 20).setAlpha(0.45).setDepth(-5);
      const top = b.key === 'b-truck' ? 12 : Math.round(img.height * 0.4);
      this.solid(img.x + 2, img.y + top, img.width - 4, img.height - top - 2);
    }
    // Props
    for (const p of town.props) {
      const img = this.add.image(p.tx * T + 8, p.ty * T + 15, p.key).setOrigin(0.5, 1);
      img.setDepth(img.y);
      this.add.image(img.x + 1, img.y - 1, 'softshadow').setDisplaySize(img.width + 6, 6).setAlpha(0.4).setDepth(-5);
      this.solid(img.x - img.width / 2 + 1, img.y - 5, img.width - 2, 5);
      if (p.key === 'lamp') {
        const g = this.add.image(img.x, img.y - 25, 'glow').setTint(0xffd98a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, 40).setAlpha(0.35).setDepth(8500);
        this.tweens.add({ targets: g, alpha: 0.2, duration: 1800 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    this.ambience(water, flowers);
    // Barricades
    for (const g of ['east', 'south'] as GateName[]) {
      for (const [tx, ty] of town.gates[g]) {
        const img = this.add.image(tx * T + 8, ty * T + 16, 'barricade').setOrigin(0.5, 1).setDepth(ty * T + 16);
        const zone = this.solid(tx * T, ty * T, T, T);
        this.gates[g].push({ img, zone });
      }
      const [gx, gy] = town.gates[g][0];
      this.items.push({
        id: `gate-${g}`, x: gx * T + 8, y: gy * T + 16, label: 'Read the sign',
        act: () => ui.dialog([{ name: 'Road sign', text: g === 'east' ? 'ROAD CLOSED. Mae will open the east road after your interview with Rosa.' : 'ROAD CLOSED. Mae will open the south road after your session with Theo.' }]),
      });
    }

    // NPCs
    for (const n of town.npcs) {
      const x = n.tx * T + 8, y = n.ty * T + 8;
      this.add.image(x, y + 7, 'softshadow').setDisplaySize(14, 6).setAlpha(0.55).setDepth(-5);
      const s = this.add.sprite(x, y, `ch-${n.id}`, IDLE[n.face]).setDepth(y + 8).setFlipX(n.face === 'left');
      this.tweens.add({ targets: s, y: y - 1, duration: 520 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Stepped', delay: Math.random() * 500 });
      this.solid(x - 5, y + 2, 10, 6);
      const name = CAST[n.id].name;
      const si = SESSIONS.findIndex((ss) => ss.id === n.id);
      const marker = this.add.sprite(x, y - 13, 'emotes', 'excl').setDepth(9999).setVisible(false);
      this.tweens.add({ targets: marker, y: y - 15, duration: 400, yoyo: true, repeat: -1, ease: 'Stepped' });
      let act: () => void | Promise<void>;
      if (n.id === 'mae') act = () => this.talkMae();
      else if (si >= 0) act = () => this.customer(si);
      else act = () => this.townsperson(n.id);
      this.items.push({ id: n.id, x, y: y + 4, label: `Talk to ${name}`, act, npc: s, marker });
    }

    // Notice board and lab door
    this.items.push({ id: 'board', x: town.board.tx * T + 8, y: town.board.ty * T + 16, label: 'Read the notice board', act: () => ui.dialog(NOTICEBOARD.map((text, i) => ({ name: i === 0 ? 'Notice board' : 'Usability 101', text }))) });
    const lx = town.labDoor.tx * T, ly = town.labDoor.ty * T;
    this.items.push({ id: 'lab', x: lx, y: ly + 2, label: 'Enter the lab', act: () => this.labDoor() });
    this.labMarker = this.add.sprite(lx, ly - 22, 'emotes', 'excl').setDepth(9999).setVisible(false);
    this.tweens.add({ targets: this.labMarker, y: ly - 24, duration: 400, yoyo: true, repeat: -1, ease: 'Stepped' });

    // Player
    this.pShadow = this.add.image(0, 0, 'softshadow').setDisplaySize(14, 6).setAlpha(0.55);
    this.player = this.physics.add.sprite(town.start.tx * T + 8, town.start.ty * T + 8, 'ch-player', '0');
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(10, 6).setOffset(3, 10);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, this.solids);
    this.facing = 'down';

    // Camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W * T, H * T);
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#141826');
    this.fitZoom();

    // Input. Captures are off so the DOM interface keeps normal keyboard behavior.
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,E,SPACE,ENTER,J,ESC', false) as Keys;
    kb.clearCaptures();
    kb.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.scale.on('resize', this.fitZoom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fitZoom, this);
      kb.off('keydown', this.onKey, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });
    if (!this.wired) {
      this.wired = true;
      this.events.on('resume', this.onResume, this);
      ui.onReset = () => { resetSave(); state.started = true; save(); this.scene.restart({ attract: false }); };
    }

    this.refresh(false);

    if (this.attract) this.startAttract();
    else this.beginPlay();
  }

  /* ---------------- helpers ---------------- */

  private solid(x: number, y: number, w: number, h: number) {
    const z = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.solids.add(z);
    return z;
  }

  /** Living-world touches: cloud shadows, light motes, butterflies, water glints, footstep dust. */
  private ambience(water: [number, number][], flowers: [number, number][]) {
    const ww = W * T, wh = H * T;
    this.clouds = this.add.tileSprite(0, 0, ww, wh, 'clouds').setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(8000);
    this.dust = this.add.particles(0, 0, 'mote', {
      lifespan: 420, speedX: { min: -8, max: 8 }, speedY: { min: -10, max: -2 },
      scale: { start: 0.18, end: 0.42 }, alpha: { start: 0.45, end: 0 }, tint: 0xf1e4c4, emitting: false,
    }).setDepth(-4);
    // Players who ask their system for less motion get a still, calm town.
    if (REDUCED) return;

    // Warm motes of light drifting on the breeze
    this.add.particles(0, 0, 'mote', {
      x: { min: 0, max: ww }, y: { min: 0, max: wh },
      lifespan: { min: 5000, max: 9000 },
      speedX: { min: -3, max: 7 }, speedY: { min: -6, max: 1 },
      scale: { min: 0.12, max: 0.32 },
      alpha: { values: [0, 0.75, 0], interpolation: 'linear' },
      tint: [0xfff4c2, 0xffe08a, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 60,
      maxAliveParticles: 160,
    }).setDepth(8600);

    // Butterflies that wander between the flowers
    if (!this.anims.exists('butterfly-flap')) {
      this.anims.create({ key: 'butterfly-flap', frames: [{ key: 'butterfly', frame: '0' }, { key: 'butterfly', frame: '1' }], frameRate: 9, repeat: -1 });
    }
    const spots = flowers.length ? flowers : [[10, 6], [24, 18], [6, 15]] as [number, number][];
    const tints = [0xffd84d, 0xffffff, 0xff9fc6, 0x9fc8ff];
    for (let i = 0; i < 7; i++) {
      const [fx, fy] = spots[Math.floor(Math.random() * spots.length)];
      const b = this.add.sprite(fx * T + 8, fy * T + 4, 'butterfly', '0').setTint(tints[i % tints.length]).setDepth(8700).play({ key: 'butterfly-flap', startFrame: i % 2 });
      const hop = () => {
        if (!b.active) return;
        const [nx, ny] = Math.random() < 0.3 ? spots[Math.floor(Math.random() * spots.length)] : [b.x / T + (Math.random() - 0.5) * 4, b.y / T + (Math.random() - 0.5) * 3];
        const tx = Phaser.Math.Clamp(nx * T + 8, 40, ww - 40), ty = Phaser.Math.Clamp(ny * T, 40, wh - 40);
        b.setFlipX(tx < b.x);
        const d = Phaser.Math.Distance.Between(b.x, b.y, tx, ty);
        this.tweens.add({ targets: b, x: tx, y: ty, duration: Math.max(900, d * 45), ease: 'Sine.easeInOut', onComplete: () => this.time.delayedCall(300 + Math.random() * 1500, hop) });
      };
      this.time.delayedCall(Math.random() * 1500, hop);
    }

    // Glints of sun on the pond
    if (water.length) {
      this.time.addEvent({
        delay: 220, loop: true,
        callback: () => {
          const [tx, ty] = water[Math.floor(Math.random() * water.length)];
          const s = this.add.image(tx * T + Math.random() * T, ty * T + Math.random() * T, 'spark').setDepth(-8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: s, alpha: 0.9, duration: 300, yoyo: true, onComplete: () => s.destroy() });
        },
      });
    }
  }

  private setGlow(s: Phaser.GameObjects.Sprite | null) {
    if (this.glowing === s) return;
    if (this.glowing && this.glowFx) { this.glowing.preFX?.remove(this.glowFx); this.glowFx = null; }
    this.glowing = s;
    if (s?.preFX) {
      s.preFX.setPadding(4);
      this.glowFx = s.preFX.addGlow(0xfff1b8, 3, 0, false, 0.1, 6);
    }
  }

  private fitZoom() {
    const z = Phaser.Math.Clamp(Math.floor(Math.min(this.scale.width / 300, this.scale.height / 170)), 2, 6);
    this.cameras.main.setZoom(z);
  }

  private startAttract() {
    ui.hud(false);
    ui.prompt(null);
    const cam = this.cameras.main;
    const stops = [[320, 170], [140, 330], [520, 120], [470, 300], [270, 400]];
    let i = 0;
    cam.centerOn(stops[0][0], stops[0][1]);
    const next = () => {
      if (!this.attract) return;
      i = (i + 1) % stops.length;
      cam.pan(stops[i][0], stops[i][1], 6000, 'Sine.easeInOut', true, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
        if (p === 1) this.time.delayedCall(800, next);
      });
    };
    this.time.delayedCall(800, next);
    ui.title({
      canContinue: state.started,
      onContinue: () => this.beginPlay(),
      onNew: () => { resetSave(); state.started = true; save(); this.scene.restart({ attract: false }); },
    });
  }

  private beginPlay() {
    this.attract = false;
    const cam = this.cameras.main;
    cam.panEffect.reset();
    cam.startFollow(this.player, true, 0.2, 0.2);
    cam.fadeIn(300);
    state.started = true;
    save();
    ui.hud(true, { journal: () => !ui.busy() && ui.journal(), menu: () => !ui.busy() && ui.menu() });
    music.sync();
    if (state.maeSeen < 0) this.time.delayedCall(600, () => { if (!ui.busy()) void this.talkMae(); });
  }

  private onResume() {
    document.body.dataset.scene = 'town';
    this.cameras.main.fadeIn(350);
    this.player.setVelocity(0);
    ui.hud(true);
    music.sync();
    this.refresh(true);
    if (state.synth.done && state.maeSeen < 4) ui.toast('Go tell Mae what you learned.', 'good');
  }

  /** Updates markers, HUD and road gates to match progress. */
  private refresh(animate: boolean) {
    const st = storyStage();
    for (const it of this.items) {
      if (!it.marker) continue;
      let e: Emote | null = null;
      if (it.id === 'mae') e = state.maeSeen < st ? 'excl' : null;
      const si = SESSIONS.findIndex((s) => s.id === it.id);
      if (si >= 0 && isUnlocked(si)) {
        const rec = state.sessions[SESSIONS[si].id];
        e = !rec || rec.stars === 0 ? 'excl' : rec.stars === 3 ? 'star' : 'check';
      }
      it.marker.setVisible(!!e);
      if (e) it.marker.setFrame(e);
    }
    this.labMarker.setVisible(stage() >= SESSIONS.length && !state.synth.done);
    ui.hudUpdate();
    if (stage() >= 1 && !this.gateOpen.east) this.openGate('east', animate);
    if (stage() >= 2 && !this.gateOpen.south) this.openGate('south', animate && stage() < 3);
  }

  private openGate(g: GateName, animate: boolean) {
    this.gateOpen[g] = true;
    this.items = this.items.filter((it) => it.id !== `gate-${g}`);
    const parts = this.gates[g];
    const remove = () => parts.forEach((p) => {
      p.zone.destroy();
      this.tweens.add({ targets: p.img, alpha: 0, y: p.img.y - 6, duration: 300, onComplete: () => p.img.destroy() });
    });
    if (!animate) { parts.forEach((p) => { p.zone.destroy(); p.img.destroy(); }); return; }
    this.cine = true;
    const cam = this.cameras.main;
    cam.stopFollow();
    const tx = parts[0].img.x, ty = parts[0].img.y;
    this.time.delayedCall(400, () => {
      cam.pan(tx, ty, 800, 'Sine.easeInOut', true, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
        if (p < 1) return;
        this.time.delayedCall(250, () => {
          const em = this.add.particles(0, 0, 'spark', { speed: { min: 20, max: 70 }, lifespan: 600, scale: { start: 1.5, end: 0 }, emitting: false }).setDepth(9999);
          em.explode(18, tx, ty - 8);
          sfx.unlock();
          remove();
          ui.toast(g === 'east' ? 'The east road to the clinic is open!' : 'The south road to Kite Bank is open!', 'good');
          this.time.delayedCall(1100, () => {
            em.destroy();
            cam.pan(this.player.x, this.player.y, 700, 'Sine.easeInOut', true, (_c2: Phaser.Cameras.Scene2D.Camera, p2: number) => {
              if (p2 < 1) return;
              cam.startFollow(this.player, true, 0.2, 0.2);
              this.cine = false;
            });
          });
        });
      });
    });
  }

  /* ---------------- interactions ---------------- */

  private interact() {
    const it = this.near;
    if (!it || ui.busy() || this.cine) return;
    if (it.npc) {
      const dx = this.player.x - it.npc.x, dy = this.player.y - it.npc.y;
      const face: Facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      it.npc.setFrame(IDLE[face]).setFlipX(face === 'left');
    }
    this.player.setVelocity(0);
    sfx.talk();
    void it.act();
  }

  private async talkMae() {
    const st = storyStage();
    const fresh = state.maeSeen < st;
    const lines = fresh ? maeLines(st, rank()) : [`Your next step: ${objective()}`, TIPS[this.tipIndex++ % TIPS.length]];
    await ui.dialog(lines.map((text) => ({ name: 'Mae', text, face: 'mae' })));
    if (fresh) {
      state.maeSeen = st;
      save();
      this.refresh(false);
      if (st === 0) ui.toast('New objective: interview Rosa at the taco truck.', 'good');
    }
  }

  private async customer(i: number) {
    const s = SESSIONS[i];
    if (!isUnlocked(i)) {
      await ui.dialog([{ name: s.name, text: 'Oh, hi! I think Mae has someone else for you to talk to first.', face: s.id }]);
      return;
    }
    const go = await ui.sessionIntro(s, state.sessions[s.id]);
    if (go) this.launch('Conversation', { index: i });
  }

  private async townsperson(id: string) {
    const t = TOWNSFOLK[id];
    await ui.dialog(t.lines.map((text) => ({ name: CAST[id].name, text, face: id })));
  }

  private async labDoor() {
    if (stage() < SESSIONS.length) {
      await ui.dialog([{ name: 'Lab door', text: 'A sticky note on the door: “Synthesis in progress. Bring notes from all three customers.”' }]);
      return;
    }
    const go = await ui.confirm(
      'The Insight Wall',
      'Sort observations from your sessions into the five quality components of usability, plus utility. Notes fall, so decide before they hit the floor. Keys 1–6 or tap a bin.',
      'Start sorting', 'Not now',
    );
    if (go) this.launch('Synthesis', {});
  }

  private launch(key: string, data: object) {
    ui.hud(false);
    ui.prompt(null);
    music.stop();
    this.player.setVelocity(0);
    this.player.anims.stop();
    const cam = this.cameras.main;
    cam.fadeOut(250, 20, 24, 38);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.launch(key, data);
      this.scene.pause();
    });
  }

  /** Action keys use keydown events so even a very quick tap is never missed. */
  private onKey(e: KeyboardEvent) {
    if (this.attract || this.cine || e.repeat || ui.busy() || ui.justClosed()) return;
    const k = e.key;
    if (k === 'e' || k === 'E' || k === ' ' || k === 'Enter') this.interact();
    else if (k === 'j' || k === 'J') ui.journal();
    else if (k === 'Escape') ui.menu();
  }

  /* ---------------- touch / mouse joystick ---------------- */

  private onDown(p: Phaser.Input.Pointer) {
    if (this.attract || ui.busy() || this.cine) return;
    this.joy = { on: true, sx: p.x, sy: p.y, dx: 0, dy: 0, t: this.time.now, moved: false };
  }
  private onMove(p: Phaser.Input.Pointer) {
    if (!this.joy.on) return;
    const dx = p.x - this.joy.sx, dy = p.y - this.joy.sy;
    const d = Math.hypot(dx, dy);
    if (d > 10) this.joy.moved = true;
    this.joy.dx = dx;
    this.joy.dy = dy;
    if (this.joy.moved) {
      const k = d > 36 ? 36 / d : 1;
      ui.joy(this.joy.sx, this.joy.sy, dx * k, dy * k);
    }
  }
  private onUp() {
    if (!this.joy.on) return;
    const tap = !this.joy.moved && this.time.now - this.joy.t < 350;
    this.joy.on = false;
    ui.joy(null);
    if (tap && this.near) this.interact();
  }

  /* ---------------- loop ---------------- */

  update(_time: number, delta: number) {
    if (!REDUCED) {
      this.clouds.tilePositionX -= delta * 0.004;
      this.clouds.tilePositionY -= delta * 0.0016;
    }
    if (this.attract) return;
    const k = this.keys;
    const busy = ui.busy() || this.cine;
    let vx = 0, vy = 0;
    if (busy) {
      if (this.joy.on) { this.joy.on = false; ui.joy(null); }
    } else {
      if (k.LEFT.isDown || k.A.isDown) vx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) vx += 1;
      if (k.UP.isDown || k.W.isDown) vy -= 1;
      if (k.DOWN.isDown || k.S.isDown) vy += 1;
      if (this.joy.on && this.joy.moved && Math.hypot(this.joy.dx, this.joy.dy) > 8) { vx = this.joy.dx; vy = this.joy.dy; }
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) { vx /= len; vy /= len; }
    this.player.setVelocity(vx * SPEED, vy * SPEED);

    if (len > 0) {
      this.dustT -= delta;
      if (this.dustT <= 0) { this.dustT = 190; this.dust.emitParticleAt(this.player.x - vx * 4, this.player.y + 7, 1); }
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
      const anim = this.facing === 'up' ? 'player-walk-up' : this.facing === 'down' ? 'player-walk-down' : 'player-walk-side';
      this.player.anims.play(anim, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(IDLE[this.facing]);
    }
    this.player.setFlipX(this.facing === 'left');
    this.player.setDepth(this.player.y + 8);
    this.pShadow.setPosition(this.player.x, this.player.y + 7).setDepth(this.player.y + 6);

    if (busy) { ui.prompt(null); this.setGlow(null); return; }

    // Nearest thing to talk to
    const fx = this.player.x, fy = this.player.y + 4;
    let best: Item | null = null;
    let bestD = REACH;
    for (const it of this.items) {
      const d = Math.hypot(it.x - fx, it.y - fy);
      if (d < bestD) { bestD = d; best = it; }
    }
    this.near = best;
    this.setGlow(best?.npc ?? null);
    ui.prompt(best ? best.label : null, () => this.interact());
  }
}
