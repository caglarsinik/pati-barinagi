import { BALANCE } from '../../config/balance';
import type { Adopter } from '../entities/Adopter';
import type { Dog } from '../entities/Dog';
import type { Staff } from '../entities/Staff';

/** Dünya üstü balon ikonları. Sırası doku sayfasındaki kare sırasıdır. */
export const EMOTE_KEYS = ['heart', 'zzz', 'bone', 'drop', 'poop', 'thermo', 'alert', 'note', 'paw', 'tool', 'question'] as const;
export type Emote = (typeof EMOTE_KEYS)[number];

/** Geçici (olay) emote'u: sev → kalp, dost oyunu → pati gibi. */
export interface EmoteEvent {
  kind: 'dog' | 'staff' | 'adopter';
  id: number;
  emote: Emote;
  /** Gerçek saniye. */
  seconds: number;
}

/**
 * Köpeğin kalıcı balonu: en acil ihtiyaç kazanır. Saf fonksiyon; render katmanı her karede okur.
 * Öncelik: hasta > kaçma riski > açlık > susuzluk > tuvalet > sıkılma > uyku.
 */
export function dogEmote(dog: Dog): Emote | null {
  if (dog.wild) return dog.following ? 'heart' : null;
  const n = dog.needs;
  const E = BALANCE.emotes;
  if (dog.sick) return 'thermo';
  if (n.loyalty < BALANCE.events.escapeLoyaltyBelow) return 'alert';
  if (n.hunger >= E.hungerAbove) return 'bone';
  if (n.thirst >= E.thirstAbove) return 'drop';
  if (n.bladder >= E.bladderAbove) return 'poop';
  if (n.play < E.playBelow) return 'note';
  if (dog.state === 'sleep') return 'zzz';
  return null;
}

export function staffEmote(s: Staff): Emote | null {
  if (s.state === 'working') return 'tool';
  if (s.state === 'resting') return 'zzz';
  return null;
}

export function adopterEmote(a: Adopter): Emote | null {
  return a.state === 'waiting' ? 'question' : null;
}
