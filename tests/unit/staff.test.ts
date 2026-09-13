import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { defaultSchedule } from '../../src/sim/entities/Staff';
import { Sim } from '../../src/sim/Sim';
import { Obj } from '../../src/sim/world/tiles';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

function hireRole(sim: Sim, role: 'caretaker' | 'trainer' | 'vet') {
  let c = sim.candidates.find((x) => x.role === role);
  if (!c) {
    sim.staffSystem.refreshCandidates();
    c = sim.candidates.find((x) => x.role === role);
  }
  if (!c) {
    // Rolü zorla
    c = sim.candidates[0];
    c.role = role;
    c.priorities = { feed: 4, water: 4, clean: 4, play: 3, groom: 2, train: role === 'trainer' ? 5 : 0, treat: role === 'vet' ? 5 : 0 };
  }
  const r = sim.command({ type: 'hire', candidateId: c.id });
  expect(r.ok).toBe(true);
  const s = sim.staff.find((x) => x.id === c!.id)!;
  s.schedule = new Array(24).fill(1) as typeof s.schedule; // her saat çalış
  return s;
}

describe('Personel', () => {
  it('adaylar her gün yenilenir, işe alınan personel vardiyada kapıdan gelir', () => {
    const sim = Sim.create(91);
    expect(sim.candidates.length).toBe(BALANCE.staff.candidatesPerDay);
    const names = sim.candidates.map((c) => c.name);
    const s = hireRole(sim, 'caretaker');
    expect(sim.staff.length).toBe(1);
    expect(sim.candidates.length).toBe(BALANCE.staff.candidatesPerDay - 1);
    expect(s.state).toBe('offDuty');
    runMinutes(sim, 10);
    expect(s.onDuty).toBe(true);
    expect(sim.world.inPlot(s.tileX, s.tileY)).toBe(true);
    // Ertesi gün adaylar yenilenir
    sim.clock.totalMinutes = 24 * 60 + 5 * 60 + 58;
    runMinutes(sim, 10);
    expect(sim.candidates.length).toBe(BALANCE.staff.candidatesPerDay);
    expect(sim.candidates.map((c) => c.name).join()).not.toBe(names.join());
  });

  it('bakıcı boş kabı doldurur ve pisliği temizler', () => {
    const sim = Sim.create(92);
    const s = hireRole(sim, 'caretaker');
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    const dog = sim.shelterDogs()[0];
    dog.needs.hunger = 10;
    dog.needs.play = 90;
    dog.needs.hygiene = 90;
    dog.needs.health = 95;
    dog.state = 'sit';
    dog.stateTimer = 9999;
    const mx = dog.tileX + 4;
    const my = dog.tileY + 2;
    sim.world.setObject(mx, my, Obj.Mess);
    sim.messTiles.add(sim.world.idx(mx, my));
    const stock0 = sim.foodStock;
    runMinutes(sim, 180);
    expect(bowl.food).toBeGreaterThan(0);
    expect(sim.foodStock).toBeLessThan(stock0);
    expect(sim.messTiles.size).toBe(0);
    expect(sim.stats.staffTasks).toBeGreaterThanOrEqual(2);
    expect(s.energy).toBeLessThan(100);
  });

  it('öncelik 0 olan görevi yapmaz, vardiya dışında çalışmaz', () => {
    const sim = Sim.create(93);
    const s = hireRole(sim, 'caretaker');
    s.priorities.feed = 0;
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    for (const t of sim.messTiles) sim.messTiles.delete(t);
    runMinutes(sim, 120);
    expect(bowl.food).toBe(0);
    // Vardiya dışı: her saat izin
    s.priorities.feed = 4;
    s.schedule = new Array(24).fill(0) as typeof s.schedule;
    runMinutes(sim, 60);
    expect(s.state).toBe('offDuty');
    expect(bowl.food).toBe(0);
  });

  it('eğitmen köpeği eğitir, politika kapalıysa eğitmez', () => {
    const sim = Sim.create(94);
    const s = hireRole(sim, 'trainer');
    s.priorities.play = 0;
    const dog = sim.shelterDogs()[0];
    dog.needs.energy = 100;
    dog.needs.hunger = 10;
    dog.needs.play = 90;
    dog.needs.hygiene = 90;
    const p0 = dog.skills.potty;
    runMinutes(sim, 240);
    expect(dog.skills.potty).toBeGreaterThan(p0);
    const sim2 = Sim.create(94);
    hireRole(sim2, 'trainer');
    sim2.command({ type: 'setPolicy', policy: { trainTarget: 0 } });
    const d2 = sim2.shelterDogs()[0];
    d2.needs.energy = 100;
    const q0 = d2.skills.potty;
    runMinutes(sim2, 240);
    expect(d2.skills.potty).toBe(q0);
  });

  it('otomatik yem siparişi politikası', () => {
    const sim = Sim.create(95);
    sim.foodStock = 3;
    sim.command({ type: 'setPolicy', policy: { autoOrderFood: true, foodThreshold: 10 } });
    const m0 = sim.money;
    runMinutes(sim, 5);
    expect(sim.foodStock).toBeGreaterThanOrEqual(10);
    expect(sim.money).toBeLessThan(m0);
    expect(sim.stats.autoOrders).toBeGreaterThanOrEqual(1);
  });

  it('maaşlar hafta sonunda ödenir, kasa eksideyse istifa', () => {
    const sim = Sim.create(96);
    const s = hireRole(sim, 'vet');
    expect(sim.weeklyWages()).toBe(s.wage);
    sim.clock.totalMinutes = 7 * 24 * 60 + 5 * 60 + 58;
    const m0 = sim.money;
    runMinutes(sim, 5);
    expect(sim.weeks[0].expense.wages).toBe(s.wage);
    expect(sim.money).toBeLessThan(m0 + (sim.weeks[0].income.aid ?? 0));
    expect(s.unpaidWeeks).toBe(0);
    // Parasız iki hafta: istifa
    sim.money = -5000;
    sim.clock.totalMinutes = 14 * 24 * 60 + 5 * 60 + 58;
    runMinutes(sim, 5);
    expect(s.unpaidWeeks).toBe(1);
    expect(sim.staff.length).toBe(1);
    sim.money = -5000;
    sim.clock.totalMinutes = 21 * 24 * 60 + 5 * 60 + 58;
    runMinutes(sim, 5);
    expect(sim.staff.length).toBe(0);
  });

  it('işten çıkarma tazminat öder; vardiya ve öncelikler kayıtta korunur', () => {
    const sim = Sim.create(97);
    const s = hireRole(sim, 'caretaker');
    sim.command({ type: 'setShift', staffId: s.id, hour: 3, value: 2 });
    sim.command({ type: 'setPriority', staffId: s.id, task: 'clean', value: 1 });
    sim.command({ type: 'setSchedule', staffId: s.id, schedule: defaultSchedule('night') });
    expect(s.schedule[22]).toBe(1);
    expect(s.schedule[10]).toBe(0);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.staff.length).toBe(1);
    expect(back.staff[0].schedule).toEqual(s.schedule);
    expect(back.staff[0].priorities.clean).toBe(1);
    expect(back.candidates.length).toBe(sim.candidates.length);
    const m0 = sim.money;
    expect(sim.command({ type: 'fire', staffId: s.id }).ok).toBe(true);
    expect(sim.staff.length).toBe(0);
    expect(sim.money).toBe(m0 - s.wage);
  });
});
