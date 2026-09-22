import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { type Building, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Dog } from '../../src/sim/entities/Dog';
import { RARITY_ORDER } from '../../src/sim/entities/DogGenome';
import { Sim } from '../../src/sim/Sim';
import { breedMinutes, breedingIssues } from '../../src/sim/systems/BreedingSystem';

const DAY = 24 * 60;

function placeNursery(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 5; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 5; x++) {
      if (!canPlaceBuilding(sim.world, 'nursery', x, y)) continue;
      const b = sim.placeBuilding('nursery', x, y);
      if (b) return b;
    }
  }
  throw new Error('yer yok');
}

/** İki yetişkin, sağlıklı, birbirine dost köpek. */
function pair(sim: Sim): [Dog, Dog] {
  const a = sim.dogs[0];
  const b = sim.addDog(sim.dogs[0].genome, 'egg', 20, a.x + 1, a.y);
  for (const d of [a, b]) {
    d.ageWeeks = 20;
    d.needs.health = 100;
    d.needs.loyalty = 100; // rastgele 'kaçan köpek' olayı çifti bozmasın
  }
  a.addAffinity(b.id, 80);
  b.addAffinity(a.id, 80);
  return [a, b];
}

/** Zamanı ilerletir; köpekleri sağlıklı tutar (test yalnız üremeyi ölçer). */
function advance(sim: Sim, minutes: number, keep: Dog[]): void {
  for (let m = 0; m < minutes; m += 30) {
    for (const d of keep) {
      d.needs.health = 100;
      d.needs.loyalty = 100;
    }
    sim.stepSim(30);
  }
}

describe('Yuva evi', () => {
  it('koşullar: yetişkinlik, sağlık, karşılıklı dostluk, dinlenme', () => {
    const sim = Sim.create(2301);
    const [a, b] = pair(sim);
    expect(breedingIssues(sim, a, b)).toEqual([]);
    expect(breedingIssues(sim, a, undefined).length).toBe(1);
    expect(breedingIssues(sim, a, a).length).toBe(1);
    b.ageWeeks = 2;
    expect(breedingIssues(sim, a, b).some((x) => x.includes('yetişkin'))).toBe(true);
    b.ageWeeks = BALANCE.dogs.growth.seniorAtWeek + 1;
    expect(breedingIssues(sim, a, b).some((x) => x.includes('yetişkin'))).toBe(true);
    b.ageWeeks = 20;
    b.needs.health = 50;
    expect(breedingIssues(sim, a, b).some((x) => x.includes('sağlığı'))).toBe(true);
    b.needs.health = 100;
    b.addAffinity(a.id, -60); // tek taraflı düşüş yeter
    expect(breedingIssues(sim, a, b).some((x) => x.includes('Dostluk'))).toBe(true);
    b.addAffinity(a.id, 60);
    a.breedReadyAt = sim.clock.totalMinutes + 3 * DAY;
    expect(breedingIssues(sim, a, b).some((x) => x.includes('dinleniyor'))).toBe(true);
  });

  it('uygun çift 5 günde soylu yumurta verir; alınıp kuluçkada çatlayan yavru soyu taşır; 4 hafta dinlenme', () => {
    const sim = Sim.create(2302);
    const [a, b] = pair(sim);
    const n = placeNursery(sim);
    expect(sim.command({ type: 'setNurseryPair', buildingId: n.id, dogIds: [a.id, b.id] }).ok).toBe(true);
    expect(n.breedLeft).toBe(breedMinutes());
    advance(sim, 4 * DAY, [a, b]);
    expect(n.eggs.length).toBe(0);
    advance(sim, DAY + 60, [a, b]);
    expect(n.eggs.length).toBe(1);
    const egg = n.eggs[0];
    expect(egg.parents).toEqual([a.id, b.id]);
    expect(egg.parentNames).toEqual([a.name, b.name]);
    expect(RARITY_ORDER[egg.genome.rarity]).toBeGreaterThanOrEqual(Math.max(RARITY_ORDER[a.genome.rarity], RARITY_ORDER[b.genome.rarity]));
    expect(sim.stats.bred).toBe(1);
    expect(a.breedReadyAt).toBeGreaterThan(sim.clock.totalMinutes + 27 * DAY);
    expect(breedingIssues(sim, a, b, n).some((x) => x.includes('dinleniyor'))).toBe(true);

    expect(sim.command({ type: 'takeNurseryEgg', buildingId: n.id }).ok).toBe(true);
    expect(n.eggs.length).toBe(0);
    const inc = sim.buildings.find((x) => x.type === 'incubator')!;
    expect(sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id }).ok).toBe(true);
    advance(sim, BALANCE.eggs.hatchDays * DAY + 60, [a, b]);
    const pup = sim.dogs.find((d) => d.parents !== null)!;
    expect(pup.parents).toEqual([a.id, b.id]);
    // Dinlenmedeyken yeni yumurta gelmez.
    advance(sim, 6 * DAY, [a, b]);
    expect(n.eggs.length).toBe(0);
  });

  it('koşul bozulunca sayaç durur, düzelince kaldığı yerden sürer', () => {
    const sim = Sim.create(2303);
    const [a, b] = pair(sim);
    const n = placeNursery(sim);
    sim.command({ type: 'setNurseryPair', buildingId: n.id, dogIds: [a.id, b.id] });
    advance(sim, 2 * DAY, [a, b]);
    const left = n.breedLeft;
    expect(left).toBeLessThan(breedMinutes());
    // Koşul bozulur (a bir gün dinlenmede): sayaç durur, sıfırlanmaz.
    a.breedReadyAt = sim.clock.totalMinutes + DAY;
    expect(breedingIssues(sim, a, b, n).length).toBeGreaterThan(0);
    advance(sim, DAY - 60, [a, b]);
    expect(n.breedLeft).toBe(left);
    advance(sim, 120, [a, b]);
    expect(n.breedLeft).toBeLessThan(left);
    advance(sim, 3 * DAY + 60, [a, b]);
    expect(n.eggs.length).toBe(1);
  });

  it('çift ataması doğrulanır; köpek iki yuva evinde olamaz; çanta doluyken yumurta alınmaz', () => {
    const sim = Sim.create(2304);
    const [a, b] = pair(sim);
    const n1 = placeNursery(sim);
    const n2 = placeNursery(sim);
    expect(sim.command({ type: 'setNurseryPair', buildingId: n1.id, dogIds: [a.id, 999999] }).ok).toBe(false);
    expect(sim.command({ type: 'setNurseryPair', buildingId: n1.id, dogIds: [a.id] }).ok).toBe(true);
    expect(sim.command({ type: 'setNurseryPair', buildingId: n2.id, dogIds: [a.id, b.id] }).ok).toBe(false);
    expect(sim.command({ type: 'setNurseryPair', buildingId: n1.id, dogIds: [a.id, b.id] }).ok).toBe(true);
    n1.eggs.push({ id: sim.nextId++, genome: a.genome, foundDay: 1, hatchLeft: -1 });
    while (sim.backpack.length < sim.backpackSlots()) sim.backpack.push({ id: sim.nextId++, genome: a.genome, foundDay: 1, hatchLeft: -1 });
    expect(sim.command({ type: 'takeNurseryEgg', buildingId: n1.id }).ok).toBe(false);
  });

  it('üreme ana rastgele sırayı değiştirmez; kayıt gidiş-dönüşü', () => {
    const run = (withNursery: boolean): { names: string[]; sim: Sim } => {
      const sim = Sim.create(2305);
      const [a, b] = pair(sim);
      if (withNursery) {
        const n = placeNursery(sim);
        sim.command({ type: 'setNurseryPair', buildingId: n.id, dogIds: [a.id, b.id] });
      }
      advance(sim, 6 * DAY, [a, b]);
      return { names: sim.candidates.map((c) => c.name), sim };
    };
    const plain = run(false);
    const bred = run(true);
    expect(bred.sim.stats.bred).toBe(1);
    expect(bred.names).toEqual(plain.names);

    const sim = bred.sim;
    const n = sim.buildings.find((x) => x.type === 'nursery')!;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    const n2 = back.buildingById(n.id)!;
    expect(n2.pair).toEqual(n.pair);
    expect(n2.breedLeft).toBe(n.breedLeft);
    expect(n2.eggs.length).toBe(1);
    expect(n2.eggs[0].parents).toEqual(n.eggs[0].parents);
    expect(back.dogById(n.pair[0])!.breedReadyAt).toBe(sim.dogById(n.pair[0])!.breedReadyAt);
  });
});
