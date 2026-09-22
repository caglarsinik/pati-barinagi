import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import type { Egg } from '../../src/sim/entities/Egg';
import { Sim } from '../../src/sim/Sim';
import { incubatorHatchDays, incubatorSlots } from '../../src/sim/systems/IncubatorSystem';
import { harvestNest } from '../../src/sim/systems/NestSystem';
import { Obj } from '../../src/sim/world/tiles';

const DAY = 24 * 60;

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Dünyadaki bir yuvadan yumurta alıp istenen sayıda kopyasını üretir (ayrı id'lerle). */
function eggs(sim: Sim, n: number): Egg[] {
  const nest = sim.world.nests.find((q) => sim.world.objectAt(q.x, q.y) === Obj.NestEggs)!;
  const first = harvestNest(sim, nest.x, nest.y)!;
  const out = [first];
  while (out.length < n) out.push({ ...first, id: sim.nextId++, genome: { ...first.genome } });
  return out;
}

describe('Yükseltmeler 1: kuluçka Sv2 ve büyük çanta', () => {
  it('kuluçka yükselir: para düşer, 6 yuva, 2 gün; ikinci kez ve parasız reddedilir', () => {
    const sim = Sim.create(1601);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    expect(inc.level).toBe(1);
    expect(incubatorSlots(inc)).toBe(3);
    sim.money = 1000;
    expect(sim.command({ type: 'upgradeBuilding', buildingId: inc.id }).ok).toBe(false);
    sim.money = 5000;
    const r = sim.command({ type: 'upgradeBuilding', buildingId: inc.id });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(5000 - 2000);
    expect(sim.ledger.some((e) => e.category === 'building' && e.amount === -2000)).toBe(true);
    expect(inc.level).toBe(2);
    expect(incubatorSlots(inc)).toBe(6);
    expect(incubatorHatchDays(inc)).toBe(2);
    expect(sim.command({ type: 'upgradeBuilding', buildingId: inc.id }).ok).toBe(false);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    expect(sim.command({ type: 'upgradeBuilding', buildingId: bowl.id }).ok).toBe(false);
  });

  it('Sv2 kuluçkada yeni yumurta 2 günde çatlar; içerideki yumurtanın kalan süresi 2/3 olur', () => {
    const sim = Sim.create(1602);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const [a, b] = eggs(sim, 2);
    sim.backpack.push(a);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: a.id });
    expect(a.hatchLeft).toBe(3 * DAY);
    sim.money = 5000;
    sim.command({ type: 'upgradeBuilding', buildingId: inc.id });
    expect(a.hatchLeft).toBe(2 * DAY);
    sim.backpack.push(b);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: b.id });
    expect(b.hatchLeft).toBe(2 * DAY);
    const h0 = sim.stats.hatched;
    runMinutes(sim, 2 * DAY + 30);
    expect(sim.stats.hatched).toBe(h0 + 2);
  });

  it('Sv1 kuluçkada ilerlemiş yumurta Sv2 kuluçkaya konunca tam süreyi aşmaz', () => {
    const sim = Sim.create(1603);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const [a] = eggs(sim, 1);
    a.hatchLeft = 2.5 * DAY; // başka bir Sv1 kuluçkadan alınmış
    sim.money = 5000;
    sim.command({ type: 'upgradeBuilding', buildingId: inc.id });
    sim.backpack.push(a);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: a.id });
    expect(a.hatchLeft).toBe(2 * DAY);
  });

  it('büyük çanta: 6 yumurta, bir kez; parasız reddedilir', () => {
    const sim = Sim.create(1604);
    expect(sim.backpackSlots()).toBe(3);
    sim.money = 500;
    expect(sim.command({ type: 'buyBackpack' }).ok).toBe(false);
    sim.money = 3000;
    expect(sim.command({ type: 'buyBackpack' }).ok).toBe(true);
    expect(sim.money).toBe(3000 - BALANCE.upgrades.backpack.cost);
    expect(sim.backpackSlots()).toBe(6);
    expect(sim.command({ type: 'buyBackpack' }).ok).toBe(false);
  });

  it('kayıt gidiş-dönüşü: seviye, çanta ve 6 yuvalı kuluçkanın yumurtaları korunur', () => {
    const sim = Sim.create(1605);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    sim.money = 10000;
    sim.command({ type: 'upgradeBuilding', buildingId: inc.id });
    sim.command({ type: 'buyBackpack' });
    const all = eggs(sim, 11);
    for (const e of all.slice(0, 6)) {
      sim.backpack.push(e);
      expect(sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: e.id }).ok).toBe(true);
    }
    sim.backpack.push(...all.slice(6)); // 5 yumurta çantada (Sv1'de 3'ü sığardı)
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    const inc2 = back.buildingById(inc.id)!;
    expect(inc2.level).toBe(2);
    expect(inc2.eggs.length).toBe(6);
    expect(back.backpackSlots()).toBe(6);
    expect(back.backpack.length).toBe(5);
    const raw = JSON.parse(JSON.stringify(Sim.create(1606).toJSON()));
    raw.buildings[0].level = 99;
    delete raw.backpackLevel;
    const old = Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!);
    expect(old.buildings[0].level).toBe(2);
    expect(old.backpackSlots()).toBe(3);
  });
});
