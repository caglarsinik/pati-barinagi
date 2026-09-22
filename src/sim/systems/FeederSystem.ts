import { BALANCE } from '../../config/balance';
import { type Building, isReady } from '../entities/Building';
import type { Sim } from '../Sim';

/** Kap, hazır bir otomatik yem makinesinin menzilinde mi. */
export function feederCovers(sim: Sim, bowl: Building): boolean {
  const R = BALANCE.feeder.radius;
  return sim.buildings.some((f) => f.type === 'feeder' && isReady(f) && Math.hypot(bowl.x - f.x, bowl.y - f.y) <= R);
}

/** Saat başı: her hazır makine menzilindeki kaplara kilerden porsiyon koyar; kiler boşsa durur. */
export function tickFeeders(sim: Sim): void {
  const F = BALANCE.feeder;
  for (const f of sim.buildings) {
    if (f.type !== 'feeder' || !isReady(f)) continue;
    for (const b of sim.buildings) {
      if (sim.foodStock <= 0) return;
      if (b.type !== 'bowl' || !isReady(b) || Math.hypot(b.x - f.x, b.y - f.y) > F.radius) continue;
      const take = Math.min(F.feedPerHour, sim.bowlCapacity(b) - b.food, sim.foodStock);
      if (take <= 0) continue;
      b.food += take;
      sim.foodStock -= take;
    }
  }
}
