import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { matchScore, requestText } from '../../src/sim/entities/Adopter';
import { Sim } from '../../src/sim/Sim';
import { runInspection } from '../../src/sim/systems/EconomySystem';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Köpeği sahiplendirilebilir hale getirir. */
function makeAdoptable(sim: Sim): void {
  for (const d of sim.shelterDogs()) {
    d.needs.health = 95;
    d.needs.hygiene = 90;
    d.needs.loyalty = 60;
    d.needs.hunger = 20;
  }
}

describe('Sahiplendirme', () => {
  it('sahiplenici gelir, ofis önünde bekler, eşleşince ücret ve itibar', () => {
    const sim = Sim.create(81);
    makeAdoptable(sim);
    sim.clock.totalMinutes = 9 * 60;
    const a = sim.adoption.spawnAdopter()!;
    expect(a).toBeTruthy();
    expect(a.state).toBe('walking');
    expect(a.path.length).toBeGreaterThan(0);
    expect(requestText(a.request).length).toBeGreaterThan(5);
    runMinutes(sim, 60);
    expect(a.state).toBe('waiting');
    const office = sim.buildings.find((b) => b.type === 'office')!;
    expect(Math.abs(a.x - (office.x + 1.5))).toBeLessThan(4);
    expect(a.y).toBeGreaterThan(office.y + 2);
    // Eşleşme puanı ve sahiplendirme
    const dog = sim.shelterDogs()[0];
    a.request = { size: dog.genome.size, temperament: dog.genome.temperament };
    const score = matchScore(dog, a.request);
    expect(score).toBeGreaterThanOrEqual(70);
    const m0 = sim.money;
    const rep0 = sim.reputation;
    const r = sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(m0 + a.fee);
    expect(sim.reputation).toBeGreaterThan(rep0);
    expect(sim.shelterDogs().length).toBe(0);
    expect(sim.stats.adopted).toBe(1);
    expect(a.state).toBe('leaving');
    expect(sim.ledger.some((e) => e.category === 'adoption' && e.amount === a.fee)).toBe(true);
    runMinutes(sim, 120);
    expect(sim.adopters.some((x) => x.id === a.id)).toBe(false);
  });

  it('zorunlu şart tutmayınca puan 0, uygun olmayan köpek reddedilir', () => {
    const sim = Sim.create(82);
    const dog = sim.shelterDogs()[0];
    expect(matchScore(dog, { size: dog.genome.size === 'S' ? 'L' : 'S' })).toBe(0);
    expect(matchScore(dog, {})).toBeGreaterThanOrEqual(85);
    sim.clock.totalMinutes = 9 * 60;
    const a = sim.adoption.spawnAdopter()!;
    a.state = 'waiting';
    a.request = {};
    dog.needs.loyalty = 5;
    expect(sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id }).ok).toBe(false);
    expect(sim.command({ type: 'declineAdopter', adopterId: a.id }).ok).toBe(true);
    expect(a.state).toBe('leaving');
  });

  it('ilgilenilmeyen sahiplenici gider ve itibar düşer', () => {
    const sim = Sim.create(83);
    sim.clock.totalMinutes = 9 * 60;
    const a = sim.adoption.spawnAdopter()!;
    a.state = 'waiting';
    a.path = [];
    const rep0 = sim.reputation;
    runMinutes(sim, BALANCE.adoption.patienceMinutes + 30);
    expect(sim.reputation).toBe(rep0 - BALANCE.adoption.repLeaveUnserved);
    expect(sim.adopters.find((x) => x.id === a.id)?.state ?? 'gone').not.toBe('waiting');
  });

  it('gün planı sahiplenici üretir (ilk günler garanti)', () => {
    const sim = Sim.create(84);
    makeAdoptable(sim);
    let arrived = 0;
    sim.events.on('adopterArrived', () => arrived++);
    runMinutes(sim, 12 * 60); // 06:00 -> 18:00
    expect(arrived).toBeGreaterThanOrEqual(1);
    expect(arrived).toBeLessThanOrEqual(BALANCE.adoption.dailyMax);
  });

  it('zayıf eşleşme geri gelebilir', () => {
    const sim = Sim.create(85);
    makeAdoptable(sim);
    const dog = sim.shelterDogs()[0];
    sim.clock.totalMinutes = 9 * 60;
    // Şanslı olana kadar dene: geri dönüş ihtimali %20
    let returned = false;
    for (let attempt = 0; attempt < 40 && !returned; attempt++) {
      const a = sim.adoption.spawnAdopter()!;
      a.state = 'waiting';
      a.request = { temperament: dog.genome.temperament === 'calm' ? 'bold' : 'calm', minTraining: 3, pottyTrained: true };
      expect(matchScore(dog, a.request)).toBeLessThan(50);
      const r = sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id });
      expect(r.ok).toBe(true);
      if (sim.pendingReturns.length > 0) {
        returned = true;
        runMinutes(sim, (BALANCE.adoption.returnAfterDays + 1) * 24 * 60);
        expect(sim.pendingReturns.length).toBe(0);
        expect(sim.shelterDogs().some((d) => d.name === dog.name)).toBe(true);
      } else {
        // Köpeği geri koy ve tekrar dene
        const back = sim.addDog(dog.genome, 'egg', dog.ageWeeks, dog.x, dog.y, dog.name);
        back.needs = { ...dog.needs };
        Object.assign(dog, back);
      }
    }
    expect(returned).toBe(true);
  });
});

describe('Ekonomi', () => {
  it('hafta tikinde denetim, yardım ve bakım gideri işlenir', () => {
    const sim = Sim.create(86);
    makeAdoptable(sim);
    const reports: number[] = [];
    sim.events.on('weekReport', (w) => reports.push(w.week));
    const insp = runInspection(sim);
    expect(insp.multiplier).toBeGreaterThanOrEqual(BALANCE.economy.aidMultiplierMin);
    expect(insp.multiplier).toBeLessThanOrEqual(BALANCE.economy.aidMultiplierMax);
    expect(insp.dogsCounted).toBe(1);
    // Haftayı kapat: 7 gün ileri (Pazartesi 06:00)
    const m0 = sim.money;
    sim.clock.totalMinutes = 7 * 24 * 60 + 5 * 60 + 55;
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 4;
    runMinutes(sim, 10);
    expect(reports).toEqual([1]);
    expect(sim.weeks.length).toBe(1);
    const w = sim.weeks[0];
    expect(w.week).toBe(1);
    expect(w.income.aid).toBeGreaterThan(0);
    expect(w.expense.upkeep).toBeGreaterThan(0);
    expect(sim.lastInspection).not.toBeNull();
    expect(sim.money).toBe(m0 + (w.income.aid ?? 0) - (w.expense.upkeep ?? 0));
  });

  it('lisans yükseltme ve aşımı', () => {
    const sim = Sim.create(87);
    expect(sim.licenseCap()).toBe(8);
    sim.money = 100;
    expect(sim.command({ type: 'upgradeLicense' }).ok).toBe(false);
    sim.money = 5000;
    expect(sim.command({ type: 'upgradeLicense' }).ok).toBe(true);
    expect(sim.licenseLevel).toBe(2);
    expect(sim.licenseCap()).toBe(20);
    expect(sim.money).toBe(1000);
    sim.money = 20000;
    expect(sim.command({ type: 'upgradeLicense' }).ok).toBe(true);
    expect(sim.command({ type: 'upgradeLicense' }).ok).toBe(false);
    // Lisans aşımı yardımı keser
    const sim2 = Sim.create(88);
    for (let i = 0; i < 10; i++) sim2.addDog(sim2.dogs[0].genome, 'egg', 20, sim2.dogs[0].x + 1, sim2.dogs[0].y + 1 + (i % 5));
    const insp = runInspection(sim2);
    expect(insp.dogsCounted).toBe(8);
    expect(insp.dogsOverCap).toBe(3);
    expect(insp.items.some((i) => i.name === 'Lisans aşımı')).toBe(true);
  });

  it('defter ve sahiplenici kayıtta korunur', () => {
    const sim = Sim.create(89);
    sim.command({ type: 'orderFood', bags: 2 });
    sim.clock.totalMinutes = 9 * 60;
    const a = sim.adoption.spawnAdopter()!;
    runMinutes(sim, 60);
    expect(a.state).toBe('waiting');
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.ledger.length).toBe(sim.ledger.length);
    expect(back.ledger[0].category).toBe('food');
    expect(back.adopters.length).toBe(1);
    expect(back.adopters[0].name).toBe(a.name);
    expect(back.adopters[0].request).toEqual(a.request);
    expect(back.reputation).toBe(sim.reputation);
    expect(back.licenseLevel).toBe(1);
  });
});
