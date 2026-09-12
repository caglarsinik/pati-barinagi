import { type Building, buildingDef, buildingDoorTile, isReady } from '../entities/Building';
import { type Egg, hatchMinutes } from '../entities/Egg';
import type { Sim } from '../Sim';
import { t } from '../../i18n';

export interface IncubatorResult {
  ok: boolean;
  message?: string;
}

export function incubatorSlots(b: Building): number {
  return buildingDef(b).eggSlots ?? 0;
}

/** Çantadaki yumurtayı kuluçkaya koyar. */
export function placeEgg(sim: Sim, building: Building, eggId: number): IncubatorResult {
  if (building.type !== 'incubator') return { ok: false, message: t('Bu bir kuluçka değil') };
  if (!isReady(building)) return { ok: false, message: t('Kuluçka henüz inşa ediliyor') };
  if (building.eggs.length >= incubatorSlots(building)) return { ok: false, message: t('Kuluçkada boş yuva yok') };
  const idx = sim.backpack.findIndex((e) => e.id === eggId);
  if (idx === -1) return { ok: false, message: t('Yumurta çantada değil') };
  const egg = sim.backpack.splice(idx, 1)[0];
  egg.hatchLeft = hatchMinutes();
  building.eggs.push(egg);
  return { ok: true, message: t('Yumurta kuluçkaya kondu') };
}

/** Kuluçkadaki yumurtayı çantaya geri alır (kuluçka süresi sıfırlanır). */
export function takeEgg(sim: Sim, building: Building, eggId: number): IncubatorResult {
  const idx = building.eggs.findIndex((e) => e.id === eggId);
  if (idx === -1) return { ok: false };
  if (sim.backpack.length >= sim.backpackSlots()) return { ok: false, message: t('Çanta dolu') };
  const egg = building.eggs.splice(idx, 1)[0];
  egg.hatchLeft = -1;
  sim.backpack.push(egg);
  return { ok: true };
}

/** Kuluçka sayaçları; süre dolunca yavru doğar. */
export function tickIncubators(sim: Sim, dtMin: number): void {
  for (const b of sim.buildings) {
    if (b.type !== 'incubator' || !isReady(b) || b.eggs.length === 0) continue;
    const hatched: Egg[] = [];
    for (const egg of b.eggs) {
      egg.hatchLeft = Math.max(0, egg.hatchLeft - dtMin);
      if (egg.hatchLeft === 0) hatched.push(egg);
    }
    for (const egg of hatched) {
      b.eggs = b.eggs.filter((e) => e.id !== egg.id);
      const door = buildingDoorTile(b);
      const dog = sim.addDog(egg.genome, 'egg', 0, door.x + 0.5, door.y + 0.5);
      sim.stats.hatched++;
      sim.events.emit('dogHatched', dog);
      sim.events.emit('message', t('Yumurta çatladı: {name} doğdu!', { name: dog.name }));
    }
  }
}
