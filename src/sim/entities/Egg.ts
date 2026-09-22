import { BALANCE } from '../../config/balance';
import type { Rng } from '../../core/Rng';
import { t } from '../../i18n';
import {
  BODY_NAMES_TR,
  COAT_COLORS,
  type DogGenome,
  PATTERN_NAMES_TR,
  RARITY_NAMES_TR,
  type Rarity,
  SIZE_NAMES_TR,
  isValidGenome,
  randomGenome,
} from './DogGenome';

/**
 * Yumurta: içindeki genom bellidir ama oyuncu sadece dış görünüşü ve birkaç ipucunu görür.
 * Görünüş genomdan türetilir: boy → boyut, şekil → gövde tipi, renk → tüy, desen → desen.
 */
export interface Egg {
  id: number;
  genome: DogGenome;
  foundDay: number;
  /** Kalan kuluçka süresi (oyun dakikası); hiç kuluçkaya girmediyse -1. Çantadayken sayaç durur, silinmez. */
  hatchLeft: number;
  /** Soy (yuva evinden): ebeveyn köpek id'leri ve adları; doğada bulunan yumurtada yok. */
  parents?: [number, number];
  parentNames?: [string, string];
}

export interface EggSave {
  id: number;
  genome: DogGenome;
  foundDay: number;
  hatchLeft: number;
  parents?: [number, number];
  parentNames?: [string, string];
}

function pairOf<T>(v: unknown, type: 'number' | 'string'): [T, T] | undefined {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === type && typeof v[1] === type ? [v[0] as T, v[1] as T] : undefined;
}

export function createEgg(id: number, rng: Rng, rarity: Rarity, foundDay: number): Egg {
  return { id, genome: randomGenome(rng, rarity), foundDay, hatchLeft: -1 };
}

export function eggFromJSON(data: unknown): Egg | null {
  const d = data as Partial<EggSave> | null;
  if (!d || typeof d.id !== 'number' || !isValidGenome(d.genome)) return null;
  return {
    id: d.id,
    genome: d.genome,
    foundDay: typeof d.foundDay === 'number' ? d.foundDay : 1,
    hatchLeft: typeof d.hatchLeft === 'number' && Number.isFinite(d.hatchLeft) && d.hatchLeft >= 0 ? Math.min(d.hatchLeft, hatchMinutes()) : -1,
    parents: pairOf<number>(d.parents, 'number'),
    parentNames: pairOf<string>(d.parentNames, 'string'),
  };
}

/** Yumurtanın dışından okunan şeyler. */
export interface EggLook {
  sizeName: string;
  shapeName: string;
  colorName: string;
  patternName: string;
  rarityName: string;
  rarity: Rarity;
  /** Gizli özelliklerin belli belirsiz ipuçları. */
  hints: string[];
}

export function eggLook(egg: Egg): EggLook {
  const g = egg.genome;
  const hints: string[] = [];
  switch (g.temperament) {
    case 'calm':
      hints.push('Hiç kıpırdamıyor, sakin bir şey var içinde.');
      break;
    case 'playful':
      hints.push('Ara sıra sallanıyor, sanki oynamak istiyor.');
      break;
    case 'shy':
      hints.push('Dokununca hareket kesiliyor; ürkek olabilir.');
      break;
    case 'bold':
      hints.push('İçeriden tık tık sesler geliyor; cesur bir şey.');
      break;
  }
  if (g.intelligence >= 4) hints.push('Kabuk hafif parlıyor: zeki bir yavru olabilir.');
  if (g.energy >= 4) hints.push('Sıcacık: enerjisi yüksek olacak.');
  if (g.energy <= 2) hints.push('Serin: sakin tempolu bir köpek.');
  return {
    sizeName: SIZE_NAMES_TR[g.size],
    shapeName: eggShapeName(g),
    colorName: COAT_COLORS[g.coat].name,
    patternName: PATTERN_NAMES_TR[g.pattern],
    rarityName: RARITY_NAMES_TR[g.rarity],
    rarity: g.rarity,
    hints,
  };
}

export function eggShapeName(g: DogGenome): string {
  switch (g.body) {
    case 'stocky':
      return 'Yuvarlak';
    case 'slim':
      return 'Sivri';
    default:
      return 'Oval';
  }
}

export function eggDescription(egg: Egg): string {
  const l = eggLook(egg);
  return t('{size}, {shape} şekilli, {color} {pattern} yumurta · {rarity} · gövde {body}', {
    size: t('{size} boy', { size: t(l.sizeName) }),
    shape: t(l.shapeName).toLowerCase(),
    color: t(l.colorName).toLowerCase(),
    pattern: t(l.patternName).toLowerCase(),
    rarity: t(l.rarityName),
    body: t(BODY_NAMES_TR[egg.genome.body]).toLowerCase(),
  }) + (egg.parentNames ? ` · ${t('Soy: {a} × {b}', { a: egg.parentNames[0], b: egg.parentNames[1] })}` : '');
}

export function hatchMinutes(days: number = BALANCE.eggs.hatchDays): number {
  return days * 24 * 60;
}
