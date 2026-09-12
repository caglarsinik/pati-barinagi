import { Biome, GROUND_SOLID, Ground, OBJ_INFO, Obj, Zone } from './tiles';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TilePos {
  x: number;
  y: number;
}

/**
 * Katmanlı kare dünyası. Sim bunun üzerinde çalışır; render sadece okur.
 * Değişen kareler `dirty` listesine yazılır, render bunları tilemap'e yansıtır.
 */
export class TileWorld {
  readonly width: number;
  readonly height: number;
  readonly ground: Uint8Array;
  readonly object: Uint8Array;
  readonly biome: Uint8Array;
  readonly solid: Uint8Array;
  readonly zone: Uint8Array;
  /** Karedeki bina id'si, yoksa -1. */
  readonly buildingIndex: Int32Array;
  /** Bina yüzünden geçilmez kareler. */
  readonly buildingSolid: Uint8Array;
  plot: Rect;
  nests: TilePos[] = [];
  spawn: { x: number; y: number } = { x: 0, y: 0 };
  dirty: number[] = [];
  /** Üretimden sonra değişen nesne kareleri (kayıt için): kare indeksi → nesne. */
  objectChanges = new Map<number, number>();
  private zoneCache = new Map<Zone, TilePos[]>();

  constructor(width: number, height: number, plot: Rect) {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.ground = new Uint8Array(n);
    this.object = new Uint8Array(n);
    this.biome = new Uint8Array(n);
    this.solid = new Uint8Array(n);
    this.zone = new Uint8Array(n);
    this.buildingIndex = new Int32Array(n).fill(-1);
    this.buildingSolid = new Uint8Array(n);
    this.plot = { ...plot };
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  groundAt(x: number, y: number): Ground {
    return this.inBounds(x, y) ? (this.ground[this.idx(x, y)] as Ground) : Ground.Mountain;
  }

  objectAt(x: number, y: number): Obj {
    return this.inBounds(x, y) ? (this.object[this.idx(x, y)] as Obj) : Obj.None;
  }

  biomeAt(x: number, y: number): Biome {
    return this.inBounds(x, y) ? (this.biome[this.idx(x, y)] as Biome) : Biome.Mountain;
  }

  zoneAt(x: number, y: number): Zone {
    return this.inBounds(x, y) ? (this.zone[this.idx(x, y)] as Zone) : Zone.None;
  }

  buildingIdAt(x: number, y: number): number {
    return this.inBounds(x, y) ? this.buildingIndex[this.idx(x, y)] : -1;
  }

  /** Harita dışı her zaman geçilmezdir. */
  isSolid(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.solid[this.idx(x, y)] === 1;
  }

  inPlot(x: number, y: number): boolean {
    const p = this.plot;
    return x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h;
  }

  /** Arsanın çit satırları hariç iç kısmı: köpekler ve personel burada dolaşır. */
  plotInterior(): Rect {
    const p = this.plot;
    return { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 };
  }

  inPlotInterior(x: number, y: number): boolean {
    const r = this.plotInterior();
    return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  }

  setGround(x: number, y: number, g: Ground): void {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.ground[i] = g;
    this.recomputeSolid(i);
    this.dirty.push(i);
  }

  setObject(x: number, y: number, o: Obj): void {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.object[i] = o;
    this.objectChanges.set(i, o);
    this.recomputeSolid(i);
    this.dirty.push(i);
    // Çit komşuları kenar deseni için yeniden çizilir.
    if (o === Obj.Fence || o === Obj.None || o === Obj.Gate) {
      for (const [dx, dy] of NEIGHBORS4) {
        if (this.inBounds(x + dx, y + dy) && this.object[this.idx(x + dx, y + dy)] === Obj.Fence) {
          this.dirty.push(this.idx(x + dx, y + dy));
        }
      }
    }
  }

  setBiome(x: number, y: number, b: Biome): void {
    if (!this.inBounds(x, y)) return;
    this.biome[this.idx(x, y)] = b;
  }

  setZone(x: number, y: number, z: Zone): void {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    if (this.zone[i] === z) return;
    this.zone[i] = z;
    this.zoneCache.clear();
    this.dirty.push(i);
  }

  /** Bölgeye ait tüm kareler (önbellekli). */
  zoneTiles(z: Zone): TilePos[] {
    const cached = this.zoneCache.get(z);
    if (cached) return cached;
    const out: TilePos[] = [];
    for (let i = 0; i < this.zone.length; i++) {
      if (this.zone[i] === z) out.push({ x: i % this.width, y: Math.floor(i / this.width) });
    }
    this.zoneCache.set(z, out);
    return out;
  }

  /** Çit komşu maskesi: L=1, R=2, U=4, D=8 (kapı da çit sayılır). */
  fenceMask(x: number, y: number): number {
    const isF = (xx: number, yy: number): boolean => {
      const o = this.objectAt(xx, yy);
      return o === Obj.Fence || o === Obj.Gate;
    };
    return (isF(x - 1, y) ? 1 : 0) | (isF(x + 1, y) ? 2 : 0) | (isF(x, y - 1) ? 4 : 0) | (isF(x, y + 1) ? 8 : 0);
  }

  recomputeSolid(i: number): void {
    const g = this.ground[i];
    const o = this.object[i];
    this.solid[i] = GROUND_SOLID[g] || OBJ_INFO[o]?.solid || this.buildingSolid[i] === 1 ? 1 : 0;
  }

  recomputeAllSolid(): void {
    for (let i = 0; i < this.solid.length; i++) this.recomputeSolid(i);
  }

  /** Render, kirli kareleri işledikten sonra çağırır. */
  takeDirty(): number[] {
    const d = this.dirty;
    this.dirty = [];
    return d;
  }
}

export const NEIGHBORS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const NEIGHBORS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
