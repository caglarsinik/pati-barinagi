import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Sim } from '../../src/sim/Sim';
import { type WeekSummary, projectCash } from '../../src/sim/systems/EconomySystem';

function week(n: number, income: number, wages: number, other: number): WeekSummary {
  return { week: n, income: { aid: income }, expense: { wages, upkeep: other }, net: income - wages - other, endMoney: 0, inspection: null };
}

describe('Nakit tahmini (projectCash)', () => {
  it('geçmiş yokken yalnız maaş ve faiz düşer', () => {
    const sim = Sim.create(2001);
    sim.money = 1000;
    sim.weeks = [];
    const p = projectCash(sim, 4);
    expect(p.weeklyNet).toBe(0 - sim.weeklyWages());
    expect(p.points.length).toBe(4);
    expect(p.weeksUntilNegative).toBeNull(); // personel yok: maaş 0
  });

  it('son 3 haftanın ortalamasıyla ilerler, bugünkü maaş ve faizle düzeltilir', () => {
    const sim = Sim.create(2002);
    sim.money = 2000;
    // Maaş dışı net: +1000, +700, +400 → ortalama +700; eski maaşlar tahmine girmez.
    sim.weeks = [week(1, 5000, 999, 0), week(2, 1500, 300, 500), week(3, 1200, 300, 500), week(4, 900, 300, 500)];
    sim.loan = 0;
    expect(sim.weeklyWages()).toBe(0);
    const p = projectCash(sim, 3);
    expect(p.weeklyNet).toBe(700);
    expect(p.points).toEqual([2700, 3400, 4100]);
    expect(p.weeksUntilNegative).toBeNull();
  });

  it('kasa eksiye düşecekse kaç hafta sonra olduğunu söyler (kredi faizi dahil)', () => {
    const sim = Sim.create(2003);
    sim.money = 1000;
    sim.weeks = [week(1, 600, 0, 1000), week(2, 600, 0, 1000)];
    sim.loan = 5000;
    const interest = Math.round(5000 * BALANCE.economy.loan.weeklyInterest);
    const p = projectCash(sim, 4);
    expect(p.weeklyNet).toBe(-400 - interest);
    expect(p.weeksUntilNegative).toBe(2);
    expect(p.points[0]).toBe(1000 - 400 - interest);
  });
});
