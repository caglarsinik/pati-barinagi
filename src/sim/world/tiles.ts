/**
 * Kare (tile) tanımları. Sayılar tileset dokusundaki indekslerdir:
 * zemin 0-31, nesneler 32-47, çit varyantları 48-63, çeşitli 64-79, bölge örtüleri 80-95.
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
  // İç mekân (M15): ahşap döşeme, halı, duvar üstü ve yüzü (katı), kapı eşiği.
  Floor = 16,
  Carpet = 17,
  Wall = 18,
  WallFace = 19,
  Doorway = 20,
  COUNT = 21,
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
  Fence = 13,
  Gate = 14,
  Mess = 15,
  Den = 16,
  COUNT = 17,
}

export const OBJ_TILE_OFFSET = 32;
export const FENCE_TILE_BASE = 48;
export const GATE_TILE = 64;
export const MESS_TILE = 65;
export const DEN_TILE = 66;
export const GATE_OPEN_TILE = 67;
export const TOILET_TILE = 68;
export const ZONE_TILE_BASE = 80;
export const TILESET_COLUMNS = 16;
export const TILESET_ROWS = 6;

/** Nesnenin tileset dizini. Çit için komşu maskesi (L=1, R=2, U=4, D=8) eklenir. */
export function objTileIndex(o: Obj, fenceMask = 0): number {
  switch (o) {
    case Obj.None:
      return -1;
    case Obj.Fence:
      return FENCE_TILE_BASE + (fenceMask & 15);
    case Obj.Gate:
      return GATE_TILE;
    case Obj.Mess:
      return MESS_TILE;
    case Obj.Den:
      return DEN_TILE;
    default:
      return OBJ_TILE_OFFSET + o;
  }
}

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

export enum Zone {
  None = 0,
  Toilet = 1,
  Play = 2,
  Training = 3,
  Quarantine = 4,
  Staff = 5,
  COUNT = 6,
}

export const ZONE_NAMES_TR: Record<Zone, string> = {
  [Zone.None]: 'Yok',
  [Zone.Toilet]: 'Tuvalet alanı',
  [Zone.Play]: 'Oyun bahçesi',
  [Zone.Training]: 'Eğitim alanı',
  [Zone.Quarantine]: 'Karantina',
  [Zone.Staff]: 'Personel alanı',
  [Zone.COUNT]: '',
};

export const ZONE_COLORS: Record<number, number> = {
  [Zone.Toilet]: 0xc9a24a,
  [Zone.Play]: 0x4fb3e8,
  [Zone.Training]: 0xa66bd6,
  [Zone.Quarantine]: 0xe4514f,
  [Zone.Staff]: 0x7f8c8d,
};

/** Zemin kendisi geçilmez mi? */
export const GROUND_SOLID: Readonly<Record<number, boolean>> = {
  [Ground.Water]: true,
  [Ground.Mountain]: true,
  [Ground.Wall]: true,
  [Ground.WallFace]: true,
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
  [Obj.Fence]: { solid: true, above: false },
  // Kapı kapalıyken geçilmez; açık durumu TileWorld.gateOpen belirler (recomputeSolid).
  [Obj.Gate]: { solid: true, above: false },
  [Obj.Mess]: { solid: false, above: false },
  [Obj.Den]: { solid: false, above: false },
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
