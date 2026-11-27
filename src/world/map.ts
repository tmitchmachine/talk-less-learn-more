// Fieldtown: a 40x30 tile map built in code so every road, hedge and pond is placed on purpose.
import { TILE, mulberry32 } from '../art/draw';

export const W = 40;
export const H = 30;
export const T = 16;

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Placed { key: string; tx: number; ty: number; solid?: [number, number, number, number] }
export interface Spot { id: string; tx: number; ty: number; face: Facing }

export interface Town {
  tiles: number[][];
  buildings: Placed[];
  props: Placed[];
  npcs: Spot[];
  gates: { east: [number, number][]; south: [number, number][] };
  start: { tx: number; ty: number };
  labDoor: { tx: number; ty: number };
  board: { tx: number; ty: number };
}

export function buildTown(): Town {
  const rnd = mulberry32(7);
  const g: number[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => (rnd() < 0.2 ? TILE.grass2 : TILE.grass)));
  const reserved: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x: number, y: number, v: number) => { if (inside(x, y)) { g[y][x] = v; reserved[y][x] = true; } };
  const rect = (x: number, y: number, w: number, h: number, v: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, v); };
  const reserve = (x: number, y: number, w: number, h: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inside(i, j)) reserved[j][i] = true; };

  // Border forest
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, TILE.tree);

  // Plaza, roads, market
  rect(14, 8, 12, 6, TILE.stone);
  rect(19, 7, 2, 1, TILE.path);
  rect(3, 10, 11, 2, TILE.path); // west road
  rect(8, 12, 2, 6, TILE.path); // down to market
  rect(3, 18, 11, 8, TILE.market);
  rect(26, 10, 12, 2, TILE.path); // east road
  rect(32, 7, 2, 3, TILE.path); // clinic door
  rect(19, 14, 2, 9, TILE.path); // south road
  rect(21, 21, 10, 2, TILE.path); // to the bank
  rect(30, 20, 2, 1, TILE.path); // bank door

  // Pond
  for (let y = 23; y <= 28; y++) for (let x = 12; x <= 20; x++) {
    if (((x - 16) ** 2) / 7 + ((y - 26) ** 2) / 3.2 <= 1) set(x, y, TILE.water);
  }

  // Hedges that split the districts. Gaps are closed with barricades until a district unlocks.
  for (let y = 2; y <= 13; y++) if (y !== 10 && y !== 11) set(27, y, TILE.hedge);
  for (let x = 21; x <= 37; x++) set(x, 14, TILE.hedge);
  for (let y = 14; y <= 27; y++) if (y !== 21 && y !== 22) set(21, y, TILE.hedge);

  // Buildings (top-left tile) and their footprints
  const buildings: Placed[] = [
    { key: 'b-lab', tx: 17, ty: 2 },
    { key: 'b-clinic', tx: 30, ty: 3 },
    { key: 'b-bank', tx: 28, ty: 16 },
    { key: 'b-truck', tx: 4, ty: 19 },
    { key: 'b-house1', tx: 3, ty: 3 },
    { key: 'b-house2', tx: 10, ty: 14 },
  ];
  reserve(16, 1, 8, 7); reserve(29, 2, 7, 6); reserve(27, 15, 7, 6); reserve(3, 18, 5, 4); reserve(2, 2, 6, 6); reserve(9, 13, 6, 5);

  const props: Placed[] = [
    { key: 'board', tx: 15, ty: 8 },
    { key: 'lamp', tx: 14, ty: 12 },
    { key: 'lamp', tx: 25, ty: 8 },
    { key: 'bench', tx: 22, ty: 12 },
    { key: 'crate', tx: 3, ty: 23 },
    { key: 'crate', tx: 4, ty: 23 },
    { key: 'crate', tx: 12, ty: 21 },
    { key: 'pot', tx: 16, ty: 6 },
    { key: 'pot', tx: 23, ty: 6 },
    { key: 'crate', tx: 12, ty: 24 },
    { key: 'pot', tx: 34, ty: 7 },
  ];

  const npcs: Spot[] = [
    { id: 'mae', tx: 22, ty: 9, face: 'down' },
    { id: 'rosa', tx: 8, ty: 22, face: 'down' },
    { id: 'len', tx: 11, ty: 21, face: 'left' },
    { id: 'theo', tx: 35, ty: 8, face: 'left' },
    { id: 'priya', tx: 33, ty: 20, face: 'down' },
    { id: 'ivy', tx: 16, ty: 12, face: 'right' },
    { id: 'pete', tx: 24, ty: 12, face: 'left' },
    { id: 'nia', tx: 5, ty: 13, face: 'down' },
    { id: 'gus', tx: 20, ty: 26, face: 'left' },
  ];
  for (const n of npcs) reserve(n.tx - 1, n.ty - 1, 3, 3);
  reserve(13, 7, 14, 8); // plaza and its edge
  reserve(18, 22, 4, 6); // walkway from the south road to Gus at the pond
  reserve(28, 7, 10, 7); // clinic yard
  reserve(22, 15, 16, 10); // bank yard (keeps the district open to explore)

  // Scatter trees and flowers on unreserved grass
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (reserved[y][x]) continue;
    const roll = rnd();
    if (roll < 0.075) g[y][x] = TILE.tree;
    else if (roll < 0.12) g[y][x] = TILE.flowers;
  }

  return {
    tiles: g,
    buildings,
    props,
    npcs,
    gates: { east: [[27, 10], [27, 11]], south: [[21, 21], [21, 22]] },
    start: { tx: 20, ty: 10 },
    labDoor: { tx: 20, ty: 7 },
    board: { tx: 15, ty: 8 },
  };
}
