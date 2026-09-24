import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { type Adopter, adoptable, hardMismatch, matchScore } from '../entities/Adopter';
import { ADOPTER_TYPES } from '../entities/AdopterType';
import { type Dog, clamp100 } from '../entities/Dog';
import type { Sim } from '../Sim';

/**
 * Can dostu (0.21.4): karşılıklı dostluğu en az `bondMin` olan en güçlü barınak köpeği (yoksa null). Dostluk iki yönlü
 * sayılır: tek yönlü sevgi yetmez.
 */
export function bondedPartner(sim: Sim, dog: Dog): Dog | null {
  let best: Dog | null = null;
  let bestScore = BALANCE.stories.bondMin - 1;
  for (const [id, score] of Object.entries(dog.friends)) {
    const other = sim.dogById(Number(id));
    if (!other || other === dog || other.wild || dog.wild) continue;
    const mutual = Math.min(score, other.affinity(dog.id));
    if (mutual > bestScore) {
      best = other;
      bestScore = mutual;
    }
  }
  return best;
}

/** İkili eşleşme puanı: iki puanın ortalaması + artı (en çok 100). */
export function pairScore(a: Adopter, dog: Dog, partner: Dog): number {
  return Math.min(100, Math.round((matchScore(dog, a.request) + matchScore(partner, a.request)) / 2) + BALANCE.stories.pairBonus);
}

/** İkisini birlikte vermenin engeli (yoksa null): can dostu olmalı, tip ikiliye açık, ikisi de uygun, birlikte puan yeterli. */
export function pairIssue(sim: Sim, a: Adopter, dog: Dog, partner: Dog): string | null {
  if (bondedPartner(sim, dog)?.id !== partner.id) return t('{a} ile {b} can dostu değil', { a: dog.name, b: partner.name });
  if (!ADOPTER_TYPES[a.type].pairs) return t('{name} iki köpeğe bakamaz', { name: a.name });
  for (const d of [dog, partner]) {
    const why = adoptable(d) ?? hardMismatch(d, a.request);
    if (why) return t('{name}: {why}', { name: d.name, why });
  }
  const score = pairScore(a, dog, partner);
  return score < BALANCE.stories.pairMinScore ? t('İkisi birlikte uymuyor (puan {n})', { n: score }) : null;
}

/** Can dostu tek başına yuva bulunca kalan üzülür (0.21.4): sadakat ve oyun keyfi düşer, kısa süre uyarı balonu. */
export function separate(sim: Sim, partner: Dog | null): void {
  if (!partner || !sim.dogById(partner.id)) return;
  const S = BALANCE.stories;
  partner.needs.loyalty = clamp100(partner.needs.loyalty - S.separationLoyalty);
  partner.needs.play = clamp100(partner.needs.play - S.separationPlay);
  sim.events.emit('emote', { kind: 'dog', id: partner.id, emote: 'alert', seconds: 20 });
  sim.events.emit('message', t('💔 {name} can dostunu özlüyor', { name: partner.name }));
}
