import Phaser from 'phaser';
import { HUMAN_DIRS, HUMAN_FRAMES, HUMAN_H, HUMAN_W, PLAYER_STYLE, buildHumanSheet } from './HumanPainter';
import { buildTileset } from './TileArt';

export const TEX = {
  tiles0: 'tiles0',
  tiles1: 'tiles1',
  player: 'player',
} as const;

/** Tüm dokuları kodla üretip Phaser'a kaydeder. Bir kez çağrılır (Boot sahnesi). */
export function registerTextures(scene: Phaser.Scene): void {
  const t = scene.textures;
  if (t.exists(TEX.tiles0)) return;
  t.addCanvas(TEX.tiles0, buildTileset(0).toCanvas());
  t.addCanvas(TEX.tiles1, buildTileset(1).toCanvas());

  const sheet = buildHumanSheet(PLAYER_STYLE);
  const tex = t.addCanvas(TEX.player, sheet.toCanvas());
  if (tex) {
    for (let i = 0; i < HUMAN_DIRS * HUMAN_FRAMES; i++) tex.add(i, 0, i * HUMAN_W, 0, HUMAN_W, HUMAN_H);
  }
}

/** Yürüme animasyonlarını (global) bir kez oluşturur. */
export function registerAnimations(scene: Phaser.Scene): void {
  for (let dir = 0; dir < HUMAN_DIRS; dir++) {
    const key = `player-walk-${dir}`;
    if (scene.anims.exists(key)) continue;
    const base = dir * HUMAN_FRAMES;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(TEX.player, { frames: [base + 1, base, base + 2, base] }),
      frameRate: 8,
      repeat: -1,
    });
  }
}
