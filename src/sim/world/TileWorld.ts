import { Biome, GROUND_SOLID, Ground, OBJ_INFO, Obj } from './tiles';

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
  plot: Rect;
  nests: TilePos[] = [];
  spawn: { x: number; y: number } = { x: 0, y: 0 };
  dirty: number[] = [];

  constructor(width: number, height: number, plot: Rect) {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.ground = new Uint8Array(n);
    this.object = new Uint8Array(n);
    this.biome = new Uint8Array(n);
    this.solid = new Uint8Array(n);
    this.zone = new Uint8Array(n);
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

  /** Harita dışı her zaman geçilmezdir. */
  isSolid(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.solid[this.idx(x, y)] === 1;
  }

  inPlot(x: number, y: number): boolean {
    const p = this.plot;
    return x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h;
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
    this.recomputeSolid(i);
    this.dirty.push(i);
  }

  setBiome(x: number, y: number, b: Biome): void {
    if (!this.inBounds(x, y)) return;
    this.biome[this.idx(x, y)] = b;
  }

  recomputeSolid(i: number): void {
    const g = this.ground[i];
    const o = this.object[i];
    this.solid[i] = GROUND_SOLID[g] || OBJ_INFO[o]?.solid ? 1 : 0;
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
