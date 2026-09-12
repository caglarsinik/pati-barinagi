import { BALANCE } from '../config/balance';

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_WEEK = 7;
export const MINUTES_PER_WEEK = MINUTES_PER_DAY * DAYS_PER_WEEK;
export const WEEKDAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

export interface ClockCrossings {
  /** Geçilen saat başları (0-23). */
  hours: number[];
  /** Geçilen gece yarıları: yeni günün 1 tabanlı numarası. */
  days: number[];
  /** Geçilen hafta tikleri (Pazartesi 06:00): yeni haftanın 1 tabanlı numarası. */
  weeks: number[];
}

/** [saat, r, g, b] anahtar kareleri; aralar doğrusal interpolasyon. */
const TINT_KEYS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0.32, 0.36, 0.6],
  [4.5, 0.32, 0.36, 0.6],
  [6, 0.75, 0.62, 0.62],
  [7.5, 1, 1, 1],
  [17, 1, 1, 1],
  [18.5, 1, 0.88, 0.72],
  [20, 0.68, 0.58, 0.68],
  [22, 0.32, 0.36, 0.6],
  [24, 0.32, 0.36, 0.6],
];

/**
 * Oyun saati. Tek bir sayaç tutar: oyun başından (1. gün 00:00) beri geçen dakika.
 * Gün, hafta, saat hepsi bundan türetilir; böylece hiçbir tik kaçmaz.
 */
export class Clock {
  totalMinutes: number;

  constructor(totalMinutes: number = BALANCE.time.startMinutes) {
    this.totalMinutes = totalMinutes;
  }

  /** 0 tabanlı gün indeksi. */
  get dayIndex(): number {
    return Math.floor(this.totalMinutes / MINUTES_PER_DAY);
  }

  /** 1 tabanlı gün numarası. */
  get day(): number {
    return this.dayIndex + 1;
  }

  get minuteOfDay(): number {
    return this.totalMinutes - this.dayIndex * MINUTES_PER_DAY;
  }

  get hour(): number {
    return Math.floor(this.minuteOfDay / 60);
  }

  get minute(): number {
    return Math.floor(this.minuteOfDay % 60);
  }

  /** Saatin ondalıklı hâli (13.5 = 13:30). */
  get hourFloat(): number {
    return this.minuteOfDay / 60;
  }

  /** 0 = Pazartesi. */
  get weekday(): number {
    return this.dayIndex % DAYS_PER_WEEK;
  }

  /** 1 tabanlı hafta numarası. */
  get week(): number {
    return Math.floor(this.dayIndex / DAYS_PER_WEEK) + 1;
  }

  isNight(): boolean {
    const h = this.hourFloat;
    return h >= BALANCE.time.nightStartHour || h < BALANCE.time.nightEndHour;
  }

  /** Öğün penceresi içinde miyiz? */
  isMealTime(): boolean {
    const m = this.minuteOfDay;
    const half = BALANCE.time.mealWindowMinutes / 2;
    return BALANCE.time.mealHours.some((h) => Math.abs(m - h * 60) <= half);
  }

  /** Zamanı ilerletir ve bu adımda geçilen sınırları döndürür. */
  advance(dtMinutes: number): ClockCrossings {
    const prev = this.totalMinutes;
    const next = prev + Math.max(0, dtMinutes);
    this.totalMinutes = next;
    const hourMarks = crossings(prev, next, 60, 0);
    const dayMarks = crossings(prev, next, MINUTES_PER_DAY, 0);
    const weekMarks = crossings(prev, next, MINUTES_PER_WEEK, BALANCE.time.weekTickHour * 60);
    return {
      hours: hourMarks.map((k) => k % 24),
      days: dayMarks.map((k) => k + 1),
      weeks: weekMarks.map((k) => k + 1),
    };
  }

  timeText(): string {
    const hh = String(this.hour).padStart(2, '0');
    const mm = String(this.minute).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  dayText(): string {
    return `${this.day}. Gün · ${WEEKDAYS_TR[this.weekday]}`;
  }

  weekText(): string {
    return `${this.week}. Hafta`;
  }

  /** Gün/gece renk tonu, [0..1] r g b. */
  tint(): [number, number, number] {
    const h = this.hourFloat;
    for (let i = 0; i < TINT_KEYS.length - 1; i++) {
      const a = TINT_KEYS[i];
      const b = TINT_KEYS[i + 1];
      if (h >= a[0] && h <= b[0]) {
        const t = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
      }
    }
    return [1, 1, 1];
  }

  toJSON(): { totalMinutes: number } {
    return { totalMinutes: this.totalMinutes };
  }

  static fromJSON(data: unknown): Clock {
    const d = data as { totalMinutes?: unknown } | null;
    const v = typeof d?.totalMinutes === 'number' && Number.isFinite(d.totalMinutes) ? d.totalMinutes : BALANCE.time.startMinutes;
    return new Clock(Math.max(0, v));
  }
}

/**
 * prev < k*period + offset <= next koşulunu sağlayan k değerleri.
 * Sınır tam olarak next'e denk gelirse sayılır, prev'e denk gelirse sayılmaz.
 */
export function crossings(prev: number, next: number, period: number, offset: number): number[] {
  const out: number[] = [];
  if (next <= prev) return out;
  let k = Math.floor((prev - offset) / period) + 1;
  while (k * period + offset <= next) {
    if (k * period + offset > prev) out.push(k);
    k++;
  }
  return out;
}
