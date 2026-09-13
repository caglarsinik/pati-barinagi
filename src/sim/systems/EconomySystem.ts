import { BALANCE } from '../../config/balance';
import { buildingDef, isReady } from '../entities/Building';
import type { Sim } from '../Sim';
import { effectiveMessCount, toiletMessCount } from './MessSystem';
import { t } from '../../i18n';

export type LedgerCategory = 'aid' | 'adoption' | 'refund' | 'food' | 'building' | 'land' | 'treatment' | 'upkeep' | 'wages' | 'license' | 'donation';

export const LEDGER_NAMES_TR: Record<LedgerCategory, string> = {
  aid: 'Devlet yardımı',
  adoption: 'Sahiplendirme',
  refund: 'İade',
  food: 'Yem',
  building: 'İnşaat',
  land: 'Arsa',
  treatment: 'Tedavi',
  upkeep: 'Bakım gideri',
  wages: 'Maaşlar',
  license: 'Lisans',
  donation: 'Bağış',
};

export interface LedgerEntry {
  week: number;
  day: number;
  category: LedgerCategory;
  /** Pozitif gelir, negatif gider. */
  amount: number;
  note: string;
}

export interface WeekSummary {
  week: number;
  income: Partial<Record<LedgerCategory, number>>;
  expense: Partial<Record<LedgerCategory, number>>;
  net: number;
  endMoney: number;
  inspection: InspectionReport | null;
}

export interface InspectionItem {
  name: string;
  value: string;
  /** -1..+1 arası katkı. */
  effect: number;
}

export interface InspectionReport {
  week: number;
  items: InspectionItem[];
  /** 0.4 - 1.5 */
  multiplier: number;
  dogsCounted: number;
  dogsOverCap: number;
  aid: number;
}

/** Haftalık denetim: barınağın durumu yardım çarpanına dönüşür. */
export function runInspection(sim: Sim): InspectionReport {
  const B = BALANCE.economy;
  const dogs = sim.shelterDogs();
  const items: InspectionItem[] = [];
  let score = 0;
  let weight = 0;
  const add = (name: string, value: string, effect: number, w: number): void => {
    items.push({ name, value, effect });
    score += effect * w;
    weight += w;
  };
  if (dogs.length > 0) {
    const avgH = dogs.reduce((s, d) => s + d.needs.hygiene, 0) / dogs.length;
    add('Ortalama temizlik', `${Math.round(avgH)}`, (avgH - 50) / 50, 3);
    const avgHealth = dogs.reduce((s, d) => s + d.needs.health, 0) / dogs.length;
    add('Ortalama sağlık', `${Math.round(avgHealth)}`, (avgHealth - 60) / 40, 3);
    const avgMood = dogs.reduce((s, d) => s + d.mood(), 0) / dogs.length;
    add('Ortalama keyif', `${Math.round(avgMood)}`, (avgMood - 50) / 50, 2);
  } else {
    add('Köpek yok', '-', 0, 1);
  }
  const contained = toiletMessCount(sim);
  const loose = sim.messTiles.size - contained;
  const eff = effectiveMessCount(sim);
  add('Pislik', contained > 0 ? `${loose} (+${contained})` : `${loose}`, eff === 0 ? 0.5 : -Math.min(1, eff / 5), 2);
  const cap = sim.kennelCapacity();
  const over = Math.max(0, dogs.length - cap);
  add('Kulübe', `${dogs.length}/${cap}`, over === 0 ? 0.5 : -Math.min(1, over / 3), 2);
  add('Yem stoğu', t('{n} porsiyon', { n: Math.floor(sim.foodStock) }), sim.foodStock <= 0 ? -1 : sim.foodStock < 10 ? -0.3 : 0.4, 1);
  if (dogs.length > 0) {
    const troughs = sim.buildings.filter((b) => b.type === 'trough' && isReady(b));
    if (troughs.length === 0) add('Su', t('Yalak yok'), -0.6, 1);
    else {
      const avgW = troughs.reduce((s, b) => s + b.water, 0) / troughs.length / sim.troughCapacity();
      add('Su', `%${Math.round(avgW * 100)}`, avgW < 0.2 ? -0.6 : avgW < 0.5 ? 0 : 0.4, 1);
    }
  }
  const decor = sim.decorScore();
  add('Çevre', `${Math.round(decor)}/${BALANCE.decor.max}`, (decor / BALANCE.decor.max) * 0.8 - 0.1, 1);
  const licenseCap = B.licenseCaps[sim.licenseLevel - 1];
  const overCap = Math.max(0, dogs.length - licenseCap);
  if (overCap > 0) add('Lisans aşımı', t('{n} köpek fazla', { n: overCap }), -1, 3);
  const norm = weight > 0 ? score / weight : 0; // -1..1
  const multiplier = Math.round(Math.max(B.aidMultiplierMin, Math.min(B.aidMultiplierMax, 0.95 + norm * 0.55)) * 100) / 100;
  const counted = Math.min(dogs.length, licenseCap);
  const aid = Math.round(counted * B.aidPerDogPerWeek * multiplier * sim.aidMul());
  return { week: sim.clock.week, items, multiplier, dogsCounted: counted, dogsOverCap: overCap, aid };
}

/** Haftalık bakım gideri: bina maliyetinin küçük bir yüzdesi. */
export function weeklyUpkeep(sim: Sim): number {
  let total = 0;
  for (const b of sim.buildings) {
    if (!isReady(b)) continue;
    total += Math.round(buildingDef(b).cost * BALANCE.economy.upkeepRate);
  }
  return total;
}

/** Hafta tikinde çağrılır: denetim, yardım, bakım, haftalık özet. */
export function closeWeek(sim: Sim, newWeek: number): WeekSummary {
  const report = runInspection(sim);
  sim.lastInspection = report;
  const week = newWeek - 1;
  report.week = week;
  if (report.aid > 0) sim.addIncome('aid', report.aid, t('{n} köpek × çarpan {mult}', { n: report.dogsCounted, mult: report.multiplier }), week);
  const upkeep = weeklyUpkeep(sim);
  if (upkeep > 0) sim.addExpense('upkeep', upkeep, t('Bina bakımı'), week);
  const wages = sim.weeklyWages();
  if (wages > 0) sim.addExpense('wages', wages, t('Personel maaşları'), week);

  const summary: WeekSummary = { week, income: {}, expense: {}, net: 0, endMoney: sim.money, inspection: report };
  for (const e of sim.ledger) {
    if (e.week !== week) continue;
    if (e.amount >= 0) summary.income[e.category] = (summary.income[e.category] ?? 0) + e.amount;
    else summary.expense[e.category] = (summary.expense[e.category] ?? 0) - e.amount;
    summary.net += e.amount;
  }
  sim.weeks.push(summary);
  if (sim.weeks.length > 12) sim.weeks.shift();
  // Defterde son 4 haftayı tut.
  sim.ledger = sim.ledger.filter((e) => e.week >= newWeek - 4);
  return summary;
}

export function licenseUpgradeCost(level: number): number | null {
  const costs = BALANCE.economy.licenseUpgradeCosts;
  return level >= 1 && level <= costs.length ? costs[level - 1] : null;
}
