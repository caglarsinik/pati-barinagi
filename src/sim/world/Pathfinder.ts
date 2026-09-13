import type { Rect, TilePos, TileWorld } from './TileWorld';
import { Obj } from './tiles';

/** İkili yığın (min-heap) açık liste. */
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.vals[0];
    const lastK = this.keys.pop()!;
    const lastV = this.vals.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastK;
      this.vals[0] = lastV;
      let i = 0;
      const n = this.keys.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.keys[l] < this.keys[m]) m = l;
        if (r < n && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const k = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = k;
    const v = this.vals[a];
    this.vals[a] = this.vals[b];
    this.vals[b] = v;
  }
}

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export interface PathOptions {
  /** Arama bu dikdörtgenin dışına çıkmaz (varsayılan: tüm harita). */
  region?: Rect;
  /** Bu kadar düğümden sonra vazgeç. */
  maxNodes?: number;
  /** Hedef kare geçilmez olsa da (kap gibi) yanına gelmek yeterli. */
  adjacentOk?: boolean;
  /** Kapalı çit kapısı geçilebilir sayılır (kapı izinli aktöre kendiliğinden açılır). */
  throughGates?: boolean;
}

/**
 * A* yol bulma, 8 yön, köşe kesme yok. Sonuç başlangıcı içermez, hedefle biter.
 * Yol yoksa null.
 */
export function findPath(world: TileWorld, from: TilePos, to: TilePos, opts: PathOptions = {}): TilePos[] | null {
  const region = opts.region ?? { x: 0, y: 0, w: world.width, h: world.height };
  const maxNodes = opts.maxNodes ?? 20000;
  const inRegion = (x: number, y: number): boolean =>
    x >= region.x && y >= region.y && x < region.x + region.w && y < region.y + region.h;
  if (!inRegion(from.x, from.y) || !inRegion(to.x, to.y)) return null;
  const blocked = (x: number, y: number): boolean =>
    world.isSolid(x, y) && !(opts.throughGates === true && world.objectAt(x, y) === Obj.Gate);
  const goalSolid = blocked(to.x, to.y);
  if (goalSolid && !opts.adjacentOk) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const W = world.width;
  const start = from.y * W + from.x;
  const goal = to.y * W + to.x;
  const g = new Map<number, number>();
  const parent = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();
  g.set(start, 0);
  open.push(heuristic(from.x, from.y, to.x, to.y), start);
  let expanded = 0;

  const isGoal = (x: number, y: number): boolean => {
    if (x === to.x && y === to.y) return true;
    return goalSolid && opts.adjacentOk === true && Math.abs(x - to.x) <= 1 && Math.abs(y - to.y) <= 1;
  };

  while (open.size > 0) {
    const cur = open.pop();
    if (closed.has(cur)) continue;
    const cx = cur % W;
    const cy = Math.floor(cur / W);
    if (isGoal(cx, cy)) {
      const path: TilePos[] = [];
      let n = cur;
      while (n !== start) {
        path.push({ x: n % W, y: Math.floor(n / W) });
        n = parent.get(n)!;
      }
      path.reverse();
      return path;
    }
    closed.add(cur);
    if (++expanded > maxNodes) return null;
    const gc = g.get(cur)!;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inRegion(nx, ny)) continue;
      const solid = blocked(nx, ny);
      if (solid && !(goalSolid && nx === to.x && ny === to.y && opts.adjacentOk)) continue;
      if (solid) continue; // hedef geçilmezse ona basmayız, yanında dururuz
      // Köşe kesme yok: çapraz adımda iki dik komşu da açık olmalı.
      if (dx !== 0 && dy !== 0 && (blocked(cx + dx, cy) || blocked(cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed.has(ni)) continue;
      const ng = gc + cost;
      const old = g.get(ni);
      if (old !== undefined && old <= ng) continue;
      g.set(ni, ng);
      parent.set(ni, cur);
      open.push(ng + heuristic(nx, ny, to.x, to.y), ni);
    }
  }
  void goal;
  return null;
}

function heuristic(x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.abs(x0 - x1);
  const dy = Math.abs(y0 - y1);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}
