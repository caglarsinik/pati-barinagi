import { BALANCE } from '../../config/balance';
import type { Rng } from '../../core/Rng';
import type { GrowthStage } from './Dog';
import { Dog, STAGE_NAMES_TR } from './Dog';
import {
  COAT_COLORS,
  type CoatPattern,
  PATTERN_NAMES_TR,
  RARITY_ORDER,
  SIZE_NAMES_TR,
  type SizeClass,
  TEMPERAMENT_NAMES_TR,
  type Temperament,
} from './DogGenome';
import type { Facing } from './Player';
import type { TilePos } from '../world/TileWorld';
import { t } from '../../i18n';
import { type AdopterType, isAdopterType } from './AdopterType';

/** Kişilik tipinin sevdiği özellik (0.21.0): uyan köpeğe eşleşme artısı verir, eksikliği puan düşürmez. */
export type AdopterLike = 'young' | 'small' | 'large' | 'rare' | 'calm' | 'playful' | 'bold' | 'energetic' | 'relaxed';

export const LIKE_NAMES_TR: Record<AdopterLike, string> = {
  young: 'yavru ya da genç',
  small: 'küçük boy',
  large: 'büyük boy',
  rare: 'nadir köpek',
  calm: 'sakin',
  playful: 'oyuncu',
  bold: 'cesur',
  energetic: 'enerjik',
  relaxed: 'sakin tempolu',
};

export function likeOk(dog: Dog, like: AdopterLike): boolean {
  const g = dog.genome;
  switch (like) {
    case 'young':
      return dog.stage === 'puppy' || dog.stage === 'young';
    case 'small':
      return g.size === 'S';
    case 'large':
      return g.size === 'L';
    case 'rare':
      return RARITY_ORDER[g.rarity] >= RARITY_ORDER.rare;
    case 'calm':
    case 'playful':
    case 'bold':
      return g.temperament === like;
    case 'energetic':
      return g.energy >= 4;
    case 'relaxed':
      return g.energy <= 2;
  }
}

/** Köpeğin uyduğu sevgi sayısı. */
export function likeHits(dog: Dog, r: AdoptionRequest): number {
  return (r.likes ?? []).filter((l) => likeOk(dog, l)).length;
}

/** Sahiplenicinin isteği: zorunlu şartlar ve ağırlıklı tercihler. */
export interface AdoptionRequest {
  size?: SizeClass;
  stage?: GrowthStage;
  coat?: number;
  pattern?: CoatPattern;
  temperament?: Temperament;
  minTraining?: number;
  pottyTrained?: boolean;
  /** 'high' enerjik, 'low' sakin. */
  energy?: 'high' | 'low';
  /** Kişilik tipinin sevdikleri (0.21.0): uyan köpeğe artı, eksikliği ceza değil. */
  likes?: AdopterLike[];
  /** Yaşlı köpeğe puan cezası yok (emekli, 0.21.0). */
  seniorOk?: boolean;
}

export type AdopterState = 'walking' | 'waiting' | 'leaving';

export interface Adopter {
  id: number;
  name: string;
  request: AdoptionRequest;
  /** Ödeyeceği ücret. */
  fee: number;
  /** Bekleme sabrı (oyun dakikası); biterse gider. */
  patienceLeft: number;
  state: AdopterState;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  path: TilePos[];
  /** Sprite renkleri için tohum. */
  look: number;
  /** Bekleme sırası (ofis önü konumu). */
  queueSlot: number;
  /** Köyden gelen sahiplenici (0.20.2): köylü indeksi. */
  villager?: number;
  /** Kişilik tipi (0.21.0). */
  type: AdopterType;
}

export interface AdopterSave {
  id: number;
  name: string;
  request: AdoptionRequest;
  fee: number;
  patienceLeft: number;
  state: AdopterState;
  x: number;
  y: number;
  look: number;
  queueSlot: number;
  villager?: number;
  type?: string;
}

const SIZES: SizeClass[] = ['S', 'M', 'L'];
const STAGES: GrowthStage[] = ['puppy', 'young', 'adult', 'senior'];
const PATTERNS: CoatPattern[] = ['plain', 'spots', 'patches', 'stripes'];
const TEMPERAMENTS: Temperament[] = ['calm', 'playful', 'shy', 'bold'];

/** Rastgele istek; itibar yükseldikçe daha seçici sahiplenici gelir. */
export function randomRequest(rng: Rng, reputation: number): AdoptionRequest {
  const picky = 0.25 + reputation / 200; // 0.25 - 0.75
  const r: AdoptionRequest = {};
  if (rng.chance(0.5)) r.size = rng.pick(SIZES);
  if (rng.chance(0.45)) r.stage = rng.weighted(STAGES, [4, 3, 3, 1]);
  if (rng.chance(picky * 0.6)) r.coat = rng.int(0, 7);
  if (rng.chance(picky * 0.4)) r.pattern = rng.pick(PATTERNS);
  if (rng.chance(picky)) r.temperament = rng.pick(TEMPERAMENTS);
  if (rng.chance(picky)) r.minTraining = rng.int(1, 3);
  if (rng.chance(picky * 0.7)) r.pottyTrained = true;
  if (rng.chance(picky * 0.6)) r.energy = rng.chance(0.5) ? 'high' : 'low';
  return r;
}

/** Tercih sayısına ve zorluğuna göre ücret. */
export function requestFee(rng: Rng, r: AdoptionRequest): number {
  const B = BALANCE.adoption;
  let fee = B.feeBase;
  const prefs = softPrefs(r).length;
  fee += prefs * B.feePerPreference;
  if (r.minTraining) fee += r.minTraining * 60;
  if (r.pottyTrained) fee += 80;
  if (r.stage === 'senior') fee += 100;
  fee = Math.round((fee * rng.float(0.9, 1.15)) / 10) * 10;
  return Math.min(B.feeMax, fee);
}

interface Pref {
  weight: number;
  ok: (d: Dog) => boolean;
  text: string;
}

function softPrefs(r: AdoptionRequest): Pref[] {
  const out: Pref[] = [];
  if (r.coat !== undefined) out.push({ weight: 2, ok: (d) => d.genome.coat === r.coat, text: t('{color} tüylü', { color: t(COAT_COLORS[r.coat].name).toLowerCase() }) });
  if (r.pattern) out.push({ weight: 1, ok: (d) => d.genome.pattern === r.pattern, text: t(PATTERN_NAMES_TR[r.pattern]).toLowerCase() });
  if (r.temperament) out.push({ weight: 3, ok: (d) => d.genome.temperament === r.temperament, text: t(TEMPERAMENT_NAMES_TR[r.temperament]).toLowerCase() });
  if (r.minTraining) out.push({ weight: 3, ok: (d) => d.trainingLevel() >= r.minTraining!, text: t('en az {n} beceri', { n: r.minTraining }) });
  if (r.pottyTrained) out.push({ weight: 3, ok: (d) => d.isPottyTrained(), text: t('tuvalet eğitimli') });
  if (r.energy === 'high') out.push({ weight: 2, ok: (d) => d.genome.energy >= 4, text: t('enerjik') });
  if (r.energy === 'low') out.push({ weight: 2, ok: (d) => d.genome.energy <= 2, text: t('sakin tempolu') });
  return out;
}

export function hardMismatch(dog: Dog, r: AdoptionRequest): string | null {
  if (r.size && dog.genome.size !== r.size) return t('{size} boy istiyor', { size: t(SIZE_NAMES_TR[r.size]).toLowerCase() });
  if (r.stage && dog.stage !== r.stage) return t('{stage} istiyor', { stage: t(STAGE_NAMES_TR[r.stage]).toLowerCase() });
  return null;
}

/** Köpek sahiplendirilebilir mi (sağlık, temizlik, güven). */
export function adoptable(dog: Dog, allowWalking = false): string | null {
  const B = BALANCE.adoption;
  if (dog.wild || dog.following) return t('barınakta değil');
  if (dog.keep) return t('sahiplendirmeye kapalı (tutuluyor)');
  if (dog.walking && !allowWalking) return t('gezintide');
  if (dog.sick) return t('hasta');
  if (dog.needs.health < B.minHealth) return t('sağlığı düşük');
  if (dog.needs.hygiene < B.minHygiene) return t('kirli');
  if (dog.needs.loyalty < B.minLoyalty) return t('insanlara güveni az');
  return null;
}

/** 0-100 eşleşme puanı; zorunlu şart tutmuyorsa 0. */
export function matchScore(dog: Dog, r: AdoptionRequest): number {
  if (hardMismatch(dog, r)) return 0;
  const prefs = softPrefs(r);
  const seniorPenalty = dog.stage === 'senior' && r.stage !== 'senior' && !r.seniorOk ? 10 : 0;
  const likeBonus = likeHits(dog, r) * BALANCE.adoption.likeBonus;
  // Öğrenilmiş beceriler: istekten fazlası küçük bonus, "otur" ayrıca artı.
  const K = BALANCE.dogs.skills;
  const skillBonus = Math.min(K.extraSkillBonusMax, K.extraSkillBonus * Math.max(0, dog.trainingLevel() - (r.minTraining ?? 0))) + (dog.skills.sit >= 100 ? K.sitMatchBonus : 0);
  if (prefs.length === 0) return Math.max(1, Math.min(100, 85 + Math.min(15, RARITY_ORDER[dog.genome.rarity] * 5) + skillBonus + likeBonus) - seniorPenalty);
  let total = 0;
  let got = 0;
  for (const p of prefs) {
    total += p.weight;
    if (p.ok(dog)) got += p.weight;
  }
  const base = 40 + 60 * (got / total);
  return Math.max(1, Math.round(Math.min(100, base + RARITY_ORDER[dog.genome.rarity] * 3 + skillBonus + likeBonus) - seniorPenalty));
}

/** İstek kartı metni. */
export function requestText(r: AdoptionRequest): string {
  const hard: string[] = [];
  if (r.size) hard.push(t('{size} boy', { size: t(SIZE_NAMES_TR[r.size]).toLowerCase() }));
  if (r.stage) hard.push(r.stage === 'senior' ? t('yaşlı dost') : t(STAGE_NAMES_TR[r.stage]).toLowerCase());
  const soft = softPrefs(r).map((p) => p.text);
  const parts: string[] = [];
  parts.push(hard.length ? t('Şart: {list}', { list: hard.join(', ') }) : t('Boyut ve yaş fark etmez'));
  if (soft.length) parts.push(t('Tercih: {list}', { list: soft.join(', ') }));
  if (r.likes?.length) parts.push(t('Sever: {list}', { list: r.likes.map((l) => t(LIKE_NAMES_TR[l])).join(', ') }));
  return parts.join(' · ');
}

export function adopterFromJSON(data: unknown): Adopter | null {
  const d = data as Partial<AdopterSave> | null;
  if (!d || typeof d.id !== 'number' || typeof d.name !== 'string' || typeof d.x !== 'number' || typeof d.y !== 'number') return null;
  const req = (d.request && typeof d.request === 'object' ? { ...d.request } : {}) as AdoptionRequest;
  if (Array.isArray(req.likes)) req.likes = req.likes.filter((l): l is AdopterLike => typeof l === 'string' && l in LIKE_NAMES_TR);
  else delete req.likes;
  return {
    id: d.id,
    name: d.name,
    request: req,
    fee: typeof d.fee === 'number' ? d.fee : BALANCE.adoption.feeBase,
    patienceLeft: typeof d.patienceLeft === 'number' ? d.patienceLeft : BALANCE.adoption.patienceMinutes,
    state: d.state === 'walking' || d.state === 'leaving' ? d.state : 'waiting',
    x: d.x,
    y: d.y,
    facing: 0,
    moving: false,
    path: [],
    look: typeof d.look === 'number' ? d.look : 0,
    queueSlot: typeof d.queueSlot === 'number' ? d.queueSlot : 0,
    ...(typeof d.villager === 'number' ? { villager: d.villager } : {}),
    // Eski kayıtta tip yok: Sim.fromJSON kimlikten (köylüde rolden) türetir.
    type: isAdopterType(d.type) ? d.type : 'family',
  };
}
