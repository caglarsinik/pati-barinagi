import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import type { Staff } from '../../src/sim/entities/Staff';
import { Sim } from '../../src/sim/Sim';

const DAY = 24 * 60;
const C = BALANCE.staff.course;
const V = BALANCE.staff.volunteer;

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

function hire(sim: Sim): Staff {
  if (sim.candidates.length === 0) sim.staffSystem.refreshCandidates();
  const c = sim.candidates[0];
  sim.money = 1e6;
  expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
  const s = sim.staff.find((x) => x.id === c.id)!;
  s.schedule = new Array(24).fill(1) as typeof s.schedule;
  return s;
}

/** Saati verilen haftanın gününe (0 = Pazartesi) ve saatine kurar (ilk hafta). */
function setTime(sim: Sim, weekday: number, hour: number): void {
  sim.clock.totalMinutes = weekday * DAY + hour * 60;
}

/** Cuma'ya geçişte gönüllü başvurusu gelir. */
function reachFriday(sim: Sim): void {
  setTime(sim, 3, 23);
  sim.clock.totalMinutes += 50;
  runMinutes(sim, 30);
}

describe('Eğitim kursu', () => {
  it('parası düşer, bir gün iş başında olmaz, dönünce en az bir seviye atlar', () => {
    const sim = Sim.create(1901);
    const s = hire(sim);
    setTime(sim, 1, 9);
    runMinutes(sim, 30);
    expect(s.onDuty).toBe(true);
    const m0 = sim.money;
    const r = sim.command({ type: 'sendToCourse', staffId: s.id });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(m0 - C.cost);
    expect(sim.command({ type: 'sendToCourse', staffId: s.id }).ok).toBe(false); // zaten kursta
    runMinutes(sim, 12 * 60);
    expect(s.onDuty).toBe(false);
    expect(s.level).toBe(1);
    runMinutes(sim, 13 * 60);
    expect(s.courseUntil).toBeNull();
    expect(s.level).toBe(2);
    expect(s.onDuty).toBe(true);
  });

  it('Sv5te, parasızken ve gönüllüye kurs yok', () => {
    const sim = Sim.create(1902);
    const s = hire(sim);
    sim.money = 100;
    expect(sim.command({ type: 'sendToCourse', staffId: s.id }).ok).toBe(false);
    sim.money = 1e6;
    s.level = BALANCE.staff.progress.maxLevel;
    expect(sim.command({ type: 'sendToCourse', staffId: s.id }).ok).toBe(false);
  });
});

describe('Gönüllüler', () => {
  it('Cuma başvuru gelir, Pazartesi düşer; kabul edilen maaşsızdır', () => {
    const sim = Sim.create(1903);
    expect(sim.volunteerOffer).toBeNull();
    reachFriday(sim);
    const offer = sim.volunteerOffer!;
    expect(offer).not.toBeNull();
    expect(offer.volunteer).toBe(true);
    expect(offer.wage).toBe(0);
    expect(sim.command({ type: 'acceptVolunteer' }).ok).toBe(true);
    expect(sim.volunteerOffer).toBeNull();
    expect(sim.staff.some((s) => s.id === offer.id && s.volunteer)).toBe(true);
    expect(sim.command({ type: 'acceptVolunteer' }).ok).toBe(false);

    const sim2 = Sim.create(1904);
    reachFriday(sim2);
    expect(sim2.volunteerOffer).not.toBeNull();
    setTime(sim2, 6, 23);
    sim2.clock.totalMinutes += 50;
    runMinutes(sim2, 30); // Pazartesi
    expect(sim2.volunteerOffer).toBeNull();
  });

  it('yalnız hafta sonu çalışır, verimi düşüktür', () => {
    const sim = Sim.create(1905);
    reachFriday(sim);
    sim.money = 1e6;
    sim.command({ type: 'acceptVolunteer' });
    const v = sim.staff.find((s) => s.volunteer)!;
    v.schedule = new Array(24).fill(1) as typeof v.schedule;
    setTime(sim, 2, 10); // Çarşamba
    runMinutes(sim, 60);
    expect(v.onDuty).toBe(false);
    setTime(sim, 5, 10); // Cumartesi
    runMinutes(sim, 60);
    expect(v.onDuty).toBe(true);
    const paid = hire(sim);
    paid.attrs = { ...v.attrs };
    paid.role = v.role;
    paid.morale = v.morale;
    expect(v.efficiency('feed')).toBeCloseTo(paid.efficiency('feed') * V.efficiencyMul, 6);
  });

  it('iki maaş gününden sonra teşekkürle ayrılır, itibar artar, maaş yazılmaz', () => {
    const sim = Sim.create(1906);
    reachFriday(sim);
    sim.command({ type: 'acceptVolunteer' });
    const v = sim.staff.find((s) => s.volunteer)!;
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    const rep0 = sim.reputation;
    expect(sim.weeklyWages()).toBe(0);
    sim.staffSystem.afterPayday();
    expect(sim.staff.includes(v)).toBe(true);
    sim.money = -500; // kasa eksi olsa da gönüllü "maaş alamadı" demez
    sim.staffSystem.afterPayday();
    expect(sim.staff.includes(v)).toBe(false);
    expect(sim.reputation).toBe(rep0 + V.reputationGain);
    expect(msgs.some((m) => m.includes(v.name) && m.includes('teşekkür'))).toBe(true);
  });

  it('kayıt gidiş-dönüşü: kurs, gönüllü ve başvuru korunur', () => {
    const sim = Sim.create(1907);
    const s = hire(sim);
    sim.command({ type: 'sendToCourse', staffId: s.id });
    reachFriday(sim);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.staff.find((x) => x.id === s.id)!.courseUntil).toBe(s.courseUntil);
    expect(back.volunteerOffer?.id).toBe(sim.volunteerOffer!.id);
    expect(back.volunteerOffer?.volunteer).toBe(true);
    back.money = 1e6;
    back.command({ type: 'acceptVolunteer' });
    const again = Sim.fromJSON(SaveManager.parse(JSON.stringify(back.toJSON()))!);
    const v = again.staff.find((x) => x.volunteer)!;
    expect(v.volunteerWeeksLeft).toBe(V.weeks);
    expect(v.wage).toBe(0);
  });
});
