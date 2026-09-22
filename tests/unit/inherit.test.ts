import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Rng } from '../../src/core/Rng';
import { SaveManager } from '../../src/core/SaveManager';
import { COAT_COLORS, type DogGenome, RARITY_ORDER, inheritGenome, isValidGenome, randomGenome } from '../../src/sim/entities/DogGenome';
import type { Egg } from '../../src/sim/entities/Egg';
import { Sim } from '../../src/sim/Sim';

const N = 2000;

function parents(seed: number, ra: DogGenome['rarity'], rb: DogGenome['rarity']): [DogGenome, DogGenome] {
  const rng = new Rng(seed);
  return [randomGenome(rng, ra), randomGenome(rng, rb)];
}

function children(a: DogGenome, b: DogGenome, seed: number, n = N): DogGenome[] {
  const rng = new Rng(seed);
  return Array.from({ length: n }, () => inheritGenome(a, b, rng));
}

describe('Kalıtım (inheritGenome)', () => {
  it('her özellik ebeveynlerden gelir; ortak değerden sapma yalnız mutasyonla (~%10 × 2/3)', () => {
    const [a0, b0] = parents(1, 'common', 'common');
    const a = { ...a0, size: 'M' as const, ears: 'pointy' as const };
    const b = { ...b0, size: 'M' as const, ears: 'pointy' as const };
    const kids = children(a, b, 2);
    const offSize = kids.filter((k) => k.size !== 'M').length / N;
    const offEars = kids.filter((k) => k.ears !== 'pointy').length / N;
    const expected = BALANCE.breeding.mutation * (2 / 3);
    expect(offSize).toBeGreaterThan(expected - 0.03);
    expect(offSize).toBeLessThan(expected + 0.03);
    expect(offEars).toBeGreaterThan(expected - 0.03);
    expect(offEars).toBeLessThan(expected + 0.03);
  });

  it('farklı ebeveynlerde çocuk çoğunlukla birinin değerini alır, ikisi de görülür', () => {
    const [a0, b0] = parents(3, 'common', 'common');
    const a = { ...a0, size: 'S' as const };
    const b = { ...b0, size: 'L' as const };
    const kids = children(a, b, 4);
    const s = kids.filter((k) => k.size === 'S').length / N;
    const l = kids.filter((k) => k.size === 'L').length / N;
    expect(s).toBeGreaterThan(0.4);
    expect(l).toBeGreaterThan(0.4);
    expect(1 - s - l).toBeLessThan(0.07); // 'M' yalnız mutasyonla
    for (const k of kids) {
      expect(k.intelligence).toBeGreaterThanOrEqual(1);
      expect(k.intelligence).toBeLessThanOrEqual(5);
    }
  });

  it('nadirlik ebeveynlerin yükseğinden aşağı düşmez, ~%15 bir kademe çıkar; efsanevi efsanevide kalır', () => {
    const [a, b] = parents(5, 'common', 'rare');
    const kids = children(a, b, 6);
    expect(kids.every((k) => RARITY_ORDER[k.rarity] >= RARITY_ORDER.rare)).toBe(true);
    const up = kids.filter((k) => k.rarity === 'legendary').length / N;
    expect(up).toBeGreaterThan(BALANCE.breeding.rarityUp - 0.03);
    expect(up).toBeLessThan(BALANCE.breeding.rarityUp + 0.03);
    const [la, lb] = parents(7, 'legendary', 'legendary');
    expect(children(la, lb, 8, 300).every((k) => k.rarity === 'legendary')).toBe(true);
  });

  it('genom her zaman geçerli, renk nadirliğe uygun; aynı tohum aynı sonuç', () => {
    const [a, b] = parents(9, 'uncommon', 'rare');
    const kids = children(a, b, 10);
    for (const k of kids) {
      expect(isValidGenome(k)).toBe(true);
      expect(RARITY_ORDER[COAT_COLORS[k.coat].minRarity]).toBeLessThanOrEqual(RARITY_ORDER[k.rarity]);
      expect(RARITY_ORDER[COAT_COLORS[k.secondary].minRarity]).toBeLessThanOrEqual(RARITY_ORDER[k.rarity]);
    }
    expect(children(a, b, 11, 50)).toEqual(children(a, b, 11, 50));
  });
});

describe('Soy bilgisi', () => {
  it('soylu yumurta çatlayınca yavru anne-babayı taşır; kayıt gidiş-dönüşünde korunur', () => {
    const sim = Sim.create(2201);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const [a, b] = parents(12, 'common', 'uncommon');
    const egg: Egg = { id: sim.nextId++, genome: inheritGenome(a, b, new Rng(13)), foundDay: 1, hatchLeft: -1, parents: [101, 102], parentNames: ['Anne', 'Baba'] };
    sim.backpack.push(egg);
    const saved = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(saved.backpack[0].parents).toEqual([101, 102]);
    expect(saved.backpack[0].parentNames).toEqual(['Anne', 'Baba']);

    expect(sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id }).ok).toBe(true);
    sim.setSpeed(4);
    const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
    for (let i = 0; i < Math.ceil((BALANCE.eggs.hatchDays * 24 * 60 + 30) / perStep); i++) sim.update(0.5);
    const pup = sim.dogs.find((d) => d.parents !== null)!;
    expect(pup).toBeTruthy();
    expect(pup.parents).toEqual([101, 102]);
    expect(pup.parentNames).toEqual(['Anne', 'Baba']);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.dogById(pup.id)!.parentNames).toEqual(['Anne', 'Baba']);
    // Eski köpeklerde soy yok.
    expect(back.dogs.find((d) => d.id !== pup.id)!.parents).toBeNull();
  });
});
