import { describe, expect, it } from 'vitest';
import { Clock, MINUTES_PER_DAY, crossings } from '../../src/core/Clock';

describe('crossings', () => {
  it('sınırları doğru sayar', () => {
    expect(crossings(0, 59, 60, 0)).toEqual([]);
    expect(crossings(0, 60, 60, 0)).toEqual([1]);
    expect(crossings(59, 121, 60, 0)).toEqual([1, 2]);
    expect(crossings(60, 60, 60, 0)).toEqual([]);
    expect(crossings(300, 400, 1440, 360)).toEqual([0]);
  });
});

describe('Clock', () => {
  it('Pazartesi 06:00 başlar', () => {
    const c = new Clock();
    expect(c.day).toBe(1);
    expect(c.hour).toBe(6);
    expect(c.weekday).toBe(0);
    expect(c.week).toBe(1);
    expect(c.timeText()).toBe('06:00');
    expect(c.dayText()).toContain('Pazartesi');
  });

  it('saat, gün ve hafta olaylarını geçerken üretir', () => {
    const c = new Clock();
    const a = c.advance(60);
    expect(a.hours).toEqual([7]);
    expect(a.days).toEqual([]);
    const toMidnight = MINUTES_PER_DAY - c.minuteOfDay;
    const b = c.advance(toMidnight + 1);
    expect(b.days).toEqual([2]);
    expect(c.day).toBe(2);
    expect(c.hour).toBe(0);
    // 7 gün sonra Pazartesi 06:00 hafta tiki
    const w = c.advance(MINUTES_PER_DAY * 7);
    expect(w.weeks).toEqual([2]);
    expect(c.week).toBe(2);
  });

  it('gece ve öğün pencerelerini bilir', () => {
    const c = new Clock(23 * 60);
    expect(c.isNight()).toBe(true);
    c.advance(8 * 60);
    expect(c.isNight()).toBe(false);
    const meal = new Clock(8 * 60 + 20);
    expect(meal.isMealTime()).toBe(true);
    expect(new Clock(12 * 60).isMealTime()).toBe(false);
  });

  it('ton gündüz beyaz, gece koyu', () => {
    expect(new Clock(12 * 60).tint()).toEqual([1, 1, 1]);
    const night = new Clock(1 * 60).tint();
    expect(night[0]).toBeLessThan(0.5);
  });

  it('kayıt gidiş dönüş ve bozuk veri', () => {
    const c = new Clock(1234.5);
    expect(Clock.fromJSON(c.toJSON()).totalMinutes).toBe(1234.5);
    expect(Clock.fromJSON({ totalMinutes: 'x' }).totalMinutes).toBe(360);
    expect(Clock.fromJSON(null).totalMinutes).toBe(360);
  });
});
