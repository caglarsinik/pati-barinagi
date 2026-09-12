/**
 * Kare (tile) tanımları. Sayılar tileset dokusundaki indekslerdir:
 * zemin kareleri 0-31, nesne kareleri 32-63 aralığında.
 */
export enum Ground {
  Grass0 = 0,
  Grass1 = 1,
  Grass2 = 2,
  Flowers0 = 3,
  Flowers1 = 4,
  ForestFloor = 5,
  Sand = 6,
  Shallow = 7,
  Water = 8,
  Rocky = 9,
  Mountain = 10,
  Swamp = 11,
  Path = 12,
  Bridge = 13,
  Plot = 14,
  Dirt = 15,
  COUNT = 16,
}

export enum Obj {
  None = 0,
  TreeTrunk = 1,
  TreeTop = 2,
  PineTrunk = 3,
  PineTop = 4,
  Bush = 5,
  BerryBush = 6,
  Rock = 7,
  Flowers = 8,
  Reeds = 9,
  Stump = 10,
  Nest = 11,
  NestEggs = 12,
  COUNT = 13,
}

export const OBJ_TILE_OFFSET = 32;
export const TILESET_COLUMNS = 16;
export const TILESET_ROWS = 4;

export enum Biome {
  Water = 0,
  Shallow = 1,
  Sand = 2,
  Meadow = 3,
  Flowers = 4,
  Forest = 5,
  Hills = 6,
  Mountain = 7,
  Swamp = 8,
  Plot = 9,
  Road = 10,
}

export const BIOME_NAMES_TR: Record<Biome, string> = {
  [Biome.Water]: 'Göl',
  [Biome.Shallow]: 'Sığ su',
  [Biome.Sand]: 'Kumsal',
  [Biome.Meadow]: 'Çayır',
  [Biome.Flowers]: 'Çiçek tarlası',
  [Biome.Forest]: 'Orman',
  [Biome.Hills]: 'Tepeler',
  [Biome.Mountain]: 'Dağ',
  [Biome.Swamp]: 'Bataklık',
  [Biome.Plot]: 'Barınak',
  [Biome.Road]: 'Yol',
};

/** Zemin kendisi geçilmez mi? */
export const GROUND_SOLID: Readonly<Record<number, boolean>> = {
  [Ground.Water]: true,
  [Ground.Mountain]: true,
};

export interface ObjInfo {
  /** Üstüne basılamaz. */
  solid: boolean;
  /** Varlıkların üstünde çizilir (ağaç tepesi gibi). */
  above: boolean;
}

export const OBJ_INFO: Readonly<Record<number, ObjInfo>> = {
  [Obj.None]: { solid: false, above: false },
  [Obj.TreeTrunk]: { solid: true, above: false },
  [Obj.TreeTop]: { solid: false, above: true },
  [Obj.PineTrunk]: { solid: true, above: false },
  [Obj.PineTop]: { solid: false, above: true },
  [Obj.Bush]: { solid: true, above: false },
  [Obj.BerryBush]: { solid: true, above: false },
  [Obj.Rock]: { solid: true, above: false },
  [Obj.Flowers]: { solid: false, above: false },
  [Obj.Reeds]: { solid: false, above: false },
  [Obj.Stump]: { solid: true, above: false },
  [Obj.Nest]: { solid: false, above: false },
  [Obj.NestEggs]: { solid: false, above: false },
};

/** Mini harita ve hata ayıklama için biyom renkleri (hex). */
export const BIOME_COLORS: Record<Biome, number> = {
  [Biome.Water]: 0x2f6fb5,
  [Biome.Shallow]: 0x5da2d6,
  [Biome.Sand]: 0xd9c98a,
  [Biome.Meadow]: 0x6dbb4f,
  [Biome.Flowers]: 0x8fcc63,
  [Biome.Forest]: 0x2f7a3a,
  [Biome.Hills]: 0x8f9a72,
  [Biome.Mountain]: 0x5c5a60,
  [Biome.Swamp]: 0x4f6142,
  [Biome.Plot]: 0x9ad86e,
  [Biome.Road]: 0xb69465,
};
