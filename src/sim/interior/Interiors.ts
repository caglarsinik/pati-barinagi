import { BALANCE } from '../../config/balance';
import type { BuildingType } from '../../content/buildings';
import { TileWorld, type TilePos } from '../world/TileWorld';
import { Ground } from '../world/tiles';

/** Girilebilen binaların iç mekân türü (M15; diğer binalar sonra eklenir). */
export type InteriorKind = 'office' | 'restRoom' | 'pantry';

/** İç mekân eşyası: kare dikdörtgeni katıdır, önünde E ile kullanılır. */
export type InteriorItemType = 'desk' | 'board' | 'window' | 'bookshelf' | 'coffee' | 'phone' | 'bed' | 'plant' | 'restBoard' | 'sofa' | 'tv' | 'fridge' | 'sacks' | 'ledger' | 'orderBoard';

/** İç mekâna satın alınan eşyalar (0.16.3 dinlenme odası). Fiyat ve üst sınır BALANCE.interior.furniture. */
export type FurnitureType = 'sofa' | 'coffee' | 'tv' | 'fridge';
export const FURNITURE_TYPES: readonly FurnitureType[] = ['sofa', 'coffee', 'tv', 'fridge'];
export const FURNITURE_NAMES_TR: Record<FurnitureType, string> = { sofa: 'Kanepe', coffee: 'Kahve köşesi', tv: 'TV', fridge: 'Buzdolabı' };
export const FURNITURE_DESC_TR: Record<FurnitureType, string> = {
  sofa: 'İki kişi oturur; oturanın mola dinlenmesi +%25.',
  coffee: 'Molada moral saatte +2. Sen de günde bir kahve içebilirsin.',
  tv: 'Molada moral saatte +1.',
  fridge: 'Personel moladan enerjisi tam dolunca döner.',
};

/** Oda türü başına satın alınabilen eşyalar (0.17.0 ortak katalog; mutfak, veteriner, kuluçka sonraki sürümlerde). */
export const FURNITURE_BY_KIND: Record<InteriorKind, readonly FurnitureType[]> = {
  office: [],
  restRoom: ['sofa', 'coffee', 'tv', 'fridge'],
  pantry: [],
};

/** Kayıttan gelen eşya listesini temizler: odanın kataloğundaki türler, her türden en çok üst sınır kadar. */
export function sanitizeFurniture(kind: InteriorKind, list: unknown): FurnitureType[] {
  if (!Array.isArray(list)) return [];
  const allowed = FURNITURE_BY_KIND[kind];
  const out: FurnitureType[] = [];
  for (const f of list) {
    if (!allowed.includes(f as FurnitureType)) continue;
    const type = f as FurnitureType;
    if (out.filter((x) => x === type).length < BALANCE.interior.furniture[type].max) out.push(type);
  }
  return out;
}

/** Kiler rafı başına çuval (0.17.0). */
export const SACKS_PER_SHELF = 3;

/** Kiler rafındaki çuval sayısı: stok çuvala yuvarlanır (porsiyon varsa en az 1), raflar soldan dolar, en çok 3 raf × 3. */
export function sacksOnShelf(foodStock: number, shelf: number): number {
  const total = Math.min(SACKS_PER_SHELF * 3, Math.ceil(Math.max(0, foodStock) / BALANCE.economy.foodBagPortions));
  return Math.max(0, Math.min(SACKS_PER_SHELF, total - shelf * SACKS_PER_SHELF));
}

export interface InteriorItem {
  type: InteriorItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Satın alınan eşya: yalnız binada o türden `slot`tan fazla varsa odada bulunur. */
  buy?: FurnitureType;
  slot?: number;
}

interface InteriorTemplate {
  /** Metin ızgara: `#` duvar üstü, `=` duvar yüzü, `.` döşeme, `c` halı, `D` kapı (tek). */
  rows: string[];
  items: InteriorItem[];
}

const TEMPLATES: Record<InteriorKind, InteriorTemplate> = {
  office: {
    rows: [
      '############',
      '#==========#',
      '#..........#',
      '#..........#',
      '#...cccc...#',
      '#...cccc...#',
      '#..........#',
      '#####D######',
    ],
    // 0.16.1 ofis eşyaları. Pano ve pencere duvarda (duvar yüzü satırı), diğerleri döşemede.
    items: [
      { type: 'desk', x: 2, y: 2, w: 2, h: 1 },
      { type: 'coffee', x: 1, y: 2, w: 1, h: 1 },
      { type: 'board', x: 5, y: 1, w: 2, h: 1 },
      { type: 'window', x: 7, y: 1, w: 1, h: 1 },
      { type: 'bookshelf', x: 9, y: 2, w: 2, h: 1 },
      { type: 'bed', x: 10, y: 4, w: 1, h: 2 },
      { type: 'plant', x: 10, y: 6, w: 1, h: 1 },
      { type: 'phone', x: 1, y: 5, w: 1, h: 1 },
    ],
  },
  // 0.16.3 dinlenme odası: pano hep var; TV, kahve köşesi, buzdolabı ve iki kanepe satın alınınca sabit yuvalarında.
  restRoom: {
    rows: [
      '##########',
      '#========#',
      '#........#',
      '#........#',
      '#.cccccc.#',
      '#.cccccc.#',
      '####D#####',
    ],
    items: [
      { type: 'restBoard', x: 1, y: 1, w: 2, h: 1 },
      { type: 'tv', x: 3, y: 2, w: 2, h: 1, buy: 'tv' },
      { type: 'coffee', x: 6, y: 2, w: 1, h: 1, buy: 'coffee' },
      { type: 'fridge', x: 8, y: 2, w: 1, h: 1, buy: 'fridge' },
      { type: 'sofa', x: 2, y: 4, w: 2, h: 1, buy: 'sofa', slot: 0 },
      { type: 'sofa', x: 6, y: 4, w: 2, h: 1, buy: 'sofa', slot: 1 },
    ],
  },
  // 0.17.0 kiler: üç çuval rafı (slot = raf sırası; stoğa göre dolar), sipariş defteri, otomatik sipariş panosu.
  pantry: {
    rows: ['########', '#======#', '#......#', '#......#', '#......#', '###D####'],
    items: [
      { type: 'sacks', x: 1, y: 2, w: 2, h: 1, slot: 0 },
      { type: 'sacks', x: 3, y: 2, w: 2, h: 1, slot: 1 },
      { type: 'sacks', x: 5, y: 2, w: 2, h: 1, slot: 2 },
      { type: 'ledger', x: 1, y: 4, w: 1, h: 1 },
      { type: 'orderBoard', x: 6, y: 4, w: 1, h: 1 },
    ],
  },
};

/** Kurulmuş iç oda: ayrı küçük dünya (duvarlar katı), kapı karesi ve giriş noktası. */
export interface InteriorMap {
  kind: InteriorKind;
  world: TileWorld;
  /** Basınca dışarı çıkılan kapı karesi (alt duvarda). */
  door: TilePos;
  /** Girişte oyuncunun ayak noktası (kapının bir üstü). */
  spawn: { x: number; y: number };
  items: InteriorItem[];
}

const GROUND_OF: Record<string, Ground> = {
  '#': Ground.Wall,
  '=': Ground.WallFace,
  '.': Ground.Floor,
  c: Ground.Carpet,
  D: Ground.Doorway,
};

/** Binanın iç mekânı varsa türü. */
export function interiorKindFor(type: BuildingType): InteriorKind | null {
  return type === 'office' ? 'office' : type === 'staffRoom' ? 'restRoom' : type === 'shed' ? 'pantry' : null;
}

export function buildInterior(kind: InteriorKind, owned: readonly string[] = []): InteriorMap {
  const tpl = TEMPLATES[kind];
  const h = tpl.rows.length;
  const w = tpl.rows[0].length;
  const world = new TileWorld(w, h, { x: 0, y: 0, w, h });
  let door: TilePos = { x: Math.floor(w / 2), y: h - 1 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = tpl.rows[y][x] ?? '#';
      world.ground[world.idx(x, y)] = GROUND_OF[ch] ?? Ground.Floor;
      if (ch === 'D') door = { x, y };
    }
  }
  const items = tpl.items.filter((it) => !it.buy || owned.filter((o) => o === it.buy).length > (it.slot ?? 0)).map((it) => ({ ...it }));
  for (const it of items) {
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) world.buildingSolid[world.idx(x, y)] = 1;
  }
  world.recomputeAllSolid();
  world.explored.fill(1);
  const spawn = { x: door.x + 0.5, y: door.y - 1 + 0.7 };
  world.spawn = { ...spawn };
  return { kind, world, door, spawn, items };
}

/** Karedeki eşya. */
export function interiorItemAt(map: InteriorMap, x: number, y: number): InteriorItem | null {
  return map.items.find((it) => x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h) ?? null;
}

/** Oyuncunun içinde olduğu oda: hangi binanın, çıkınca dönülecek dış nokta (kapı önü). */
export interface ActiveInterior extends InteriorMap {
  buildingId: number;
  back: { x: number; y: number };
}
