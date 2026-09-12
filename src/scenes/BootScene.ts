import Phaser from 'phaser';
import { registerAnimations, registerTextures } from '../render/TextureRegistry';
import { store } from '../ui/store';

/** Tüm dokuları kodla üretir, sonra menünün oyunu başlatmasına izin verir. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    registerTextures(this);
    registerAnimations(this);
    store.booted.value = true;
  }
}
