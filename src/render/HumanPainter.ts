import { Pixels, type RGBA, hex, shade } from './Pixels';
import { P } from './palette';
import { HAIR_COLORS, HAT_COLORS, MOUTH_COLORS, PANTS_COLORS, SHIRT_COLORS, SHOE_COLORS, SKIN_TONES, type PlayerLook } from '../sim/entities/PlayerLook';

export interface HumanStyle {
  skin: RGBA;
  hair: RGBA;
  shirt: RGBA;
  shirtDark: RGBA;
  pants: RGBA;
  shoes: RGBA;
  /** Şapka rengi, yoksa null. */
  hat: RGBA | null;
  // --- Oyuncu görünümü seçenekleri (0.24.0). Hepsi isteğe bağlı; yokken bugünkü çizim (NPC'ler değişmez).
  /** 0 erkek, 1 kadın (belde daralma, uzun göz). */
  body?: number;
  /** 0 kısa, 1 uzun, 2 at kuyruğu, 3 topuz, 4 kısa kesim. */
  hairStyle?: number;
  /** 0 düz, 1 çizgili, 2 kapüşonlu. */
  shirtStyle?: number;
  /** 0 uzun, 1 şort, 2 etek. */
  pantsStyle?: number;
  /** 0 yok, 1 gözlük, 2 atkı. */
  accessory?: number;
  /** Ağız rengi; yoksa eski davranış (yalnız P.skin teninde skinDark). */
  mouth?: RGBA;
}

export const PLAYER_STYLE: HumanStyle = {
  skin: P.skin,
  hair: P.hair,
  shirt: P.shirt,
  shirtDark: P.shirtDark,
  pants: P.pants,
  shoes: P.shoes,
  hat: null,
};

const SKINS = [0xf1c9a1, 0xd9a877, 0xb07a4c, 0x8a5a36];
const HAIRS = [0x5c3b22, 0x1f1a1a, 0xc98a3a, 0x8a3a2a, 0x9a9aa8];
const SHIRTS = [0x3f82dc, 0xe4514f, 0x4fb36b, 0xf6d55c, 0xa66bd6, 0xf28fb8, 0x8fd9b6, 0xe08c55];
const PANTS = [0x3b4664, 0x5b3a2a, 0x2c2535, 0x6b6f7a];
const HATS = [0xe4514f, 0x3b4664, 0xf6d55c, 0x2f7f5c];

/** Tohumdan tutarlı bir kıyafet: sahiplenici ve personel çeşitliliği. */
export function humanStyleFromSeed(seed: number): HumanStyle {
  const s = seed >>> 0;
  const skin = hex(SKINS[s % SKINS.length]);
  const hair = hex(HAIRS[(s >> 3) % HAIRS.length]);
  const shirt = hex(SHIRTS[(s >> 6) % SHIRTS.length]);
  const pants = hex(PANTS[(s >> 9) % PANTS.length]);
  const hat = (s >> 12) % 5 === 0 ? hex(HATS[(s >> 14) % HATS.length]) : null;
  return { skin, hair, shirt, shirtDark: shade(shirt, 0.75), pants, shoes: P.shoes, hat };
}

export const HUMAN_W = 16;
export const HUMAN_H = 24;
/** Yön başına kare sayısı: 0 duruş, 1-2 yürüyüş. */
export const HUMAN_FRAMES = 3;
export const HUMAN_DIRS = 4;

/**
 * 12 kareli sprite şeridi: yön (0 aşağı, 1 sol, 2 sağ, 3 yukarı) × kare (duruş, adım1, adım2).
 * Kare indeksi = yön*3 + kare. Sağ kareler sol karelerin aynasıdır.
 */
export function buildHumanSheet(style: HumanStyle): Pixels {
  const sheet = new Pixels(HUMAN_W * HUMAN_DIRS * HUMAN_FRAMES, HUMAN_H);
  for (let dir = 0; dir < HUMAN_DIRS; dir++) {
    for (let f = 0; f < HUMAN_FRAMES; f++) {
      let frame: Pixels;
      if (dir === 2) frame = drawHuman(1, f, style).flipH();
      else frame = drawHuman(dir, f, style);
      sheet.blit(frame, (dir * HUMAN_FRAMES + f) * HUMAN_W, 0);
    }
  }
  return sheet;
}

/** Oyuncu görünümünden stil (0.24.0). Varsayılan görünüm PLAYER_STYLE ile piksel piksel aynı şeridi verir (shirtDark ve ağız dahil). */
export function styleFromLook(look: PlayerLook): HumanStyle {
  const shirt = hex(SHIRT_COLORS[look.shirt] ?? SHIRT_COLORS[0]);
  return {
    skin: hex(SKIN_TONES[look.skin] ?? SKIN_TONES[0]),
    hair: hex(HAIR_COLORS[look.hair] ?? HAIR_COLORS[0]),
    shirt,
    shirtDark: look.shirt === 0 ? P.shirtDark : shade(shirt, 0.75),
    pants: hex(PANTS_COLORS[look.pants] ?? PANTS_COLORS[0]),
    shoes: hex(SHOE_COLORS[look.shoes] ?? SHOE_COLORS[0]),
    hat: look.hat > 0 ? hex(HAT_COLORS[look.hat - 1] ?? HAT_COLORS[0]) : null,
    body: look.body,
    hairStyle: look.hairStyle,
    shirtStyle: look.shirtStyle,
    pantsStyle: look.pantsStyle,
    accessory: look.accessory,
    mouth: hex(MOUTH_COLORS[look.skin] ?? MOUTH_COLORS[0]),
  };
}

const GLASS = hex(0x8f9196);
const SCARF_A = hex(0xe4514f);
const SCARF_B = hex(0x3b4664);

/**
 * Tek kare çizer: 16x24, ayaklar en altta. Seçenek değeri 0 olan her dal bugünkü çizimin aynısıdır (0.24.0 öncesi sprite'lar
 * ve NPC'ler değişmez); seçenekler yalnız oyuncu görünümünden gelir.
 */
export function drawHuman(dir: number, frame: number, s: HumanStyle): Pixels {
  const p = new Pixels(HUMAN_W, HUMAN_H);
  const bob = frame === 0 ? 0 : -1; // yürürken gövde 1 px zıplar
  const profile = dir === 1; // sol profil (sağ aynalanır)
  const back = dir === 3;
  const body = s.body ?? 0;
  const hs = s.hairStyle ?? 0;
  const ss = s.shirtStyle ?? 0;
  const ps = s.pantsStyle ?? 0;
  const acc = s.accessory ?? 0;
  const bodyX = profile ? 5 : 4;
  const bodyW = profile ? 7 : 8;

  // Bacaklar ve ayakkabılar (şort: alt bacak ten; etek: bacaklar ten, üstüne etek)
  const legL = { x: 5, w: 3 };
  const legR = { x: 8, w: 3 };
  if (profile) {
    legL.x = 5;
    legR.x = 8;
  }
  const stepL = frame === 1 ? 1 : 0;
  const stepR = frame === 2 ? 1 : 0;
  const legColor = ps === 0 ? s.pants : s.skin;
  p.fillRect(legL.x, 18 + bob, legL.w, 4 - stepL, legColor);
  p.fillRect(legR.x, 18 + bob, legR.w, 4 - stepR, legColor);
  if (ps === 1) {
    p.fillRect(legL.x, 18 + bob, legL.w, 2, s.pants);
    p.fillRect(legR.x, 18 + bob, legR.w, 2, s.pants);
  }
  p.fillRect(legL.x, 22 - stepL, legL.w, 2, s.shoes);
  p.fillRect(legR.x, 22 - stepR, legR.w, 2, s.shoes);
  if (profile) {
    // Profilde arka bacak biraz geride görünür.
    if (ps === 0) p.fillRect(legR.x + 1, 18 + bob, 1, 4 - stepR, P.pantsDark);
    else if (ps === 1) p.fillRect(legR.x + 1, 18 + bob, 1, 2, P.pantsDark);
  }
  if (ps === 2) p.fillRect(bodyX, 18 + bob, bodyW, 3, s.pants);

  // Gövde
  if (body === 0) {
    p.fillRect(bodyX, 11 + bob, bodyW, 7, s.shirt);
    p.fillRect(bodyX + bodyW - 1, 11 + bob, 1, 7, s.shirtDark);
  } else {
    // Kadın beden: bel satırları birer piksel içeride (dış çizgi boşluğu doldurur).
    p.fillRect(bodyX, 11 + bob, bodyW, 3, s.shirt);
    p.fillRect(bodyX + 1, 14 + bob, bodyW - 2, 2, s.shirt);
    p.fillRect(bodyX, 16 + bob, bodyW, 2, s.shirt);
    p.fillRect(bodyX + bodyW - 1, 11 + bob, 1, 3, s.shirtDark);
    p.fillRect(bodyX + bodyW - 2, 14 + bob, 1, 2, s.shirtDark);
    p.fillRect(bodyX + bodyW - 1, 16 + bob, 1, 2, s.shirtDark);
  }
  if (ss === 1) {
    // Çizgili: iki koyu şerit.
    p.fillRect(bodyX, 13 + bob, bodyW, 1, s.shirtDark);
    p.fillRect(bodyX, 16 + bob, bodyW, 1, s.shirtDark);
  } else if (ss === 2 && dir === 0) {
    // Kapüşonlu (ön): yaka ve cep.
    p.fillRect(bodyX + 1, 11 + bob, bodyW - 2, 1, s.shirtDark);
    p.fillRect(6, 16 + bob, 4, 1, s.shirtDark);
  }
  // Kollar
  if (!profile) {
    const armDrop = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    p.fillRect(3, 12 + bob + armDrop, 1, 4, s.shirt);
    p.fillRect(12, 12 + bob - armDrop, 1, 4, s.shirt);
    p.set(3, 16 + bob + armDrop, s.skin);
    p.set(12, 16 + bob - armDrop, s.skin);
  } else {
    const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    p.fillRect(7 + swing, 12 + bob, 2, 4, s.shirtDark);
    p.set(7 + swing, 16 + bob, s.skin);
  }

  // Kafa
  const headX = profile ? 5 : 4;
  const headW = profile ? 7 : 8;
  p.fillRect(headX, 3 + bob, headW, 8, s.skin);
  // Saç
  if (hs === 4) {
    // Kısa kesim: tek sıra.
    p.fillRect(headX, 2 + bob, headW, 1, s.hair);
    if (back) p.fillRect(headX, 2 + bob, headW, 3, s.hair);
    else if (profile) p.set(headX + headW - 1, 3 + bob, s.hair);
  } else {
    p.fillRect(headX, 2 + bob, headW, 3, s.hair);
    p.set(headX, 5 + bob, s.hair);
    p.set(headX + headW - 1, 5 + bob, s.hair);
    if (back) {
      p.fillRect(headX, 2 + bob, headW, 7, s.hair);
    } else if (profile) {
      p.fillRect(headX + 3, 2 + bob, 4, 4, s.hair);
      p.set(headX + 6, 6 + bob, s.hair);
    }
    if (hs === 1) {
      // Uzun: yan tutamlar, arkada omuzlara dökülür.
      if (back) {
        p.fillRect(headX, 5 + bob, 1, 6, s.hair);
        p.fillRect(headX + headW - 1, 5 + bob, 1, 6, s.hair);
        p.fillRect(5, 9 + bob, 6, 4, s.hair);
      } else if (profile) {
        p.fillRect(headX + headW - 2, 5 + bob, 2, 7, s.hair);
      } else {
        p.fillRect(headX, 5 + bob, 1, 6, s.hair);
        p.fillRect(headX + headW - 1, 5 + bob, 1, 6, s.hair);
      }
    } else if (hs === 2) {
      // At kuyruğu: arkadan ve profilden görünür.
      if (back) p.fillRect(7, 9 + bob, 2, 5, s.hair);
      else if (profile) p.fillRect(12, 5 + bob, 1, 5, s.hair);
    } else if (hs === 3 && !s.hat) {
      // Topuz: tepede; şapka varsa görünmez.
      if (profile) {
        p.fillRect(headX + headW - 3, 1 + bob, 3, 1, s.hair);
        p.fillRect(11, 2 + bob, 2, 2, s.hair);
      } else {
        p.fillRect(headX + 2, 1 + bob, headW - 4, 1, s.hair);
      }
    }
  }
  if (ss === 2) {
    // Kapüşon (arka ve profil): ensede.
    if (back) p.fillRect(bodyX + 1, 9 + bob, bodyW - 2, 3, s.shirt);
    else if (profile) p.fillRect(9, 9 + bob, 3, 3, s.shirt);
  }
  // Yüz
  const mouth = s.mouth ?? (s.skin === P.skin ? P.skinDark : s.skin);
  if (dir === 0) {
    p.set(6, 7 + bob, P.eye);
    p.set(9, 7 + bob, P.eye);
    if (body === 1) {
      p.set(6, 6 + bob, P.eye);
      p.set(9, 6 + bob, P.eye);
    }
    p.set(7, 9 + bob, mouth);
    p.set(8, 9 + bob, mouth);
    if (acc === 1) {
      p.set(5, 7 + bob, GLASS);
      p.set(7, 7 + bob, GLASS);
      p.set(8, 7 + bob, GLASS);
      p.set(10, 7 + bob, GLASS);
    }
  } else if (profile) {
    p.set(6, 7 + bob, P.eye);
    if (body === 1) p.set(6, 6 + bob, P.eye);
    if (acc === 1) {
      p.set(5, 7 + bob, GLASS);
      p.set(7, 7 + bob, GLASS);
    }
  }
  // Atkı: boyun satırı desenli, bir ucu sarkar.
  if (acc === 2) {
    for (let x = bodyX; x < bodyX + bodyW; x++) p.set(x, 11 + bob, (x - bodyX) % 3 === 2 ? SCARF_B : SCARF_A);
    if (dir === 0) p.fillRect(bodyX + bodyW - 2, 12 + bob, 1, 2, SCARF_A);
    else if (back) p.fillRect(bodyX + 1, 12 + bob, 1, 2, SCARF_A);
    else p.fillRect(9, 12 + bob, 1, 2, SCARF_A);
  }
  // Şapka
  if (s.hat) {
    p.fillRect(headX - 1, 2 + bob, headW + 2, 1, s.hat);
    p.fillRect(headX, 0 + bob, headW, 2, s.hat);
  }

  p.outline(P.outline);
  return p;
}
