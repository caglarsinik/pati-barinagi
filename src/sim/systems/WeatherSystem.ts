import { BALANCE } from '../../config/balance';
import type { Sim } from '../Sim';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_NAMES_TR: Record<Season, string> = { spring: 'İlkbahar', summer: 'Yaz', autumn: 'Sonbahar', winter: 'Kış' };
export const WEATHER_NAMES_TR: Record<Weather, string> = { clear: 'Açık', cloudy: 'Bulutlu', rain: 'Yağmurlu', storm: 'Fırtına', snow: 'Karlı' };
export const WEATHER_ICONS: Record<Weather, string> = { clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️', snow: '❄️' };

/** Hafta numarasından mevsim: her mevsim `weeksPerSeason` hafta, ilkbaharla başlar. */
export function seasonForWeek(week: number): Season {
  const idx = Math.floor((week - 1) / BALANCE.seasons.weeksPerSeason) % SEASONS.length;
  return SEASONS[(idx + SEASONS.length) % SEASONS.length];
}

/** Mevsimin renk tonu (çarpan). */
export const SEASON_TINT: Record<Season, [number, number, number]> = {
  spring: [1, 1, 1],
  summer: [1.03, 1, 0.9],
  autumn: [1.04, 0.92, 0.8],
  winter: [0.86, 0.9, 1.04],
};

const WEATHER_TABLE: Record<Season, Array<[Weather, number]>> = {
  spring: [
    ['clear', 45],
    ['cloudy', 30],
    ['rain', 25],
  ],
  summer: [
    ['clear', 65],
    ['cloudy', 20],
    ['rain', 5],
    ['storm', 10],
  ],
  autumn: [
    ['clear', 35],
    ['cloudy', 35],
    ['rain', 25],
    ['storm', 5],
  ],
  winter: [
    ['clear', 30],
    ['cloudy', 30],
    ['snow', 40],
  ],
};

export interface WeatherModifiers {
  hunger: number;
  thirst: number;
  hygiene: number;
  energy: number;
  /** Kulübesiz köpeklere gece saatte sağlık kaybı. */
  cold: number;
  adopters: number;
  nestRespawn: number;
  berryBonus: number;
  playYard: number;
}

/** Günün havası mevsime göre seçilir; gün içinde de değişebilir. */
export class WeatherSystem {
  weather: Weather = 'clear';
  /** Bir sonraki hava değişimi (toplam dakika). */
  nextChange = 0;

  constructor(private readonly sim: Sim) {}

  get season(): Season {
    return seasonForWeek(this.sim.clock.week);
  }

  update(): void {
    if (this.sim.clock.totalMinutes >= this.nextChange) this.roll();
  }

  /** Yeni hava seç; 6-14 saat sonra yeniden bakılır. */
  roll(): void {
    const rng = this.sim.rng;
    const table = WEATHER_TABLE[this.season];
    const prev = this.weather;
    this.weather = rng.weighted(
      table.map((t) => t[0]),
      table.map((t) => t[1]),
    );
    this.nextChange = this.sim.clock.totalMinutes + rng.int(6, 14) * 60;
    if (this.weather !== prev) this.sim.events.emit('weatherChanged', this.weather);
  }

  modifiers(): WeatherModifiers {
    const W = BALANCE.weather;
    const s = this.season;
    const w = this.weather;
    const m: WeatherModifiers = { hunger: 1, thirst: 1, hygiene: 1, energy: 1, cold: 0, adopters: 1, nestRespawn: 1, berryBonus: 0, playYard: 1 };
    if (s === 'summer') {
      m.hygiene *= W.summerHygieneMul;
      m.thirst *= W.summerThirstMul;
      m.playYard *= 1.2;
    }
    if (s === 'winter') {
      m.hunger *= W.winterHungerMul;
      m.energy *= W.winterEnergyMul;
      m.cold = W.coldDamagePerHour;
    }
    if (s === 'spring') m.nestRespawn *= W.springNestMul;
    if (s === 'autumn') m.berryBonus += W.autumnBerryBonus;
    if (w === 'rain') {
      m.hygiene *= W.rainHygieneMul;
      m.adopters *= W.rainAdopterMul;
    } else if (w === 'storm') {
      m.hygiene *= W.stormHygieneMul;
      m.adopters *= W.stormAdopterMul;
      m.cold = Math.max(m.cold, W.coldDamagePerHour * 0.5);
    } else if (w === 'snow') {
      m.energy *= W.snowEnergyMul;
      m.adopters *= W.snowAdopterMul;
      m.cold = Math.max(m.cold, W.coldDamagePerHour * 1.5);
    }
    return m;
  }

  toJSON(): { weather: Weather; nextChange: number } {
    return { weather: this.weather, nextChange: this.nextChange };
  }

  load(data: unknown): void {
    const d = data as { weather?: string; nextChange?: number } | null;
    if (!d) return;
    if (d.weather && (Object.keys(WEATHER_NAMES_TR) as string[]).includes(d.weather)) this.weather = d.weather as Weather;
    if (typeof d.nextChange === 'number' && Number.isFinite(d.nextChange)) this.nextChange = d.nextChange;
  }
}
