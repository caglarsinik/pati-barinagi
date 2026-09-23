import type { BuildingType } from '../../content/buildings';
import { TileWorld, type TilePos } from '../world/TileWorld';
import { Ground } from '../world/tiles';

/** Girilebilen binaların iç mekân türü (M15; diğer binalar sonra eklenir). */
export type InteriorKind = 'office';

/** İç mekân eşyası: kare dikdörtgeni katıdır, önünde E ile kullanılır. */
export type InteriorItemType = 'desk' | 'board' | 'window' | 'bookshelf' | 'coffee' | 'phone' | 'bed' | 'plant';

export interface InteriorItem {
  type: InteriorItemType;
  x: number;
  y: number;
  w: number;
  h: number;
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
  return type === 'office' ? 'office' : null;
}

export function buildInterior(kind: InteriorKind): InteriorMap {
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
  const items = tpl.items.map((it) => ({ ...it }));
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
