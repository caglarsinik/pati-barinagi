import { Rng, hash2 } from '../core/Rng';
import {
  FENCE_TILE_BASE,
  DEN_TILE,
  GATE_TILE,
  Ground,
  MESS_TILE,
  Obj,
  TILESET_COLUMNS,
  TILESET_ROWS,
  ZONE_COLORS,
  ZONE_TILE_BASE,
  Zone,
  objTileIndex,
} from '../sim/world/tiles';
import { Pixels, type RGBA, hex } from './Pixels';
import { P } from './palette';

export const TILE = 16;

/**
 * Tüm zemin ve nesne karelerini tek bir tileset görseline çizer.
 * frame=1 sadece su karelerinde farklıdır; tileset görseli değiştirilerek tüm su birlikte kıpırdar.
 */
export function buildTileset(frame: 0 | 1): Pixels {
  const sheet = new Pixels(TILESET_COLUMNS * TILE, TILESET_ROWS * TILE);
  for (let g = 0; g < Ground.COUNT; g++) {
    sheet.blit(drawGround(g as Ground, frame), (g % TILESET_COLUMNS) * TILE, Math.floor(g / TILESET_COLUMNS) * TILE);
  }
  const objs = drawObjects();
  const put = (id: number, tile: Pixels): void => {
    sheet.blit(tile, (id % TILESET_COLUMNS) * TILE, Math.floor(id / TILESET_COLUMNS) * TILE);
  };
  for (let o = 1; o < Obj.COUNT; o++) {
    if (o === Obj.Fence || o === Obj.Gate || o === Obj.Mess) continue;
    put(objTileIndex(o as Obj), objs[o]);
  }
  for (let mask = 0; mask < 16; mask++) put(FENCE_TILE_BASE + mask, drawFence(mask));
  put(GATE_TILE, drawGate());
  put(MESS_TILE, drawMess());
  put(DEN_TILE, drawDen());
  for (let z = 1; z < Zone.COUNT; z++) put(ZONE_TILE_BASE + z, drawZoneOverlay(ZONE_COLORS[z] ?? 0xffffff));
  return sheet;
}

/** Çit: L=1, R=2, U=4, D=8 komşu maskesine göre direk + tahtalar. */
export function drawFence(mask: number): Pixels {
  const p = new Pixels(TILE, TILE);
  const L = mask & 1;
  const R = mask & 2;
  const U = mask & 4;
  const D = mask & 8;
  const post = P.trunk;
  const postDark = P.trunkDark;
  const rail = P.trunkLight;
  // Yatay tahtalar (iki sıra)
  if (L) {
    p.fillRect(0, 6, 8, 2, rail);
    p.fillRect(0, 11, 8, 2, rail);
  }
  if (R) {
    p.fillRect(8, 6, 8, 2, rail);
    p.fillRect(8, 11, 8, 2, rail);
  }
  // Dikey tahtalar
  if (U) p.fillRect(6, 0, 3, 8, rail);
  if (D) p.fillRect(6, 8, 3, 8, rail);
  // Direk
  p.fillRect(5, 3, 5, 12, post);
  p.fillRect(8, 3, 2, 12, postDark);
  p.fillRect(5, 2, 5, 1, P.trunkLight);
  p.outline(P.outline);
  return p;
}

export function drawGate(): Pixels {
  const p = new Pixels(TILE, TILE);
  p.fillRect(1, 2, 3, 12, P.trunk);
  p.fillRect(12, 2, 3, 12, P.trunk);
  p.fillRect(3, 5, 10, 1, P.trunkLight);
  p.fillRect(3, 10, 10, 1, P.trunkLight);
  p.fillRect(1, 1, 3, 1, P.trunkLight);
  p.fillRect(12, 1, 3, 1, P.trunkLight);
  p.outline(P.outline);
  return p;
}

/** Sokak köpeği ini: toprak tümsek, karanlık giriş ve saman. */
export function drawDen(): Pixels {
  const p = new Pixels(TILE, TILE);
  p.ellipse(8, 10, 7, 4.5, P.dirt);
  p.ellipse(8, 9, 6, 3.5, P.dirtDark);
  p.ellipse(8, 10.5, 3.5, 2.5, P.outline);
  p.ellipse(8, 10, 2.5, 1.5, hex(0x0d0b16));
  p.set(3, 12, P.twigLight);
  p.set(12, 12, P.twigLight);
  p.set(5, 13, P.twig);
  p.set(11, 13, P.twig);
  p.outline(P.outline);
  return p;
}

export function drawMess(): Pixels {
  const p = new Pixels(TILE, TILE);
  p.ellipse(8, 11, 4, 2.2, P.trunkDark);
  p.ellipse(7, 9.5, 2.5, 1.8, P.trunk);
  p.ellipse(8, 8, 1.5, 1.2, P.trunkDark);
  p.set(9, 5, P.mountainLight);
  p.set(6, 4, P.mountainLight);
  p.outline(P.outline);
  return p;
}

function drawZoneOverlay(color: number): Pixels {
  const p = new Pixels(TILE, TILE);
  const c: RGBA = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 110];
  const edge: RGBA = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 200];
  p.fill(c);
  p.fillRect(0, 0, TILE, 1, edge);
  p.fillRect(0, TILE - 1, TILE, 1, edge);
  p.fillRect(0, 0, 1, TILE, edge);
  p.fillRect(TILE - 1, 0, 1, TILE, edge);
  return p;
}

function tileRng(id: number, salt = 0): Rng {
  return new Rng(hash2(id * 31 + 7, salt + 99));
}

function speckle(p: Pixels, rng: Rng, n: number, colors: RGBA[]): void {
  for (let i = 0; i < n; i++) p.set(rng.int(0, TILE - 1), rng.int(0, TILE - 1), rng.pick(colors));
}

function blades(p: Pixels, rng: Rng, n: number, c: RGBA): void {
  for (let i = 0; i < n; i++) {
    const x = rng.int(0, TILE - 1);
    const y = rng.int(1, TILE - 1);
    p.set(x, y, c);
    p.set(x, y - 1, c);
  }
}

function plusFlower(p: Pixels, x: number, y: number, petal: RGBA, center: RGBA): void {
  p.set(x, y, center);
  p.set(x - 1, y, petal);
  p.set(x + 1, y, petal);
  p.set(x, y - 1, petal);
  p.set(x, y + 1, petal);
}

export function drawGround(g: Ground, frame: 0 | 1): Pixels {
  const p = new Pixels(TILE, TILE);
  const rng = tileRng(g);
  switch (g) {
    case Ground.Grass0:
      p.fill(P.grass);
      speckle(p, rng, 6, [P.grassDark, P.grassLight]);
      blades(p, rng, 2, P.grassDark);
      break;
    case Ground.Grass1:
      p.fill(P.grass);
      speckle(p, rng, 5, [P.grassDark, P.grassLight]);
      blades(p, rng, 3, P.grassLight);
      break;
    case Ground.Grass2:
      p.fill(P.grassDark);
      speckle(p, rng, 6, [P.grass, P.forestDark]);
      blades(p, rng, 2, P.grass);
      break;
    case Ground.Flowers0:
      p.fill(P.grass);
      speckle(p, rng, 4, [P.grassDark, P.grassLight]);
      plusFlower(p, 4, 5, P.flowerPink, P.flowerYellow);
      plusFlower(p, 11, 10, P.flowerWhite, P.flowerYellow);
      break;
    case Ground.Flowers1:
      p.fill(P.grass);
      speckle(p, rng, 4, [P.grassDark, P.grassLight]);
      plusFlower(p, 10, 4, P.flowerYellow, P.flowerRed);
      plusFlower(p, 4, 11, P.flowerBlue, P.flowerWhite);
      break;
    case Ground.ForestFloor:
      p.fill(P.forestFloor);
      speckle(p, rng, 7, [P.forestDark, P.forestLeaf]);
      blades(p, rng, 2, P.forestDark);
      break;
    case Ground.Sand:
      p.fill(P.sand);
      speckle(p, rng, 6, [P.sandDark, P.sandLight]);
      break;
    case Ground.Shallow: {
      p.fill(P.shallow);
      const off = frame === 0 ? 0 : 2;
      for (let i = 0; i < 3; i++) {
        const x = (rng.int(0, TILE - 1) + off) % TILE;
        const y = rng.int(0, TILE - 1);
        p.set(x, y, P.shallowLight);
        p.set((x + 1) % TILE, y, P.shallowLight);
        p.set((x + 2) % TILE, y, P.shallowLight);
      }
      speckle(p, rng, 3, [P.water]);
      break;
    }
    case Ground.Water: {
      p.fill(P.water);
      const off = frame === 0 ? 0 : 3;
      for (let i = 0; i < 4; i++) {
        const x = (rng.int(0, TILE - 1) + off) % TILE;
        const y = rng.int(0, TILE - 1);
        p.set(x, y, P.waterLight);
        p.set((x + 1) % TILE, y, P.waterLight);
        if (i % 2 === 0) p.set((x + 2) % TILE, y, P.foam);
      }
      speckle(p, rng, 4, [P.waterDark]);
      break;
    }
    case Ground.Rocky:
      p.fill(P.rocky);
      speckle(p, rng, 6, [P.rockyDark, P.rockyLight]);
      for (let i = 0; i < 2; i++) {
        const x = rng.int(1, TILE - 3);
        const y = rng.int(1, TILE - 3);
        p.fillRect(x, y, 2, 2, P.rock);
        p.set(x + 1, y + 1, P.rockDark);
      }
      break;
    case Ground.Mountain:
      p.fill(P.mountain);
      speckle(p, rng, 6, [P.mountainDark, P.mountainLight]);
      for (let i = 0; i < 2; i++) {
        const x = rng.int(0, TILE - 1);
        const y = rng.int(0, TILE - 1);
        p.line(x, y, x + rng.int(-4, 4), y + rng.int(2, 6), P.mountainDark);
      }
      p.line(rng.int(0, 6), rng.int(0, 6), rng.int(8, 15), rng.int(0, 4), P.mountainLight);
      break;
    case Ground.Swamp:
      p.fill(P.swamp);
      speckle(p, rng, 5, [P.swampDark, P.grassDark]);
      p.ellipse(rng.int(3, 12), rng.int(3, 12), rng.float(2, 3.5), rng.float(1.5, 2.5), P.swampWater);
      break;
    case Ground.Path:
      p.fill(P.path);
      speckle(p, rng, 7, [P.pathDark, P.pathLight]);
      break;
    case Ground.Bridge:
      p.fill(P.plank);
      for (let y = 3; y < TILE; y += 4) p.fillRect(0, y, TILE, 1, P.plankDark);
      p.fillRect(rng.int(2, 6), 0, 1, TILE, P.plankDark);
      p.fillRect(rng.int(9, 13), 0, 1, TILE, P.plankDark);
      break;
    case Ground.Plot:
      p.fill(P.plot);
      p.fillRect(0, 4, TILE, 4, P.plotStripe);
      p.fillRect(0, 12, TILE, 4, P.plotStripe);
      speckle(p, rng, 4, [P.plotDark, P.grassLight]);
      break;
    case Ground.Dirt:
      p.fill(P.dirt);
      speckle(p, rng, 6, [P.dirtDark, P.path]);
      break;
    default:
      p.fill(P.grass);
  }
  return p;
}

/** Nesne kareleri: dizin Obj değeriyle aynı, [0] boş. */
export function drawObjects(): Pixels[] {
  const out: Pixels[] = [];
  for (let i = 0; i < Obj.COUNT; i++) out.push(new Pixels(TILE, TILE));

  // Yaprak ağacı 16x32, üst/alt olarak ikiye bölünür.
  const tree = new Pixels(TILE, TILE * 2);
  tree.fillRect(6, 21, 4, 10, P.trunk);
  tree.fillRect(9, 21, 1, 10, P.trunkDark);
  tree.ellipse(8, 12, 7, 9.5, P.leaf);
  tree.ellipse(6, 15, 4.5, 5, P.leafDark);
  tree.ellipse(10, 8, 3.2, 3, P.leafLight);
  tree.set(5, 5, P.leafLight);
  tree.set(12, 17, P.leafDark);
  tree.outline(P.outline);
  out[Obj.TreeTop] = tree.crop(0, 0, TILE, TILE);
  out[Obj.TreeTrunk] = tree.crop(0, TILE, TILE, TILE);

  // Çam 16x32
  const pine = new Pixels(TILE, TILE * 2);
  pine.fillRect(7, 24, 3, 7, P.trunk);
  pine.set(9, 24, P.trunkDark);
  const layers: Array<[number, number, number]> = [
    [2, 8, 3],
    [8, 14, 5],
    [14, 21, 7],
    [20, 26, 7],
  ];
  for (const [y0, y1, halfW] of layers) {
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const w = Math.max(1, Math.round(1 + halfW * t));
      pine.fillRect(8 - w, y, w * 2, 1, P.pine);
      pine.set(8 - w, y, P.pineDark);
      pine.set(8 + w - 1, y, P.pineLight);
    }
  }
  pine.set(8, 1, P.pineLight);
  pine.outline(P.outline);
  out[Obj.PineTop] = pine.crop(0, 0, TILE, TILE);
  out[Obj.PineTrunk] = pine.crop(0, TILE, TILE, TILE);

  // Çalı
  const bush = out[Obj.Bush];
  bush.ellipse(8, 10.5, 6.5, 4.5, P.leaf);
  bush.ellipse(6, 12, 3.5, 2.5, P.leafDark);
  bush.ellipse(10, 8.5, 2.5, 1.8, P.leafLight);
  bush.outline(P.outline);

  const berry = out[Obj.BerryBush];
  berry.blit(bush, 0, 0);
  for (const [x, y] of [
    [5, 9],
    [9, 11],
    [11, 8],
    [7, 12],
  ]) {
    berry.set(x, y, P.berry);
  }

  // Kaya
  const rock = out[Obj.Rock];
  rock.ellipse(8, 10.5, 5.5, 4, P.rock);
  rock.ellipse(8, 12, 5, 2.5, P.rockDark);
  rock.ellipse(6.5, 8.5, 2, 1.5, P.rockLight);
  rock.outline(P.outline);

  // Çiçek demeti
  const fl = out[Obj.Flowers];
  fl.fillRect(4, 10, 1, 4, P.grassDark);
  fl.fillRect(8, 9, 1, 5, P.grassDark);
  fl.fillRect(12, 11, 1, 3, P.grassDark);
  plusFlower(fl, 4, 8, P.flowerPink, P.flowerYellow);
  plusFlower(fl, 8, 7, P.flowerWhite, P.flowerYellow);
  plusFlower(fl, 12, 9, P.flowerRed, P.flowerYellow);

  // Sazlık
  const reeds = out[Obj.Reeds];
  const rr = tileRng(Obj.Reeds);
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 3 + rr.int(0, 1);
    const hgt = rr.int(6, 11);
    reeds.fillRect(x, TILE - hgt, 1, hgt, P.reed);
    reeds.fillRect(x, TILE - hgt - 2, 1, 2, P.reedTuft);
  }

  // Kütük
  const stump = out[Obj.Stump];
  stump.ellipse(8, 12, 5, 2.8, P.trunkDark);
  stump.fillRect(3, 8, 10, 4, P.trunk);
  stump.ellipse(8, 8, 5, 2.8, P.trunkLight);
  stump.ellipse(8, 8, 3, 1.6, P.trunk);
  stump.ellipse(8, 8, 1.2, 0.8, P.trunkLight);
  stump.outline(P.outline);

  // Yuva
  const nest = out[Obj.Nest];
  nest.ellipse(8, 10.5, 6.5, 4, P.twig);
  nest.ellipse(8, 11, 4.5, 2.5, P.twigDark);
  const nr = tileRng(Obj.Nest);
  for (let i = 0; i < 8; i++) {
    const a = nr.float(0, Math.PI * 2);
    nest.set(Math.round(8 + Math.cos(a) * 5.5), Math.round(10.5 + Math.sin(a) * 3.2), nr.pick([P.twigLight, P.twigDark]));
  }
  nest.outline(P.outline);

  const nestEggs = out[Obj.NestEggs];
  nestEggs.blit(nest, 0, 0);
  nestEggs.ellipse(6, 10, 1.9, 2.4, P.eggBlue);
  nestEggs.ellipse(10, 10.5, 1.9, 2.4, P.eggPink);
  nestEggs.set(6, 9, P.eggSpot);
  nestEggs.set(10, 11, P.eggSpot);
  nestEggs.outline(P.outline);

  return out;
}
