import { BALANCE } from '../../config/balance';
import { FIRST_NAMES, SURNAMES } from '../../content/names';
import { Rng, hash3 } from '../../core/Rng';
import type { AdopterLike, AdoptionRequest } from './Adopter';
import type { VillagerRole } from './Villager';

/** Sahiplenici kişilik tipi (0.21.0). */
export type AdopterType = 'family' | 'retiree' | 'athlete' | 'student' | 'farmer' | 'artist';
export const ADOPTER_TYPE_ORDER: readonly AdopterType[] = ['family', 'retiree', 'athlete', 'student', 'farmer', 'artist'];

export interface AdopterTypeDef {
  icon: string;
  name: string;
  /** Kartta kısa huy. */
  trait: string;
  /** Sevdiği özellikler: uyan köpeğe eşleşme artısı, eksikliği puan düşürmez. */
  likes: readonly AdopterLike[];
  /** Yaşlı köpeğe puan cezası yok. */
  seniorOk?: boolean;
  feeMul: number;
  patienceMul: number;
  /** Mektup bağışı çarpanı (0.21.1). */
  generosity: number;
  /** İkili sahiplendirmeye açık mı (0.21.4). */
  pairs: boolean;
}

export const ADOPTER_TYPES: Record<AdopterType, AdopterTypeDef> = {
  family: { icon: '👨‍👩‍👧', name: 'Aile', trait: 'çocuklu, evi kalabalık', likes: ['young', 'playful'], feeMul: 1, patienceMul: 1, generosity: 1, pairs: true },
  retiree: { icon: '👵', name: 'Emekli', trait: 'sabırlı, yaşlı köpeğe de kucak açar', likes: ['calm', 'relaxed'], seniorOk: true, feeMul: 0.9, patienceMul: 1.5, generosity: 1.2, pairs: true },
  athlete: { icon: '🏃', name: 'Sporcu', trait: 'aceleci, her sabah koşar', likes: ['energetic', 'bold'], feeMul: 1.1, patienceMul: 0.8, generosity: 1, pairs: true },
  student: { icon: '🎒', name: 'Öğrenci', trait: 'bütçesi dar, evi küçük', likes: ['small'], feeMul: 0.7, patienceMul: 1.2, generosity: 0.5, pairs: false },
  farmer: { icon: '🚜', name: 'Çiftçi', trait: 'bahçesi geniş, çiftlikte yaşar', likes: ['large'], feeMul: 1, patienceMul: 1, generosity: 1, pairs: true },
  artist: { icon: '🎨', name: 'Sanatçı', trait: 'sabırsız ama cömert', likes: ['rare'], feeMul: 1.4, patienceMul: 0.7, generosity: 1.5, pairs: true },
};

/** Köyden gelen sahiplenicinin tipi rolünden. */
export const VILLAGER_ADOPTER_TYPE: Record<VillagerRole, AdopterType> = {
  child: 'family',
  elder: 'retiree',
  walker: 'athlete',
  clerk: 'student',
  gardener: 'farmer',
  shopkeeper: 'artist',
};

export function isAdopterType(v: unknown): v is AdopterType {
  return typeof v === 'string' && (ADOPTER_TYPE_ORDER as readonly string[]).includes(v);
}

/** Sahiplenici kimliği: kişilik tipi ve ad soyad, sahiplenici kimliğinden ayrı RNG ile (ana RNG sırası değişmez). */
export function adopterIdentity(seed: number, adopterId: number): { type: AdopterType; name: string } {
  const rng = new Rng(hash3(seed, adopterId, 0xad0b));
  const type = rng.pick(ADOPTER_TYPE_ORDER);
  return { type, name: `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}` };
}

/** Tipin sevdikleri isteğe eklenir (emeklide yaşlı cezası da kalkar); boy/yaş şartları ve tercihler aynen kalır. */
export function withTypeLikes(r: AdoptionRequest, type: AdopterType): AdoptionRequest {
  const d = ADOPTER_TYPES[type];
  return { ...r, likes: [...d.likes], ...(d.seniorOk ? { seniorOk: true } : {}) };
}

/** Tipe göre ücret (10'a yuvarlı, tavanlı). */
export function typedFee(fee: number, type: AdopterType): number {
  return Math.min(BALANCE.adoption.feeMax, Math.round((fee * ADOPTER_TYPES[type].feeMul) / 10) * 10);
}
