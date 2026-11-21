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

function portraitRects(l: Look, mood: Mood, blink: boolean, talk = false) {
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
  // Soft form shading: light from the top left
  d.push([14, 32, 20, 1, shade(sk, 0.8)], [34, 24, 1, 6, shade(sk, 0.93)]);
  d.push([13, 17, 1, 5, shade(sk, 1.07)]);
  if (l.style !== 'bald' && l.style !== 'cap') d.push([15, 7, 6, 1, shade(hr, l.hair === '#e4e1da' || l.hair === '#d8d8d8' ? 1.06 : 1.16)]);
  if (l.style === 'cap') d.push([12, 6, 6, 1, shade(cap, 1.25)]);
  d.push([5, 44, 38, 4, shade(sh, 0.84)], [11, 38, 9, 1, shade(sh, 1.18)], [6, 40, 2, 4, shade(sh, 1.12)]);

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
  if (mood === 'open') d.push([13, 25, 3, 2, '#e86a6a'], [32, 25, 3, 2, '#e86a6a']);
  if (talk) {
    // Open mouth for lip sync, shaped a little by mood
    const w = mood === 'guarded' ? 6 : 8, x = 24 - w / 2;
    d.push([x, 27, w, 4, M], [x + 1, 27, w - 2, 1, '#f4f1ea'], [x + 2, 30, w - 4, 1, '#c25a5a']);
    if (mood === 'open') d.push([x - 1, 27, 1, 1, M], [x + w, 27, 1, 1, M]);
  } else {
    if (mood === 'open') d.push([18, 27, 2, 1, M], [20, 28, 8, 2, M], [28, 27, 2, 1, M], [21, 28, 6, 1, '#f4f1ea']);
    if (mood === 'neutral') d.push([20, 28, 8, 2, M]);
    if (mood === 'guarded') d.push([19, 29, 2, 1, M], [20, 28, 8, 1, M], [27, 29, 2, 1, M]);
    if (mood === 'confused') d.push([19, 28, 3, 1, M], [22, 29, 3, 1, M], [25, 28, 3, 1, M], [28, 29, 2, 1, M]);
  }
  // Collar
  d.push([20, 37, 8, 2, shade(sh, 0.72)], [22, 39, 4, 1, shade(sh, 0.72)]);
  return { r, d };
}

export const PORTRAIT_URL: Record<string, string> = {};

export function makePortrait(scene: Phaser.Scene, id: string, look: Look) {
  const key = `pt-${id}`;
  canvasTex(scene, key, 48 * 12, 48, (ctx, t) => {
    let i = 0;
    for (const m of MOODS) {
      for (const [suffix, blink, talk] of [['', false, false], ['-b', true, false], ['-t', false, true]] as const) {
        const { r, d } = portraitRects(look, m, blink, talk);
        ctx.save();
        ctx.beginPath(); ctx.rect(i * 48, 0, 48, 48); ctx.clip();
        paint(ctx, i * 48, 0, r, d);
        ctx.restore();
        t.add(`${m}${suffix}`, 0, i * 48, 0, 48, 48);
        i++;
      }
    }
  });
  PORTRAIT_URL[id] = scene.textures.getBase64(key, 'neutral') as string;
  PORTRAIT_URL[`${id}-open`] = scene.textures.getBase64(key, 'open') as string;
  PORTRAIT_URL[`${id}-talk`] = scene.textures.getBase64(key, 'neutral-t') as string;
}

/* ------------------------------------------------------------------ */
/* Tiles: 16x16 each, in one strip.                                     */
/* ------------------------------------------------------------------ */

export const TILE = { grass: 0, grass2: 1, flowers: 2, path: 3, stone: 4, water: 5, tree: 6, market: 7, fence: 8, hedge: 9, water2: 10 } as const;
export const SOLID_TILES = [TILE.water, TILE.tree, TILE.fence, TILE.hedge, TILE.water2];

/** Shared palette, so the ground, trees and overlays all read as one place. */
export const PAL = {
  grass: '#6cb257', grassD: '#5a9c4b', grassDD: '#4a8641', grassL: '#86c76a', grassLL: '#a3d982',
  path: '#dcb880', pathD: '#c49c63', pathDD: '#a98450', pathL: '#ead09d',
  stone: '#cfc8b9', stoneD: '#aaa294', stoneL: '#e3ddd1',
  water: '#4b9ee0', waterD: '#3a86cc', waterDD: '#2f72b4', waterL: '#8fcdf6', foam: '#e6f6ff',
  leaf: '#3f9a4c', leafD: '#2c7a3d', leafDD: '#1f5c2f', leafL: '#5cb85a', leafLL: '#86d071', bark: '#7a4e2c', barkD: '#5a3820',
  out: '#183824',
};

function grass(ctx: Ctx, ox: number, seed: number) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = PAL.grass; ctx.fillRect(ox, 0, 16, 16);
  for (let i = 0; i < 16; i++) {
    const x = ox + Math.floor(rnd() * 16), y = 1 + Math.floor(rnd() * 14);
    const r = rnd();
    if (r < 0.5) { ctx.fillStyle = PAL.grassD; ctx.fillRect(x, y, 1, 2); }
    else if (r < 0.8) { ctx.fillStyle = PAL.grassL; ctx.fillRect(x, y, 1, 1); }
    else { ctx.fillStyle = PAL.grassD; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = PAL.grassL; ctx.fillRect(x, y - 1, 1, 1); }
  }
}

function water(ctx: Ctx, ox: number, phase: number) {
  ctx.fillStyle = PAL.water; ctx.fillRect(ox, 0, 16, 16);
  ctx.fillStyle = PAL.waterD;
  for (const [x, y, w] of [[1, 5, 5], [8, 11, 6], [3, 14, 4], [10, 2, 4]]) ctx.fillRect(ox + ((x + phase) % 16), y, Math.min(w, 16 - ((x + phase) % 16)), 1);
  ctx.fillStyle = PAL.waterL;
  for (const [x, y, w] of [[2, 3, 3], [9, 8, 4], [4, 12, 3]]) {
    const xx = (x + phase * 2) % 16;
    ctx.fillRect(ox + xx, y, Math.min(w, 16 - xx), 1);
  }
  ctx.fillStyle = PAL.foam;
  ctx.fillRect(ox + ((12 + phase * 3) % 15), 6, 1, 1);
}

export function makeTiles(scene: Phaser.Scene) {
  canvasTex(scene, 'tiles', 16 * 11, 16, (ctx) => {
    const at = (i: number) => i * 16;
    grass(ctx, at(0), 3);
    grass(ctx, at(1), 11);
    grass(ctx, at(2), 5);
    const rnd = mulberry32(9);
    for (let i = 0; i < 5; i++) {
      const x = at(2) + 2 + Math.floor(rnd() * 12), y = 2 + Math.floor(rnd() * 12);
      const c = ['#fff8ec', '#ffd84d', '#ff8fb8', '#fff8ec', '#9fc2ff'][i];
      ctx.fillStyle = PAL.grassDD; ctx.fillRect(x, y + 1, 1, 2);
      ctx.fillStyle = c; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = '#f2b628'; ctx.fillRect(x, y, 1, 1);
    }
    // path: packed earth with pebbles
    ctx.fillStyle = PAL.path; ctx.fillRect(at(3), 0, 16, 16);
    const r2 = mulberry32(21);
    for (let i = 0; i < 14; i++) {
      const x = at(3) + Math.floor(r2() * 15), y = Math.floor(r2() * 15), r = r2();
      ctx.fillStyle = r < 0.45 ? PAL.pathD : r < 0.85 ? PAL.pathL : PAL.pathDD;
      ctx.fillRect(x, y, r < 0.85 ? 2 : 1, 1);
    }
    // stone plaza: offset bricks with a bevel
    ctx.fillStyle = PAL.stone; ctx.fillRect(at(4), 0, 16, 16);
    for (const [bx, by, bw] of [[0, 0, 8], [8, 0, 8], [-4, 8, 8], [4, 8, 8], [12, 8, 8]] as const) {
      const x0 = Math.max(0, bx), x1 = Math.min(16, bx + bw);
      ctx.fillStyle = PAL.stoneL; ctx.fillRect(at(4) + x0, by, x1 - x0, 1);
      if (bx >= 0) ctx.fillRect(at(4) + bx, by, 1, 7);
      ctx.fillStyle = PAL.stoneD; ctx.fillRect(at(4) + x0, by + 7, x1 - x0, 1);
      if (bx + bw <= 16) ctx.fillRect(at(4) + bx + bw - 1, by, 1, 8);
    }
    ctx.fillStyle = '#bdb5a6'; ctx.fillRect(at(4) + 3, 3, 2, 1); ctx.fillRect(at(4) + 10, 12, 2, 1);
    // water x2 (animated by swapping)
    water(ctx, at(5), 0);
    water(ctx, at(10), 3);
    // tree base: plain grass. The tree itself is a tall sprite so characters can walk behind it.
    grass(ctx, at(6), 3);
    // market floor: warm tiles with grout
    ctx.fillStyle = '#e8d6ad'; ctx.fillRect(at(7), 0, 16, 16);
    ctx.fillStyle = '#dcc595'; ctx.fillRect(at(7), 0, 8, 8); ctx.fillRect(at(7) + 8, 8, 8, 8);
    ctx.fillStyle = '#c8ae7c'; ctx.fillRect(at(7), 7, 16, 1); ctx.fillRect(at(7), 15, 16, 1); ctx.fillRect(at(7) + 7, 0, 1, 16); ctx.fillRect(at(7) + 15, 0, 1, 16);
    ctx.fillStyle = '#f3e4c2'; ctx.fillRect(at(7), 0, 7, 1); ctx.fillRect(at(7) + 8, 8, 7, 1);
    // fence (clipped so its outline can't bleed into the next tile)
    grass(ctx, at(8), 3);
    ctx.save(); ctx.beginPath(); ctx.rect(at(8), 0, 16, 16); ctx.clip();
    ctx.fillStyle = 'rgba(20,40,20,.25)'; ctx.fillRect(at(8), 13, 16, 2);
    paint(ctx, at(8), 0, [[0, 6, 16, 2, '#b07a46'], [0, 10, 16, 2, '#b07a46'], [2, 3, 3, 11, '#9a6638'], [11, 3, 3, 11, '#9a6638']],
      [[0, 6, 16, 1, '#c99460'], [2, 3, 1, 11, '#b8834e'], [11, 3, 1, 11, '#b8834e']], '#3b2414');
    ctx.restore();
    // hedge: a seamless leafy block. Its outline and front face are added per edge in makeGroundDetail.
    ctx.fillStyle = PAL.leaf; ctx.fillRect(at(9), 0, 16, 16);
    const r3 = mulberry32(33);
    for (let i = 0; i < 9; i++) {
      const x = at(9) + Math.floor(r3() * 14), y = Math.floor(r3() * 14);
      ctx.fillStyle = PAL.leafD; ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillStyle = PAL.leafL; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = PAL.leafLL; ctx.fillRect(x, y, 1, 1);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Trees: tall sprites, y-sorted with everything else.                  */
/* ------------------------------------------------------------------ */

function disc(ctx: Ctx, cx: number, cy: number, r: number, c: string) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y) * 1.0);
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

export const TREE_KINDS = ['tree-a', 'tree-b', 'tree-c', 'tree-d'] as const;

export function makeTrees(scene: Phaser.Scene) {
  const leafy = (key: string, cols: [string, string, string, string, string], seed: number) =>
    canvasTex(scene, key, 32, 38, (ctx) => {
      const [dd, d, m, l, ll] = cols;
      const rnd = mulberry32(seed);
      const lumps: [number, number, number][] = [[16, 15, 12], [8, 19, 8], [24, 19, 8], [12, 8, 8], [21, 9, 7]];
      // trunk
      paint(ctx, 0, 0, [[13, 26, 6, 11, PAL.bark], [11, 35, 10, 2, PAL.bark]], [[13, 26, 2, 11, '#946238'], [17, 28, 2, 9, PAL.barkD]], '#2a1a10');
      // outline, then dark, mid and light layers offset toward the sun (top left)
      for (const [x, y, r] of lumps) disc(ctx, x, y, r + 1, PAL.out);
      for (const [x, y, r] of lumps) disc(ctx, x, y, r, dd);
      for (const [x, y, r] of lumps) disc(ctx, x - 1, y - 1, r - 1, d);
      for (const [x, y, r] of lumps) disc(ctx, x - 2, y - 2, Math.max(1, r - 3), m);
      for (const [x, y, r] of lumps.slice(0, 4)) disc(ctx, x - 3, y - 4, Math.max(1, r - 6), l);
      // leaf speckles
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, rr = rnd() * 11;
        const x = Math.round(15 + Math.cos(a) * rr), y = Math.round(13 + Math.sin(a) * rr * 0.9);
        ctx.fillStyle = y < 13 ? ll : d;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  leafy('tree-a', [PAL.leafDD, PAL.leafD, PAL.leaf, PAL.leafL, PAL.leafLL], 4);
  leafy('tree-b', ['#1d5236', '#24684a', '#2f8058', '#43a06a', '#6cc08a'], 8);
  leafy('tree-c', ['#7a3150', '#a8486c', '#d46b92', '#ef94b4', '#ffc4d8'], 12);
  // A tiered pine
  canvasTex(scene, 'tree-d', 32, 38, (ctx) => {
    paint(ctx, 0, 0, [[14, 29, 4, 8, PAL.bark]], [[14, 29, 1, 8, '#946238']], '#2a1a10');
    const tiers: [number, number, number][] = [[30, 14, 0], [22, 11, 0], [14, 8, 0], [7, 5, 0]];
    const tri = (base: number, half: number, c: string, dx = 0) => {
      for (let y = 0; y < 10; y++) {
        const w = Math.round((half * (y + 1)) / 10);
        ctx.fillStyle = c; ctx.fillRect(16 - w + dx, base - 10 + y, w * 2, 1);
      }
    };
    for (const [b, h] of tiers) tri(b + 1, h + 1, PAL.out);
    for (const [b, h] of tiers) tri(b, h, '#1f5a3a');
    for (const [b, h] of tiers) tri(b - 1, h - 3, '#2b7449', -1);
    for (const [b, h] of tiers) tri(b - 3, Math.max(2, h - 7), '#3f915c', -2);
  });
}

/* ------------------------------------------------------------------ */
/* Soft light and shadow textures (smooth-filtered).                    */
/* ------------------------------------------------------------------ */

function smoothTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  const ctx = t.getContext();
  draw(ctx);
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function makeFx(scene: Phaser.Scene) {
  // Soft contact shadow (an ellipse made by squashing a radial gradient)
  smoothTex(scene, 'softshadow', 64, 64, (ctx) => radial(ctx, 32, 32, 32, [[0, 'rgba(14,22,30,.9)'], [0.55, 'rgba(14,22,30,.55)'], [1, 'rgba(14,22,30,0)']]));
  smoothTex(scene, 'glow', 64, 64, (ctx) => radial(ctx, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]));
  smoothTex(scene, 'mote', 16, 16, (ctx) => radial(ctx, 8, 8, 8, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]));
  // Tileable drifting cloud shadows: white is "no shadow" under a multiply blend.
  smoothTex(scene, 'clouds', 256, 256, (ctx) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(77);
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * 256, cy = rnd() * 256, r = 40 + rnd() * 50;
      for (let k = 0; k < 4; k++) {
        const ox = cx + (rnd() - 0.5) * r, oy = cy + (rnd() - 0.5) * r * 0.6, rr = r * (0.5 + rnd() * 0.4);
        for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) radial(ctx, ox + dx, oy + dy, rr, [[0, 'rgba(70,90,130,.22)'], [1, 'rgba(70,90,130,0)']]);
      }
    }
  });
  // Butterfly: two wing frames
  canvasTex(scene, 'butterfly', 14, 6, (ctx, t) => {
    for (const [i, c] of [[0, '#ffd84d'], [1, '#ffd84d']] as const) {
      const ox = i * 7;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(ox + 3, 1, 1, 4);
      ctx.fillStyle = c;
      if (i === 0) { ctx.fillRect(ox, 0, 3, 3); ctx.fillRect(ox + 4, 0, 3, 3); ctx.fillRect(ox + 1, 3, 2, 2); ctx.fillRect(ox + 4, 3, 2, 2); }
      else { ctx.fillRect(ox + 2, 1, 1, 3); ctx.fillRect(ox + 4, 1, 1, 3); }
      t.add(String(i), 0, ox, 0, 7, 6);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Ground detail: grass fringes, shores, tufts and soft light patches,  */
/* drawn once over the whole map so tile seams disappear.               */
/* ------------------------------------------------------------------ */

export function makeGroundDetail(scene: Phaser.Scene, tiles: number[][], T: number) {
  const H = tiles.length, W = tiles[0].length;
  const isGrass = (v: number) => v === TILE.grass || v === TILE.grass2 || v === TILE.flowers || v === TILE.tree || v === TILE.hedge || v === TILE.fence;
  const isWater = (v: number) => v === TILE.water || v === TILE.water2;
  const isGround = (v: number) => v === TILE.path || v === TILE.stone || v === TILE.market;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? tiles[y][x] : TILE.tree);

  canvasTex(scene, 'ground-fx', W * T, H * T, (ctx) => {
    const rnd = mulberry32(1234);

    // Large soft light and shade patches across the grass break up the tile grid.
    ctx.save();
    ctx.beginPath();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isGrass(tiles[y][x])) ctx.rect(x * T, y * T, T, T);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W * T, y = rnd() * H * T, r = 24 + rnd() * 48;
      const light = rnd() < 0.55;
      radial(ctx, x, y, r, [[0, light ? 'rgba(255,250,190,.10)' : 'rgba(20,70,30,.12)'], [1, 'rgba(0,0,0,0)']]);
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = tiles[y][x];
      const ox = x * T, oy = y * T;

      if (isGround(v)) {
        // Grass creeps over the edges of paths and plazas, with a little shadow under it.
        const edges: [number, number, (i: number, d: number) => [number, number]][] = [
          [0, -1, (i, d) => [ox + i, oy + d]],
          [0, 1, (i, d) => [ox + i, oy + T - 1 - d]],
          [-1, 0, (i, d) => [ox + d, oy + i]],
          [1, 0, (i, d) => [ox + T - 1 - d, oy + i]],
        ];
        for (const [dx, dy, pos] of edges) {
          if (!isGrass(at(x + dx, y + dy))) continue;
          for (let i = 0; i < T; i++) {
            const depth = 1 + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.18 ? 1 : 0);
            for (let d = 0; d < depth; d++) {
              const [px, py] = pos(i, d);
              ctx.fillStyle = d === depth - 1 ? PAL.grassD : PAL.grass;
              ctx.fillRect(px, py, 1, 1);
            }
            const [sx, sy] = pos(i, depth);
            ctx.fillStyle = 'rgba(60,40,20,.16)';
            ctx.fillRect(sx, sy, 1, 1);
          }
        }
      }

      if (isWater(v)) {
        // Shoreline: a dark lip under the bank, then a broken line of foam.
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          if (isWater(at(x + dx, y + dy))) continue;
          for (let i = 0; i < T; i++) {
            const px = dx === 0 ? ox + i : dx < 0 ? ox : ox + T - 1;
            const py = dy === 0 ? oy + i : dy < 0 ? oy : oy + T - 1;
            const ix = dx === 0 ? 0 : -dx, iy = dy === 0 ? 0 : -dy;
            ctx.fillStyle = PAL.waterDD; ctx.fillRect(px, py, 1, 1);
            ctx.fillStyle = 'rgba(47,114,180,.6)'; ctx.fillRect(px + ix, py + iy, 1, 1);
            if (rnd() < 0.6) { ctx.fillStyle = 'rgba(230,246,255,.75)'; ctx.fillRect(px + ix * 2, py + iy * 2, 1, 1); }
          }
        }
      }

      if (v === TILE.hedge) {
        // Hedges join into one long shape: outline only where they meet something else,
        // a lit top edge, and a darker front face with a shadow on the ground below.
        const open = (dx: number, dy: number) => at(x + dx, y + dy) !== TILE.hedge;
        if (open(0, -1)) { ctx.fillStyle = PAL.out; ctx.fillRect(ox, oy, T, 1); ctx.fillStyle = PAL.leafL; ctx.fillRect(ox, oy + 1, T, 1); ctx.fillStyle = PAL.leafLL; for (let i = 1; i < T; i += 3) ctx.fillRect(ox + i, oy + 1, 1, 1); }
        if (open(-1, 0)) { ctx.fillStyle = PAL.out; ctx.fillRect(ox, oy, 1, T); ctx.fillStyle = PAL.leafL; ctx.fillRect(ox + 1, oy + 1, 1, T - 2); }
        if (open(1, 0)) { ctx.fillStyle = PAL.out; ctx.fillRect(ox + T - 1, oy, 1, T); ctx.fillStyle = PAL.leafD; ctx.fillRect(ox + T - 2, oy + 1, 1, T - 2); }
        if (open(0, 1)) {
          ctx.fillStyle = PAL.leafD; ctx.fillRect(ox, oy + T - 5, T, 4);
          ctx.fillStyle = PAL.leafDD; ctx.fillRect(ox, oy + T - 2, T, 1);
          for (let i = 0; i < T; i += 2) { ctx.fillStyle = PAL.leaf; ctx.fillRect(ox + i, oy + T - 5, 1, 1); }
          ctx.fillStyle = PAL.out; ctx.fillRect(ox, oy + T - 1, T, 1);
          if (y + 1 < H) { ctx.fillStyle = 'rgba(16,40,20,.3)'; ctx.fillRect(ox, oy + T, T, 2); ctx.fillStyle = 'rgba(16,40,20,.15)'; ctx.fillRect(ox, oy + T + 2, T, 1); }
        }
        // Round off exposed corners
        for (const [cx, cy, dx, dy] of [[0, 0, -1, -1], [T - 1, 0, 1, -1], [0, T - 1, -1, 1], [T - 1, T - 1, 1, 1]] as const) {
          if (open(dx, 0) && open(0, dy)) { ctx.fillStyle = PAL.grass; ctx.fillRect(ox + cx, oy + cy, 1, 1); }
        }
      }

      if (isGrass(v) && v !== TILE.hedge && v !== TILE.fence) {
        // Bank shading where grass meets water
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
          if (!isWater(at(x + dx, y + dy))) continue;
          for (let i = 0; i < T; i++) {
            const px = dx === 0 ? ox + i : dx > 0 ? ox + T - 1 : ox;
            const py = dy === 0 ? oy + i : dy > 0 ? oy + T - 1 : oy;
            ctx.fillStyle = PAL.grassDD; ctx.fillRect(px, py, 1, 1);
          }
        }
        // Tufts, tiny flowers and pebbles
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const px = ox + 1 + Math.floor(rnd() * (T - 3)), py = oy + 2 + Math.floor(rnd() * (T - 4));
          const r = rnd();
          if (r < 0.62) {
            ctx.fillStyle = PAL.grassDD; ctx.fillRect(px, py + 1, 3, 1);
            ctx.fillStyle = PAL.grassD; ctx.fillRect(px, py, 1, 1); ctx.fillRect(px + 2, py, 1, 1);
            ctx.fillStyle = PAL.grassLL; ctx.fillRect(px + 1, py - 1, 1, 2);
          } else if (r < 0.74) {
            ctx.fillStyle = ['#fff8ec', '#ffd84d', '#cfe0ff'][Math.floor(rnd() * 3)];
            ctx.fillRect(px, py, 1, 1);
          } else if (r < 0.8) {
            ctx.fillStyle = '#b9b2a2'; ctx.fillRect(px, py, 2, 1);
            ctx.fillStyle = '#e1dccf'; ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
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
