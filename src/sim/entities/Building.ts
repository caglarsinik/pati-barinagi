import { BUILDING_DEFS, type BuildingDef, type BuildingType } from '../../content/buildings';
import type { TileWorld } from '../world/TileWorld';
import type { Egg, EggSave } from './Egg';

/** 0: tanımdaki gibi, 1: 90° döndürülmüş (genişlik/yükseklik takas). Ön yüz (kapı, eşik) her zaman güneyde kalır. */
export type Rotation = 0 | 1;

export interface Building {
  id: number;
  type: BuildingType;
  /** Sol üst kare. */
  x: number;
  y: number;
  /** Döndürme (yalnız kare olmayan binalarda 1 olabilir). */
  rot: Rotation;
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
  /** Yükseltme seviyesi (1 ya da 2; bkz. BuildingDef.upgrade). */
  level: number;
  /** Yuva evi: atanan çift (0-2 köpek id) ve yumurtaya kalan süre (dk). */
  pair: number[];
  breedLeft: number;
  /** Dinlenme odası: satın alınan eşyalar (0.16.3). */
  furniture: string[];
}

export interface BuildingSave {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  rot?: number;
  food?: number;
  water?: number;
  occupants?: number[];
  buildLeft?: number;
  eggs?: EggSave[];
  level?: number;
  pair?: number[];
  breedLeft?: number;
  furniture?: string[];
}

export function buildingDef(b: Building | BuildingType): BuildingDef {
  return BUILDING_DEFS[typeof b === 'string' ? b : b.type];
}

export function isReady(b: Building): boolean {
  return b.buildLeft <= 0;
}

/** Yalnız kare olmayan binalar döndürülebilir. */
export function canRotate(type: BuildingType): boolean {
  const d = BUILDING_DEFS[type];
  return d.w !== d.h;
}

/** Kayıttan/komuttan gelen döndürmeyi geçerli değere indirger. */
export function normalizeRot(type: BuildingType, rot: unknown): Rotation {
  return rot === 1 && canRotate(type) ? 1 : 0;
}

/** Döndürülmüş ayak izi boyutu. */
export function buildingSize(def: BuildingDef, rot: Rotation): { w: number; h: number } {
  return rot === 1 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

/**
 * Döndürülmüş katı satır sayısı: alttaki yürünebilir eşik satırlarının sayısı korunur
 * (büyük kulübe 3×2 / 1 katı → 2×3 / 2 katı; 'all' ve 0 değişmez).
 */
export function solidRowsFor(def: BuildingDef, rot: Rotation): number | 'all' {
  if (def.solidRows === 'all' || def.solidRows <= 0) return def.solidRows;
  const { h } = buildingSize(def, rot);
  return Math.max(0, h - (def.h - def.solidRows));
}

export function buildingFootprint(b: Building): { x: number; y: number; w: number; h: number } {
  const s = buildingSize(buildingDef(b), b.rot);
  return { x: b.x, y: b.y, w: s.w, h: s.h };
}

/** Bina merkezine en yakın yürünebilir kare (kapı önü). Alt kenarın ortası tercih edilir. */
export function buildingDoorTile(b: Building): { x: number; y: number } {
  const s = buildingSize(buildingDef(b), b.rot);
  return { x: b.x + Math.floor(s.w / 2), y: b.y + s.h };
}

/** Kulübenin köpeğin yattığı eşik karesi. */
export function kennelRestTile(b: Building, slot = 0): { x: number; y: number } {
  const s = buildingSize(buildingDef(b), b.rot);
  return { x: b.x + Math.min(s.w - 1, Math.max(0, slot)), y: b.y + s.h - 1 };
}

export function isTileSolidForBuilding(def: BuildingDef, row: number, rot: Rotation = 0): boolean {
  const sr = solidRowsFor(def, rot);
  if (sr === 'all') return true;
  return row < sr;
}

/** Bina yerleştirilebilir mi: tüm kareler arsa içinde (çit satırları hariç), boş ve nesnesiz. */
export function canPlaceBuilding(world: TileWorld, type: BuildingType, x: number, y: number, rot: Rotation = 0): boolean {
  const s = buildingSize(BUILDING_DEFS[type], rot);
  for (let yy = y; yy < y + s.h; yy++) {
    for (let xx = x; xx < x + s.w; xx++) {
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
  const s = buildingSize(d, b.rot);
  for (let row = 0; row < s.h; row++) {
    for (let col = 0; col < s.w; col++) {
      const xx = b.x + col;
      const yy = b.y + row;
      if (!world.inBounds(xx, yy)) continue;
      const i = world.idx(xx, yy);
      world.buildingIndex[i] = b.id;
      world.buildingSolid[i] = isTileSolidForBuilding(d, row, b.rot) ? 1 : 0;
      world.recomputeSolid(i);
      world.dirty.push(i);
    }
  }
}

export function unstampBuilding(world: TileWorld, b: Building): void {
  const s = buildingSize(buildingDef(b), b.rot);
  for (let row = 0; row < s.h; row++) {
    for (let col = 0; col < s.w; col++) {
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
