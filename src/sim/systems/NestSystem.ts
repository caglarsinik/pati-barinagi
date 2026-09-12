import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { type Egg, createEgg } from '../entities/Egg';
import type { Rarity } from '../entities/DogGenome';
import { Biome, Obj } from '../world/tiles';
import type { Sim } from '../Sim';

/** Biyom ve uzaklığa göre nadirlik ağırlıkları: [sıradan, az, nadir, efsanevi]. */
function rarityWeights(biome: Biome, dist: number): [number, number, number, number] {
  let w: [number, number, number, number];
  switch (biome) {
    case Biome.Forest:
      w = [50, 35, 13, 2];
      break;
    case Biome.Hills:
    case Biome.Swamp:
      w = [35, 40, 20, 5];
      break;
    case Biome.Flowers:
      w = [60, 30, 9, 1];
      break;
    case Biome.Sand:
      w = [55, 35, 9, 1];
      break;
    default:
      w = [75, 22, 3, 0];
  }
  if (dist > 60) {
    w[0] = Math.max(10, w[0] - 15);
    w[2] += 10;
    w[3] += 5;
  }
  if (dist > 85) {
    w[0] = Math.max(5, w[0] - 10);
    w[3] += 10;
  }
  return w;
}

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Yuvadaki yumurtayı alır: yumurta üretir, yuva boşalır ve yeniden dolma sayacı başlar. */
export function harvestNest(sim: Sim, x: number, y: number): Egg | null {
  const w = sim.world;
  if (w.objectAt(x, y) !== Obj.NestEggs) return null;
  const i = w.idx(x, y);
  const count = sim.nestHarvests.get(i) ?? 0;
  const rng = new Rng(hash3(sim.seed, i, count));
  const p = w.plot;
  const dist = Math.hypot(x - (p.x + p.w / 2), y - (p.y + p.h / 2));
  const rarity = rng.weighted(RARITIES, rarityWeights(w.biomeAt(x, y), dist));
  const egg = createEgg(sim.nextId++, rng, rarity, sim.clock.day);
  sim.nestHarvests.set(i, count + 1);
  w.setObject(x, y, Obj.Nest);
  const base = BALANCE.eggs.nestRespawnDays;
  const extra = rarity === 'common' ? 0 : rarity === 'uncommon' ? 1 : 2;
  sim.nestTimers.set(i, (base + extra + rng.float(0, 1.5)) * 24 * 60 * sim.weatherSys.modifiers().nestRespawn);
  sim.stats.eggsFound++;
  return egg;
}

/** Böğürtlen çalısından ödül maması toplar; çalı bir süre sıradan çalıya döner. */
export function harvestBerries(sim: Sim, x: number, y: number): number {
  const w = sim.world;
  if (w.objectAt(x, y) !== Obj.BerryBush) return 0;
  const room = BALANCE.eggs.treatsMax - sim.treats;
  if (room <= 0) return 0;
  const gain = Math.min(room, BALANCE.eggs.treatsPerBush + sim.weatherSys.modifiers().berryBonus);
  sim.treats += gain;
  w.setObject(x, y, Obj.Bush);
  sim.bushTimers.set(w.idx(x, y), BALANCE.eggs.bushRegrowDays * 24 * 60);
  return gain;
}

/** Yuva ve çalı sayaçları: süre dolunca yeniden dolar. */
export function tickNests(sim: Sim, dtMin: number): void {
  const w = sim.world;
  for (const [i, left] of sim.nestTimers) {
    const next = left - dtMin;
    if (next > 0) {
      sim.nestTimers.set(i, next);
      continue;
    }
    sim.nestTimers.delete(i);
    const x = i % w.width;
    const y = Math.floor(i / w.width);
    if (w.objectAt(x, y) === Obj.Nest) w.setObject(x, y, Obj.NestEggs);
  }
  for (const [i, left] of sim.bushTimers) {
    const next = left - dtMin;
    if (next > 0) {
      sim.bushTimers.set(i, next);
      continue;
    }
    sim.bushTimers.delete(i);
    const x = i % w.width;
    const y = Math.floor(i / w.width);
    if (w.objectAt(x, y) === Obj.Bush) w.setObject(x, y, Obj.BerryBush);
  }
}
