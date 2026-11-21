import Phaser from 'phaser';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/400-italic.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './ui/style.css';
import { BootScene } from './scenes/BootScene';
import { TownScene } from './scenes/TownScene';
import { ConversationScene } from './scenes/ConversationScene';
import { SynthesisScene } from './scenes/SynthesisScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#141826',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, TownScene, ConversationScene, SynthesisScene],
});

// Add ?debug to the URL to reach the game object from the console (used by automated play tests).
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __game: Phaser.Game }).__game = game;
