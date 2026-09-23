import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { isReady } from '../entities/Building';
import type { Sim } from '../Sim';

/** Hazır bir mutfakta bu eşya var mı (0.17.1: su deposu, ikinci fırın). */
function kitchenHas(sim: Sim, item: string): boolean {
  return sim.buildings.some((b) => b.type === 'kitchen' && isReady(b) && b.furniture.includes(item));
}

/** Bugün kalan fırın hakkı: günlük sınır (+ ikinci fırın), gün değişince sıfırlanır. */
export function bakesLeft(sim: Sim): number {
  const K = BALANCE.kitchen;
  const cap = K.bakesPerDay + (kitchenHas(sim, 'oven2') ? K.secondOvenBakes : 0);
  const used = sim.bakeDay === sim.clock.day ? sim.bakesToday : 0;
  return Math.max(0, cap - used);
}

/** Pişirilemiyorsa nedeni (hak bitti, çanta dolu, kiler yetmiyor); pişirilebiliyorsa null. */
export function bakeIssue(sim: Sim): string | null {
  const K = BALANCE.kitchen;
  if (bakesLeft(sim) <= 0) return t('Bugünlük fırın hakkı bitti');
  if (sim.treats >= BALANCE.eggs.treatsMax) return t('Ödül maması çantası dolu');
  if (sim.foodStock < K.foodPerTreat) return t('Kiler yetmiyor: fırın için {n} porsiyon yem lazım', { n: K.foodPerTreat });
  return null;
}

/** Fırında ödül maması pişirir: kilerden yem düşer, çantaya bir ödül maması girer. */
export function bake(sim: Sim): { ok: boolean; message: string } {
  const why = bakeIssue(sim);
  if (why) return { ok: false, message: why };
  const K = BALANCE.kitchen;
  if (sim.bakeDay !== sim.clock.day) {
    sim.bakeDay = sim.clock.day;
    sim.bakesToday = 0;
  }
  sim.bakesToday++;
  sim.foodStock -= K.foodPerTreat;
  sim.treats += 1;
  return { ok: true, message: t('🍪 Ödül maması pişti ({n}/{max})', { n: sim.treats, max: BALANCE.eggs.treatsMax }) };
}

/** Mutfaklı barınakta yalakların saatlik kendiliğinden dolumu (su deposuyla katlanır). */
export function kitchenWaterPerHour(sim: Sim): number {
  return BALANCE.shelter.kitchenWaterPerHour * (kitchenHas(sim, 'waterTank') ? BALANCE.kitchen.waterTankMul : 1);
}
