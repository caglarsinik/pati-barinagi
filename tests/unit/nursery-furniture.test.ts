import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { type Building, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Dog } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';
import { ACHIEVEMENTS } from '../../src/sim/systems/Achievements';
import { breedMinutes, breedingIssues, nurseryCooldownMinutes, nurseryDaysLeft, nurseryTimeMul, tickNurseries } from '../../src/sim/systems/BreedingSystem';

const DAY = 24 * 60;
const ITEMS = ['nestCushion', 'nestHeater', 'nestWindow', 'photoWall'] as const;

/** Arsada ilk sığan yere hazır bir yuva evi kurar. */
function placeNursery(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y; y < p.y + p.h - 3; y++) {
    for (let x = p.x; x < p.x + p.w - 3; x++) {
      if (!canPlaceBuilding(sim.world, 'nursery', x, y)) continue;
      const b = sim.placeBuilding('nursery', x, y)!;
      b.buildLeft = 0;
      return b;
    }
  }
  throw new Error('yuva evine yer yok');
}

/** İki yetişkin, sağlıklı, birbirine dost köpeği çift olarak atar. */
function pairUp(sim: Sim, b: Building): [Dog, Dog] {
  while (sim.shelterDogs().length < 2) {
    const d0 = sim.dogs[0];
    sim.addDog({ ...d0.genome }, 'egg', 30, d0.x + 1, d0.y + 1);
  }
  const [a, c] = sim.shelterDogs().slice(0, 2);
  for (const d of [a, c]) {
    d.ageWeeks = 30; // yetişkin: 12–51. hafta
    d.needs.health = 100;
    d.breedReadyAt = 0;
  }
  a.friends[c.id] = 90;
  c.friends[a.id] = 90;
  expect(sim.command({ type: 'setNurseryPair', buildingId: b.id, dogIds: [a.id, c.id] }).ok).toBe(true);
  expect(breedingIssues(sim, a, c, b)).toEqual([]);
  return [a, c];
}

describe('Yuva evi eşyaları (0.25.1)', () => {
  it('dört eşya birer kez alınır, para düşer, ikinci alım reddedilir; oda eşyalı; başarım; kayıt turu', () => {
    const sim = Sim.create(2511);
    sim.money = 10000;
    const b = placeNursery(sim);
    const F = BALANCE.interior.furniture;
    for (const item of ITEMS) {
      const m0 = sim.money;
      expect(sim.command({ type: 'buyFurniture', buildingId: b.id, item }).ok, item).toBe(true);
      expect(m0 - sim.money).toBe(F[item].cost);
      expect(sim.command({ type: 'buyFurniture', buildingId: b.id, item }).ok, item + ' ikinci').toBe(false);
    }
    expect(b.furniture).toHaveLength(4);
    expect(ACHIEVEMENTS.find((a) => a.id === 'warm-nest')!.check(sim)).toBe(true);
    expect(sim.enterBuilding(b.id).ok).toBe(true);
    const types = sim.interior!.items.map((i) => i.type);
    for (const t of ['nestCushion', 'nestHeater', 'window', 'photoWall', 'nestBed', 'eggBasket', 'nestBoard']) expect(types).toContain(t);
    sim.exitInterior();
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect([...back.buildingById(b.id)!.furniture].sort()).toEqual([...b.furniture].sort());
  });

  it('yumuşak yuva sayacı %15 hızlandırır, ısıtıcı dinlenmeyi %25 kısaltır', () => {
    const sim = Sim.create(2512);
    sim.money = 10000;
    const b = placeNursery(sim);
    const [a, c] = pairUp(sim, b);
    expect(nurseryTimeMul(b)).toBe(1);
    expect(b.breedLeft).toBe(breedMinutes());
    tickNurseries(sim, 60);
    expect(breedMinutes() - b.breedLeft).toBeCloseTo(60, 6);
    expect(sim.command({ type: 'buyFurniture', buildingId: b.id, item: 'nestCushion' }).ok).toBe(true);
    const mul = BALANCE.breeding.furniture.cushionDaysMul;
    expect(nurseryTimeMul(b)).toBe(mul);
    const before = b.breedLeft;
    tickNurseries(sim, 60);
    expect(before - b.breedLeft).toBeCloseTo(60 / mul, 6);
    expect(nurseryDaysLeft(b)).toBeCloseTo((b.breedLeft * mul) / DAY, 6);
    // Isıtıcı: yumurta çıkınca dinlenme kısa.
    expect(sim.command({ type: 'buyFurniture', buildingId: b.id, item: 'nestHeater' }).ok).toBe(true);
    expect(nurseryCooldownMinutes(b)).toBeCloseTo(BALANCE.breeding.cooldownWeeks * 7 * DAY * BALANCE.breeding.furniture.heaterCooldownMul, 6);
    b.breedLeft = 1;
    tickNurseries(sim, 5);
    expect(b.eggs).toHaveLength(1);
    expect(a.breedReadyAt - sim.clock.totalMinutes).toBeCloseTo(nurseryCooldownMinutes(b), 6);
    expect(c.breedReadyAt).toBe(a.breedReadyAt);
    expect(b.eggs[0].parentNames).toEqual([a.name, c.name]);
  });

  it('pencere ve fotoğraf duvarı dekor +1 (tavanın altında)', () => {
    const sim = Sim.create(2513);
    sim.money = 10000;
    const b = placeNursery(sim);
    const d0 = sim.decorScore();
    expect(d0).toBeLessThan(BALANCE.decor.max - 2);
    sim.command({ type: 'buyFurniture', buildingId: b.id, item: 'nestWindow' });
    expect(sim.decorScore()).toBe(d0 + BALANCE.breeding.furniture.windowDecor);
    sim.command({ type: 'buyFurniture', buildingId: b.id, item: 'photoWall' });
    expect(sim.decorScore()).toBe(d0 + BALANCE.breeding.furniture.windowDecor + BALANCE.breeding.furniture.photoWallDecor);
    sim.command({ type: 'buyFurniture', buildingId: b.id, item: 'nestCushion' });
    expect(sim.decorScore()).toBe(d0 + 2);
  });

  it('çizimler: minderli yatak varyantı farklı; raf, ısıtıcı ve fotoğraf duvarı dolu', () => {
    const plain = drawInteriorItem('nestBed', 0);
    const cushioned = drawInteriorItem('nestBed', 1);
    expect(cushioned.data).not.toEqual(plain.data);
    for (const type of ['nestCushion', 'nestHeater', 'photoWall'] as const) {
      const p = drawInteriorItem(type);
      expect([p.w, p.h]).toEqual([16, 16]);
      let n = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
      expect(n, type).toBeGreaterThan(60);
    }
  });
});
