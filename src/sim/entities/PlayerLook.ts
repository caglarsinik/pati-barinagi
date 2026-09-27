import type { Rng } from '../../core/Rng';
import { t } from '../../i18n';

/**
 * Oyuncu görünümü (0.24.0): her alan bir seçenek indeksi; renkler aşağıdaki tablolardan. Varsayılan (hepsi 0) eski sabit
 * oyuncu sprite'ıyla piksel piksel aynıdır; çizim `render/HumanPainter.styleFromLook` ile yapılır. Saf modül: Phaser yok.
 */
export interface PlayerLook {
  /** 0 erkek (bugünkü beden), 1 kadın (belde daralma, uzun göz). */
  body: number;
  /** Ten tonu: SKIN_TONES. */
  skin: number;
  /** Saç rengi: HAIR_COLORS. */
  hair: number;
  /** 0 kısa, 1 uzun, 2 at kuyruğu, 3 topuz, 4 kısa kesim. */
  hairStyle: number;
  /** Tişört rengi: SHIRT_COLORS. */
  shirt: number;
  /** 0 düz, 1 çizgili, 2 kapüşonlu. */
  shirtStyle: number;
  /** Pantolon rengi: PANTS_COLORS. */
  pants: number;
  /** 0 uzun, 1 şort, 2 etek. */
  pantsStyle: number;
  /** Ayakkabı rengi: SHOE_COLORS. */
  shoes: number;
  /** 0 yok, 1.. HAT_COLORS[hat − 1]. */
  hat: number;
  /** 0 yok, 1 gözlük, 2 atkı. */
  accessory: number;
}

export const LOOK_KEYS = ['body', 'skin', 'hair', 'hairStyle', 'shirt', 'shirtStyle', 'pants', 'pantsStyle', 'shoes', 'hat', 'accessory'] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

/** Renk tabloları (0xRRGGBB). İlk girişler `render/palette` P.skin / P.hair / P.shirt / P.pants / P.shoes ile aynıdır. */
export const SKIN_TONES = [0xf1c9a1, 0xd9a877, 0xb07a4c, 0x8a5a36] as const;
/** Ten tonuna göre ağız rengi (ilki P.skinDark). */
export const MOUTH_COLORS = [0xcf9e72, 0xb8865a, 0x8e5f38, 0x6b4227] as const;
export const HAIR_COLORS = [0x5c3b22, 0x1f1a1a, 0xc98a3a, 0x8a3a2a, 0x9a9aa8, 0xf3efe6] as const;
export const SHIRT_COLORS = [0x3f82dc, 0xe4514f, 0x4fb36b, 0xf6d55c, 0xa66bd6, 0xf28fb8, 0x8fd9b6, 0xe08c55] as const;
export const PANTS_COLORS = [0x3b4664, 0x5b3a2a, 0x2c2535, 0x6b6f7a] as const;
export const SHOE_COLORS = [0x2c2535, 0x5b3a2a, 0xe4514f, 0xf7f3ea, 0x3f82dc] as const;
export const HAT_COLORS = [0xe4514f, 0x3b4664, 0xf6d55c, 0x2f7f5c] as const;

export const LOOK_COUNTS: Record<LookKey, number> = {
  body: 2,
  skin: SKIN_TONES.length,
  hair: HAIR_COLORS.length,
  hairStyle: 5,
  shirt: SHIRT_COLORS.length,
  shirtStyle: 3,
  pants: PANTS_COLORS.length,
  pantsStyle: 3,
  shoes: SHOE_COLORS.length,
  hat: HAT_COLORS.length + 1,
  accessory: 3,
};

export const DEFAULT_LOOK: Readonly<PlayerLook> = Object.freeze({ body: 0, skin: 0, hair: 0, hairStyle: 0, shirt: 0, shirtStyle: 0, pants: 0, pantsStyle: 0, shoes: 0, hat: 0, accessory: 0 });

/** Seçenek adları (TR; EN `i18n/en.ts` ve i18n testinin tablo listesinde). */
export const PLAYER_BODY_NAMES_TR: readonly string[] = ['Erkek', 'Kadın'];
export const HAIR_STYLE_NAMES_TR: readonly string[] = ['Kısa', 'Uzun', 'At kuyruğu', 'Topuz', 'Kısa kesim'];
export const SHIRT_STYLE_NAMES_TR: readonly string[] = ['Düz', 'Çizgili', 'Kapüşonlu'];
export const PANTS_STYLE_NAMES_TR: readonly string[] = ['Uzun', 'Şort', 'Etek'];
export const ACCESSORY_NAMES_TR: readonly string[] = ['Yok', 'Gözlük', 'Atkı'];
export const SKIN_NAMES_TR: readonly string[] = ['Açık ten', 'Buğday', 'Esmer', 'Koyu esmer'];
export const HAIR_COLOR_NAMES_TR: readonly string[] = ['Kahve', 'Siyah', 'Sarışın', 'Kızıl', 'Gri', 'Beyaz'];
export const SHIRT_COLOR_NAMES_TR: readonly string[] = ['Mavi', 'Kırmızı', 'Yeşil', 'Sarı', 'Mor', 'Pembe', 'Nane', 'Turuncu'];
export const PANTS_COLOR_NAMES_TR: readonly string[] = ['Lacivert', 'Kahve', 'Koyu', 'Gri'];
export const SHOE_COLOR_NAMES_TR: readonly string[] = ['Koyu', 'Kahve', 'Kırmızı', 'Beyaz', 'Mavi'];
export const HAT_NAMES_TR: readonly string[] = ['Yok', 'Kırmızı', 'Lacivert', 'Sarı', 'Yeşil'];
export const LOOK_FIELD_NAMES_TR: Record<LookKey, string> = {
  body: 'Vücut',
  skin: 'Ten',
  hair: 'Saç rengi',
  hairStyle: 'Saç',
  shirt: 'Tişört rengi',
  shirtStyle: 'Tişört',
  pants: 'Pantolon rengi',
  pantsStyle: 'Pantolon',
  shoes: 'Ayakkabı',
  hat: 'Şapka',
  accessory: 'Aksesuar',
};

const OPTION_NAMES: Record<LookKey, readonly string[]> = {
  body: PLAYER_BODY_NAMES_TR,
  skin: SKIN_NAMES_TR,
  hair: HAIR_COLOR_NAMES_TR,
  hairStyle: HAIR_STYLE_NAMES_TR,
  shirt: SHIRT_COLOR_NAMES_TR,
  shirtStyle: SHIRT_STYLE_NAMES_TR,
  pants: PANTS_COLOR_NAMES_TR,
  pantsStyle: PANTS_STYLE_NAMES_TR,
  shoes: SHOE_COLOR_NAMES_TR,
  hat: HAT_NAMES_TR,
  accessory: ACCESSORY_NAMES_TR,
};

/** Seçeneğin Türkçe adı (arayüz `t()` ile çevirir). */
export function lookOptionName(key: LookKey, value: number): string {
  return OPTION_NAMES[key][value] ?? OPTION_NAMES[key][0];
}

/** Alanın renk seçeneği varsa o rengin sayısı (0xRRGGBB); biçim alanlarında null. Şapkada 0 = yok → null. */
export function lookOptionColor(key: LookKey, value: number): number | null {
  switch (key) {
    case 'skin':
      return SKIN_TONES[value] ?? SKIN_TONES[0];
    case 'hair':
      return HAIR_COLORS[value] ?? HAIR_COLORS[0];
    case 'shirt':
      return SHIRT_COLORS[value] ?? SHIRT_COLORS[0];
    case 'pants':
      return PANTS_COLORS[value] ?? PANTS_COLORS[0];
    case 'shoes':
      return SHOE_COLORS[value] ?? SHOE_COLORS[0];
    case 'hat':
      return value > 0 ? (HAT_COLORS[value - 1] ?? null) : null;
    default:
      return null;
  }
}

/** Kayıttan ya da dış girdiden görünüm: tam sayı ve aralık içi olmayan her alan varsayılana döner. */
export function lookFromJSON(raw: unknown): PlayerLook {
  const look: PlayerLook = { ...DEFAULT_LOOK };
  if (!raw || typeof raw !== 'object') return look;
  const r = raw as Record<string, unknown>;
  for (const k of LOOK_KEYS) {
    const v = r[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LOOK_COUNTS[k]) look[k] = v;
  }
  return look;
}

export function isDefaultLook(look: PlayerLook): boolean {
  return LOOK_KEYS.every((k) => look[k] === 0);
}

export function sameLook(a: PlayerLook, b: PlayerLook): boolean {
  return LOOK_KEYS.every((k) => a[k] === b[k]);
}

/** Görünümün kısa anahtarı (doku adı, önizleme imzası): alan sırasıyla 11 karakter (36 tabanı). */
export function lookKey(look: PlayerLook): string {
  return LOOK_KEYS.map((k) => look[k].toString(36)).join('');
}

/** Rastgele görünüm (yalnız arayüzün kendi RNG'siyle; ana `sim.rng` asla). Şapka ve aksesuar çoğunlukla yok. */
export function randomLook(rng: Rng): PlayerLook {
  const look: PlayerLook = { ...DEFAULT_LOOK };
  for (const k of LOOK_KEYS) look[k] = rng.int(0, LOOK_COUNTS[k] - 1);
  look.hat = rng.chance(0.6) ? 0 : rng.int(1, LOOK_COUNTS.hat - 1);
  look.accessory = rng.chance(0.65) ? 0 : rng.int(1, LOOK_COUNTS.accessory - 1);
  return look;
}

export const PLAYER_NAME_MAX = 14;
/** Ad boşsa gösterilen ad (EN "Caretaker"). */
export const DEFAULT_PLAYER_NAME = 'Bakıcı';

/** Kontrol karakterleri atılır, boşluklar tekleştirilir, en çok 14 karakter; metin değilse boş. */
export function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX)
    .trim();
}

/** Gösterilecek ad: boşsa varsayılan (çevrilir). */
export function displayPlayerName(name: string): string {
  return name || t(DEFAULT_PLAYER_NAME);
}

/** Yeni oyunda seçilen karakter: görünüm + ad. */
export interface PlayerProfile {
  look: PlayerLook;
  name: string;
}
