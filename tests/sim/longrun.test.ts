import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Sim } from '../../src/sim/Sim';

/** 4x hızda, 30 saniyelik gerçek zaman adımlarıyla ilerletir (uzun koşular için hızlı). */
function runHours(sim: Sim, hours: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  const steps = Math.ceil((hours * 60) / perStep);
  for (let i = 0; i < steps; i++) sim.update(0.5);
}

describe('Uzun koşu', () => {
  it('4 hafta: bir bakıcı + otomatik sipariş ile barınak ayakta kalır, sayılar bozulmaz', () => {
    const sim = Sim.create(2026);
    // Başlangıç: bakıcı al, tam gün çalışsın, yem otomatik gelsin.
    const c = sim.candidates.find((x) => x.role === 'caretaker') ?? sim.candidates[0];
    c.role = 'caretaker';
    c.priorities = { feed: 5, clean: 5, play: 3, groom: 3, train: 0, treat: 0 };
    expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
    const staff = sim.staff[0];
    staff.schedule = new Array(24).fill(1) as typeof staff.schedule;
    staff.schedule[13] = 2;
    sim.command({ type: 'setPolicy', policy: { autoOrderFood: true, foodThreshold: 12 } });
    // Bir köpek daha (yavru) ki iş olsun.
    sim.addDog(sim.dogs[0].genome, 'egg', 1, sim.dogs[0].x + 1, sim.dogs[0].y + 1);

    const dogs = sim.shelterDogs();
    const health: number[] = [];
    for (let day = 0; day < 28; day++) {
      runHours(sim, 24);
      for (const d of sim.shelterDogs()) {
        for (const v of Object.values(d.needs)) expect(Number.isNaN(v)).toBe(false);
      }
      expect(Number.isNaN(sim.money)).toBe(false);
      health.push(Math.min(...sim.shelterDogs().map((d) => d.needs.health)));
    }
    expect(sim.clock.day).toBe(29);
    expect(sim.weeks.length).toBe(4);
    // Köpekler hayatta ve makul sağlıkta.
    for (const d of dogs) {
      expect(d.needs.health).toBeGreaterThan(40);
      expect(d.needs.hunger).toBeLessThan(90);
    }
    // Personel çalıştı, görevler yaptı, istifa etmedi.
    expect(sim.staff.length).toBe(1);
    expect(sim.stats.staffTasks).toBeGreaterThan(40);
    expect(sim.messTiles.size).toBeLessThanOrEqual(4);
    // Ekonomi: yardım geldi, maaş ödendi, kasa tamamen erimedi.
    const aid = sim.weeks.reduce((s, w) => s + (w.income.aid ?? 0), 0);
    const wages = sim.weeks.reduce((s, w) => s + (w.expense.wages ?? 0), 0);
    expect(aid).toBeGreaterThan(0);
    expect(wages).toBe(staff.wage * 4);
    expect(sim.money).toBeGreaterThan(1500);
    // Yavru büyüdü.
    expect(dogs[1].stage).toBe('young');
    console.log(`4 hafta sonu: kasa ${Math.round(sim.money)}, yardım ${aid}, maaş ${wages}, görev ${sim.stats.staffTasks}, min sağlık ${Math.min(...health).toFixed(0)}`);
  });

  it('30 köpek ve 4 personel ile bir gün makul sürede simüle edilir', () => {
    const sim = Sim.create(3030);
    sim.money = 100000;
    const p = sim.world.plotInterior();
    for (let i = 0; i < 29; i++) {
      const g = { ...sim.dogs[0].genome, size: (['S', 'M', 'L'] as const)[i % 3] };
      sim.addDog(g, 'egg', 5 + i, p.x + 4 + (i % 12) * 2, p.y + 12 + Math.floor(i / 12) * 3);
    }
    for (let i = 0; i < 4; i++) {
      if (sim.candidates.length === 0) sim.staffSystem.refreshCandidates();
      const c = sim.candidates[0];
      sim.command({ type: 'hire', candidateId: c.id });
      const s = sim.staff[sim.staff.length - 1];
      s.schedule = new Array(24).fill(1) as typeof s.schedule;
    }
    sim.command({ type: 'setPolicy', policy: { autoOrderFood: true, foodThreshold: 40 } });
    const t0 = performance.now();
    runHours(sim, 24);
    const ms = performance.now() - t0;
    console.log(`30 köpek + 4 personel, 1 gün: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(6000);
    expect(sim.shelterDogs().length).toBe(30);
    for (const d of sim.shelterDogs()) for (const v of Object.values(d.needs)) expect(Number.isNaN(v)).toBe(false);
  });
});
