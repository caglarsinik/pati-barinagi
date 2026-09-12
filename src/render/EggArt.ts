import { Rng, hashStr } from '../core/Rng';
import { COAT_COLORS, type DogGenome, genomeKey } from '../sim/entities/DogGenome';
import { Pixels, hex, mix } from './Pixels';
import { P } from './palette';

export const EGG_SIZE = 16;

/** Yumurta görseli: boy, şekil, renk ve desen genomdan gelir. */
export function drawEgg(g: DogGenome): Pixels {
  const p = new Pixels(EGG_SIZE, EGG_SIZE);
  const coat = COAT_COLORS[g.coat];
  const base = hex(coat.base);
  const light = hex(coat.light);
  const dark = hex(coat.dark);
  const second = hex(COAT_COLORS[g.secondary].base);
  const scale = g.size === 'S' ? 0.78 : g.size === 'L' ? 1.05 : 0.92;
  const rx = 4.6 * scale;
  const ry = 6 * scale;
  const cx = 8;
  const cy = 8.5;
  const rng = new Rng(hashStr(`egg-${genomeKey(g)}`));

  for (let y = 0; y < EGG_SIZE; y++) {
    for (let x = 0; x < EGG_SIZE; x++) {
      const dx = (x + 0.5 - cx) / rx;
      let dy = (y + 0.5 - cy) / ry;
      // Şekil: sivri yumurtada üst yarı daralır, yuvarlakta genişler.
      if (dy < 0) {
        const taper = g.body === 'slim' ? 1.45 : g.body === 'stocky' ? 0.85 : 1.15;
        dy *= taper;
      }
      if (dx * dx + dy * dy <= 1) p.set(x, y, base);
    }
  }
  // Desen
  const inside = (x: number, y: number): boolean => p.isOpaque(x, y);
  if (g.pattern === 'spots') {
    for (let i = 0; i < 5; i++) {
      const sx = Math.round(cx + rng.float(-rx * 0.7, rx * 0.7));
      const sy = Math.round(cy + rng.float(-ry * 0.7, ry * 0.7));
      for (const [ox, oy] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ]) {
        if (inside(sx + ox, sy + oy)) p.set(sx + ox, sy + oy, second);
      }
    }
  } else if (g.pattern === 'patches') {
    const sx = cx + rng.float(-1.5, 1.5);
    const sy = cy + rng.float(-1, 2);
    for (let y = 0; y < EGG_SIZE; y++) {
      for (let x = 0; x < EGG_SIZE; x++) {
        const dx = (x + 0.5 - sx) / (rx * 0.6);
        const dy = (y + 0.5 - sy) / (ry * 0.45);
        if (dx * dx + dy * dy <= 1 && inside(x, y)) p.set(x, y, second);
      }
    }
  } else if (g.pattern === 'stripes') {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 3) {
      for (let x = 0; x < EGG_SIZE; x++) if (inside(x, y)) p.set(x, y, second);
    }
  }
  // Gölge ve parlama
  for (let y = 0; y < EGG_SIZE; y++) {
    for (let x = 0; x < EGG_SIZE; x++) {
      if (!inside(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx > 0.45 || dy > 0.6) p.set(x, y, mix(p.get(x, y), dark, 0.45));
    }
  }
  p.set(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.45), light);
  p.set(Math.round(cx - rx * 0.4) + 1, Math.round(cy - ry * 0.45), light);
  p.set(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.45) + 1, light);
  if (g.rarity === 'legendary') {
    p.set(Math.round(cx + rx * 0.3), Math.round(cy - ry * 0.7), P.flowerYellow);
    p.set(Math.round(cx - rx * 0.6), Math.round(cy + ry * 0.2), P.flowerYellow);
  }
  p.outline(P.outline);
  return p;
}
