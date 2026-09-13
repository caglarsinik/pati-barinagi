import { BUILDING_DEFS, type BuildingDef, type BuildingType } from '../../content/buildings';
import type { TileWorld } from '../world/TileWorld';
import type { Egg, EggSave } from './Egg';

export interface Building {
  id: number;
  type: BuildingType;
  /** Sol üst kare. */
  x: number;
  y: number;
  /** Kap: porsiyon. */
  food: number;
  /** Yalak: su (0-troughCapacity). */
  water: number;
  /** Kulübe: barınan köpek id'leri. */
  occupants: number[];
  /** Kalan inşaat süresi (oyun dakikası); 0 ise hazır. */
  buildLeft: number;
  /** Kuluçka: içindeki yumurtalar. */
  eggs: Egg[];
}

export interface BuildingSave {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  food?: number;
  water?: number;
  occupants?: number[];
  buildLeft?: number;
  eggs?: EggSave[];
}

export function buildingDef(b: Building | BuildingType): BuildingDef {
  return BUILDING_DEFS[typeof b === 'string' ? b : b.type];
}

export function isReady(b: Building): boolean {
  return b.buildLeft <= 0;
}

export function buildingFootprint(b: Building): { x: number; y: number; w: number; h: number } {
  const d = buildingDef(b);
  return { x: b.x, y: b.y, w: d.w, h: d.h };
}

/** Bina merkezine en yakın yürünebilir kare (kapı önü). Alt kenarın ortası tercih edilir. */
export function buildingDoorTile(b: Building): { x: number; y: number } {
  const d = buildingDef(b);
  return { x: b.x + Math.floor(d.w / 2), y: b.y + d.h };
}

/** Kulübenin köpeğin yattığı eşik karesi. */
export function kennelRestTile(b: Building, slot = 0): { x: number; y: number } {
  const d = buildingDef(b);
  return { x: b.x + Math.min(d.w - 1, Math.max(0, slot)), y: b.y + d.h - 1 };
}

export function isTileSolidForBuilding(def: BuildingDef, row: number): boolean {
  if (def.solidRows === 'all') return true;
  return row < def.solidRows;
}

/** Bina yerleştirilebilir mi: tüm kareler arsa içinde (çit satırları hariç), boş ve nesnesiz. */
export function canPlaceBuilding(world: TileWorld, type: BuildingType, x: number, y: number): boolean {
  const d = BUILDING_DEFS[type];
  for (let yy = y; yy < y + d.h; yy++) {
    for (let xx = x; xx < x + d.w; xx++) {
      if (!world.inPlotInterior(xx, yy)) return false;
      const i = world.idx(xx, yy);
      if (world.object[i] !== 0) return false;
      if (world.buildingIndex[i] !== -1) return false;
      if (world.solid[i] === 1) return false;
    }
  }
  return true;
}

/** Dünya katmanlarına yazar: geçilmezlik ve kare→bina eşlemesi. */
export function stampBuilding(world: TileWorld, b: Building): void {
  const d = buildingDef(b);
  for (let row = 0; row < d.h; row++) {
    for (let col = 0; col < d.w; col++) {
      const xx = b.x + col;
      const yy = b.y + row;
      if (!world.inBounds(xx, yy)) continue;
      const i = world.idx(xx, yy);
      world.buildingIndex[i] = b.id;
      world.buildingSolid[i] = isTileSolidForBuilding(d, row) ? 1 : 0;
      world.recomputeSolid(i);
      world.dirty.push(i);
    }
  }
}

export function unstampBuilding(world: TileWorld, b: Building): void {
  const d = buildingDef(b);
  for (let row = 0; row < d.h; row++) {
    for (let col = 0; col < d.w; col++) {
      const xx = b.x + col;
      const yy = b.y + row;
      if (!world.inBounds(xx, yy)) continue;
      const i = world.idx(xx, yy);
      if (world.buildingIndex[i] !== b.id) continue;
      world.buildingIndex[i] = -1;
      world.buildingSolid[i] = 0;
      world.recomputeSolid(i);
      world.dirty.push(i);
    }
  }
}
