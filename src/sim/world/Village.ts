import { BALANCE } from '../../config/balance';
import type { InteriorKind } from '../interior/Interiors';
import type { Rect, TilePos, TileWorld } from './TileWorld';
import { Biome, Ground, Obj } from './tiles';

/** Köy binası türleri (0.18.2). Oyuncuya ait değil; `sim.buildings` dışında, dünya üretiminde sabit yerleşir. */
export type VillageKind = 'wholesaler' | 'toyShop' | 'house' | 'fountain' | 'market' | 'postOffice' | 'bench';

export interface VillageBuilding {
  index: number;
  kind: VillageKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const VILLAGE_W = 24;
export const VILLAGE_H = 16;
/** İç mekânda köy binasının kimliği: VILLAGE_ID_BASE - index (oyuncu binalarıyla çakışmaz). */
export const VILLAGE_ID_BASE = -1000;

export const VILLAGE_NAMES_TR: Record<VillageKind, string> = {
  wholesaler: 'Yem toptancısı',
  toyShop: 'Oyuncak ve ilaç dükkânı',
  house: 'Köy evi',
  fountain: 'Köy çeşmesi',
  market: 'Pazar tezgâhı',
  postOffice: 'Postane',
  bench: 'Köy parkı',
};

/** Yol bandının köy içindeki sütunları (sol kenardan). */
const ROAD_COL = 11;

/** Köy dikdörtgenine göre (sol üst) yerleşim; yol bandı (11–12) boş kalır, meydan 4–10. satırlar. */
const LAYOUT: ReadonlyArray<Omit<VillageBuilding, 'index'>> = [
  { kind: 'wholesaler', x: 2, y: 1, w: 4, h: 3 },
  { kind: 'house', x: 6, y: 1, w: 3, h: 3 },
  { kind: 'toyShop', x: 15, y: 1, w: 4, h: 3 },
  { kind: 'house', x: 20, y: 1, w: 3, h: 3 },
  { kind: 'fountain', x: 16, y: 7, w: 2, h: 2 },
  { kind: 'house', x: 4, y: 11, w: 3, h: 3 },
  // 0.20.0: pazar tezgâhı, çeşmenin karşısında; sona eklenir ki eski indeksler değişmesin.
  { kind: 'market', x: 6, y: 7, w: 3, h: 2 },
];

function inRect(r: Rect, x: number, y: number, pad = 0): boolean {
  return x >= r.x - pad && y >= r.y - pad && x < r.x + r.w + pad && y < r.y + r.h + pad;
}

/**
 * Köyü güney yolunun harita kenarına yakın ucuna yerleştirir (üretimin sonunda, RNG kullanmadan → eski kayıtlarda da aynı
 * yerde). Alan temizlenir, yol bandı düzleşir, meydan döşenir, içindeki yuva/inler listeden çıkar, binalar katı olur.
 */
export function stampVillage(world: TileWorld): void {
  const top = world.height - 3 - VILLAGE_H;
  let roadX = -1;
  for (let x = 0; x < world.width && roadX < 0; x++) if (world.biome[world.idx(x, top)] === Biome.Road) roadX = x;
  const left = roadX - ROAD_COL;
  if (roadX < 0 || left < 2 || left + VILLAGE_W > world.width - 2) return;
  const rect: Rect = { x: left, y: top, w: VILLAGE_W, h: VILLAGE_H };
  for (let y = rect.y - 1; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = world.idx(x, y);
      if (y < rect.y) {
        // Köyün hemen üstünde, gövdesi köyde kalan ağaçların tepeleri.
        const o = world.object[i];
        if (o === Obj.TreeTop || o === Obj.PineTop) world.object[i] = Obj.None;
        continue;
      }
      const rx = x - left;
      const ry = y - top;
      const road = rx === ROAD_COL || rx === ROAD_COL + 1;
      const plaza = ry >= 4 && ry <= 10 && rx >= 1 && rx <= VILLAGE_W - 2;
      world.object[i] = Obj.None;
      world.biome[i] = road ? Biome.Road : Biome.Village;
      world.ground[i] = road || plaza ? Ground.Path : Ground.Grass0;
    }
  }
  world.nests = world.nests.filter((n) => !inRect(rect, n.x, n.y, 1));
  world.dens = world.dens.filter((d) => !inRect(rect, d.x, d.y, 1));
  world.village = rect;
  world.villageBuildings = LAYOUT.map((b, index) => ({ ...b, index, x: left + b.x, y: top + b.y }));
  for (const vb of world.villageBuildings) {
    for (let y = vb.y; y < vb.y + vb.h; y++) for (let x = vb.x; x < vb.x + vb.w; x++) world.buildingSolid[world.idx(x, y)] = 1;
  }
}

/** Kayıttan yüklemede nesne değişiklikleri yeniden uygulandıktan sonra köy alanını yeniden temizler. */
export function restampVillage(world: TileWorld): void {
  const r = world.village;
  if (!r) return;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) if (world.objectAt(x, y) !== Obj.None) world.setObject(x, y, Obj.None);
  }
  world.nests = world.nests.filter((n) => !inRect(r, n.x, n.y, 1));
  world.dens = world.dens.filter((d) => !inRect(r, d.x, d.y, 1));
}

/** Kapı önü (alt orta karenin altı), binalardaki gibi. */
export function villageDoorTile(vb: VillageBuilding): TilePos {
  return { x: vb.x + Math.floor(vb.w / 2), y: vb.y + vb.h };
}

/** Girilebilen köy binasının iç mekân türü (0.18.2 toptancı, 0.20.0 oyuncak ve ilaç dükkânı). */
export function villageInteriorKind(kind: VillageKind): InteriorKind | null {
  return kind === 'wholesaler' ? 'wholesaler' : kind === 'toyShop' ? 'toyShop' : null;
}

/** Dokununca önüne gidip iş yapılan köy yapısı: girilebilen binalar ve pazar tezgâhı. */
export function villageInteractive(kind: VillageKind): boolean {
  return villageInteriorKind(kind) !== null || kind === 'market' || kind === 'postOffice';
}

/** Köy kademeleriyle açılan yapılar (0.20.2); LAYOUT'tan sonra eklenir, eski indeksler değişmez. */
const STAGE_LAYOUT: ReadonlyArray<{ stage: number; b: Omit<VillageBuilding, 'index'> }> = [
  { stage: 2, b: { kind: 'postOffice', x: 19, y: 11, w: 4, h: 3 } },
  { stage: 3, b: { kind: 'bench', x: 15, y: 13, w: 2, h: 1 } },
];
/** Köy parkı (3. kademe): çiçekli, yürünebilir zemin; bank ortasında. */
const PARK: Rect = { x: 13, y: 12, w: 6, h: 4 };
export const VILLAGE_MAX_STAGE = 3;

/**
 * Kademeye kadar olan yapıları ve parkı damgalar (0.20.2). RNG yok; kademe atlayınca ve her yüklemede aynı sonucu verir,
 * damgalı yapıya dokunmaz. Döndürür: yeni eklenen yapılar.
 */
export function stampVillageStage(world: TileWorld, stage: number): VillageBuilding[] {
  const r = world.village;
  if (!r) return [];
  const touch = (x: number, y: number): number => {
    const i = world.idx(x, y);
    world.dirty.push(i);
    return i;
  };
  if (stage >= 3) {
    for (let y = r.y + PARK.y; y < r.y + PARK.y + PARK.h; y++) {
      for (let x = r.x + PARK.x; x < r.x + PARK.x + PARK.w; x++) {
        const i = touch(x, y);
        world.object[i] = Obj.None;
        world.ground[i] = (x + y) % 3 === 0 ? Ground.Flowers1 : Ground.Flowers0;
        world.recomputeSolid(i);
      }
    }
  }
  const added: VillageBuilding[] = [];
  for (const { stage: s, b } of STAGE_LAYOUT) {
    if (s > stage) continue;
    const x = r.x + b.x;
    const y = r.y + b.y;
    if (world.villageBuildings.some((v) => v.kind === b.kind && v.x === x && v.y === y)) continue;
    const vb: VillageBuilding = { ...b, index: world.villageBuildings.length, x, y };
    world.villageBuildings.push(vb);
    for (let ty = y; ty < y + b.h; ty++) {
      for (let tx = x; tx < x + b.w; tx++) {
        const i = touch(tx, ty);
        world.object[i] = Obj.None;
        world.buildingSolid[i] = 1;
        world.recomputeSolid(i);
      }
    }
    added.push(vb);
  }
  return added;
}

/** Parkta köylünün durduğu kare (0.20.2; bankın önünde iki sıra). */
export function parkSpot(world: TileWorld, i: number): TilePos | null {
  const r = world.village;
  return r ? { x: r.x + PARK.x + (i % 4), y: r.y + PARK.y + 2 + ((i >> 2) & 1) } : null;
}

/** Toptancıda bir çuvalın fiyatı (kilerdeki tam fiyatın indirimli hâli). */
export function wholesaleBagPrice(): number {
  return Math.round(BALANCE.economy.foodBagPrice * BALANCE.village.wholesaleMul);
}
