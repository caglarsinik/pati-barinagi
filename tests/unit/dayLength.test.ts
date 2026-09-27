import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Sim, isDayMinutes } from '../../src/sim/Sim';

/** Gün uzunluğu seçeneği (0.23.5): yalnız gerçek zaman ölçeği; oyun dakikası başına hiçbir şey değişmez. */
describe('Gün uzunluğu (0.23.5)', () => {
  it('varsayılan 10 dk eski hızı bire bir korur; 20 dk saati yarı hızda akıtır, oyuncu hareketi değişmez', () => {
    const a = Sim.create(77);
    const b = Sim.create(77, 'normal', 'ready', 20);
    expect(a.dayMinutes).toBe(10);
    expect(a.minutesPerRealSecond).toBe(BALANCE.time.minutesPerRealSecond);
    expect(b.dayMinutes).toBe(20);
    expect(b.minutesPerRealSecond).toBeCloseTo(BALANCE.time.minutesPerRealSecond / 2, 9);
    const ta = a.clock.totalMinutes;
    const tb = b.clock.totalMinutes;
    const input = { dx: 1, dy: 0, run: false };
    for (let i = 0; i < 20; i++) {
      a.update(0.1, input);
      b.update(0.1, input);
    }
    expect(a.clock.totalMinutes - ta).toBeCloseTo(2 * BALANCE.time.minutesPerRealSecond, 6);
    expect(b.clock.totalMinutes - tb).toBeCloseTo(BALANCE.time.minutesPerRealSecond, 6);
    // Oyuncu gerçek saniyeyle yürür: iki dünyada aynı yere varır.
    expect(b.player.x).toBeCloseTo(a.player.x, 6);
    expect(b.player.y).toBeCloseTo(a.player.y, 6);
  });

  it('setDayMinutes komutu yalnız 10/15/20 kabul eder', () => {
    const sim = Sim.create(77);
    const r = sim.command({ type: 'setDayMinutes', minutes: 15 });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('15');
    expect(sim.dayMinutes).toBe(15);
    expect(sim.minutesPerRealSecond).toBeCloseTo(1.6, 9);
    expect(sim.command({ type: 'setDayMinutes', minutes: 12 }).ok).toBe(false);
    expect(sim.dayMinutes).toBe(15);
    expect(isDayMinutes(10) && isDayMinutes(15) && isDayMinutes(20)).toBe(true);
    expect(isDayMinutes(12)).toBe(false);
    expect(isDayMinutes('10')).toBe(false);
    expect(isDayMinutes(null)).toBe(false);
  });

  it('kayıtta korunur; eski kayıtta alan yoksa 10', () => {
    const sim = Sim.create(77, 'normal', 'ready', 20);
    const data = JSON.parse(JSON.stringify(sim.toJSON()));
    expect(Sim.fromJSON(data).dayMinutes).toBe(20);
    delete data.dayMinutes;
    expect(Sim.fromJSON(data).dayMinutes).toBe(10);
    data.dayMinutes = 99;
    expect(Sim.fromJSON(data).dayMinutes).toBe(10);
  });

  it('stepSim oyun dakikasıyla çağrılınca (uyku, seyahat) gün uzunluğundan bağımsız aynı sonucu verir', () => {
    const a = Sim.create(77);
    const b = Sim.create(77, 'normal', 'ready', 20);
    a.stepSim(5);
    b.stepSim(5);
    expect(b.clock.totalMinutes).toBe(a.clock.totalMinutes);
    expect(b.dogs[0].needs.hunger).toBeCloseTo(a.dogs[0].needs.hunger, 9);
  });
});
