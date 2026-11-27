// The 3D renderer: one WebGL canvas, physically based lighting, soft shadows, ambient occlusion,
// bloom and filmic tone mapping. Quality scales with the device and adapts to keep motion smooth.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { state } from '../state';

export type Quality = 'low' | 'medium' | 'high';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number, t: number): void;
  /** Depth of field focus distance in metres, or null for none. */
  focus?: () => number | null;
}

const host = document.getElementById('game')!;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const small = Math.min(window.innerWidth, window.innerHeight) < 700;

export function autoQuality(): Quality {
  if (coarse && small) return 'low';
  if (coarse) return 'medium';
  return 'high';
}
export function currentQuality(): Quality {
  const q = state.settings.graphics;
  return q === 'auto' ? autoQuality() : q;
}

const PROFILE: Record<Quality, { dpr: number; shadow: number; ao: boolean; bloom: boolean; msaa: number; dof: boolean }> = {
  low: { dpr: 1, shadow: 1024, ao: false, bloom: false, msaa: 0, dof: false },
  medium: { dpr: 1.5, shadow: 2048, ao: false, bloom: true, msaa: 4, dof: true },
  high: { dpr: 2, shadow: 2048, ao: true, bloom: true, msaa: 4, dof: true },
};

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-hidden', 'true');

let stage: Stage | null = null;
let composer: EffectComposer | null = null;
let passes: { render: RenderPass; ao?: GTAOPass; bloom?: UnrealBloomPass; dof?: BokehPass } | null = null;
let quality: Quality = currentQuality();
let scale = 1; // adaptive resolution multiplier
const listeners = new Set<(q: Quality) => void>();

export const shadowSize = () => PROFILE[quality].shadow;
export const getQuality = () => quality;
export const onQuality = (fn: (q: Quality) => void) => { listeners.add(fn); return () => listeners.delete(fn); };

function pixelRatio() {
  return Math.max(0.6, Math.min(window.devicePixelRatio || 1, PROFILE[quality].dpr) * scale);
}

function buildComposer() {
  composer?.dispose();
  composer = null;
  passes = null;
  if (!stage) return;
  const p = PROFILE[quality];
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h);
  if (quality === 'low') return; // straight render, no post effects
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: p.msaa });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio());
  composer.setSize(w, h);
  const render = new RenderPass(stage.scene, stage.camera);
  composer.addPass(render);
  passes = { render };
  if (p.ao) {
    const ao = new GTAOPass(stage.scene, stage.camera, w, h);
    ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.5, scale: 1 });
    composer.addPass(ao);
    passes.ao = ao;
  }
  if (p.dof && stage.focus) {
    const dof = new BokehPass(stage.scene, stage.camera, { focus: 3, aperture: 0.0016, maxblur: 0.008 });
    composer.addPass(dof);
    passes.dof = dof;
  }
  if (p.bloom) {
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.5, 0.92);
    composer.addPass(bloom);
    passes.bloom = bloom;
  }
  composer.addPass(new OutputPass());
}

export function setStage(s: Stage) {
  stage = s;
  resize();
  buildComposer();
}
export const getStage = () => stage;

export function setQuality(q: Quality) {
  quality = q;
  scale = 1;
  buildComposer();
  listeners.forEach((fn) => fn(q));
}

function resize() {
  if (!stage) return;
  const w = window.innerWidth, h = window.innerHeight;
  stage.camera.aspect = w / h;
  stage.camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h);
  composer?.setPixelRatio(pixelRatio());
  composer?.setSize(w, h);
}
window.addEventListener('resize', resize);

// Adaptive resolution: if frames get slow, render fewer pixels; recover when there's headroom.
let slow = 0, fast = 0;
function adapt(dt: number) {
  if (dt > 0.2) return; // tab switch or hitch, ignore
  if (dt > 1 / 40) { slow += dt; fast = 0; } else if (dt < 1 / 58) { fast += dt; slow = Math.max(0, slow - dt); }
  if (slow > 1.5 && scale > 0.6) { scale = Math.max(0.6, scale - 0.15); slow = 0; resize(); }
  else if (fast > 4 && scale < 1) { scale = Math.min(1, scale + 0.1); fast = 0; resize(); }
}

const clock = new THREE.Clock();
let elapsed = 0;
export const now = () => elapsed;
const tickers = new Set<(dt: number) => void>();
export const onTick = (fn: (dt: number) => void) => { tickers.add(fn); return () => tickers.delete(fn); };

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;
  adapt(dt);
  tickers.forEach((fn) => fn(dt));
  if (stage) {
    stage.update(dt, elapsed);
    if (passes?.dof) {
      const f = stage.focus?.() ?? null;
      const u = passes.dof.uniforms as unknown as Record<string, { value: number }>;
      if (f !== null) { u.focus.value = f; u.aperture.value = 0.0016; passes.dof.enabled = true; }
      else passes.dof.enabled = false;
    }
    if (composer) composer.render(dt); else renderer.render(stage.scene, stage.camera);
  }
}
renderer.setAnimationLoop(frame);

/** Shared environment: sky image for reflections and image-based light. */
export function pmrem(tex: THREE.Texture) {
  const gen = new THREE.PMREMGenerator(renderer);
  const env = gen.fromEquirectangular(tex).texture;
  gen.dispose();
  return env;
}

/* ---------------- fades ---------------- */
const fadeEl = document.createElement('div');
fadeEl.id = 'fade';
document.body.appendChild(fadeEl);
export function fade(to: 0 | 1, ms = 350): Promise<void> {
  fadeEl.style.transitionDuration = `${ms}ms`;
  fadeEl.style.opacity = String(to);
  return new Promise((r) => setTimeout(r, ms));
}
