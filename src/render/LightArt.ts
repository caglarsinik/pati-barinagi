import { Pixels } from './Pixels';

/** Yumuşak kenarlı ışık dairesi; gece haritasında ERASE ile delik açmak için. */
export function drawLightDisc(size = 96): Pixels {
  const p = new Pixels(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (d >= 1) continue;
      const a = Math.round(255 * Math.pow(1 - d, 1.6));
      p.set(x, y, [255, 230, 170, a]);
    }
  }
  return p;
}
