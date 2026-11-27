// Loads every model, texture and the sky up front, with progress for the loading screen.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { pmrem, renderer } from './core';

const BASE = `${import.meta.env.BASE_URL}assets/`;

export const MODELS = ['man-suit', 'man-a', 'man-b', 'man-c', 'woman-a', 'woman-b', 'woman-c', 'woman-d',
  'tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5', 'pine-1', 'pine-2', 'bush', 'bush-flowers', 'grass', 'grass-wispy',
  'flowers-1', 'flowers-2', 'fern', 'rock-1', 'rock-2', 'pebble', 'car', 'suv', 'taxi'] as const;
export const PROPS = ['street_lamp_02', 'painted_wooden_bench', 'standing_chalkboard_01', 'concrete_road_barrier_02', 'wooden_crate_01',
  'planter_box_01', 'potted_plant_04', 'wooden_picnic_table', 'utility_box_01', 'metal_office_desk', 'classic_laptop', 'clipboard',
  'modern_arm_chair_01', 'wall_clock', 'wooden_display_shelves_01', 'plastic_monobloc_chair_01', 'cardboard_box_01', 'vintage_microscope',
  'outdoor_table_chair_set_01'] as const;
export const TEXTURES = ['leafy_grass', 'patterned_paving', 'rectangular_paving', 'terracotta_floor_tiles', 'asphalt_02', 'white_stucco',
  'painted_plaster_wall', 'yellow_plaster', 'brick_wall_02', 'white_sandstone_bricks', 'clay_roof_tiles_02', 'grey_roof_tiles',
  'laminate_floor_02', 'long_white_tiles', 'wood_floor_deck'] as const;

export type ModelKey = (typeof MODELS)[number];
export type PropKey = (typeof PROPS)[number];
export type TexKey = (typeof TEXTURES)[number];

interface TexSet { diff: THREE.Texture; nor: THREE.Texture; arm: THREE.Texture | null }

export const A = {
  models: {} as Record<ModelKey, GLTF>,
  props: {} as Record<PropKey, GLTF>,
  tex: {} as Record<TexKey, TexSet>,
  sky: null as unknown as THREE.Texture,
  env: null as unknown as THREE.Texture,
};

export async function loadAll(onProgress: (f: number) => void) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, done, total) => onProgress(done / Math.max(1, total));
  const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const tl = new THREE.TextureLoader(manager);
  const hdr = new HDRLoader(manager);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (url: string, color: boolean) => new Promise<THREE.Texture>((res, rej) => tl.load(url, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    res(t);
  }, undefined, rej));

  const jobs: Promise<unknown>[] = [];
  for (const k of MODELS) jobs.push(gltf.loadAsync(`${BASE}models/${k}.glb`).then((g) => { A.models[k] = g; }));
  for (const k of PROPS) jobs.push(gltf.loadAsync(`${BASE}props/${k}.glb`).then((g) => { A.props[k] = g; }));
  for (const k of TEXTURES) {
    jobs.push(Promise.all([
      tex(`${BASE}tex/${k}/diff.webp`, true),
      tex(`${BASE}tex/${k}/nor.webp`, false),
      tex(`${BASE}tex/${k}/arm.webp`, false).catch(() => null),
    ]).then(([diff, nor, arm]) => { A.tex[k] = { diff, nor, arm }; }));
  }
  jobs.push(hdr.loadAsync(`${BASE}hdri/sky.hdr`).then((t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    A.sky = t;
    A.env = pmrem(t);
  }));
  await Promise.all(jobs);
}

/* ---------------- materials ---------------- */

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * A physically based material from a Poly Haven texture set. Geometry UVs are in metres,
 * so `size` is how many metres one copy of the texture covers.
 */
export function pbr(key: TexKey, size = 2, opts: { color?: THREE.ColorRepresentation; rough?: number; normal?: number; macro?: boolean } = {}) {
  const id = `${key}|${size}|${opts.color ?? ''}|${opts.rough ?? ''}|${opts.normal ?? ''}|${opts.macro ?? ''}`;
  const hit = matCache.get(id);
  if (hit) return hit;
  const set = A.tex[key];
  const rep = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(1 / size, 1 / size); c.needsUpdate = true; return c; };
  const m = new THREE.MeshStandardMaterial({
    map: rep(set.diff),
    normalMap: rep(set.nor),
    normalScale: new THREE.Vector2(opts.normal ?? 1, opts.normal ?? 1),
    roughness: opts.rough ?? 1,
    metalness: 0,
    color: opts.color ?? 0xffffff,
  });
  if (set.arm && opts.rough === undefined) { m.roughnessMap = rep(set.arm); m.metalnessMap = rep(set.arm); }
  if (opts.macro) addMacroVariation(m);
  matCache.set(id, m);
  return m;
}

/** Breaks up visible texture tiling across big surfaces with slow, large-scale colour variation. */
export function addMacroVariation(m: THREE.Material, amount = 0.22) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMacroPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vMacroPos;
float mHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(mHash(i), mHash(i+vec2(1,0)), u.x), mix(mHash(i+vec2(0,1)), mHash(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float mn = mNoise(vMacroPos.xz * 0.06) * 0.6 + mNoise(vMacroPos.xz * 0.21) * 0.4;
diffuseColor.rgb *= mix(1.0 - ${amount.toFixed(2)}, 1.0 + ${(amount * 0.6).toFixed(2)}, mn);`);
  };
  m.customProgramCacheKey = () => `macro${amount}`;
}

/** Copies a loaded model, sharing geometry and materials, with shadows on. */
export function instance(g: GLTF, shadows = true) {
  const o = g.scene.clone(true);
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; }
  });
  return o;
}

/** Scales an object so its height is `h` metres and rests its base on y = 0. */
export function fitHeight(o: THREE.Object3D, h: number) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o);
  const s = h / Math.max(0.001, b.max.y - b.min.y);
  o.scale.multiplyScalar(s);
  o.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(o);
  o.position.y -= b2.min.y;
  return o;
}

/** Scales an object so its longest horizontal side is `len` metres, base on y = 0, centred. */
export function fitLength(o: THREE.Object3D, len: number) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o);
  const s = len / Math.max(0.001, b.max.x - b.min.x, b.max.z - b.min.z);
  o.scale.multiplyScalar(s);
  o.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(o);
  const c = b2.getCenter(new THREE.Vector3());
  o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y;
  return o;
}

/** Wraps an object so later transforms apply around its fitted origin. */
export function wrap(o: THREE.Object3D) {
  const g = new THREE.Group();
  g.add(o);
  return g;
}
