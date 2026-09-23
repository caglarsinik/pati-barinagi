import { BALANCE } from '../../config/balance';
import type { Rect, TileWorld } from './TileWorld';
import { Biome, Ground, Obj } from './tiles';

/**
 * Kuruluş açılışı (0.19.0). Dünya üretimi arsayı hep 40×32 "rezerv" olarak kurar (RNG sırası ve eski kayıtlar değişmez).
 * Kuruluş oyununda çitli arsa bu rezervin içindeki küçük çekirdektir; çekirdeğin güney ve doğu kapıları, üretimdeki yolların
 * başladığı sütun ve satırla hizalıdır.
 */
export function plotCoreRect(): Rect {
  const r = BALANCE.world.plot;
  const c = BALANCE.world.plotCore;
  return { x: r.x + c.dx, y: r.y + c.dy, w: c.w, h: c.h };
}

const GRASS = [Ground.Grass0, Ground.Grass0, Ground.Grass0, Ground.Grass1, Ground.Grass1, Ground.Grass2] as const;

/**
 * Rezervin arsa dışında kalan kısmı çayıra döner; çekirdek kapılarından üretimdeki yolların başına kısa yol çekilir.
 * RNG kullanmaz: yeni oyunda ve her yüklemede aynı sonucu verir. Arsa (genişlemiş olabilir) içindeki karelere dokunmaz.
 */
export function trimReserve(world: TileWorld): void {
  const r = BALANCE.world.plot;
  const core = plotCoreRect();
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!world.inBounds(x, y) || world.inPlot(x, y)) continue;
      const i = world.idx(x, y);
      world.biome[i] = Biome.Meadow;
      world.ground[i] = GRASS[(x * 7 + y * 13) % GRASS.length];
      world.object[i] = Obj.None;
    }
  }
  const road = (x: number, y: number): void => {
    if (!world.inBounds(x, y) || world.inPlot(x, y)) return;
    const i = world.idx(x, y);
    world.biome[i] = Biome.Road;
    world.ground[i] = Ground.Path;
    world.object[i] = Obj.None;
  };
  // Güney kapısı sütunu ve doğu kapısı satırı, rezervin ortasıyla (üretimdeki yolların başıyla) aynıdır.
  const gx = Math.floor(r.x + r.w / 2);
  const gy = Math.floor(r.y + r.h / 2);
  for (let y = core.y + core.h; y < r.y + r.h; y++) {
    road(gx, y);
    road(gx + 1, y);
  }
  for (let x = core.x + core.w; x < r.x + r.w; x++) {
    road(x, gy);
    road(x, gy + 1);
  }
  world.recomputeAllSolid();
}

/** Üretilmiş dünyayı kuruluş arsasına getirir: arsa çekirdek olur, rezerv budanır, doğuş noktası çekirdeğe taşınır. */
export function applyFoundingPlot(world: TileWorld): void {
  const core = plotCoreRect();
  world.plot = core;
  trimReserve(world);
  world.spawn = { x: core.x + core.w / 2, y: core.y + core.h - 3 };
}
