import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { type Building, canPlaceBuilding, kennelRestTile } from '../../src/sim/entities/Building';
import type { Dog } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';
import { illnessChanceMul } from '../../src/sim/systems/ClinicSystem';
import { runInspection } from '../../src/sim/systems/EconomySystem';
import { atKennelRest, furnishedRatio, kennelComfort, kennelFurnishing } from '../../src/sim/systems/KennelComfort';
import { Zone } from '../../src/sim/world/tiles';

const K = BALANCE.kennelComfort;
const ALL = ['dogBed', 'blanket', 'dogBowl', 'dogToy', 'kennelWindow'];

/** Hazır barınak: iki küçük kulübe, ilkinde A (tam döşenmiş), ikincisinde B (eşyasız); ikisi de aynı genom ve yaşta. */
function twoKennels(seed: number): { sim: Sim; a: Dog; b: Dog; k1: Building; k2: Building } {
  const sim = Sim.create(seed);
  const [k1, k2] = sim.buildings.filter((x) => x.type === 'kennelSmall');
  const a = sim.shelterDogs()[0];
  const b = sim.addDog(a.genome, 'egg', 20, k2.x + 0.5, k2.y + 2.5);
  expect(b.stage).toBe(a.stage);
  expect(sim.command({ type: 'assignKennel', dogId: a.id, buildingId: k1.id }).ok).toBe(true);
  expect(sim.command({ type: 'assignKennel', dogId: b.id, buildingId: k2.id }).ok).toBe(true);
  k1.furniture.push(...ALL);
  return { sim, a, b, k1, k2 };
}

/** Köpeği kulübesinin yatış karesinde uyut. */
function sleepAtRest(sim: Sim, dog: Dog, k: Building): void {
  const rest = kennelRestTile(k, k.occupants.indexOf(dog.id));
  dog.x = rest.x + 0.5;
  dog.y = rest.y + 0.5;
  dog.path = [];
  dog.state = 'sleep';
}

function setNeeds(dog: Dog): void {
  dog.needs.energy = 30;
  dog.needs.hygiene = 80;
  dog.needs.thirst = 20;
  dog.needs.play = 60;
}

describe('Kulübe eşyalarının etkileri (0.22.4)', () => {
  it('kulübesinde uyurken: yatak enerjiyi %25 hızlı doldurur, battaniye kirlenmeyi yarıya indirir, su kabıyla susamaz', () => {
    const { sim, a, b, k1, k2 } = twoKennels(2241);
    sleepAtRest(sim, a, k1);
    sleepAtRest(sim, b, k2);
    expect(atKennelRest(sim, a)).toBe(true);
    expect(kennelComfort(sim, a)).toEqual({ bed: true, blanket: true, bowl: true, toy: true, window: true, count: 5 });
    expect(kennelComfort(sim, b).count).toBe(0);
    setNeeds(a);
    setNeeds(b);
    sim.needs.update(60);
    const gainA = a.needs.energy - 30;
    const gainB = b.needs.energy - 30;
    expect(gainB).toBeGreaterThan(0);
    expect(gainA / gainB).toBeCloseTo(K.bedSleepRegenMul, 5);
    expect((80 - a.needs.hygiene) / (80 - b.needs.hygiene)).toBeCloseTo(K.blanketHygieneAsleepMul, 5);
    expect(b.needs.thirst).toBeGreaterThan(20);
    expect(a.needs.thirst).toBeCloseTo(20 + (b.needs.thirst - 20) * K.bowlThirstAsleepMul, 5);
  });

  it('kulübesinin dışında uyuyan köpeğe yatak, battaniye ve su kabı işlemez', () => {
    const { sim, a, b, k2 } = twoKennels(2242);
    sleepAtRest(sim, b, k2);
    a.x = b.x + 4;
    a.y = b.y + 3;
    a.state = 'sleep';
    expect(atKennelRest(sim, a)).toBe(false);
    setNeeds(a);
    setNeeds(b);
    sim.needs.update(60);
    expect(a.needs.energy).toBeCloseTo(b.needs.energy, 5);
    expect(a.needs.hygiene).toBeCloseTo(b.needs.hygiene, 5);
    expect(a.needs.thirst).toBeCloseTo(b.needs.thirst, 5);
  });

  it('oyuncak sepeti: uyanıkken keyif %25 yavaş düşer', () => {
    const { sim, a, b } = twoKennels(2243);
    for (const d of [a, b]) {
      d.state = 'idle';
      d.path = [];
      expect(sim.world.zoneAt(d.tileX, d.tileY)).not.toBe(Zone.Play);
    }
    setNeeds(a);
    setNeeds(b);
    sim.needs.update(60);
    expect((60 - a.needs.play) / (60 - b.needs.play)).toBeCloseTo(K.toyPlayDecayMul, 5);
  });

  it('battaniye hastalanma olasılığını %25 düşürür; yatak köpek başına (büyük kulübede tek yatak ilk köpeğin)', () => {
    const { sim, a, b } = twoKennels(2244);
    expect(illnessChanceMul(sim, a) / illnessChanceMul(sim, b)).toBeCloseTo(K.blanketIllnessMul, 5);
    const p = sim.world.plotInterior();
    let large: Building | null = null;
    for (let y = p.y + 2; y < p.y + p.h - 4 && !large; y++) {
      for (let x = p.x + 2; x < p.x + p.w - 4 && !large; x++) if (canPlaceBuilding(sim.world, 'kennelLarge', x, y)) large = sim.placeBuilding('kennelLarge', x, y);
    }
    expect(large).not.toBeNull();
    const d1 = sim.addDog(a.genome, 'egg', 20, large!.x + 0.5, large!.y + 2.5);
    const d2 = sim.addDog(a.genome, 'egg', 20, large!.x + 1.5, large!.y + 2.5);
    sim.command({ type: 'assignKennel', dogId: d1.id, buildingId: large!.id });
    sim.command({ type: 'assignKennel', dogId: d2.id, buildingId: large!.id });
    expect(large!.occupants).toEqual([d1.id, d2.id]);
    large!.furniture.push('dogBed', 'dogToy');
    expect(kennelComfort(sim, d1).bed).toBe(true);
    expect(kennelComfort(sim, d2).bed).toBe(false);
    expect(kennelComfort(sim, d2).toy).toBe(true);
    large!.furniture.push('dogBed');
    expect(kennelComfort(sim, d2).bed).toBe(true);
    expect(kennelFurnishing(large!)).toBe(2);
    // Hazır olmayan kulübenin eşyası işlemez.
    large!.buildLeft = 10;
    expect(kennelComfort(sim, d1).count).toBe(0);
  });

  it('pencere dekoru +1 (tavan aynı); denetimde Konfor kalemi yalnız artı; beş eşya başarımı; kayıtta korunur', () => {
    const sim = Sim.create(2245);
    const [k1, k2] = sim.buildings.filter((x) => x.type === 'kennelSmall');
    const base = sim.decorScore();
    const before = runInspection(sim);
    const konfor0 = before.items.find((i) => i.name === 'Konfor')!;
    expect(konfor0.value).toBe('%0');
    expect(konfor0.effect).toBe(0);
    expect(furnishedRatio(sim)).toBe(0);
    k1.furniture.push('kennelWindow');
    expect(sim.decorScore()).toBeCloseTo(Math.min(BALANCE.decor.max, base + K.windowDecor));
    k2.furniture.push('kennelWindow');
    expect(sim.decorScore()).toBeCloseTo(Math.min(BALANCE.decor.max, base + 2 * K.windowDecor));
    k1.furniture.push('dogBed', 'blanket', 'dogBowl', 'dogToy');
    expect(furnishedRatio(sim)).toBeCloseTo(6 / 10, 5);
    const after = runInspection(sim);
    const konfor = after.items.find((i) => i.name === 'Konfor')!;
    expect(konfor.value).toBe('%60');
    expect(konfor.effect).toBeCloseTo(0.6 * K.inspectionBonus, 5);
    expect(after.multiplier).toBeGreaterThanOrEqual(before.multiplier);
    expect(sim.achievements.unlocked.has('comfy-kennel')).toBe(false);
    sim.achievements.check();
    expect(sim.achievements.unlocked.has('comfy-kennel')).toBe(true);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.decorScore()).toBeCloseTo(sim.decorScore());
    expect(furnishedRatio(back)).toBeCloseTo(6 / 10, 5);
    expect(back.achievements.unlocked.has('comfy-kennel')).toBe(true);
  });

  it('kulübesiz barınakta Konfor kalemi yok', () => {
    const sim = Sim.create(2246, 'normal', 'guided');
    expect(sim.buildings.some((b) => b.type === 'kennelSmall' || b.type === 'kennelLarge')).toBe(false);
    expect(furnishedRatio(sim)).toBeNull();
    expect(runInspection(sim).items.some((i) => i.name === 'Konfor')).toBe(false);
  });
});
