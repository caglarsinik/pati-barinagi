import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { Rng } from '../../src/core/Rng';
import { SaveManager } from '../../src/core/SaveManager';
import { createEgg } from '../../src/sim/entities/Egg';
import { Sim } from '../../src/sim/Sim';
import { type MorningReport, buildMorningReport, takeDaySnapshot } from '../../src/sim/systems/DayReport';

describe('Sabah raporu ve dönüş kartı (0.19.2)', () => {
  it('gün dönümünde biten günün özeti saklanır; uyanınca sabah raporu dün ve bugünle gelir', () => {
    const sim = Sim.create(1931);
    expect(sim.lastDay).toBeNull();
    const start = { ...sim.dayStart };
    expect(start).toEqual(takeDaySnapshot(sim));
    expect(start.day).toBe(1);
    const reports: MorningReport[] = [];
    const seen: { v?: Record<string, number> } = {};
    // Sim'in kendi gün dinleyicisi önce çalışır; aynı andaki sayaçlardan beklenen fark.
    sim.events.on('day', () => {
      seen.v = {
        day: 1,
        money: Math.round(sim.money) - start.money,
        adopted: sim.stats.adopted - start.adopted,
        hatched: sim.stats.hatched - start.hatched,
        strays: sim.stats.strays - start.strays,
        cured: sim.stats.cured - start.cured,
      };
    });
    sim.events.on('morning', (r) => reports.push(r));
    sim.stats.adopted += 2;
    sim.stats.hatched += 1;
    sim.stats.strays += 1;
    sim.stats.cured += 1;
    sim.money += 500;
    sim.sleepUntilMorning();
    expect(sim.clock.day).toBe(2);
    expect(sim.lastDay).toMatchObject(seen.v!);
    expect(sim.lastDay!.adopted).toBeGreaterThanOrEqual(2);
    expect(sim.dayStart.day).toBe(2);
    expect(reports).toHaveLength(1);
    const r = reports[0];
    expect(r.kind).toBe('morning');
    expect(r.passedOut).toBe(false);
    expect(r.day).toBe(2);
    expect(r.weekday).toBe(1);
    expect(r.yesterday).toEqual(sim.lastDay);
    // Bayılma da rapor verir.
    sim.sleepUntilMorning(true);
    expect(reports).toHaveLength(2);
    expect(reports[1].passedOut).toBe(true);
    expect(reports[1].yesterday?.day).toBe(2);
  });

  it('bugün: çatlayacak yumurta, hasta köpek, yem günü, personel, sahiplendirme, sıradaki hedef', () => {
    const sim = Sim.create(1932);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const rng = new Rng(7);
    const soon = createEgg(sim.nextId++, rng, 'common', 1);
    soon.hatchLeft = 600;
    const later = createEgg(sim.nextId++, rng, 'common', 1);
    later.hatchLeft = MINUTES_PER_DAY * 2;
    inc.eggs.push(soon, later);
    const dog = sim.shelterDogs()[0];
    let r = buildMorningReport(sim, 'welcome');
    expect(r.kind).toBe('welcome');
    expect(r.eggsSoon).toBe(1);
    expect(r.nurseryEggs).toBe(0);
    expect(r.dogs).toBe(1);
    const bowls = sim.buildings.filter((b) => b.type === 'bowl').reduce((a, b) => a + b.food, 0);
    expect(r.foodDays).toBeCloseTo((sim.foodStock + bowls) / (dog.portion() * BALANCE.time.mealHours.length), 5);
    expect(r.staffToday).toBe(0);
    expect(r.adoptionsOpen).toBe(true);
    expect(r.goal?.title).toBe('Yuvadan yumurta al');
    expect(r.goal?.reward).toBeGreaterThan(0);

    dog.needs.health = 20;
    expect(sim.command({ type: 'hire', candidateId: sim.candidates[0].id }).ok).toBe(true);
    sim.policies.adoptionsOpen = false;
    r = buildMorningReport(sim, 'morning');
    expect(r.sickDogs).toBe(1);
    expect(r.adoptableDogs).toBe(0);
    expect(r.adoptionsOpen).toBe(false);
    expect(r.staffToday).toBe(1);

    // Köpek yoksa yem süresi hesaplanmaz.
    const empty = Sim.create(1933, 'normal', 'guided');
    for (const d of empty.shelterDogs()) empty.dogs.splice(empty.dogs.indexOf(d), 1);
    expect(buildMorningReport(empty, 'welcome').foodDays).toBeNull();
  });

  it('kayıt: gün sayaçları korunur; eski kayıtta yüklemedeki değerlerle başlar, dün özeti yok', () => {
    const sim = Sim.create(1934);
    sim.stats.adopted += 3;
    sim.sleepUntilMorning();
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.dayStart).toEqual(sim.dayStart);
    expect(back.lastDay).toEqual(sim.lastDay);
    expect(back.lastDay?.day).toBe(1);

    const old = sim.toJSON() as unknown as Record<string, unknown>;
    delete old.dayStart;
    delete old.lastDay;
    const ob = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    expect(ob.lastDay).toBeNull();
    expect(ob.dayStart).toEqual(takeDaySnapshot(ob));
    expect(buildMorningReport(ob, 'welcome').yesterday).toBeNull();

    // Bozuk alan varsayılana döner.
    const bad = sim.toJSON() as unknown as Record<string, unknown>;
    bad.dayStart = { day: 'x' };
    bad.lastDay = 5;
    const bb = Sim.fromJSON(SaveManager.parse(JSON.stringify(bad))!);
    expect(bb.dayStart).toEqual(takeDaySnapshot(bb));
    expect(bb.lastDay).toBeNull();
  });
});
