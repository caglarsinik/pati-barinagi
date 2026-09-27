import { BALANCE } from '../../config/balance';
import type { Rect, TilePos, TileWorld } from './TileWorld';
import { Biome, GROUND_SOLID, OBJ_INFO, Obj } from './tiles';

/**
 * Terk edilmiş ev (M18, 0.23.2): eski barınakçı Nuri Usta'nın uzak ormandaki evi. Yeri tohumdan RNG'siz seçilir (üretimin
 * sonunda, köyden sonra; eski kayıtlarda da aynı yerde, kaydedilmez): 10×8 açıklığın ortasında 4×3 ev, kapı alt ortada.
 */
export interface RuinSite {
  /** Evin sol üst karesi ve boyutu. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Temizlenen açıklık (ev ortasında). */
  clearing: Rect;
}

/** İç mekânda evin kimliği (oyuncu binaları ve köy binalarıyla çakışmaz). */
export const RUIN_ID = -2000;

const CLEAR_W = 10;
const CLEAR_H = 8;
const HOUSE = { dx: 3, dy: 2, w: 4, h: 3 };

const isTrunk = (o: number): boolean => o === Obj.TreeTrunk || o === Obj.PineTrunk;
const isTop = (o: number): boolean => o === Obj.TreeTop || o === Obj.PineTop;

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** Karenin yürünebilirliği; üretim sırasında `solid` henüz hesaplanmadığından katmanlardan okunur. */
function passable(world: TileWorld, i: number): boolean {
  return !GROUND_SOLID[world.ground[i]] && !(OBJ_INFO[world.object[i]]?.solid ?? false) && world.buildingSolid[i] === 0;
}

/** `from` karesinden 4-komşu yürünerek ulaşılan kareler (`limit` kare yarıçapında; verilmezse bütün harita). */
export function reachableFrom(world: TileWorld, from: TilePos, limit = Infinity): Uint8Array {
  const W = world.width;
  const seen = new Uint8Array(W * world.height);
  if (!world.inBounds(from.x, from.y)) return seen;
  const start = world.idx(from.x, from.y);
  const queue = new Int32Array(W * world.height);
  let head = 0;
  let tail = 0;
  seen[start] = 1;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.inBounds(nx, ny) || Math.max(Math.abs(nx - from.x), Math.abs(ny - from.y)) > limit) continue;
      const j = ny * W + nx;
      if (seen[j] || !passable(world, j)) continue;
      seen[j] = 1;
      queue[tail++] = j;
    }
  }
  return seen;
}

/**
 * Evin yeri: ev merkezi arsa merkezinden `minDist`–`maxDist` kare; açıklık su, dağ, yol, köy ve arsa değil, en büyük arsa +
 * `plotPad`, köy + `villagePad`, yollar + `roadPad` dışında, yuva ve in içermez (listeler değişmez → sonraki her şey aynı);
 * açıklığın çevresinden güney yolunun başına yürünerek ulaşılır. Orman oranı eşiği sırayla gevşer. Puan: ideal uzaklığa
 * (tam kare) yakınlık, sonra orman oranı, sonra tarama sırası.
 */
export function findRuinSite(world: TileWorld): RuinSite | null {
  const R = BALANCE.ruin;
  const W = world.width;
  const H = world.height;
  const gen = BALANCE.world.plot;
  const cx = gen.x + gen.w / 2;
  const cy = gen.y + gen.h / 2;
  const bad = new Uint8Array(W * H);
  const forest = new Uint8Array(W * H);
  const mark = (x: number, y: number, r: number): void => {
    for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) bad[yy * W + xx] = 1;
  };
  const maxPlot: Rect = { x: gen.x - R.plotPad, y: gen.y - R.plotPad, w: BALANCE.world.plotMaxW + 2 * R.plotPad, h: BALANCE.world.plotMaxH + 2 * R.plotPad };
  const v = world.village;
  const village: Rect | null = v ? { x: v.x - R.villagePad, y: v.y - R.villagePad, w: v.w + 2 * R.villagePad, h: v.h + 2 * R.villagePad } : null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = world.biome[i] as Biome;
      if (b === Biome.Forest) forest[i] = 1;
      if (b === Biome.Road) mark(x, y, R.roadPad);
      if (b === Biome.Water || b === Biome.Shallow || b === Biome.Mountain || b === Biome.Village || b === Biome.Plot) bad[i] = 1;
      if (inRect(maxPlot, x, y) || (village && inRect(village, x, y))) bad[i] = 1;
    }
  }
  for (const n of world.nests) mark(n.x, n.y, 1);
  for (const d of world.dens) mark(d.x, d.y, 1);
  // Kare toplamları: pencere başına O(1).
  const sums = (a: Uint8Array): Int32Array => {
    const S = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) S[(y + 1) * (W + 1) + x + 1] = a[y * W + x] + S[y * (W + 1) + x + 1] + S[(y + 1) * (W + 1) + x] - S[y * (W + 1) + x];
    }
    return S;
  };
  const badS = sums(bad);
  const forestS = sums(forest);
  const area = (S: Int32Array, x: number, y: number, w: number, h: number): number =>
    S[(y + h) * (W + 1) + x + w] - S[y * (W + 1) + x + w] - S[(y + h) * (W + 1) + x] + S[y * (W + 1) + x];
  const reach = reachableFrom(world, { x: Math.floor(gen.x + gen.w / 2), y: gen.y + gen.h });
  const ringReached = (wx: number, wy: number): boolean => {
    for (let x = wx - 1; x <= wx + CLEAR_W; x++) if (reach[(wy - 1) * W + x] || reach[(wy + CLEAR_H) * W + x]) return true;
    for (let y = wy; y < wy + CLEAR_H; y++) if (reach[y * W + wx - 1] || reach[y * W + wx + CLEAR_W]) return true;
    return false;
  };
  for (const minForest of R.forestTiers) {
    let best: { x: number; y: number; d: number; f: number } | null = null;
    for (let wy = 3; wy + CLEAR_H <= H - 3; wy++) {
      for (let wx = 3; wx + CLEAR_W <= W - 3; wx++) {
        const d = Math.round(Math.abs(Math.hypot(wx + HOUSE.dx + HOUSE.w / 2 - cx, wy + HOUSE.dy + HOUSE.h / 2 - cy) - R.idealDist));
        if (d > Math.max(R.idealDist - R.minDist, R.maxDist - R.idealDist)) continue;
        const dist = Math.hypot(wx + HOUSE.dx + HOUSE.w / 2 - cx, wy + HOUSE.dy + HOUSE.h / 2 - cy);
        if (dist < R.minDist || dist > R.maxDist) continue;
        if (best && d > best.d) continue;
        if (area(badS, wx, wy, CLEAR_W, CLEAR_H) > 0) continue;
        const f = area(forestS, wx, wy, CLEAR_W, CLEAR_H) / (CLEAR_W * CLEAR_H);
        if (f < minForest) continue;
        if (best && d === best.d && f <= best.f) continue;
        if (!ringReached(wx, wy)) continue;
        best = { x: wx, y: wy, d, f };
      }
    }
    if (best) {
      return { x: best.x + HOUSE.dx, y: best.y + HOUSE.dy, w: HOUSE.w, h: HOUSE.h, clearing: { x: best.x, y: best.y, w: CLEAR_W, h: CLEAR_H } };
    }
  }
  return null;
}

/**
 * Açıklığı temizler ve evi katı yapar. Açıklıktaki gövdeler tepeleriyle (tepe açıklığın üstünde olsa da) kalkar; gövdesi
 * açıklığın altında kalan tepeler yürünür olduğu için kalır. Üretimde diziye doğrudan yazar (`recomputeAllSolid` sonra gelir),
 * yüklemede (`live`) `setObject` ve katılık yenilenir.
 */
function clearSite(world: TileWorld, site: RuinSite, live: boolean): void {
  const c = site.clearing;
  const clear = (x: number, y: number): void => {
    if (!world.inBounds(x, y) || world.objectAt(x, y) === Obj.None) return;
    if (live) world.setObject(x, y, Obj.None);
    else world.object[world.idx(x, y)] = Obj.None;
  };
  for (let y = c.y; y < c.y + c.h; y++) {
    for (let x = c.x; x < c.x + c.w; x++) {
      const o = world.objectAt(x, y);
      if (o === Obj.None) continue;
      if (isTop(o) && isTrunk(world.objectAt(x, y + 1)) && y + 1 >= c.y + c.h) continue;
      if (isTrunk(o) && isTop(world.objectAt(x, y - 1))) clear(x, y - 1);
      clear(x, y);
    }
  }
  for (let y = site.y; y < site.y + site.h; y++) {
    for (let x = site.x; x < site.x + site.w; x++) {
      const i = world.idx(x, y);
      world.buildingSolid[i] = 1;
      if (live) world.recomputeSolid(i);
    }
  }
}

/** Üretimin sonunda (köyden sonra): evin yerini seçip damgalar; yer yoksa ev olmaz. */
export function stampRuin(world: TileWorld): void {
  const site = findRuinSite(world);
  if (!site) return;
  world.ruin = site;
  clearSite(world, site, false);
}

/** Kayıttan yüklemede nesne değişiklikleri yeniden uygulandıktan sonra açıklığı yeniden temizler (eski kayıtta kesilen ağaç vb.). */
export function restampRuin(world: TileWorld): void {
  if (world.ruin) clearSite(world, world.ruin, true);
}

/** (x, y) evin karelerinden biri mi? */
export function ruinAt(world: TileWorld, x: number, y: number): boolean {
  const r = world.ruin;
  return !!r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** Kapı önü (alt orta karenin altı), köy binalarındaki gibi. */
export function ruinDoorTile(site: RuinSite): TilePos {
  return { x: site.x + Math.floor(site.w / 2), y: site.y + site.h };
}
