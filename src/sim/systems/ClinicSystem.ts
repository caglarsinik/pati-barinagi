import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { isReady } from '../entities/Building';
import type { Dog } from '../entities/Dog';
import type { Sim } from '../Sim';

/** Hazır bir veteriner odasında bu eşya var mı (0.17.2: ilaç dolabı). */
function clinicHas(sim: Sim, item: string): boolean {
  return sim.buildings.some((b) => b.type === 'vetClinic' && isReady(b) && b.furniture.includes(item));
}

/** Tedavi ücreti: ilaç dolabıyla indirimli (oyuncu, personel ve otopilot aynı ücreti öder). */
export function treatmentCost(sim: Sim): number {
  const base = BALANCE.economy.treatmentPrice;
  return Math.round(base * (clinicHas(sim, 'medCabinet') ? 1 - BALANCE.clinic.medCabinetDiscount : 1));
}

/** Aşının bitmesine kalan gün (aşısızsa 0). */
export function vaccineDaysLeft(sim: Sim, dog: Dog): number {
  const left = dog.vaccinatedUntil - sim.clock.totalMinutes;
  return left > 0 ? Math.ceil(left / (24 * 60)) : 0;
}

/** Hastalık olasılığı çarpanı: aşılı köpekte düşük (zar yine atılır; yalnız eşik değişir). */
export function illnessChanceMul(sim: Sim, dog: Dog): number {
  return dog.vaccinatedUntil > sim.clock.totalMinutes ? BALANCE.clinic.vaccineMul : 1;
}

/** Aşılanamıyorsa nedeni; aşılanabiliyorsa null. */
export function vaccinateIssue(sim: Sim, dog: Dog): string | null {
  if (!sim.hasReady('vetClinic')) return t('Aşı için hazır bir veteriner odası lazım');
  if (dog.wild || !sim.shelterDogs().includes(dog)) return t('{name} barınakta değil', { name: dog.name });
  const days = vaccineDaysLeft(sim, dog);
  if (days > 0) return t('{name} zaten aşılı ({n} gün kaldı)', { name: dog.name, n: days });
  if (sim.money < BALANCE.clinic.vaccineCost) return t('Aşı için para yok');
  return null;
}

/** Köpeği aşılar: ücret düşer, aşı `vaccineWeeks` hafta sürer. */
export function vaccinate(sim: Sim, dog: Dog): { ok: boolean; message: string } {
  const why = vaccinateIssue(sim, dog);
  if (why) return { ok: false, message: why };
  const C = BALANCE.clinic;
  sim.addExpense('treatment', C.vaccineCost, t('{name} aşısı', { name: dog.name }));
  dog.vaccinatedUntil = sim.clock.totalMinutes + C.vaccineWeeks * 7 * 24 * 60;
  sim.stats.vaccinated++;
  return { ok: true, message: t('💉 {name} aşılandı ({w} hafta korunur)', { name: dog.name, w: C.vaccineWeeks }) };
}
