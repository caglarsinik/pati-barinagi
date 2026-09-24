import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import type { Sim } from '../Sim';
import type { AdoptionRecord } from './AdoptionSystem';
import { type Letter, type PhotoScene, TYPE_SCENE } from './MailSystem';

/** Sahiplendirme kaydının ailesi (0.21.2): tekrar gelen ailede ilk sahiplendirmenin anahtarı, yoksa kaydın kendi anahtarı. */
export function familyKey(r: AdoptionRecord): number | undefined {
  return r.family ?? r.key;
}

/** Ailenin en son sahiplendirmesi (yoksa null). */
export function familyLast(sim: Sim, family: number): AdoptionRecord | null {
  for (let i = sim.adoptions.length - 1; i >= 0; i--) if (familyKey(sim.adoptions[i]) === family) return sim.adoptions[i];
  return null;
}

export interface ReturningFamily {
  family: number;
  last: AdoptionRecord;
  adoptions: number;
}

/**
 * Tekrar gelebilecek aileler (0.21.2): köylü olmayan, hiç köpek geri getirmemiş, son sahiplendirmesi harika (≥70) ve en az
 * `returnMinDays` gün önce olan, en çok `returnMaxAdoptions` kez sahiplenmiş, şu an sırada olmayan aileler.
 */
export function returningCandidates(sim: Sim): ReturningFamily[] {
  const S = BALANCE.stories;
  const byFamily = new Map<number, AdoptionRecord[]>();
  for (const r of sim.adoptions) {
    const f = familyKey(r);
    if (f === undefined || f < 0 || r.villager !== undefined) continue;
    const list = byFamily.get(f);
    if (list) list.push(r);
    else byFamily.set(f, [r]);
  }
  const out: ReturningFamily[] = [];
  for (const [family, recs] of byFamily) {
    const last = recs[recs.length - 1];
    if (recs.some((r) => r.returned) || last.score < 70 || recs.length >= S.returnMaxAdoptions) continue;
    if (sim.clock.day - last.day < S.returnMinDays || sim.adopters.some((a) => a.family === family)) continue;
    out.push({ family, last, adoptions: recs.length });
  }
  return out;
}

/** Gelen sahiplenici eski bir aile mi: ayrı RNG (sahiplenici kimliğinden), olasılık uygun aile sayısıyla artar. */
export function pickReturningFamily(sim: Sim, adopterId: number): ReturningFamily | null {
  const S = BALANCE.stories;
  const cands = returningCandidates(sim);
  if (cands.length === 0) return null;
  const rng = new Rng(hash3(sim.seed, adopterId, 0xfa11));
  const chance = Math.min(S.returnChanceMax, S.returnChanceBase + S.returnChancePerFamily * cands.length);
  return rng.next() < chance ? rng.pick(cands) : null;
}

export type AlbumFilter = 'all' | 'letters' | 'village';

export interface AlbumEntry {
  index: number;
  record: AdoptionRecord;
  /** Eşleşme puanından 1–5 yıldız. */
  stars: number;
  scene: PhotoScene;
  village: boolean;
  /** Tekrar gelen ailenin sahiplendirmesi. */
  returning: boolean;
  returned: boolean;
  /** İkili sahiplendirmede birlikte giden can dostu (0.21.4). */
  pair: string | null;
  letter: Letter | null;
}

/** Mezunlar albümü (0.21.2): yeniden eskiye, süzgeçli. */
export function albumEntries(sim: Sim, filter: AlbumFilter = 'all'): AlbumEntry[] {
  const out: AlbumEntry[] = [];
  for (let i = sim.adoptions.length - 1; i >= 0; i--) {
    const r = sim.adoptions[i];
    let letter: Letter | null = null;
    if (r.key !== undefined) {
      for (let k = sim.mail.list.length - 1; k >= 0 && !letter; k--) if (sim.mail.list[k].key === r.key) letter = sim.mail.list[k];
    }
    const village = r.villager !== undefined;
    if (filter === 'letters' && !letter) continue;
    if (filter === 'village' && !village) continue;
    out.push({
      index: i,
      record: r,
      stars: Math.max(1, Math.min(5, Math.ceil(r.score / 20))),
      scene: village ? 'village' : TYPE_SCENE[r.type ?? 'family'],
      village,
      returning: r.family !== undefined && r.key !== undefined && r.family !== r.key,
      returned: r.returned === true,
      pair: r.pair ?? null,
      letter,
    });
  }
  return out;
}

/** Albüm başlığı: mezun sayısı, mutlu (≥70, geri gelmemiş) yüzdesi, geri gelenler. */
export function albumStats(sim: Sim): { total: number; happyPct: number; returned: number } {
  const total = sim.adoptions.length;
  const happy = sim.adoptions.filter((r) => r.score >= 70 && !r.returned).length;
  return { total, happyPct: total > 0 ? Math.round((100 * happy) / total) : 0, returned: sim.adoptions.filter((r) => r.returned).length };
}
