// All art in the game is drawn here, pixel by pixel, into canvas textures at boot.
import Phaser from 'phaser';

export type HairStyle = 'short' | 'bun' | 'long' | 'spiky' | 'cap' | 'bald';
export type Mood = 'open' | 'neutral' | 'guarded' | 'confused';
export const MOODS: Mood[] = ['open', 'neutral', 'guarded', 'confused'];

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes?: string;
  style: HairStyle;
  cap?: string;
  glasses?: boolean;
}

type Rect = [number, number, number, number, string];
type Ctx = CanvasRenderingContext2D;

const OUT = '#1b1424';
const EYE = '#1d1a26';

/** f < 1 darkens toward black, f > 1 lightens toward white. */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const out = f < 1 ? v * f : v + (255 - v) * (f - 1);
    return Math.max(0, Math.min(255, Math.round(out)));
  });
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws filled rects with a 1px silhouette outline, then detail rects on top without outline. */
function paint(ctx: Ctx, ox: number, oy: number, rects: Rect[], details: Rect[] = [], outline: string | null = OUT) {
  if (outline) {
    ctx.fillStyle = outline;
    for (const [x, y, w, h] of rects) ctx.fillRect(ox + x - 1, oy + y - 1, w + 2, h + 2);
  }
  for (const [x, y, w, h, c] of rects) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); }
  for (const [x, y, w, h, c] of details) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); }
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, t: Phaser.Textures.CanvasTexture) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  const ctx = t.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, t);
  t.refresh();
  return t;
}

/* ------------------------------------------------------------------ */
/* Characters: 16x16 frames. 0-2 down, 3-5 up, 6-8 side (faces right). */
/* ------------------------------------------------------------------ */

function charRects(l: Look, dir: 'down' | 'up' | 'side', step: 0 | 1 | 2) {
  const r: Rect[] = [];
  const d: Rect[] = [];
  const shoes = l.shoes ?? '#3a2a24';
  const sh = l.shirt, shD = shade(l.shirt, 0.78), sk = l.skin, hr = l.hair, pn = l.pants;
  const cap = l.cap ?? '#c8463a', capD = shade(cap, 0.72);

  if (dir !== 'side') {
    const lUp = step === 1, rUp = step === 2;
    r.push([5, 11, 2, lUp ? 2 : 3, pn], [9, 11, 2, rUp ? 2 : 3, pn], [5, 11, 6, 1, pn]);
    r.push([5, lUp ? 13 : 14, 2, 1, shoes], [9, rUp ? 13 : 14, 2, 1, shoes]);
    r.push([4, 8, 8, 3, sh]);
    r.push([3, 8, 1, rUp ? 2 : 3, sh], [12, 8, 1, lUp ? 2 : 3, sh]);
    r.push([3, rUp ? 10 : 11, 1, 1, sk], [12, lUp ? 10 : 11, 1, 1, sk]);
    d.push([5, 8, 6, 1, shD]);

    if (dir === 'down') {
      r.push([4, 2, 8, 6, sk]);
      switch (l.style) {
        case 'short': r.push([4, 1, 8, 2, hr], [4, 3, 1, 2, hr], [11, 3, 1, 2, hr]); d.push([5, 3, 3, 1, hr]); break;
        case 'spiky': r.push([4, 1, 8, 2, hr], [4, 3, 1, 2, hr], [11, 3, 1, 2, hr], [5, 0, 1, 1, hr], [8, 0, 1, 1, hr], [10, 0, 1, 1, hr]); d.push([5, 3, 2, 1, hr], [9, 3, 2, 1, hr]); break;
        case 'bun': r.push([4, 1, 8, 2, hr], [4, 3, 1, 2, hr], [11, 3, 1, 2, hr], [6, 0, 4, 1, hr]); break;
        case 'long': r.push([4, 1, 8, 2, hr], [3, 3, 2, 7, hr], [11, 3, 2, 7, hr]); d.push([5, 3, 2, 1, hr]); break;
        case 'cap': r.push([4, 1, 8, 2, cap], [3, 3, 10, 1, capD], [4, 4, 1, 1, hr], [11, 4, 1, 1, hr]); break;
        case 'bald': r.push([4, 4, 1, 2, hr], [11, 4, 1, 2, hr]); d.push([6, 2, 2, 1, shade(sk, 1.25)]); break;
      }
      if (l.glasses) d.push([5, 5, 6, 1, '#2a2a33'], [6, 5, 1, 1, '#bfe3ff'], [9, 5, 1, 1, '#bfe3ff'], [6, 6, 1, 1, EYE], [9, 6, 1, 1, EYE]);
      else d.push([6, 5, 1, 2, EYE], [9, 5, 1, 2, EYE]);
      d.push([7, 7, 2, 1, shade(sk, 0.82)]);
    } else {
      if (l.style === 'bald') r.push([4, 2, 8, 6, sk], [4, 4, 8, 2, hr]);
      else if (l.style === 'cap') r.push([4, 4, 8, 4, hr], [4, 1, 8, 3, cap]);
      else r.push([4, 1, 8, 7, hr]);
      if (l.style === 'long') r.push([3, 3, 10, 7, hr]);
      if (l.style === 'bun') r.push([6, 0, 4, 2, hr]);
      if (l.style === 'spiky') r.push([5, 0, 1, 1, hr], [8, 0, 1, 1, hr], [10, 0, 1, 1, hr]);
    }
  } else {
    r.push([6, 11, 4, 1, pn]);
    if (step === 0) r.push([6, 11, 4, 3, pn], [6, 14, 5, 1, shoes]);
    if (step === 1) r.push([8, 11, 2, 3, pn], [8, 14, 3, 1, shoes], [5, 11, 2, 2, pn], [4, 13, 2, 1, shoes]);
    if (step === 2) r.push([5, 11, 2, 3, pn], [5, 14, 3, 1, shoes], [9, 11, 2, 2, pn], [10, 13, 2, 1, shoes]);
    r.push([5, 8, 6, 3, sh]);
    if (step === 0) d.push([7, 8, 2, 3, shD], [7, 11, 2, 1, sk]);
    if (step === 1) d.push([8, 8, 2, 2, shD], [9, 10, 1, 1, sk]);
    if (step === 2) d.push([6, 8, 2, 2, shD], [5, 10, 1, 1, sk]);
    r.push([5, 2, 7, 6, sk], [12, 5, 1, 1, sk]);
    switch (l.style) {
      case 'short': r.push([4, 1, 8, 2, hr], [4, 3, 3, 3, hr]); break;
      case 'spiky': r.push([4, 1, 8, 2, hr], [4, 3, 3, 3, hr], [5, 0, 1, 1, hr], [8, 0, 1, 1, hr], [3, 2, 1, 1, hr]); break;
      case 'bun': r.push([4, 1, 8, 2, hr], [4, 3, 3, 3, hr], [2, 1, 2, 3, hr]); break;
      case 'long': r.push([4, 1, 8, 2, hr], [3, 3, 4, 7, hr]); break;
      case 'cap': r.push([4, 1, 8, 2, cap], [10, 3, 4, 1, capD], [4, 3, 2, 3, hr]); break;
      case 'bald': r.push([4, 4, 2, 2, hr]); break;
    }
    if (l.glasses) d.push([9, 5, 3, 1, '#2a2a33'], [10, 5, 1, 1, '#bfe3ff'], [10, 6, 1, 1, EYE]);
    else d.push([10, 5, 1, 2, EYE]);
  }
  return { r, d };
}

export function makeCharacter(scene: Phaser.Scene, id: string, look: Look) {
  const key = `ch-${id}`;
  canvasTex(scene, key, 144, 16, (ctx, t) => {
    let i = 0;
    for (const dir of ['down', 'up', 'side'] as const) {
      for (const s of [0, 1, 2] as const) {
        const { r, d } = charRects(look, dir, s);
        ctx.save();
        ctx.beginPath(); ctx.rect(i * 16, 0, 16, 16); ctx.clip();
        paint(ctx, i * 16, 0, r, d);
        ctx.restore();
        t.add(String(i), 0, i * 16, 0, 16, 16);
        i++;
      }
    }
  });
  const mk = (k: string, frames: number[]) => {
    if (scene.anims.exists(k)) scene.anims.remove(k);
    scene.anims.create({ key: k, frames: frames.map((f) => ({ key, frame: String(f) })), frameRate: 8, repeat: -1 });
  };
  mk(`${id}-walk-down`, [1, 0, 2, 0]);
  mk(`${id}-walk-up`, [4, 3, 5, 3]);
  mk(`${id}-walk-side`, [7, 6, 8, 6]);
}

/* ------------------------------------------------------------------ */
/* Portraits: 48x48, one frame per mood plus a blink frame for each.   */
/* ------------------------------------------------------------------ */

function portraitRects(l: Look, mood: Mood, blink: boolean) {
  const r: Rect[] = [];
  const d: Rect[] = [];
  const sk = l.skin, hr = l.hair, sh = l.shirt, skD = shade(sk, 0.84);
  const cap = l.cap ?? '#c8463a';
  const brow = l.style === 'bald' ? shade(sk, 0.55) : shade(hr, l.hair === '#e4e1da' || l.hair === '#d8d8d8' ? 0.7 : 0.85);

  if (l.style === 'long') r.push([8, 8, 32, 34, hr]);
  if (l.style === 'bun') r.push([18, 0, 12, 8, hr]);
  r.push([5, 39, 38, 9, sh], [10, 37, 28, 3, sh]);
  r.push([19, 30, 10, 9, skD]);
  r.push([9, 19, 3, 6, sk], [36, 19, 3, 6, sk]);
  r.push([12, 8, 24, 24, sk], [11, 10, 26, 20, sk], [14, 32, 20, 2, sk]);

  switch (l.style) {
    case 'short': r.push([11, 6, 26, 6, hr], [10, 9, 3, 10, hr], [35, 9, 3, 10, hr], [13, 12, 10, 2, hr]); break;
    case 'spiky': r.push([11, 6, 26, 6, hr], [10, 9, 3, 9, hr], [35, 9, 3, 9, hr], [13, 3, 3, 3, hr], [19, 2, 3, 4, hr], [25, 3, 3, 3, hr], [31, 4, 3, 3, hr], [14, 12, 4, 2, hr], [26, 12, 5, 2, hr]); break;
    case 'bun': r.push([11, 6, 26, 6, hr], [10, 9, 3, 9, hr], [35, 9, 3, 9, hr]); d.push([20, 2, 8, 1, shade(hr, 1.3)]); break;
    case 'long': r.push([11, 6, 26, 7, hr], [9, 10, 4, 26, hr], [35, 10, 4, 26, hr], [12, 12, 8, 2, hr], [28, 12, 8, 2, hr]); break;
    case 'cap': r.push([11, 5, 26, 7, cap], [8, 11, 32, 2, shade(cap, 0.72)], [10, 13, 3, 6, hr], [35, 13, 3, 6, hr]); d.push([22, 6, 4, 3, shade(cap, 1.3)]); break;
    case 'bald': r.push([10, 15, 3, 6, hr], [35, 15, 3, 6, hr]); d.push([17, 10, 6, 2, shade(sk, 1.18)]); break;
  }

  // Eyes
  if (blink) {
    d.push([16, 21, 5, 1, EYE], [27, 21, 5, 1, EYE]);
  } else {
    d.push([16, 19, 5, 4, '#f7f4ee'], [27, 19, 5, 4, '#f7f4ee'], [18, 19, 2, 4, EYE], [29, 19, 2, 4, EYE], [18, 19, 1, 1, '#ffffff'], [29, 19, 1, 1, '#ffffff']);
    if (mood === 'guarded') d.push([16, 19, 5, 1, skD], [27, 19, 5, 1, skD]);
  }
  if (l.glasses) {
    const G = '#2a2a33';
    d.push([15, 18, 7, 1, G], [15, 23, 7, 1, G], [15, 18, 1, 6, G], [21, 18, 1, 6, G]);
    d.push([26, 18, 7, 1, G], [26, 23, 7, 1, G], [26, 18, 1, 6, G], [32, 18, 1, 6, G], [22, 20, 4, 1, G]);
  }
  // Brows
  if (mood === 'open') d.push([15, 14, 6, 2, brow], [27, 14, 6, 2, brow]);
  if (mood === 'neutral') d.push([15, 16, 6, 2, brow], [27, 16, 6, 2, brow]);
  if (mood === 'guarded') d.push([15, 15, 3, 2, brow], [18, 16, 3, 2, brow], [27, 16, 3, 2, brow], [30, 15, 3, 2, brow]);
  if (mood === 'confused') d.push([15, 13, 6, 2, brow], [27, 16, 6, 2, brow]);
  // Nose
  d.push([23, 23, 2, 4, skD]);
  // Mouth
  const M = '#6a2c2c';
  if (mood === 'open') d.push([18, 27, 2, 1, M], [20, 28, 8, 2, M], [28, 27, 2, 1, M], [21, 28, 6, 1, '#f4f1ea'], [13, 25, 3, 2, shade('#e86a6a', 1)], [32, 25, 3, 2, '#e86a6a']);
  if (mood === 'neutral') d.push([20, 28, 8, 2, M]);
  if (mood === 'guarded') d.push([19, 29, 2, 1, M], [20, 28, 8, 1, M], [27, 29, 2, 1, M]);
  if (mood === 'confused') d.push([19, 28, 3, 1, M], [22, 29, 3, 1, M], [25, 28, 3, 1, M], [28, 29, 2, 1, M]);
  // Collar
  d.push([20, 37, 8, 2, shade(sh, 0.72)], [22, 39, 4, 1, shade(sh, 0.72)]);
  return { r, d };
}

export const PORTRAIT_URL: Record<string, string> = {};

export function makePortrait(scene: Phaser.Scene, id: string, look: Look) {
  const key = `pt-${id}`;
  canvasTex(scene, key, 48 * 8, 48, (ctx, t) => {
    let i = 0;
    for (const m of MOODS) {
      for (const blink of [false, true]) {
        const { r, d } = portraitRects(look, m, blink);
        ctx.save();
        ctx.beginPath(); ctx.rect(i * 48, 0, 48, 48); ctx.clip();
        paint(ctx, i * 48, 0, r, d);
        ctx.restore();
        t.add(blink ? `${m}-b` : m, 0, i * 48, 0, 48, 48);
        i++;
      }
    }
  });
  PORTRAIT_URL[id] = scene.textures.getBase64(key, 'neutral') as string;
  PORTRAIT_URL[`${id}-open`] = scene.textures.getBase64(key, 'open') as string;
}

/* ------------------------------------------------------------------ */
/* Tiles: 16x16 each, in one strip.                                     */
/* ------------------------------------------------------------------ */

export const TILE = { grass: 0, grass2: 1, flowers: 2, path: 3, stone: 4, water: 5, tree: 6, market: 7, fence: 8, hedge: 9, water2: 10 } as const;
export const SOLID_TILES = [TILE.water, TILE.tree, TILE.fence, TILE.hedge, TILE.water2];

function grass(ctx: Ctx, ox: number, seed: number) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#5d9a4e'; ctx.fillRect(ox, 0, 16, 16);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = rnd() < 0.6 ? '#4f8a43' : '#6dad5a';
    ctx.fillRect(ox + Math.floor(rnd() * 16), Math.floor(rnd() * 15), 1, rnd() < 0.5 ? 2 : 1);
  }
}

export function makeTiles(scene: Phaser.Scene) {
  canvasTex(scene, 'tiles', 16 * 11, 16, (ctx) => {
    const at = (i: number) => i * 16;
    grass(ctx, at(0), 3);
    grass(ctx, at(1), 11);
    grass(ctx, at(2), 5);
    const rnd = mulberry32(9);
    for (let i = 0; i < 5; i++) {
      const x = at(2) + 1 + Math.floor(rnd() * 13), y = 1 + Math.floor(rnd() * 13);
      const c = ['#f4f1ea', '#f6d865', '#ef8fb0', '#f4f1ea', '#a9c7ff'][i];
      ctx.fillStyle = c; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = '#f6c443'; ctx.fillRect(x, y, 1, 1);
    }
    // path
    ctx.fillStyle = '#c9a36b'; ctx.fillRect(at(3), 0, 16, 16);
    const r2 = mulberry32(21);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = r2() < 0.5 ? '#b48c58' : '#d8b77f'; ctx.fillRect(at(3) + Math.floor(r2() * 15), Math.floor(r2() * 15), 2, 1); }
    // stone plaza
    ctx.fillStyle = '#bdb6a8'; ctx.fillRect(at(4), 0, 16, 16);
    ctx.fillStyle = '#a49d90'; ctx.fillRect(at(4), 7, 16, 1); ctx.fillRect(at(4), 15, 16, 1); ctx.fillRect(at(4) + 7, 0, 1, 7); ctx.fillRect(at(4) + 15, 8, 1, 7);
    ctx.fillStyle = '#cfc9bc'; ctx.fillRect(at(4) + 1, 1, 3, 1); ctx.fillRect(at(4) + 9, 9, 3, 1);
    // water x2
    for (const [i, off] of [[5, 0], [10, 3]] as const) {
      ctx.fillStyle = '#3f7fc4'; ctx.fillRect(at(i), 0, 16, 16);
      ctx.fillStyle = '#6aa6e0';
      ctx.fillRect(at(i) + ((2 + off) % 16), 3, 4, 1); ctx.fillRect(at(i) + ((9 + off) % 13), 8, 4, 1); ctx.fillRect(at(i) + ((4 + off) % 12), 13, 3, 1);
      ctx.fillStyle = '#356fae'; ctx.fillRect(at(i) + ((11 + off) % 14), 4, 2, 1);
    }
    // tree on grass
    grass(ctx, at(6), 3);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(at(6) + 3, 13, 10, 2);
    paint(ctx, at(6), 0, [[7, 10, 2, 4, '#6b4426'], [3, 2, 10, 8, '#2f6b3a'], [2, 4, 12, 5, '#2f6b3a'], [5, 1, 6, 1, '#2f6b3a']],
      [[5, 3, 4, 2, '#3f8a4a'], [4, 5, 2, 2, '#3f8a4a'], [10, 7, 2, 2, '#255a2f'], [7, 10, 1, 4, '#573620']], '#173a20');
    // market floor
    ctx.fillStyle = '#dccaa2'; ctx.fillRect(at(7), 0, 16, 16);
    ctx.fillStyle = '#cdb88e'; ctx.fillRect(at(7), 0, 8, 8); ctx.fillRect(at(7) + 8, 8, 8, 8);
    // fence (clipped so its outline can't bleed into the next tile)
    grass(ctx, at(8), 3);
    ctx.save(); ctx.beginPath(); ctx.rect(at(8), 0, 16, 16); ctx.clip();
    paint(ctx, at(8), 0,[[0, 6, 16, 2, '#9a6a3c'], [0, 10, 16, 2, '#9a6a3c'], [2, 4, 2, 10, '#8a5a32'], [12, 4, 2, 10, '#8a5a32']], [], '#3b2414');
    ctx.restore();
    // hedge
    grass(ctx, at(9), 11);
    paint(ctx, at(9), 0, [[1, 3, 14, 12, '#3d7a3a'], [2, 2, 12, 1, '#3d7a3a']], [[3, 4, 3, 2, '#4f9449'], [9, 6, 3, 2, '#4f9449'], [5, 10, 3, 2, '#326632'], [11, 11, 2, 2, '#326632']], '#173a20');
  });
}

/* ------------------------------------------------------------------ */
/* Buildings and props.                                                 */
/* ------------------------------------------------------------------ */

function shingles(d: Rect[], x: number, y: number, w: number, h: number, c: string) {
  for (let j = y + 3; j < y + h; j += 4) d.push([x + 1, j, w - 2, 1, c]);
}

export function makeBuildings(scene: Phaser.Scene) {
  // Research lab: 96x80
  canvasTex(scene, 'b-lab', 96, 80, (ctx) => {
    const r: Rect[] = [[4, 30, 88, 49, '#e9e2cf'], [10, 2, 76, 10, '#2e6f73'], [1, 9, 94, 22, '#2e6f73']];
    const d: Rect[] = [[1, 29, 94, 3, '#245759'], [4, 73, 88, 6, '#c9bfa5']];
    shingles(d, 1, 9, 94, 20, '#3a8488'); shingles(d, 10, 2, 76, 8, '#3a8488');
    d.push([42, 4, 12, 12, '#f6d865'], [50, 12, 4, 4, '#d9b94a'], [44, 7, 7, 1, '#3a2f05'], [44, 10, 5, 1, '#3a2f05']);
    for (const wx of [11, 67]) d.push([wx, 46, 18, 15, '#5a4632'], [wx + 1, 47, 16, 13, '#9fd3e6'], [wx + 9, 47, 1, 13, '#5a4632'], [wx + 1, 53, 16, 1, '#5a4632'], [wx + 2, 48, 4, 2, '#d7eef7']);
    d.push([39, 53, 18, 26, '#5a3a22'], [40, 54, 16, 25, '#7a4b2a'], [52, 66, 2, 2, '#f6d865']);
    d.push([30, 35, 36, 13, '#3a2f05'], [31, 36, 34, 11, '#f6d865'], [34, 39, 22, 2, '#3a2f05'], [34, 43, 28, 1, '#7a6420']);
    paint(ctx, 0, 0, r, d);
  });
  // Vet clinic: 80x64
  canvasTex(scene, 'b-clinic', 80, 64, (ctx) => {
    const r: Rect[] = [[4, 24, 72, 39, '#f1efe8'], [10, 1, 60, 8, '#c0504d'], [1, 7, 78, 18, '#c0504d']];
    const d: Rect[] = [[1, 23, 78, 3, '#9c3f3c'], [4, 58, 72, 5, '#d8d3c6']];
    shingles(d, 1, 7, 78, 16, '#cf6764'); shingles(d, 10, 1, 60, 6, '#cf6764');
    d.push([31, 39, 18, 24, '#3e5f86'], [32, 40, 16, 23, '#5b7fa8'], [34, 42, 12, 9, '#bfe3ff']);
    for (const wx of [8, 58]) d.push([wx, 33, 15, 13, '#7a8fa8'], [wx + 1, 34, 13, 11, '#9fd3e6'], [wx + 2, 35, 3, 2, '#d7eef7']);
    d.push([25, 27, 30, 10, '#9c3f3c'], [26, 28, 28, 8, '#ffffff'], [37, 31, 6, 4, '#c0504d'], [35, 29, 2, 2, '#c0504d'], [38, 28, 2, 2, '#c0504d'], [41, 28, 2, 2, '#c0504d'], [44, 29, 2, 2, '#c0504d']);
    paint(ctx, 0, 0, r, d);
  });
  // Bank: 80x64
  canvasTex(scene, 'b-bank', 80, 64, (ctx) => {
    const r: Rect[] = [];
    for (let i = 0; i < 9; i++) r.push([36 - 4 * i, 2 + i * 2, 8 + 8 * i, 2, '#2d3e66']);
    r.push([2, 19, 76, 6, '#cfcac0'], [6, 25, 68, 31, '#d8d4cc'], [4, 55, 72, 4, '#c6c1b7'], [1, 59, 78, 5, '#b9b4aa']);
    const d: Rect[] = [[2, 24, 76, 1, '#a9a49a']];
    for (const cx of [10, 23, 51, 64]) d.push([cx, 27, 6, 28, '#efece6'], [cx + 4, 27, 2, 28, '#c9c4ba'], [cx - 1, 26, 8, 2, '#b9b4aa']);
    d.push([34, 34, 12, 21, '#3b2f2a'], [35, 35, 10, 20, '#523f36'], [43, 44, 1, 2, '#f0c24a']);
    d.push([38, 8, 4, 2, '#f0c24a'], [37, 10, 6, 2, '#f0c24a'], [38, 12, 4, 2, '#f0c24a'], [39, 14, 2, 3, '#a8862a']);
    paint(ctx, 0, 0, r, d);
  });
  // Taco truck: 48x36
  canvasTex(scene, 'b-truck', 48, 36, (ctx) => {
    const r: Rect[] = [[2, 8, 32, 20, '#e0b33a'], [34, 12, 12, 16, '#e0b33a'], [8, 26, 8, 8, '#2a2a2a'], [34, 26, 8, 8, '#2a2a2a'], [10, 1, 16, 5, '#d9534f']];
    const d: Rect[] = [[2, 26, 44, 2, '#8a6a1f'], [38, 14, 7, 6, '#9fd3e6'], [8, 12, 20, 9, '#3b2f2a'], [6, 21, 24, 2, '#a8862a'], [11, 29, 2, 2, '#9a9a9a'], [37, 29, 2, 2, '#9a9a9a']];
    for (let i = 0; i < 6; i++) d.push([6 + i * 4, 6, 4, 4, i % 2 ? '#f4f1ea' : '#d9534f']);
    d.push([12, 2, 12, 1, '#f6d865'], [13, 4, 10, 1, '#f6d865']);
    d.push([12, 15, 6, 3, '#f6d865'], [19, 15, 6, 3, '#6dad5a']);
    paint(ctx, 0, 0, r, d);
  });
  // Houses: 64x56, two roof colors
  for (const [key, roof] of [['b-house1', '#8a5a9a'], ['b-house2', '#4f7d3a']] as const) {
    canvasTex(scene, key, 64, 56, (ctx) => {
      const r: Rect[] = [[4, 22, 56, 33, '#e7dcc6'], [8, 1, 48, 8, roof], [1, 7, 62, 16, roof]];
      const d: Rect[] = [[1, 21, 62, 2, shade(roof, 0.72)], [4, 51, 56, 4, '#cdbfa3']];
      shingles(d, 1, 7, 62, 14, shade(roof, 1.2));
      d.push([25, 35, 14, 20, '#5a3a22'], [26, 36, 12, 19, '#7a4b2a'], [35, 45, 2, 2, '#f6d865']);
      for (const wx of [8, 44]) d.push([wx, 29, 12, 11, '#5a4632'], [wx + 1, 30, 10, 9, '#9fd3e6'], [wx + 5, 30, 1, 9, '#5a4632'], [wx + 2, 31, 2, 2, '#d7eef7']);
      d.push([6, 46, 10, 5, '#3d7a3a'], [48, 46, 10, 5, '#3d7a3a'], [8, 46, 2, 1, '#ef8fb0'], [52, 47, 2, 1, '#f6d865']);
      paint(ctx, 0, 0, r, d);
    });
  }
  // Barricade 16x16
  canvasTex(scene, 'barricade', 16, 16, (ctx) => {
    paint(ctx, 0, 0, [[2, 9, 2, 6, '#7a4b2a'], [12, 9, 2, 6, '#7a4b2a'], [0, 4, 16, 6, '#f2f2f2'], [7, 0, 2, 3, '#e8742f']],
      [[0, 4, 3, 6, '#e8742f'], [6, 4, 3, 6, '#e8742f'], [12, 4, 3, 6, '#e8742f'], [7, 1, 2, 1, '#f6d865']]);
  });
  // Props
  canvasTex(scene, 'bench', 20, 12, (ctx) => paint(ctx, 0, 0, [[1, 1, 18, 3, '#8a5a32'], [1, 5, 18, 3, '#9a6a3c'], [2, 8, 2, 4, '#5a3a22'], [16, 8, 2, 4, '#5a3a22']], [[1, 2, 18, 1, '#a67a4c']]));
  canvasTex(scene, 'lamp', 8, 28, (ctx) => paint(ctx, 0, 0, [[3, 6, 2, 21, '#3a3f4a'], [1, 1, 6, 6, '#3a3f4a'], [2, 26, 4, 2, '#3a3f4a']], [[2, 2, 4, 3, '#f6d865']]));
  canvasTex(scene, 'board', 24, 22, (ctx) => paint(ctx, 0, 0, [[3, 12, 2, 10, '#5a3a22'], [19, 12, 2, 10, '#5a3a22'], [1, 1, 22, 13, '#8a5a32']],
    [[2, 2, 20, 10, '#c9a36b'], [4, 3, 5, 4, '#f6d865'], [11, 4, 5, 4, '#ef8fb0'], [17, 3, 4, 4, '#a9c7ff'], [6, 8, 5, 3, '#a9e0b8'], [13, 8, 6, 3, '#f6d865']]));
  canvasTex(scene, 'crate', 14, 12, (ctx) => paint(ctx, 0, 0, [[1, 1, 12, 10, '#a67a4c']], [[1, 5, 12, 1, '#7a5432'], [6, 1, 1, 10, '#7a5432'], [2, 2, 3, 2, '#6dad5a'], [8, 7, 3, 3, '#d9534f']]));
  canvasTex(scene, 'pot', 10, 12, (ctx) => paint(ctx, 0, 0, [[2, 6, 6, 5, '#b5603a'], [1, 1, 8, 6, '#3d7a3a']], [[3, 2, 2, 2, '#ef8fb0'], [6, 3, 2, 2, '#f6d865']]));
  canvasTex(scene, 'shadow', 12, 5, (ctx) => { ctx.fillStyle = 'rgba(10,12,20,.28)'; ctx.fillRect(2, 0, 8, 1); ctx.fillRect(0, 1, 12, 3); ctx.fillRect(2, 4, 8, 1); });
  canvasTex(scene, 'spark', 3, 3, (ctx) => { ctx.fillStyle = '#fff6c8'; ctx.fillRect(1, 0, 1, 3); ctx.fillRect(0, 1, 3, 1); });
  canvasTex(scene, 'note', 8, 8, (ctx) => paint(ctx, 0, 0, [[0, 0, 8, 8, '#f6d865']], [[6, 6, 2, 2, '#d9b94a'], [1, 2, 5, 1, '#3a2f05'], [1, 4, 4, 1, '#3a2f05']], null));
  canvasTex(scene, 'pixel', 1, 1, (ctx) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1); });
}

/* ------------------------------------------------------------------ */
/* Emotes: 12x12 speech-bubble icons.                                   */
/* ------------------------------------------------------------------ */

export const EMOTES = ['excl', 'q', 'heart', 'dots', 'sweat', 'star', 'lock', 'check'] as const;
export type Emote = (typeof EMOTES)[number];

export function makeEmotes(scene: Phaser.Scene) {
  canvasTex(scene, 'emotes', 12 * EMOTES.length, 12, (ctx, t) => {
    const bubble: Rect[] = [[1, 0, 10, 9, '#ffffff'], [4, 9, 3, 2, '#ffffff']];
    const defs: Record<Emote, { r: Rect[]; d: Rect[] }> = {
      excl: { r: bubble, d: [[5, 1, 2, 5, '#d23a2e'], [5, 7, 2, 1, '#d23a2e']] },
      q: { r: bubble, d: [[4, 1, 4, 1, '#2550b8'], [7, 2, 1, 2, '#2550b8'], [5, 4, 2, 1, '#2550b8'], [5, 5, 1, 1, '#2550b8'], [5, 7, 1, 1, '#2550b8']] },
      heart: { r: bubble, d: [[3, 2, 2, 1, '#e0457b'], [7, 2, 2, 1, '#e0457b'], [2, 3, 8, 2, '#e0457b'], [3, 5, 6, 1, '#e0457b'], [4, 6, 4, 1, '#e0457b'], [5, 7, 2, 1, '#e0457b']] },
      dots: { r: bubble, d: [[2, 4, 2, 2, '#555566'], [5, 4, 2, 2, '#555566'], [8, 4, 2, 2, '#555566']] },
      sweat: { r: [[5, 1, 2, 2, '#6aa6e0'], [4, 3, 4, 4, '#6aa6e0'], [5, 7, 2, 1, '#6aa6e0']], d: [[5, 4, 1, 2, '#d7eef7']] },
      star: { r: [[5, 0, 2, 2, '#f6d865'], [1, 3, 10, 2, '#f6d865'], [3, 5, 6, 2, '#f6d865'], [2, 7, 3, 2, '#f6d865'], [7, 7, 3, 2, '#f6d865']], d: [] },
      lock: { r: [[2, 5, 8, 6, '#a0a0a8'], [3, 1, 6, 1, '#a0a0a8'], [3, 2, 1, 3, '#a0a0a8'], [8, 2, 1, 3, '#a0a0a8']], d: [[5, 7, 2, 2, '#333340']] },
      check: { r: bubble, d: [[2, 4, 1, 2, '#3aa76d'], [3, 5, 1, 2, '#3aa76d'], [4, 6, 1, 1, '#3aa76d'], [5, 5, 1, 1, '#3aa76d'], [6, 4, 1, 1, '#3aa76d'], [7, 3, 1, 1, '#3aa76d'], [8, 2, 1, 1, '#3aa76d']] },
    };
    EMOTES.forEach((e, i) => {
      ctx.save(); ctx.beginPath(); ctx.rect(i * 12, 0, 12, 12); ctx.clip();
      paint(ctx, i * 12, 0, defs[e].r, defs[e].d);
      ctx.restore();
      t.add(e, 0, i * 12, 0, 12, 12);
    });
  });
}
