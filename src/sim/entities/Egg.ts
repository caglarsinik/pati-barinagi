import { BALANCE } from '../../config/balance';
import type { Rng } from '../../core/Rng';
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
  /** Kuluçkada kalan süre (oyun dakikası); çantadayken -1. */
  hatchLeft: number;
}

export interface EggSave {
  id: number;
  genome: DogGenome;
  foundDay: number;
  hatchLeft: number;
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
    hatchLeft: typeof d.hatchLeft === 'number' && Number.isFinite(d.hatchLeft) ? d.hatchLeft : -1,
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
    sizeName: `${SIZE_NAMES_TR[g.size]} boy`,
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
  return `${l.sizeName}, ${l.shapeName.toLowerCase()} şekilli, ${l.colorName.toLowerCase()} ${l.patternName.toLowerCase()} yumurta · ${l.rarityName} · gövde ${BODY_NAMES_TR[egg.genome.body].toLowerCase()}`;
}

export function hatchMinutes(): number {
  return BALANCE.eggs.hatchDays * 24 * 60;
}
