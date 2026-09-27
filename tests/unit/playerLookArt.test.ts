import { describe, expect, it } from 'vitest';
import { HUMAN_DIRS, HUMAN_FRAMES, HUMAN_H, HUMAN_W, PLAYER_STYLE, buildHumanSheet, drawHuman, humanStyleFromSeed, styleFromLook } from '../../src/render/HumanPainter';
import { Pixels, hex } from '../../src/render/Pixels';
import { DEFAULT_LOOK, HAIR_COLORS, LOOK_COUNTS, LOOK_KEYS, PANTS_COLORS, SHIRT_COLORS, SKIN_TONES, type PlayerLook } from '../../src/sim/entities/PlayerLook';

function fnv(d: Uint8ClampedArray): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function opaqueCount(p: Pixels, x: number, y: number, w: number, h: number): number {
  let n = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (p.isOpaque(xx, yy)) n++;
  return n;
}

function look(patch: Partial<PlayerLook>): PlayerLook {
  return { ...DEFAULT_LOOK, ...patch };
}

describe('Oyuncu görünümü çizimi (0.24.0)', () => {
  it('varsayılan görünüm eski oyuncu şeridiyle bayt bayt aynı', () => {
    expect(buildHumanSheet(styleFromLook(DEFAULT_LOOK)).data).toEqual(buildHumanSheet(PLAYER_STYLE).data);
  });

  it('her alanın her değeri şeridi değiştirir; kareler dolu, sağ = solun aynası', () => {
    const base = buildHumanSheet(styleFromLook(DEFAULT_LOOK));
    for (const k of LOOK_KEYS) {
      for (let v = 1; v < LOOK_COUNTS[k]; v++) {
        const sheet = buildHumanSheet(styleFromLook(look({ [k]: v })));
        expect(sheet.w).toBe(HUMAN_W * HUMAN_DIRS * HUMAN_FRAMES);
        expect(sheet.h).toBe(HUMAN_H);
        expect(sheet.data, `${k}=${v} değişmedi`).not.toEqual(base.data);
        for (let i = 0; i < HUMAN_DIRS * HUMAN_FRAMES; i++) expect(opaqueCount(sheet, i * HUMAN_W, 0, HUMAN_W, HUMAN_H)).toBeGreaterThan(80);
        const left = sheet.crop(1 * HUMAN_FRAMES * HUMAN_W, 0, HUMAN_W, HUMAN_H);
        const right = sheet.crop(2 * HUMAN_FRAMES * HUMAN_W, 0, HUMAN_W, HUMAN_H);
        expect(left.flipH().data).toEqual(right.data);
      }
    }
  });

  it('piksel sondaları: şort, etek, kadın beden, gözlük, kapüşon, uzun saç, topuz ve şapka', () => {
    const skin = hex(SKIN_TONES[0]);
    const pants = hex(PANTS_COLORS[0]);
    const shirt = hex(SHIRT_COLORS[0]);
    const hair = hex(HAIR_COLORS[0]);
    expect(drawHuman(0, 0, styleFromLook(look({ pantsStyle: 1 }))).get(5, 20)).toEqual(skin);
    expect(drawHuman(0, 0, styleFromLook(DEFAULT_LOOK)).get(5, 20)).toEqual(pants);
    expect(drawHuman(0, 0, styleFromLook(look({ pantsStyle: 2 }))).get(4, 19)).toEqual(pants);
    expect(drawHuman(0, 0, styleFromLook(DEFAULT_LOOK)).get(4, 14)).toEqual(shirt);
    expect(drawHuman(0, 0, styleFromLook(look({ body: 1 }))).get(4, 14)).not.toEqual(shirt);
    expect(drawHuman(0, 0, styleFromLook(look({ body: 1 }))).get(5, 14)).toEqual(shirt);
    expect(drawHuman(0, 0, styleFromLook(look({ accessory: 1 }))).get(5, 7)).toEqual(hex(0x8f9196));
    expect(drawHuman(3, 0, styleFromLook(look({ shirtStyle: 2 }))).get(5, 10)).toEqual(shirt);
    expect(drawHuman(3, 0, styleFromLook(DEFAULT_LOOK)).get(5, 10)).toEqual(skin);
    expect(drawHuman(3, 0, styleFromLook(look({ hairStyle: 1 }))).get(7, 11)).toEqual(hair);
    expect(drawHuman(0, 0, styleFromLook(look({ hairStyle: 3 }))).get(6, 1)).toEqual(hair);
    expect(drawHuman(0, 0, styleFromLook(look({ hairStyle: 3, hat: 1 }))).get(6, 1)).not.toEqual(hair);
    expect(drawHuman(0, 0, styleFromLook(look({ hairStyle: 4 }))).get(4, 3)).toEqual(skin);
    expect(drawHuman(0, 0, styleFromLook(look({ skin: 2 }))).get(7, 9)).toEqual(hex(0x8e5f38));
  });

  it("NPC sprite'ları değişmedi (tohumdan stil ve şerit özetleri 0.24.0 öncesiyle aynı)", () => {
    expect(humanStyleFromSeed(12345)).toEqual({
      skin: [217, 168, 119, 255],
      hair: [138, 58, 42, 255],
      shirt: [63, 130, 220, 255],
      shirtDark: [47, 98, 165, 255],
      pants: [59, 70, 100, 255],
      shoes: [44, 37, 53, 255],
      hat: null,
    });
    const expected: Record<number, string> = { 12345: '3edf3d75', 11: '63716921', 12: '09cc6451', 13: '50eb4351', 0xbeef: 'caae5e75' };
    for (const [seed, hash] of Object.entries(expected)) {
      expect(fnv(buildHumanSheet(humanStyleFromSeed(Number(seed))).data), `tohum ${seed}`).toBe(hash);
    }
    expect(fnv(buildHumanSheet(PLAYER_STYLE).data)).toBe('6c2b2ccd');
  });

  it('doku anahtarı: varsayılan görünüm boot dokusu, başkası player- öneki', async () => {
    const { playerTextureKey } = await import('../../src/render/TextureRegistry');
    expect(playerTextureKey(DEFAULT_LOOK)).toBe('player');
    const k = playerTextureKey(look({ body: 1, hat: 2 }));
    expect(k.startsWith('player-')).toBe(true);
    expect(k).not.toBe(playerTextureKey(look({ body: 1, hat: 3 })));
  });
});
