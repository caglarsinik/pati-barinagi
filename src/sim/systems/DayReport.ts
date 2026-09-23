import { BALANCE } from '../../config/balance';
import { MINUTES_PER_DAY } from '../../core/Clock';
import { adoptable } from '../entities/Adopter';
import { isReady } from '../entities/Building';
import type { Sim } from '../Sim';
import { goalReward } from './Goals';
import { incubatorTimeMul } from './IncubatorSystem';
import { type Season, type Weather, seasonForWeek } from './WeatherSystem';

/** Günün başındaki sayaçlar (0.19.2); fark alınınca biten günün özeti olur (`day` o günün numarası). */
export interface DaySnapshot {
  day: number;
  money: number;
  adopted: number;
  hatched: number;
  strays: number;
  cured: number;
  fed: number;
  eggsFound: number;
}

const COUNTERS = ['adopted', 'hatched', 'strays', 'cured', 'fed', 'eggsFound'] as const;

export function takeDaySnapshot(sim: Sim): DaySnapshot {
  const s = sim.stats;
  return {
    day: sim.clock.day,
    money: Math.round(sim.money),
    adopted: s.adopted,
    hatched: s.hatched,
    strays: s.strays,
    cured: s.cured,
    fed: s.fed,
    eggsFound: s.eggsFound,
  };
}

/** Biten günün özeti: `start` o günün başı, `end` gün dönümü. */
export function diffDay(end: DaySnapshot, start: DaySnapshot): DaySnapshot {
  const out: DaySnapshot = { ...end, day: start.day, money: end.money - start.money };
  for (const k of COUNTERS) out[k] = Math.max(0, end[k] - start[k]);
  return out;
}

/** Kayıttan okur; alan eksik ya da bozuksa null. */
export function daySnapshotFrom(raw: unknown): DaySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out = {} as DaySnapshot;
  for (const k of ['day', 'money', ...COUNTERS] as const) {
    const v = r[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    out[k] = v;
  }
  return out;
}

/** Uyanınca sabah raporu, oyuna dönünce hoş geldin kartı. */
export type MorningKind = 'morning' | 'welcome';

export interface MorningReport {
  kind: MorningKind;
  passedOut: boolean;
  /** Biten günün özeti; ilk gün ve eski kayıtta null. */
  yesterday: DaySnapshot | null;
  day: number;
  week: number;
  /** 0 = Pazartesi. */
  weekday: number;
  season: Season;
  weather: Weather;
  /** 24 saat içinde çatlayacak kuluçka yumurtası. */
  eggsSoon: number;
  /** Yuva evinde alınmayı bekleyen yumurta. */
  nurseryEggs: number;
  dogs: number;
  sickDogs: number;
  /** Kiler ve kaplardaki yem kaç gün yeter; köpek yoksa null. */
  foodDays: number | null;
  /** Bugün vardiyası olan personel (kurstaki ve hafta içi gönüllü hariç). */
  staffToday: number;
  adoptionsOpen: boolean;
  /** Şu an sahiplendirmeye uygun köpek. */
  adoptableDogs: number;
  goal: { title: string; reward: number } | null;
  /** Kabul edilmiş köylü görevleri ve kalan süreleri (0.20.4). */
  quests: Array<{ title: string; minutesLeft: number }>;
  /** Köy panosunda bekleyen ilan. */
  questOffers: number;
}

export function buildMorningReport(sim: Sim, kind: MorningKind, passedOut = false): MorningReport {
  const c = sim.clock;
  const dogs = sim.shelterDogs();
  let eggsSoon = 0;
  let nurseryEggs = 0;
  let bowlFood = 0;
  for (const b of sim.buildings) {
    if (!isReady(b)) continue;
    if (b.type === 'incubator') {
      // Sayaç oyun dakikasında 1/çarpan kadar azalır: kalan oyun süresi = hatchLeft × çarpan.
      const mul = incubatorTimeMul(b);
      for (const e of b.eggs) if (e.hatchLeft >= 0 && e.hatchLeft * mul <= MINUTES_PER_DAY) eggsSoon++;
    } else if (b.type === 'nursery') {
      nurseryEggs += b.eggs.length;
    } else if (b.type === 'bowl') {
      bowlFood += b.food;
    }
  }
  const perDay = dogs.reduce((a, d) => a + d.portion(), 0) * BALANCE.time.mealHours.length;
  const staffToday = sim.staff.filter((s) => {
    if (s.state === 'leaving') return false;
    if (s.courseUntil !== null || (s.volunteer && c.weekday < 5)) return false;
    return s.schedule.some((v, h) => h >= c.hour && v === 1);
  }).length;
  const g = sim.goals.current;
  return {
    kind,
    passedOut,
    yesterday: sim.lastDay ? { ...sim.lastDay } : null,
    day: c.day,
    week: c.week,
    weekday: c.weekday,
    season: seasonForWeek(c.week),
    weather: sim.weatherSys.weather,
    eggsSoon,
    nurseryEggs,
    dogs: dogs.length,
    sickDogs: dogs.filter((d) => d.sick).length,
    foodDays: perDay > 0 ? (sim.foodStock + bowlFood) / perDay : null,
    staffToday,
    adoptionsOpen: sim.policies.adoptionsOpen,
    adoptableDogs: dogs.filter((d) => adoptable(d) === null).length,
    goal: g ? { title: g.title, reward: goalReward(g) } : null,
    quests: sim.quests.list.filter((q) => q.state === 'active').map((q) => ({ title: sim.quests.title(q), minutesLeft: sim.quests.timeLeft(q) })),
    questOffers: sim.quests.list.filter((q) => q.state === 'offer').length,
  };
}
