import Phaser from 'phaser';
import { makeBuildings, makeCharacter, makeEmotes, makePortrait, makeTiles } from '../art/draw';
import { CAST } from '../data/cast';

/** Draws every texture in code, then hands off to the town. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    makeTiles(this);
    makeBuildings(this);
    makeEmotes(this);
    for (const [id, c] of Object.entries(CAST)) {
      makeCharacter(this, id, c.look);
      makePortrait(this, id, c.look);
    }
    const go = () => this.scene.start('Town', { attract: true });
    if (document.fonts?.ready) void document.fonts.ready.then(go); else go();
  }
}
