import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { BUILDING_DEFS, TILE_TOOL_DEFS } from '../../src/content/buildings';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';
import { quoteBuilding, tileMatLabel } from '../../src/sim/systems/BuildSystem';
import { Ground, Obj } from '../../src/sim/world/tiles';
import { buildToolHint } from '../../src/ui/store';

const M = BALANCE.materials;

/** Arsa içinde boş bir alan (çevresi de boş). */
function freeSpot(sim: Sim, w: number, h: number): { x: number; y: number } {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - h - 2; y++) {
    for (let x = p.x + 2; x < p.x + p.w - w - 2; x++) {
      let ok = true;
      for (let yy = y - 1; yy <= y + h && ok; yy++) {
        for (let xx = x - 1; xx <= x + w && ok; xx++) {
          if (sim.world.isSolid(xx, yy) || sim.world.buildingIdAt(xx, yy) !== -1 || sim.world.objectAt(xx, yy) !== Obj.None) ok = false;
          if (sim.world.groundAt(xx, yy) === Ground.Path) ok = false;
        }
      }
      if (ok && !sim.dogs.some((d) => d.tileX >= x - 1 && d.tileX <= x + w && d.tileY >= y - 1 && d.tileY <= y + h)) return { x, y };
    }
  }
  throw new Error('boş yer yok');
}

function roundTrip(sim: Sim, patch: Record<string, unknown> = {}): Sim {
  return Sim.fromJSON(SaveManager.parse(JSON.stringify({ ...sim.toJSON(), ...patch }))!);
}

describe('Malzemeyle öde (0.23.1)', () => {
  it('tarifler fiyatın en çok yarısını indirir; çit, kapı ve yolun malzeme bedeli var', () => {
    const withMats = Object.values(BUILDING_DEFS).filter((d) => d.mats);
    expect(withMats.length).toBe(20);
    for (const d of withMats) {
      const value = (d.mats!.wood ?? 0) * M.woodValue + (d.mats!.stone ?? 0) * M.stoneValue;
      expect(d.buildable).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(d.cost * M.maxShare);
    }
    expect(BUILDING_DEFS.kennelSmall.mats).toEqual({ wood: 6, stone: 2 });
    expect(BUILDING_DEFS.office.mats).toBeUndefined();
    expect(tileMatLabel(TILE_TOOL_DEFS.fence)).toBe('🪵1');
    expect(tileMatLabel(TILE_TOOL_DEFS.gate)).toBe('🪵2');
    expect(tileMatLabel(TILE_TOOL_DEFS.path)).toBe('🪨½');
  });

  it('fiyat: tam tarif, kısmi malzeme, anahtar kapalı, malzemesiz', () => {
    const sim = Sim.create(231);
    expect(sim.policies.useMaterials).toBe(true);
    expect(quoteBuilding(sim, 'kennelSmall')).toEqual({ money: 600, wood: 0, stone: 0, discount: 0 });
    sim.materials = { wood: 20, stone: 20 };
    expect(quoteBuilding(sim, 'kennelSmall')).toEqual({ money: 420, wood: 6, stone: 2, discount: 180 });
    expect(quoteBuilding(sim, 'vetClinic')).toEqual({ money: 2380, wood: 10, stone: 14, discount: 620 });
    expect(quoteBuilding(sim, 'toyBall').discount).toBe(0); // tarifsiz
    sim.materials = { wood: 3, stone: 0 };
    expect(quoteBuilding(sim, 'kennelSmall')).toEqual({ money: 540, wood: 3, stone: 0, discount: 60 });
    const r = sim.command({ type: 'setPolicy', policy: { useMaterials: false } });
    expect(r.message).toMatch(/kapalı/);
    expect(quoteBuilding(sim, 'kennelSmall')).toEqual({ money: 600, wood: 0, stone: 0, discount: 0 });
  });

  it('malzemeyle kurulan bina: para ve malzeme düşer, ödeme binada, defterde not; yıkımda yarısı geri', () => {
    const sim = Sim.create(232);
    sim.materials = { wood: 10, stone: 5 };
    sim.money = 450; // tam fiyata (600) yetmez, indirimliye (420) yeter
    const spot = freeSpot(sim, 2, 2);
    const r = sim.command({ type: 'placeBuilding', building: 'kennelSmall', x: spot.x, y: spot.y });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('🪵6 🪨2');
    expect(sim.money).toBe(30);
    expect(sim.materials).toEqual({ wood: 4, stone: 3 });
    const b = r.building!;
    expect(b.paid).toEqual({ money: 420, wood: 6, stone: 2 });
    const entry = sim.ledger[sim.ledger.length - 1];
    expect(entry.amount).toBe(-420);
    expect(entry.note).toContain('malzemeyle −180 ₺');
    // Yıkım: 210 ₺ + 🪵3 🪨1 (ödenenin yarısı, fiyatın değil).
    const d = sim.command({ type: 'demolish', x: b.x, y: b.y });
    expect(d.ok).toBe(true);
    expect(d.message).toContain('🪵3 🪨1');
    expect(sim.money).toBe(240);
    expect(sim.materials).toEqual({ wood: 7, stone: 4 });
    // Kur-yık döngüsü para da malzeme de kaybettirir.
    expect(sim.money).toBeLessThan(450);
    expect(sim.materials.wood + sim.materials.stone).toBeLessThan(15);
  });

  it('anahtar kapalıyken tam fiyat ve malzeme harcanmaz; iade üst sınırı aşmaz', () => {
    const sim = Sim.create(233);
    sim.materials = { wood: 40, stone: 40 };
    sim.money = 500;
    sim.command({ type: 'setPolicy', policy: { useMaterials: false } });
    const spot = freeSpot(sim, 2, 2);
    expect(sim.command({ type: 'placeBuilding', building: 'kennelSmall', x: spot.x, y: spot.y }).ok).toBe(false);
    sim.money = 5000;
    const r = sim.command({ type: 'placeBuilding', building: 'kennelSmall', x: spot.x, y: spot.y });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(4400);
    expect(sim.materials).toEqual({ wood: 40, stone: 40 });
    expect(r.building!.paid).toEqual({ money: 600, wood: 0, stone: 0 });
    // Malzemeyle kurulan büyük kulübeyi dolu çantayla yık: fazlası kaybolur.
    sim.command({ type: 'setPolicy', policy: { useMaterials: true } });
    const spot2 = freeSpot(sim, 3, 2);
    const big = sim.command({ type: 'placeBuilding', building: 'kennelLarge', x: spot2.x, y: spot2.y }).building!;
    expect(big.paid).toEqual({ money: 780, wood: 10, stone: 4 });
    sim.materials = { wood: M.max - 2, stone: M.max };
    sim.command({ type: 'demolish', x: big.x, y: big.y });
    expect(sim.materials).toEqual({ wood: M.max, stone: M.max });
  });

  it('çit odunla, kapı iki odunla, yol iki kareye bir taşla; malzeme bitince parayla; malzemeli kare iade vermez', () => {
    const sim = Sim.create(234);
    const spot = freeSpot(sim, 6, 2);
    const row = (y: number, n: number) => Array.from({ length: n }, (_, i) => ({ x: spot.x + i, y }));
    sim.materials = { wood: 4, stone: 2 };
    const m0 = sim.money;
    const f = sim.command({ type: 'placeTiles', tool: 'fence', tiles: row(spot.y, 6) });
    expect(f.ok).toBe(true);
    expect(f.message).toContain('🪵4');
    expect(sim.materials.wood).toBe(0);
    expect(sim.money).toBe(m0 - 2 * TILE_TOOL_DEFS.fence.cost);
    expect(sim.matTiles.size).toBe(4);
    // Malzemeli kare yıkılınca iade yok, parayla konan kare yarısını verir.
    const m1 = sim.money;
    const d1 = sim.command({ type: 'demolish', x: spot.x, y: spot.y });
    expect(d1.message).toMatch(/iade yok/);
    expect(sim.money).toBe(m1);
    expect(sim.matTiles.size).toBe(3);
    sim.command({ type: 'demolish', x: spot.x + 5, y: spot.y });
    expect(sim.money).toBe(m1 + Math.round(TILE_TOOL_DEFS.fence.cost * 0.5));
    // Kapı iki odun: 3 odunla bir kapı malzemeyle, ikincisi parayla.
    sim.materials.wood = 3;
    const m2 = sim.money;
    expect(sim.command({ type: 'placeTiles', tool: 'gate', tiles: [{ x: spot.x + 1, y: spot.y }, { x: spot.x + 2, y: spot.y }] }).ok).toBe(true);
    expect(sim.materials.wood).toBe(1);
    expect(sim.money).toBe(m2 - TILE_TOOL_DEFS.gate.cost);
    expect(sim.matTiles.has(sim.world.idx(spot.x + 1, spot.y))).toBe(true);
    expect(sim.matTiles.has(sim.world.idx(spot.x + 2, spot.y))).toBe(false); // parayla konan kapı malzemeli çitin yerini aldı
    // Yol: 5 kare, 2 taş → 4 kare taşla, 1 kare parayla.
    const m3 = sim.money;
    const p = sim.command({ type: 'placeTiles', tool: 'path', tiles: row(spot.y + 1, 5) });
    expect(p.ok).toBe(true);
    expect(sim.materials.stone).toBe(0);
    expect(sim.money).toBe(m3 - TILE_TOOL_DEFS.path.cost);
    expect(sim.matPaths.size).toBe(4);
    const m4 = sim.money;
    sim.command({ type: 'demolish', x: spot.x, y: spot.y + 1 });
    expect(sim.world.groundAt(spot.x, spot.y + 1)).toBe(Ground.Plot);
    expect(sim.money).toBe(m4);
    // Tek sayıda kare taşın yarısını boşa harcar (komut başına yukarı yuvarlanır).
    sim.materials.stone = 5;
    sim.command({ type: 'placeTiles', tool: 'path', tiles: [{ x: spot.x, y: spot.y + 1 }] });
    expect(sim.materials.stone).toBe(4);
    // Anahtar kapalı: hepsi parayla.
    sim.command({ type: 'setPolicy', policy: { useMaterials: false } });
    sim.materials.wood = 10;
    sim.command({ type: 'placeTiles', tool: 'fence', tiles: [{ x: spot.x, y: spot.y }] });
    expect(sim.materials.wood).toBe(10);
    expect(sim.matTiles.has(sim.world.idx(spot.x, spot.y))).toBe(false);
  });

  it('kayıt: ödeme, malzemeli kareler ve anahtar korunur; eski kayıt ve bozuk değerler güvenli', () => {
    const sim = Sim.create(235);
    sim.materials = { wood: 30, stone: 30 };
    const spot = freeSpot(sim, 6, 3);
    const k = sim.command({ type: 'placeBuilding', building: 'kennelSmall', x: spot.x, y: spot.y + 1 }).building!;
    sim.command({ type: 'placeTiles', tool: 'fence', tiles: [{ x: spot.x + 3, y: spot.y }, { x: spot.x + 4, y: spot.y }] });
    sim.command({ type: 'placeTiles', tool: 'path', tiles: [{ x: spot.x + 3, y: spot.y + 2 }] });
    sim.command({ type: 'setPolicy', policy: { useMaterials: false } });
    const back = roundTrip(sim);
    expect(back.buildingById(k.id)!.paid).toEqual({ money: 420, wood: 6, stone: 2 });
    expect([...back.matTiles].sort()).toEqual([...sim.matTiles].sort());
    expect([...back.matPaths]).toEqual([...sim.matPaths]);
    expect(back.policies.useMaterials).toBe(false);
    // Eski kayıt: ödeme yok → tam fiyat sayılır, malzemeli kare yok, anahtar açık.
    const data = sim.toJSON();
    const buildings = (data.buildings ?? []) as Array<Record<string, unknown>>;
    const old = {
      ...data,
      buildings: buildings.map((b) => ({ ...b, paid: undefined })),
      matTiles: undefined,
      matPaths: undefined,
      policies: { ...(data.policies as Record<string, unknown>), useMaterials: undefined },
    };
    const legacy = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    expect(legacy.buildingById(k.id)!.paid).toEqual({ money: 600, wood: 0, stone: 0 });
    expect(legacy.matTiles.size).toBe(0);
    expect(legacy.policies.useMaterials).toBe(true);
    // Bozuk: fiyat/tarif üstü kırpılır, çit olmayan kare ve sayı olmayan girişler atılır.
    const emptyIdx = sim.world.idx(spot.x + 5, spot.y + 2);
    const bad = roundTrip(sim, {
      buildings: buildings.map((b) => (b.id === k.id ? { ...b, paid: { money: 99999, wood: 50, stone: -4 } } : b)),
      matTiles: [...sim.matTiles, emptyIdx, 'x', -1],
      matPaths: [emptyIdx],
    });
    expect(bad.buildingById(k.id)!.paid).toEqual({ money: 600, wood: 6, stone: 0 });
    expect(bad.matTiles.size).toBe(2);
    expect(bad.matPaths.size).toBe(0);
  });

  it('ipucu malzemeli fiyatı yazar', () => {
    const sim = Sim.create(236);
    sim.materials = { wood: 20, stone: 20 };
    expect(buildToolHint({ kind: 'building', type: 'kennelSmall' }, true, sim)).toBe('Küçük kulübe (420 ₺ + 🪵6 🪨2) · dokun: yerleştir');
    expect(buildToolHint({ kind: 'building', type: 'kennelLarge' }, false, sim)).toMatch(/^Büyük kulübe \(780 ₺ \+ 🪵10 🪨4\) · tıkla: yerleştir · R: döndür/);
    expect(buildToolHint({ kind: 'tile', tool: 'fence' }, true, sim)).toBe('Çit (🪵1/kare, bitince 15 ₺/kare) · sürükle: çizgi çek');
    expect(buildToolHint({ kind: 'tile', tool: 'path' }, true, sim)).toContain('🪨½/kare');
    sim.materials = { wood: 0, stone: 0 };
    expect(buildToolHint({ kind: 'building', type: 'kennelSmall' }, true, sim)).toBe('Küçük kulübe (600 ₺) · dokun: yerleştir');
    expect(buildToolHint({ kind: 'tile', tool: 'fence' }, true, sim)).toBe('Çit (15 ₺/kare) · sürükle: çizgi çek');
  });
});
