import { BALANCE } from '../../config/balance';
import type { Rng } from '../../core/Rng';

export type SizeClass = 'S' | 'M' | 'L';
export type BodyType = 'stocky' | 'standard' | 'slim';
export type EarType = 'floppy' | 'pointy' | 'round';
export type TailType = 'curly' | 'straight' | 'bushy';
export type CoatPattern = 'plain' | 'spots' | 'patches' | 'stripes';
export type Temperament = 'calm' | 'playful' | 'shy' | 'bold';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Köpeğin değişmez özellikleri. Sprite ve karakter tamamen bundan türetilir. */
export interface DogGenome {
  size: SizeClass;
  body: BodyType;
  ears: EarType;
  tail: TailType;
  /** COAT_COLORS dizini. */
  coat: number;
  pattern: CoatPattern;
  /** Desen rengi, COAT_COLORS dizini. */
  secondary: number;
  temperament: Temperament;
  intelligence: number; // 1-5
  energy: number; // 1-5
  rarity: Rarity;
}

export interface CoatColor {
  name: string;
  base: number;
  dark: number;
  light: number;
  /** Sadece nadir/efsanevi yumurtalardan çıkar. */
  minRarity: Rarity;
}

export const COAT_COLORS: readonly CoatColor[] = [
  { name: 'Bal', base: 0xd9a651, dark: 0xa9772f, light: 0xf0c97e, minRarity: 'common' },
  { name: 'Kahve', base: 0x8a5a33, dark: 0x5e3b1f, light: 0xb07d52, minRarity: 'common' },
  { name: 'Siyah', base: 0x2f2b36, dark: 0x1c1a21, light: 0x4d4858, minRarity: 'common' },
  { name: 'Beyaz', base: 0xf3efe6, dark: 0xc9c2b4, light: 0xffffff, minRarity: 'common' },
  { name: 'Gri', base: 0x8f8f98, dark: 0x5f5f68, light: 0xb8b8c0, minRarity: 'common' },
  { name: 'Kızıl', base: 0xc3672f, dark: 0x8a4419, light: 0xe08c55, minRarity: 'common' },
  { name: 'Krem', base: 0xe9d7b0, dark: 0xbfa77a, light: 0xf8ecd2, minRarity: 'common' },
  { name: 'Çikolata', base: 0x5b3a2a, dark: 0x3a2318, light: 0x7d5440, minRarity: 'common' },
  { name: 'Lavanta', base: 0xb69ee6, dark: 0x8468b8, light: 0xd6c6f5, minRarity: 'rare' },
  { name: 'Nane', base: 0x8fd9b6, dark: 0x5aa984, light: 0xbdeed6, minRarity: 'rare' },
  { name: 'Gül', base: 0xf0a3bd, dark: 0xc26f8e, light: 0xf9cddb, minRarity: 'rare' },
  { name: 'Altın', base: 0xf3c634, dark: 0xbd8f0e, light: 0xfbe58c, minRarity: 'legendary' },
  { name: 'Gece', base: 0x2c3e8f, dark: 0x1a2560, light: 0x4a62c4, minRarity: 'legendary' },
];

export const RARITY_ORDER: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

export const RARITY_NAMES_TR: Record<Rarity, string> = {
  common: 'Sıradan',
  uncommon: 'Az bulunur',
  rare: 'Nadir',
  legendary: 'Efsanevi',
};

export const SIZE_NAMES_TR: Record<SizeClass, string> = { S: 'Küçük', M: 'Orta', L: 'Büyük' };
export const BODY_NAMES_TR: Record<BodyType, string> = { stocky: 'Tıknaz', standard: 'Standart', slim: 'İnce' };
export const EAR_NAMES_TR: Record<EarType, string> = { floppy: 'Düşük kulak', pointy: 'Dik kulak', round: 'Yuvarlak kulak' };
export const TAIL_NAMES_TR: Record<TailType, string> = { curly: 'Kıvrık kuyruk', straight: 'Düz kuyruk', bushy: 'Tüylü kuyruk' };
export const PATTERN_NAMES_TR: Record<CoatPattern, string> = { plain: 'Düz', spots: 'Benekli', patches: 'Yamalı', stripes: 'Çizgili' };
export const TEMPERAMENT_NAMES_TR: Record<Temperament, string> = { calm: 'Sakin', playful: 'Oyuncu', shy: 'Çekingen', bold: 'Cesur' };

const SIZES: SizeClass[] = ['S', 'M', 'L'];
const BODIES: BodyType[] = ['stocky', 'standard', 'slim'];
const EARS: EarType[] = ['floppy', 'pointy', 'round'];
const TAILS: TailType[] = ['curly', 'straight', 'bushy'];
const PATTERNS: CoatPattern[] = ['plain', 'spots', 'patches', 'stripes'];
const TEMPERAMENTS: Temperament[] = ['calm', 'playful', 'shy', 'bold'];

function coatChoices(rarity: Rarity): number[] {
  const r = RARITY_ORDER[rarity];
  const out: number[] = [];
  COAT_COLORS.forEach((c, i) => {
    if (RARITY_ORDER[c.minRarity] <= r) out.push(i);
  });
  return out;
}

/** Rastgele genom. Nadirlik yükseldikçe özel renkler ve yüksek zekâ/enerji ihtimali artar. */
export function randomGenome(rng: Rng, rarity: Rarity = 'common'): DogGenome {
  const r = RARITY_ORDER[rarity];
  const choices = coatChoices(rarity);
  // Nadir renkler, nadir yumurtalarda daha olası.
  const weights = choices.map((i) => (RARITY_ORDER[COAT_COLORS[i].minRarity] === r ? 4 : 1));
  const coat = rng.weighted(choices, weights);
  let secondary = rng.pick(choices.filter((i) => i !== coat));
  if (secondary === undefined) secondary = coat;
  const pattern = rng.weighted(PATTERNS, [5, 3, 3, 2]);
  const bonus = r; // 0-3
  return {
    size: rng.pick(SIZES),
    body: rng.pick(BODIES),
    ears: rng.pick(EARS),
    tail: rng.pick(TAILS),
    coat,
    pattern,
    secondary,
    temperament: rng.pick(TEMPERAMENTS),
    intelligence: Math.min(5, rng.int(1, 4) + (rng.chance(0.25 * bonus) ? 1 : 0)),
    energy: Math.min(5, rng.int(1, 4) + (rng.chance(0.25 * bonus) ? 1 : 0)),
    rarity,
  };
}

const RARITY_LIST: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * Kalıtım: her görünüş/huy alanı ebeveynlerden birinden, `BALANCE.breeding.mutation` olasılıkla o alanın rastgele değeri.
 * Ana renk seçilen ebeveynden (mutasyonda nadirliğe uygun rastgele renk), ikincil renk öbür ebeveynin ana rengi. Zekâ ve
 * enerji ebeveynlerden biri, mutasyonda ±1. Nadirlik ebeveynlerin yükseği, `rarityUp` olasılıkla bir kademe üstü.
 */
export function inheritGenome(a: DogGenome, b: DogGenome, rng: Rng): DogGenome {
  const B = BALANCE.breeding;
  const pick = <T>(x: T, y: T, all: readonly T[]): T => (rng.chance(B.mutation) ? rng.pick(all as T[]) : rng.chance(0.5) ? x : y);
  const stat = (x: number, y: number): number => {
    const v = rng.chance(0.5) ? x : y;
    return rng.chance(B.mutation) ? Math.max(1, Math.min(5, v + (rng.chance(0.5) ? 1 : -1))) : v;
  };
  const top = RARITY_ORDER[a.rarity] >= RARITY_ORDER[b.rarity] ? a.rarity : b.rarity;
  const rarity = rng.chance(B.rarityUp) ? RARITY_LIST[Math.min(3, RARITY_ORDER[top] + 1)] : top;
  const fromA = rng.chance(0.5);
  const main = fromA ? a : b;
  const other = fromA ? b : a;
  const coat = rng.chance(B.mutation) ? rng.pick(coatChoices(rarity)) : main.coat;
  const secondary = other.coat !== coat ? other.coat : main.secondary;
  return {
    size: pick(a.size, b.size, SIZES),
    body: pick(a.body, b.body, BODIES),
    ears: pick(a.ears, b.ears, EARS),
    tail: pick(a.tail, b.tail, TAILS),
    coat,
    pattern: pick(a.pattern, b.pattern, PATTERNS),
    secondary,
    temperament: pick(a.temperament, b.temperament, TEMPERAMENTS),
    intelligence: stat(a.intelligence, b.intelligence),
    energy: stat(a.energy, b.energy),
    rarity,
  };
}

/** Doku önbelleği anahtarı: görünümü etkileyen her alan. */
export function genomeKey(g: DogGenome): string {
  return `${g.size}${g.body[0]}${g.ears[0]}${g.tail[0]}c${g.coat}p${g.pattern[0]}s${g.secondary}`;
}

export function describeGenome(g: DogGenome): string {
  const parts = [SIZE_NAMES_TR[g.size], COAT_COLORS[g.coat].name.toLowerCase(), PATTERN_NAMES_TR[g.pattern].toLowerCase()];
  return parts.join(' · ');
}

export function isValidGenome(g: unknown): g is DogGenome {
  if (!g || typeof g !== 'object') return false;
  const d = g as Record<string, unknown>;
  return (
    SIZES.includes(d.size as SizeClass) &&
    BODIES.includes(d.body as BodyType) &&
    EARS.includes(d.ears as EarType) &&
    TAILS.includes(d.tail as TailType) &&
    typeof d.coat === 'number' &&
    d.coat >= 0 &&
    d.coat < COAT_COLORS.length &&
    PATTERNS.includes(d.pattern as CoatPattern) &&
    typeof d.secondary === 'number' &&
    d.secondary >= 0 &&
    d.secondary < COAT_COLORS.length &&
    TEMPERAMENTS.includes(d.temperament as Temperament) &&
    typeof d.intelligence === 'number' &&
    typeof d.energy === 'number' &&
    typeof d.rarity === 'string' &&
    d.rarity in RARITY_ORDER
  );
}
