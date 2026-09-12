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
}

const SIZES: SizeClass[] = ['S', 'M', 'L'];
const STAGES: GrowthStage[] = ['puppy', 'young', 'adult'];
const PATTERNS: CoatPattern[] = ['plain', 'spots', 'patches', 'stripes'];
const TEMPERAMENTS: Temperament[] = ['calm', 'playful', 'shy', 'bold'];

/** Rastgele istek; itibar yükseldikçe daha seçici sahiplenici gelir. */
export function randomRequest(rng: Rng, reputation: number): AdoptionRequest {
  const picky = 0.25 + reputation / 200; // 0.25 - 0.75
  const r: AdoptionRequest = {};
  if (rng.chance(0.5)) r.size = rng.pick(SIZES);
  if (rng.chance(0.45)) r.stage = rng.weighted(STAGES, [4, 3, 3]);
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
  if (r.coat !== undefined) out.push({ weight: 2, ok: (d) => d.genome.coat === r.coat, text: `${COAT_COLORS[r.coat].name.toLowerCase()} tüylü` });
  if (r.pattern) out.push({ weight: 1, ok: (d) => d.genome.pattern === r.pattern, text: PATTERN_NAMES_TR[r.pattern].toLowerCase() });
  if (r.temperament) out.push({ weight: 3, ok: (d) => d.genome.temperament === r.temperament, text: TEMPERAMENT_NAMES_TR[r.temperament].toLowerCase() });
  if (r.minTraining) out.push({ weight: 3, ok: (d) => d.trainingLevel() >= r.minTraining!, text: `en az ${r.minTraining} beceri` });
  if (r.pottyTrained) out.push({ weight: 3, ok: (d) => d.isPottyTrained(), text: 'tuvalet eğitimli' });
  if (r.energy === 'high') out.push({ weight: 2, ok: (d) => d.genome.energy >= 4, text: 'enerjik' });
  if (r.energy === 'low') out.push({ weight: 2, ok: (d) => d.genome.energy <= 2, text: 'sakin tempolu' });
  return out;
}

export function hardMismatch(dog: Dog, r: AdoptionRequest): string | null {
  if (r.size && dog.genome.size !== r.size) return `${SIZE_NAMES_TR[r.size].toLowerCase()} boy istiyor`;
  if (r.stage && dog.stage !== r.stage) return `${STAGE_NAMES_TR[r.stage].toLowerCase()} istiyor`;
  return null;
}

/** Köpek sahiplendirilebilir mi (sağlık, temizlik, güven). */
export function adoptable(dog: Dog): string | null {
  const B = BALANCE.adoption;
  if (dog.wild || dog.following) return 'barınakta değil';
  if (dog.sick) return 'hasta';
  if (dog.needs.health < B.minHealth) return 'sağlığı düşük';
  if (dog.needs.hygiene < B.minHygiene) return 'kirli';
  if (dog.needs.loyalty < B.minLoyalty) return 'insanlara güveni az';
  return null;
}

/** 0-100 eşleşme puanı; zorunlu şart tutmuyorsa 0. */
export function matchScore(dog: Dog, r: AdoptionRequest): number {
  if (hardMismatch(dog, r)) return 0;
  const prefs = softPrefs(r);
  if (prefs.length === 0) return 85 + Math.min(15, RARITY_ORDER[dog.genome.rarity] * 5);
  let total = 0;
  let got = 0;
  for (const p of prefs) {
    total += p.weight;
    if (p.ok(dog)) got += p.weight;
  }
  const base = 40 + 60 * (got / total);
  return Math.round(Math.min(100, base + RARITY_ORDER[dog.genome.rarity] * 3));
}

/** İstek kartı metni. */
export function requestText(r: AdoptionRequest): string {
  const hard: string[] = [];
  if (r.size) hard.push(`${SIZE_NAMES_TR[r.size].toLowerCase()} boy`);
  if (r.stage) hard.push(STAGE_NAMES_TR[r.stage].toLowerCase());
  const soft = softPrefs(r).map((p) => p.text);
  const parts: string[] = [];
  parts.push(hard.length ? `Şart: ${hard.join(', ')}` : 'Boyut ve yaş fark etmez');
  if (soft.length) parts.push(`Tercih: ${soft.join(', ')}`);
  return parts.join(' · ');
}

export function adopterFromJSON(data: unknown): Adopter | null {
  const d = data as Partial<AdopterSave> | null;
  if (!d || typeof d.id !== 'number' || typeof d.name !== 'string' || typeof d.x !== 'number' || typeof d.y !== 'number') return null;
  const req = (d.request && typeof d.request === 'object' ? d.request : {}) as AdoptionRequest;
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
  };
}
