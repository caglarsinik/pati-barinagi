import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { ACHIEVEMENTS } from '../../src/sim/systems/Achievements';
import type { AdoptionRecord } from '../../src/sim/systems/AdoptionSystem';
import { albumEntries, albumStats, familyLast, pickReturningFamily, returningCandidates } from '../../src/sim/systems/Stories';
import { Sim } from '../../src/sim/Sim';

function day(sim: Sim, d: number, hour = 10): void {
  sim.clock.totalMinutes = (d - 1) * MINUTES_PER_DAY + hour * 60;
}

function rec(sim: Sim, key: number, score: number, extra: Partial<AdoptionRecord> = {}): AdoptionRecord {
  const g = sim.shelterDogs()[0].genome;
  return { day: 1, dogName: `Köpek${key}`, adopterName: `Aile ${key}`, fee: 200, score, key, family: key, type: 'retiree', look: 77, genome: { ...g }, stage: 'adult', ...extra };
}

describe('Mezunlar albümü ve tekrar gelen aileler (0.21.2)', () => {
  it('albüm yeniden eskiye; yıldız, sahne, rozetler ve son mektup; süzgeçler ve başlık sayıları', () => {
    const sim = Sim.create(2701);
    const r1 = rec(sim, 1, 95, { type: 'artist', letterDay: 1 });
    const r2 = rec(sim, 2, 55, { villager: 2 });
    const r3 = rec(sim, 3, 40, { returned: true });
    const r4 = rec(sim, 4, 80, { family: 1, dogName: 'Yeni' });
    sim.adoptions.push(r1, r2, r3, r4);
    day(sim, 2, 11);
    expect(sim.mail.deliverDue()).toHaveLength(1);
    const all = albumEntries(sim);
    expect(all.map((e) => e.record)).toEqual([r4, r3, r2, r1]);
    expect(all.map((e) => e.stars)).toEqual([4, 2, 3, 5]);
    const [e4, e3, e2, e1] = all;
    expect(e1.scene).toBe('studio');
    expect(e1.letter?.key).toBe(1);
    expect(e2.scene).toBe('village');
    expect(e2.village).toBe(true);
    expect(e3.returned).toBe(true);
    expect(e4.returning).toBe(true);
    expect(e1.returning).toBe(false);
    expect(albumEntries(sim, 'village').map((e) => e.record)).toEqual([r2]);
    expect(albumEntries(sim, 'letters').map((e) => e.record)).toEqual([r1]);
    expect(albumStats(sim)).toEqual({ total: 4, happyPct: 50, returned: 1 });
    expect(familyLast(sim, 1)).toBe(r4);
    // Eski kayıt (anahtarsız, görünümsüz) albümde silüetle durur.
    sim.adoptions.push({ day: 1, dogName: 'Eski', adopterName: 'Eski Aile', fee: 100, score: 90 });
    expect(albumEntries(sim)[0].record.genome).toBeUndefined();
  });

  it('tekrar gelebilecek aile: harika eşleşme, en az 7 gün, geri getirmemiş, köylü değil, en çok 3 sahiplendirme', () => {
    const sim = Sim.create(2702);
    sim.adoptions.push(
      rec(sim, 10, 90),
      rec(sim, 11, 65),
      rec(sim, 12, 90, { villager: 1 }),
      rec(sim, 13, 90, { returned: true }),
      rec(sim, 14, 90),
      rec(sim, 15, 90, { family: 14 }),
      rec(sim, 16, 90, { family: 14 }),
    );
    day(sim, 1 + BALANCE.stories.returnMinDays - 1);
    expect(returningCandidates(sim)).toHaveLength(0);
    day(sim, 1 + BALANCE.stories.returnMinDays);
    expect(returningCandidates(sim).map((c) => c.family)).toEqual([10]);
    // Seçim ayrı RNG'den, kimlikten deterministik; olasılık tavanın altında.
    let hits = 0;
    for (let id = 1; id <= 400; id++) {
      const a = pickReturningFamily(sim, id);
      if (a) hits++;
      expect(pickReturningFamily(sim, id)?.family).toBe(a?.family);
    }
    expect(hits).toBeGreaterThan(20);
    expect(hits).toBeLessThan(400 * BALANCE.stories.returnChanceMax);
  });

  it('tekrar gelen sahiplenici ailenin adı, görünümü ve tipiyle gelir; ücret ve sabır artar; sahiplendirmede ek itibar ve aile bağı', () => {
    const sim = Sim.create(2703);
    sim.adoptions.push(rec(sim, 20, 92, { adopterName: 'Hakan Akın', look: 4242, type: 'retiree', dogName: 'Karamel' }));
    day(sim, 1 + BALANCE.stories.returnMinDays);
    let id = sim.nextId;
    while (!pickReturningFamily(sim, id)) id++;
    sim.nextId = id;
    const a = sim.adoption.spawnAdopter()!;
    expect(a.family).toBe(20);
    expect(a.name).toBe('Hakan Akın');
    expect(a.look).toBe(4242);
    expect(a.type).toBe('retiree');
    expect(a.fee % 10).toBe(0);
    const base = BALANCE.adoption.patienceMinutes * 1.5 + sim.decorScore() * BALANCE.decor.patiencePerPoint;
    expect(a.patienceLeft).toBeCloseTo(base * BALANCE.stories.returnPatienceMul);
    // Sırada olan aile yeniden aday değil.
    expect(returningCandidates(sim)).toHaveLength(0);

    const dog = sim.shelterDogs()[0];
    dog.needs.health = 100;
    dog.needs.hygiene = 100;
    dog.needs.loyalty = 100;
    a.state = 'waiting';
    a.request = { temperament: dog.genome.temperament };
    const rep0 = sim.reputation;
    const r = sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('Karamel');
    const last = sim.adoptions[sim.adoptions.length - 1];
    expect(last.family).toBe(20);
    expect(last.key).toBe(a.id);
    const score = last.score;
    const B = BALANCE.adoption;
    const gain = (score >= 70 ? B.repGood + Math.round((score - 70) / 10) : score >= 50 ? B.repOk : -B.repBad) + BALANCE.stories.returnRep;
    expect(sim.reputation).toBe(Math.min(100, rep0 + gain));
    expect(familyLast(sim, 20)).toBe(last);
    expect(ACHIEVEMENTS.find((x) => x.id === 'loyal-family')!.check(sim)).toBe(true);
  });

  it('kayıt turu: sahiplenicinin ve kayıtların aile bağı korunur; tekrar gelme ana RNG sırasını değiştirmez', () => {
    const sim = Sim.create(2704);
    sim.adoptions.push(rec(sim, 30, 95));
    day(sim, 1 + BALANCE.stories.returnMinDays);
    let id = sim.nextId;
    while (!pickReturningFamily(sim, id)) id++;
    sim.nextId = id;
    const a = sim.adoption.spawnAdopter()!;
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect(back.adopters.find((x) => x.id === a.id)?.family).toBe(30);
    expect(back.adoptions[0].family).toBe(30);

    // Aynı tohum: biri tekrar gelen aileyle, öbürü sıradan sahiplenici; ana RNG aynı ilerler.
    const x = Sim.create(2705);
    const y = Sim.create(2705);
    y.adoptions.push(rec(y, 40, 95));
    day(x, 9);
    day(y, 9);
    let yid = y.nextId;
    while (!pickReturningFamily(y, yid)) yid++;
    x.nextId = y.nextId = yid;
    const xa = x.adoption.spawnAdopter()!;
    const ya = y.adoption.spawnAdopter()!;
    expect(ya.family).toBe(40);
    expect(xa.family).toBeUndefined();
    expect(x.rng.next()).toBe(y.rng.next());
  });
});
