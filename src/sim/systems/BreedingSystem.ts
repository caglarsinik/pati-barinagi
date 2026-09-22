import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { type Building, isReady } from '../entities/Building';
import type { Dog } from '../entities/Dog';
import { inheritGenome } from '../entities/DogGenome';
import type { Sim } from '../Sim';
import { t } from '../../i18n';

const DAY = 24 * 60;

/** Bir yuva evinde tam çiftin bir yumurta için harcadığı süre (dk). */
export function breedMinutes(): number {
  return BALANCE.breeding.days * DAY;
}

/** Karşılıklı dostluk: iki köpeğin birbirine verdiği puanın küçüğü. */
export function mutualAffinity(a: Dog, b: Dog): number {
  return Math.min(a.affinity(b.id), b.affinity(a.id));
}

function nurseryOf(sim: Sim, dogId: number, except?: Building): Building | undefined {
  return sim.buildings.find((b) => b !== except && b.type === 'nursery' && b.pair.includes(dogId));
}

/** Çiftin eksikleri (boş liste = uygun). Sıra: seçim, yaş, sağlık, dostluk, dinlenme, konum. */
export function breedingIssues(sim: Sim, a: Dog | undefined, b: Dog | undefined, building?: Building): string[] {
  const B = BALANCE.breeding;
  if (!a || !b) return [t('İki köpek seç')];
  if (a.id === b.id) return [t('İki farklı köpek seç')];
  const out: string[] = [];
  const now = sim.clock.totalMinutes;
  for (const d of [a, b]) {
    if (d.wild || d.walking || !sim.dogById(d.id)) out.push(t('{name} barınakta değil', { name: d.name }));
    if (d.stage !== 'adult') out.push(t('{name} yetişkin değil (yavru, genç ya da yaşlı)', { name: d.name }));
    if (d.needs.health < B.minHealth) out.push(t('{name} sağlığı düşük ({n}/{min})', { name: d.name, n: Math.floor(d.needs.health), min: B.minHealth }));
    if (d.breedReadyAt > now) out.push(t('{name} dinleniyor ({n} gün)', { name: d.name, n: Math.ceil((d.breedReadyAt - now) / DAY) }));
    if (nurseryOf(sim, d.id, building)) out.push(t('{name} başka bir yuva evinde', { name: d.name }));
  }
  const aff = mutualAffinity(a, b);
  if (aff < B.minAffinity) out.push(t('Dostlukları yetersiz ({n}/{min})', { n: Math.floor(aff), min: B.minAffinity }));
  return out;
}

/** Çifti ata (0–2 köpek). Değişince sayaç baştan başlar. */
export function setNurseryPair(sim: Sim, building: Building, ids: number[]): { ok: boolean; message?: string } {
  if (building.type !== 'nursery') return { ok: false };
  const clean = [...new Set(ids)].slice(0, 2);
  for (const id of clean) {
    const d = sim.dogById(id);
    if (!d || d.wild) return { ok: false, message: t('Köpek bulunamadı') };
    if (nurseryOf(sim, id, building)) return { ok: false, message: t('{name} başka bir yuva evinde', { name: d.name }) };
  }
  const same = clean.length === building.pair.length && clean.every((id) => building.pair.includes(id));
  building.pair = clean;
  if (!same) building.breedLeft = breedMinutes();
  return { ok: true };
}

/** Yuva evleri: tam ve uygun çift varken sayaç işler; bitince soylu yumurta, ikisine dinlenme süresi. */
export function tickNurseries(sim: Sim, dtMin: number): void {
  for (const b of sim.buildings) {
    if (b.type !== 'nursery' || !isReady(b)) continue;
    b.pair = b.pair.filter((id) => sim.dogById(id) !== undefined);
    if (b.pair.length < 2 || b.eggs.length > 0) continue;
    const [a, c] = b.pair.map((id) => sim.dogById(id));
    if (breedingIssues(sim, a, c, b).length > 0) continue;
    b.breedLeft = Math.max(0, b.breedLeft - dtMin);
    if (b.breedLeft > 0) continue;
    const rng = new Rng(hash3(sim.seed, b.id, sim.stats.bred));
    const egg = {
      id: sim.nextId++,
      genome: inheritGenome(a!.genome, c!.genome, rng),
      foundDay: sim.clock.day,
      hatchLeft: -1,
      parents: [a!.id, c!.id] as [number, number],
      parentNames: [a!.name, c!.name] as [string, string],
    };
    b.eggs.push(egg);
    b.breedLeft = breedMinutes();
    const rest = sim.clock.totalMinutes + BALANCE.breeding.cooldownWeeks * 7 * DAY;
    a!.breedReadyAt = rest;
    c!.breedReadyAt = rest;
    sim.stats.bred++;
    sim.events.emit('message', t('{a} ile {b} yuva evinde bir yumurta verdi!', { a: a!.name, b: c!.name }));
  }
}

/** Yuva evindeki yumurtayı çantaya al. */
export function takeNurseryEgg(sim: Sim, building: Building): { ok: boolean; message?: string } {
  if (building.type !== 'nursery' || building.eggs.length === 0) return { ok: false, message: t('Yuva evinde yumurta yok') };
  if (sim.backpack.length >= sim.backpackSlots()) return { ok: false, message: t('Çanta dolu') };
  const egg = building.eggs.shift()!;
  sim.backpack.push(egg);
  return { ok: true, message: t('Soylu yumurta çantaya alındı: kuluçkaya koy') };
}
