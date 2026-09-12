import { describe, expect, it } from 'vitest';
import { HUMAN_DIRS, HUMAN_FRAMES, HUMAN_H, HUMAN_W, PLAYER_STYLE, buildHumanSheet } from '../../src/render/HumanPainter';
import { Pixels, hex } from '../../src/render/Pixels';
import { TILE, buildTileset } from '../../src/render/TileArt';
import { Ground, OBJ_TILE_OFFSET, Obj, TILESET_COLUMNS, TILESET_ROWS } from '../../src/sim/world/tiles';

function opaqueCount(p: Pixels, x: number, y: number, w: number, h: number): number {
  let n = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (p.isOpaque(xx, yy)) n++;
  return n;
}

describe('Pixels', () => {
  it('outline sadece opak bölgenin dışına çizer', () => {
    const p = new Pixels(6, 6);
    p.fillRect(2, 2, 2, 2, hex(0xff0000));
    p.outline(hex(0x000000));
    expect(p.get(1, 2)[3]).toBe(255);
    expect(p.get(2, 2)).toEqual([255, 0, 0, 255]);
    expect(p.get(0, 0)[3]).toBe(0);
    expect(p.get(1, 1)[3]).toBe(0); // köşegen komşu dahil değil
  });

  it('flipH ve crop', () => {
    const p = new Pixels(4, 2);
    p.set(0, 0, hex(0x112233));
    const f = p.flipH();
    expect(f.get(3, 0)).toEqual([0x11, 0x22, 0x33, 255]);
    const c = p.crop(0, 0, 2, 2);
    expect(c.w).toBe(2);
    expect(c.get(0, 0)).toEqual([0x11, 0x22, 0x33, 255]);
  });
});

describe('TileArt', () => {
  it('tileset doğru boyutta, her zemin karesi dolu, nesneler kısmen saydam', () => {
    const sheet = buildTileset(0);
    expect(sheet.w).toBe(TILESET_COLUMNS * TILE);
    expect(sheet.h).toBe(TILESET_ROWS * TILE);
    for (let g = 0; g < Ground.COUNT; g++) {
      const x = (g % TILESET_COLUMNS) * TILE;
      const y = Math.floor(g / TILESET_COLUMNS) * TILE;
      expect(opaqueCount(sheet, x, y, TILE, TILE)).toBe(TILE * TILE);
    }
    for (let o = 1; o < Obj.COUNT; o++) {
      const id = OBJ_TILE_OFFSET + o;
      const x = (id % TILESET_COLUMNS) * TILE;
      const y = Math.floor(id / TILESET_COLUMNS) * TILE;
      const n = opaqueCount(sheet, x, y, TILE, TILE);
      expect(n).toBeGreaterThan(10);
      expect(n).toBeLessThan(TILE * TILE);
    }
  });

  it('su kareleri iki karede farklı, diğerleri aynı', () => {
    const a = buildTileset(0);
    const b = buildTileset(1);
    const waterX = (Ground.Water % TILESET_COLUMNS) * TILE;
    expect(a.crop(waterX, 0, TILE, TILE).data).not.toEqual(b.crop(waterX, 0, TILE, TILE).data);
    const grassX = (Ground.Grass0 % TILESET_COLUMNS) * TILE;
    expect(a.crop(grassX, 0, TILE, TILE).data).toEqual(b.crop(grassX, 0, TILE, TILE).data);
  });
});

describe('HumanPainter', () => {
  it('12 kare, hepsi dolu, sağ kareler solun aynası', () => {
    const sheet = buildHumanSheet(PLAYER_STYLE);
    expect(sheet.w).toBe(HUMAN_W * HUMAN_DIRS * HUMAN_FRAMES);
    expect(sheet.h).toBe(HUMAN_H);
    for (let i = 0; i < HUMAN_DIRS * HUMAN_FRAMES; i++) {
      expect(opaqueCount(sheet, i * HUMAN_W, 0, HUMAN_W, HUMAN_H)).toBeGreaterThan(80);
    }
    const left = sheet.crop(1 * HUMAN_FRAMES * HUMAN_W, 0, HUMAN_W, HUMAN_H);
    const right = sheet.crop(2 * HUMAN_FRAMES * HUMAN_W, 0, HUMAN_W, HUMAN_H);
    expect(left.flipH().data).toEqual(right.data);
  });
});
