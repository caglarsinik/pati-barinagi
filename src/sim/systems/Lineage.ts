import type { Dog } from '../entities/Dog';
import type { Sim } from '../Sim';

export interface LineageInfo {
  /** Anne-baba: ad ve barınakta olup olmadığı (panelde tıklanabilir). */
  parents: Array<{ id: number; name: string; here: boolean }>;
  /** Dede-nine adları (ebeveyn hâlâ kayıttaysa onun soyundan). */
  grandparents: string[];
  /** Barınaktaki yavruları. */
  children: Array<{ id: number; name: string }>;
}

/** Köpeğin soy ağacı: yuva evinden gelen yavrularda anne-baba ve dede-nine, herkeste barınaktaki yavrular. */
export function lineageOf(sim: Sim, dog: Dog): LineageInfo {
  const parents: LineageInfo['parents'] = [];
  const grandparents: string[] = [];
  if (dog.parents && dog.parentNames) {
    dog.parents.forEach((id, i) => {
      const p = sim.dogById(id);
      parents.push({ id, name: p?.name ?? dog.parentNames![i], here: !!p && !p.wild });
      if (p?.parentNames) grandparents.push(...p.parentNames);
    });
  }
  const children = sim.dogs.filter((d) => d.id !== dog.id && !!d.parents && d.parents.includes(dog.id)).map((d) => ({ id: d.id, name: d.name }));
  return { parents, grandparents, children };
}
