import Phaser from 'phaser';
import { mulberry32 } from '../art/draw';
import { SORT } from '../data/sort';
import { recordSynth } from '../state';
import { ui } from '../ui/ui';
import { sfx } from '../audio';

/** The lab's insight wall: sort falling notes into usability's quality components. */
export class SynthesisScene extends Phaser.Scene {
  private alive = true;
  private g!: Phaser.GameObjects.Graphics;

  constructor() { super('Synthesis'); }

  create() {
    this.alive = true;
    document.body.dataset.scene = 'synth';
    this.g = this.add.graphics();
    this.g.postFX?.addBlur(0, 1, 1, 0.8);
    this.draw();
    this.scale.on('resize', this.draw, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.draw, this); this.alive = false; });
    this.cameras.main.fadeIn(300);
    ui.synthOpen(SORT.length, () => this.exit());
    this.time.delayedCall(400, () => void this.run());
  }

  private draw() {
    const w = this.scale.width, h = this.scale.height;
    const u = Math.max(2, Math.floor(Math.min(w, h) / 160));
    const g = this.g.clear();
    g.fillStyle(0x5a3a22).fillRect(0, 0, w, h);
    g.fillStyle(0xb08850).fillRect(4 * u, 4 * u, w - 8 * u, h - 8 * u);
    const rnd = mulberry32(42);
    for (let i = 0; i < (w * h) / (60 * u * u); i++) {
      g.fillStyle(rnd() < 0.5 ? 0xa07a45 : 0xbf9862).fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), u, u);
    }
    const cols = [0xf6d865, 0xef8fb0, 0xa9c7ff, 0xa9e0b8];
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * (w - 30 * u)), y = Math.floor(rnd() * (h - 30 * u));
      g.fillStyle(0x000000, 0.18).fillRect(x + u, y + u, 18 * u, 18 * u);
      g.fillStyle(cols[i % cols.length], 0.55).fillRect(x, y, 18 * u, 18 * u);
    }
    // A warm desk lamp from above, falling off to shadow at the bottom
    g.fillGradientStyle(0xfff0c8, 0xfff0c8, 0x1a1208, 0x1a1208, 0.12, 0.12, 0.45, 0.45).fillRect(0, 0, w, h);
  }

  private async run() {
    const results: boolean[] = [];
    let score = 0;
    for (let i = 0; i < SORT.length; i++) {
      const card = SORT[i];
      const ms = Math.max(8000, 15000 - i * 650);
      const k = await ui.synthCard(card, i, results, ms);
      if (!this.alive) return;
      const ok = k === card.a;
      results.push(ok);
      if (ok) { score++; sfx.good(); } else { sfx.bad(); this.cameras.main.shake(120, 0.004); }
      await ui.synthFeedback(ok, k === null, card, i === SORT.length - 1);
      if (!this.alive) return;
    }
    const stars = score >= 10 ? 3 : score >= 8 ? 2 : score >= 6 ? 1 : 0;
    const { prevStars, firstClear } = recordSynth(stars, score / SORT.length);
    if (stars > 0) sfx.unlock(); else sfx.fail();
    const r = await ui.results({
      eyebrow: 'The Insight Wall · synthesis',
      title: firstClear ? 'Wall sorted!' : 'Wall sorted',
      stars,
      headline: `${score} of ${SORT.length} notes in the right place`,
      sub: stars === 0
        ? 'Sort at least 6 correctly to finish the wall. The five components: learnability, efficiency, memorability, errors, satisfaction. Utility is its own question.'
        : 'Usability is how easily people can successfully complete a task using an interface. Utility is whether it has the features they need.',
      newBest: stars > prevStars,
      stats: [[`${score}`, 'Correct'], [`${SORT.length - score}`, 'Missed'], [`${stars}/3`, 'Stars'], [`${Math.round((score / SORT.length) * 100)}%`, 'Accuracy']],
    });
    if (!this.alive) return;
    if (r === 'retry') { ui.synthClose(); this.scene.restart(); }
    else this.exit();
  }

  private exit() {
    ui.synthClose();
    this.alive = false;
    this.scene.resume('Town', { from: 'synth' });
    this.scene.stop();
  }
}
