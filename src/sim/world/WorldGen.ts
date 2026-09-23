import { BALANCE } from '../../config/balance';
import { Rng, hash2 } from '../../core/Rng';
import { TileWorld } from './TileWorld';
import { Biome, Ground, Obj } from './tiles';
import { stampVillage } from './Village';

// ---------------------------------------------------------------------------
// Gürültü
// ---------------------------------------------------------------------------

function lattice(seed: number, x: number, y: number): number {
  return hash2(hash2(seed, x | 0), y | 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Değer gürültüsü, [0,1). */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = lattice(seed, x0, y0);
  const b = lattice(seed, x0 + 1, y0);
  const c = lattice(seed, x0, y0 + 1);
  const d = lattice(seed, x0 + 1, y0 + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/** Katmanlı gürültü (fBm), yaklaşık [0,1], ortalama 0.5. */
export function fbm(seed: number, x: number, y: number, octaves: number, freq: number, gain = 0.5): number {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(seed + i * 101, x * f + i * 7.13, y * f + i * 3.71);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Dünya üretimi
// ---------------------------------------------------------------------------

const PLOT_MARGIN = 3;
const NEST_PLOT_MARGIN = 8;

/**
 * Tohumdan tüm haritayı üretir. Aynı tohum aynı haritayı verir.
 * Sıra önemli: biyom → arsa → yollar → zemin varyantları → nesneler → yuvalar.
 */
export function generateWorld(seed: number): TileWorld {
  const { width: w, height: h, plot } = BALANCE.world;
  const world = new TileWorld(w, h, plot);
  const rng = new Rng(hash2(seed, 0x51));
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;

  // 1) Biyomlar
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = world.idx(x, y);
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) {
        world.biome[i] = Biome.Mountain;
        continue;
      }
      let hgt = clamp01((fbm(seed + 1, x, y, 5, 1 / 56) - 0.5) * 2.4 + 0.5);
      let moist = clamp01((fbm(seed + 2, x, y, 4, 1 / 40) - 0.5) * 2.2 + 0.5);
      const detail = fbm(seed + 3, x, y, 2, 1 / 9);

      // Kenarlara doğru yükselt (dağ halkası), merkezi düzleştir (çayır).
      // Kare mesafe (Chebyshev): dağ halkası harita kenarını izler, sadece dış bant dağ olur.
      const dx = Math.abs(x - cx) / (w / 2);
      const dy = Math.abs(y - cy) / (h / 2);
      const d = Math.max(dx, dy);
      const edge = clamp01((d - 0.82) / 0.18);
      hgt = lerp(hgt, 0.95, Math.pow(edge, 1.5));
      const distPlot = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const centerPull = clamp01(1 - distPlot / 30);
      hgt = lerp(hgt, 0.5, centerPull);
      moist = lerp(moist, 0.42, centerPull);

      let b: Biome;
      if (hgt < 0.36) b = Biome.Water;
      else if (hgt < 0.4) b = Biome.Shallow;
      else if (hgt < 0.43) b = Biome.Sand;
      else if (hgt > 0.82) b = Biome.Mountain;
      else if (hgt > 0.7) b = Biome.Hills;
      else if (moist > 0.72 && hgt < 0.55) b = Biome.Swamp;
      else if (moist > 0.57) b = Biome.Forest;
      else if (detail > 0.6 && moist < 0.5) b = Biome.Flowers;
      else b = Biome.Meadow;
      world.biome[i] = b;
    }
  }

  // 2) Arsa ve çevresi
  for (let y = plot.y - PLOT_MARGIN; y < plot.y + plot.h + PLOT_MARGIN; y++) {
    for (let x = plot.x - PLOT_MARGIN; x < plot.x + plot.w + PLOT_MARGIN; x++) {
      if (!world.inBounds(x, y)) continue;
      world.biome[world.idx(x, y)] = world.inPlot(x, y) ? Biome.Plot : Biome.Meadow;
    }
  }

  // 3) Yollar: arsanın güney kapısından aşağıya, doğu kapısından sağa.
  const roadRng = rng.fork(2);
  carveRoad(world, roadRng, Math.floor(plot.x + plot.w / 2), plot.y + plot.h, 0, 1);
  carveRoad(world, roadRng, plot.x + plot.w, Math.floor(plot.y + plot.h / 2), 1, 0);

  // 4) Zemin kareleri
  const gRng = rng.fork(3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = world.idx(x, y);
      if (world.biome[i] === Biome.Road) continue; // yol zaten yazıldı
      world.ground[i] = groundFor(world.biome[i] as Biome, gRng);
    }
  }

  // 5) Nesneler
  const oRng = rng.fork(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = world.idx(x, y);
      if (world.object[i] !== Obj.None) continue;
      const b = world.biome[i] as Biome;
      if (b === Biome.Plot || b === Biome.Road || b === Biome.Mountain || b === Biome.Water || b === Biome.Shallow) continue;
      if (nearPlot(world, x, y, PLOT_MARGIN)) continue;
      placeObject(world, oRng, x, y, b);
    }
  }

  // 6) Yuvalar ve sokak köpeği inleri
  placeNests(world, rng.fork(5));
  placeDens(world, rng.fork(6));

  // 8) Köy (0.18.2): güney yolunun ucunda; RNG kullanmaz, eski kayıtlarda da aynı yerde.
  stampVillage(world);

  // 7) Doğuş noktası ve geçilmezlik
  world.spawn = { x: plot.x + plot.w / 2, y: plot.y + plot.h - 3 };
  world.recomputeAllSolid();
  world.dirty = [];
  return world;
}

function nearPlot(world: TileWorld, x: number, y: number, margin: number): boolean {
  const p = world.plot;
  return x >= p.x - margin && y >= p.y - margin && x < p.x + p.w + margin && y < p.y + p.h + margin;
}

function carveRoad(world: TileWorld, rng: Rng, startX: number, startY: number, dirX: number, dirY: number): void {
  let x = startX;
  let y = startY;
  let drift = 0;
  let steps = 0;
  while (world.inBounds(x, y)) {
    // Hafif kıvrım; ilk adımlar düz ki yol kapıyla hizalı kalsın.
    if (steps++ < 4) drift = 0;
    else if (rng.chance(0.22)) drift = rng.int(-1, 1);
    else if (rng.chance(0.5)) drift = 0;
    if (dirY !== 0) x = clampInt(x + drift, 3, world.width - 5);
    else y = clampInt(y + drift, 3, world.height - 5);
    for (let k = 0; k < 2; k++) {
      const tx = dirY !== 0 ? x + k : x;
      const ty = dirY !== 0 ? y : y + k;
      carveRoadTile(world, tx, ty);
    }
    x += dirX;
    y += dirY;
  }
}

function carveRoadTile(world: TileWorld, x: number, y: number): void {
  if (!world.inBounds(x, y)) return;
  const i = world.idx(x, y);
  const b = world.biome[i] as Biome;
  const water = b === Biome.Water || b === Biome.Shallow;
  world.biome[i] = Biome.Road;
  world.ground[i] = water ? Ground.Bridge : Ground.Path;
  world.object[i] = Obj.None;
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function groundFor(b: Biome, rng: Rng): Ground {
  switch (b) {
    case Biome.Water:
      return Ground.Water;
    case Biome.Shallow:
      return Ground.Shallow;
    case Biome.Sand:
      return Ground.Sand;
    case Biome.Meadow:
      return rng.weighted([Ground.Grass0, Ground.Grass1, Ground.Grass2], [6, 3, 1]);
    case Biome.Flowers:
      return rng.weighted([Ground.Flowers0, Ground.Flowers1, Ground.Grass0], [4, 3, 3]);
    case Biome.Forest:
      return rng.weighted([Ground.ForestFloor, Ground.Grass2], [5, 2]);
    case Biome.Hills:
      return rng.weighted([Ground.Rocky, Ground.Grass2], [4, 2]);
    case Biome.Mountain:
      return Ground.Mountain;
    case Biome.Swamp:
      return rng.weighted([Ground.Swamp, Ground.ForestFloor], [5, 1]);
    case Biome.Plot:
      return Ground.Plot;
    case Biome.Road:
      return Ground.Path;
    default:
      return Ground.Grass0;
  }
}

function placeObject(world: TileWorld, rng: Rng, x: number, y: number, b: Biome): void {
  const r = rng.next();
  const tree = (pine: boolean): boolean => {
    // Ağaç 2 kare yüksek: üst kare boş olmalı ve arsa/yol olmamalı.
    if (!world.inBounds(x, y - 1)) return false;
    const ai = world.idx(x, y - 1);
    if (world.object[ai] !== Obj.None) return false;
    const ab = world.biome[ai] as Biome;
    if (ab === Biome.Plot || ab === Biome.Road) return false;
    world.object[world.idx(x, y)] = pine ? Obj.PineTrunk : Obj.TreeTrunk;
    world.object[ai] = pine ? Obj.PineTop : Obj.TreeTop;
    return true;
  };
  const set = (o: Obj): void => {
    world.object[world.idx(x, y)] = o;
  };

  switch (b) {
    case Biome.Forest:
      if (r < 0.34) tree(rng.chance(0.3));
      else if (r < 0.39) set(Obj.Bush);
      else if (r < 0.41) set(Obj.BerryBush);
      else if (r < 0.42) set(Obj.Stump);
      else if (r < 0.43) set(Obj.Rock);
      break;
    case Biome.Meadow:
      if (r < 0.02) tree(false);
      else if (r < 0.045) set(Obj.Bush);
      else if (r < 0.055) set(Obj.BerryBush);
      else if (r < 0.09) set(Obj.Flowers);
      else if (r < 0.095) set(Obj.Rock);
      break;
    case Biome.Flowers:
      if (r < 0.22) set(Obj.Flowers);
      else if (r < 0.24) set(Obj.Bush);
      else if (r < 0.25) tree(false);
      break;
    case Biome.Hills:
      if (r < 0.13) set(Obj.Rock);
      else if (r < 0.18) tree(true);
      else if (r < 0.2) set(Obj.Bush);
      break;
    case Biome.Swamp:
      if (r < 0.24) set(Obj.Reeds);
      else if (r < 0.28) tree(false);
      else if (r < 0.3) set(Obj.Rock);
      break;
    case Biome.Sand:
      if (r < 0.02) set(Obj.Rock);
      else if (r < 0.04) set(Obj.Reeds);
      break;
    default:
      break;
  }
}

function placeDens(world: TileWorld, rng: Rng): void {
  const p = world.plot;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const minPlot = BALANCE.eggs.strayMinDistFromPlot;
  const minBetween = BALANCE.eggs.strayMinDistBetween;
  const candidates: number[] = [];
  for (let y = 4; y < world.height - 4; y++) {
    for (let x = 4; x < world.width - 4; x++) {
      const b = world.biome[world.idx(x, y)] as Biome;
      if (b !== Biome.Meadow && b !== Biome.Forest && b !== Biome.Hills && b !== Biome.Flowers) continue;
      if (world.object[world.idx(x, y)] !== Obj.None) continue;
      if (Math.hypot(x - cx, y - cy) < minPlot) continue;
      // Çevresinde yürünecek yer olsun.
      let free = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (world.object[world.idx(x + dx, y + dy)] === Obj.None) free++;
      if (free < 7) continue;
      candidates.push(world.idx(x, y));
    }
  }
  rng.shuffle(candidates);
  for (const i of candidates) {
    if (world.dens.length >= BALANCE.eggs.strayDens) break;
    const x = i % world.width;
    const y = Math.floor(i / world.width);
    if (world.dens.some((d) => Math.hypot(d.x - x, d.y - y) < minBetween)) continue;
    world.object[i] = Obj.Den;
    world.dens.push({ x, y });
  }
}

function placeNests(world: TileWorld, rng: Rng): void {
  const minDist = BALANCE.world.nestMinDistance;
  const target = BALANCE.world.nestTarget;
  const candidates: number[] = [];
  for (let y = 3; y < world.height - 3; y++) {
    for (let x = 3; x < world.width - 3; x++) {
      const i = world.idx(x, y);
      const b = world.biome[i] as Biome;
      if (b === Biome.Water || b === Biome.Shallow || b === Biome.Mountain || b === Biome.Plot || b === Biome.Road) continue;
      if (world.object[i] !== Obj.None) continue;
      if (nearPlot(world, x, y, NEST_PLOT_MARGIN)) continue;
      candidates.push(i);
    }
  }
  rng.shuffle(candidates);
  const cell = minDist;
  const cols = Math.ceil(world.width / cell);
  const buckets = new Map<number, number[]>();
  const accepted: number[] = [];
  for (const i of candidates) {
    if (accepted.length >= target) break;
    const x = i % world.width;
    const y = Math.floor(i / world.width);
    const bx = Math.floor(x / cell);
    const by = Math.floor(y / cell);
    let ok = true;
    for (let oy = -1; oy <= 1 && ok; oy++) {
      for (let ox = -1; ox <= 1 && ok; ox++) {
        const list = buckets.get((by + oy) * cols + (bx + ox));
        if (!list) continue;
        for (const j of list) {
          const jx = j % world.width;
          const jy = Math.floor(j / world.width);
          const ddx = jx - x;
          const ddy = jy - y;
          if (ddx * ddx + ddy * ddy < minDist * minDist) {
            ok = false;
            break;
          }
        }
      }
    }
    if (!ok) continue;
    accepted.push(i);
    const key = by * cols + bx;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
    world.object[i] = rng.chance(0.6) ? Obj.NestEggs : Obj.Nest;
    world.nests.push({ x, y });
  }
}
