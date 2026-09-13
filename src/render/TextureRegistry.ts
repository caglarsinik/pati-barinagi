import Phaser from 'phaser';
import { BUILDING_DEFS, type BuildingType } from '../content/buildings';
import type { GrowthStage } from '../sim/entities/Dog';
import type { DogGenome } from '../sim/entities/DogGenome';
import { drawBuilding } from './BuildingArt';
import { DOG_DIRS, DOG_FRAME, DOG_FRAMES, buildDogSheet, dogTextureKey } from './DogPainter';
import { HUMAN_DIRS, HUMAN_FRAMES, HUMAN_H, HUMAN_W, PLAYER_STYLE, buildHumanSheet, humanStyleFromSeed } from './HumanPainter';
import { hex, shade } from './Pixels';
import { buildTileset } from './TileArt';

export const TEX = {
  tiles0: 'tiles0',
  tiles1: 'tiles1',
  player: 'player',
} as const;

export function buildingTextureKey(type: BuildingType, variant = 0): string {
  return variant > 0 ? `bld-${type}-${variant}` : `bld-${type}`;
}

/** Tüm sabit dokuları kodla üretip Phaser'a kaydeder. Bir kez çağrılır (Boot sahnesi). */
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

  for (const type of Object.keys(BUILDING_DEFS) as BuildingType[]) {
    const variants = type === 'bowl' || type === 'trough' ? 3 : 1;
    for (let v = 0; v < variants; v++) t.addCanvas(buildingTextureKey(type, v), drawBuilding(type, v).toCanvas());
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

const ROLE_SHIRTS: Record<string, number> = { caretaker: 0x4fb36b, trainer: 0xa66bd6, vet: 0xf7f3ea };

/** Sahiplenici / personel dokusu: görünüş tohumu (ve rol) başına bir kez. */
export function ensureHumanTexture(scene: Phaser.Scene, look: number, role?: string): string {
  const key = role ? `human-${look}-${role}` : `human-${look}`;
  if (scene.textures.exists(key)) return key;
  const style = humanStyleFromSeed(look);
  if (role && ROLE_SHIRTS[role] !== undefined) {
    style.shirt = hex(ROLE_SHIRTS[role]);
    style.shirtDark = shade(style.shirt, 0.75);
    style.hat = role === 'vet' ? hex(0xe4514f) : role === 'caretaker' ? hex(0x2f7f5c) : style.hat;
  }
  const sheet = buildHumanSheet(style);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas());
  if (!tex) return key;
  for (let i = 0; i < HUMAN_DIRS * HUMAN_FRAMES; i++) tex.add(i, 0, i * HUMAN_W, 0, HUMAN_W, HUMAN_H);
  for (let dir = 0; dir < HUMAN_DIRS; dir++) {
    const base = dir * HUMAN_FRAMES;
    scene.anims.create({
      key: `${key}-walk-${dir}`,
      frames: scene.anims.generateFrameNumbers(key, { frames: [base + 1, base, base + 2, base] }),
      frameRate: 8,
      repeat: -1,
    });
  }
  return key;
}

/** Köpek dokusunu gerekiyorsa üretir (genom + aşama başına bir kez) ve anahtarını döndürür. */
export function ensureDogTexture(scene: Phaser.Scene, genome: DogGenome, stage: GrowthStage): string {
  const key = dogTextureKey(genome, stage);
  if (scene.textures.exists(key)) return key;
  const sheet = buildDogSheet(genome, stage);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas());
  if (!tex) return key;
  for (let i = 0; i < DOG_DIRS * DOG_FRAMES; i++) tex.add(i, 0, i * DOG_FRAME, 0, DOG_FRAME, DOG_FRAME);
  for (let dir = 0; dir < DOG_DIRS; dir++) {
    const base = dir * DOG_FRAMES;
    scene.anims.create({
      key: `${key}-walk-${dir}`,
      frames: scene.anims.generateFrameNumbers(key, { frames: [base + 1, base, base + 2, base] }),
      frameRate: 7,
      repeat: -1,
    });
  }
  return key;
}
