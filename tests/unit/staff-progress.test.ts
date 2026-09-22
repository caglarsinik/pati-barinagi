import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { type Staff, xpForLevel } from '../../src/sim/entities/Staff';
import { Sim } from '../../src/sim/Sim';

const P = BALANCE.staff.progress;
const M = BALANCE.staff.morale;

function hire(sim: Sim, role: 'caretaker' | 'trainer' | 'vet' = 'caretaker'): Staff {
  if (sim.candidates.length === 0) sim.staffSystem.refreshCandidates();
  const c = sim.candidates[0];
  c.role = role;
  c.attrs = { speed: 3, diligence: 3, empathy: 3, stamina: 3, skill: 3 };
  sim.money = 1e6;
  expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
  const s = sim.staff.find((x) => x.id === c.id)!;
  s.schedule = new Array(24).fill(1) as typeof s.schedule;
  return s;
}

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

describe('Personel deneyimi ve seviyesi', () => {
  it('eşikte seviye atlar, rolün ana niteliği artar, en çok Sv5', () => {
    const sim = Sim.create(1801);
    const s = hire(sim, 'caretaker');
    expect(s.level).toBe(1);
    expect(s.morale).toBe(M.start);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    const dil0 = s.attrs.diligence;
    sim.staffSystem.gainXp(s, xpForLevel(1) - 1);
    expect(s.level).toBe(1);
    sim.staffSystem.gainXp(s, 1);
    expect(s.level).toBe(2);
    expect(s.attrs.diligence).toBe(dil0 + 1);
    expect(msgs.some((m) => m.includes('Sv2'))).toBe(true);
    for (let i = 0; i < 50; i++) sim.staffSystem.gainXp(s, 1000);
    expect(s.level).toBe(P.maxLevel);
    for (const v of Object.values(s.attrs)) expect(v).toBeLessThanOrEqual(5);
  });

  it('gerçek görev tamamlayınca deneyim kazanır', () => {
    const sim = Sim.create(1802);
    const s = hire(sim, 'caretaker');
    sim.clock.totalMinutes = 9 * 60;
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    runMinutes(sim, 180);
    expect(sim.stats.staffTasks).toBeGreaterThan(0);
    expect(s.xp + (s.level - 1) * 1000).toBeGreaterThan(0);
  });
});

describe('Personel morali', () => {
  it('yorgun çalışmak ve ödenmemiş maaş düşürür; mola odasında dinlenmek yükseltir', () => {
    const sim = Sim.create(1803);
    const s = hire(sim);
    s.state = 'working';
    s.energy = 10;
    s.morale = 50;
    sim.staffSystem.onHour();
    expect(s.morale).toBeLessThan(50);

    s.state = 'resting';
    s.morale = 50;
    sim.staffSystem.onHour();
    expect(s.morale).toBeGreaterThan(50);

    s.morale = 50;
    sim.money = -100;
    sim.staffSystem.afterPayday();
    expect(s.morale).toBe(50 - M.unpaidLoss);
  });

  it('düşük moral verimi düşürür', () => {
    const sim = Sim.create(1804);
    const s = hire(sim);
    s.morale = 60;
    const normal = s.efficiency('feed');
    s.morale = M.lowBelow - 1;
    expect(s.efficiency('feed')).toBeCloseTo(normal * M.lowEfficiencyMul, 6);
  });

  it('moral dipte üç gün kalırsa istifa eder', () => {
    const sim = Sim.create(1805);
    const s = hire(sim);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    s.morale = M.quitBelow - 5;
    sim.staffSystem.onDay();
    sim.staffSystem.onDay();
    expect(sim.staff.includes(s)).toBe(true);
    sim.staffSystem.onDay();
    expect(sim.staff.includes(s)).toBe(false);
    expect(msgs.some((m) => m.includes(s.name) && m.includes('istifa'))).toBe(true);
  });

  it('kayıt gidiş-dönüşünde seviye, deneyim ve moral korunur; eski kayıtta varsayılan', () => {
    const sim = Sim.create(1806);
    const s = hire(sim);
    sim.staffSystem.gainXp(s, xpForLevel(1) + 15);
    s.morale = 42;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    const b = back.staff.find((x) => x.id === s.id)!;
    expect(b.level).toBe(2);
    expect(b.xp).toBe(15);
    expect(b.morale).toBe(42);
    const raw = JSON.parse(JSON.stringify(sim.toJSON()));
    delete raw.staff[0].level;
    delete raw.staff[0].xp;
    delete raw.staff[0].morale;
    const old = Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!).staff[0];
    expect(old.level).toBe(1);
    expect(old.xp).toBe(0);
    expect(old.morale).toBe(M.start);
  });
});
