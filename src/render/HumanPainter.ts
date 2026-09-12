import { Pixels, type RGBA } from './Pixels';
import { P } from './palette';

export interface HumanStyle {
  skin: RGBA;
  hair: RGBA;
  shirt: RGBA;
  shirtDark: RGBA;
  pants: RGBA;
  shoes: RGBA;
  /** Şapka rengi, yoksa null. */
  hat: RGBA | null;
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

/** Tek kare çizer: 16x24, ayaklar en altta. */
export function drawHuman(dir: number, frame: number, s: HumanStyle): Pixels {
  const p = new Pixels(HUMAN_W, HUMAN_H);
  const bob = frame === 0 ? 0 : -1; // yürürken gövde 1 px zıplar
  const profile = dir === 1; // sol profil (sağ aynalanır)
  const back = dir === 3;

  // Bacaklar ve ayakkabılar
  const legL = { x: 5, w: 3 };
  const legR = { x: 8, w: 3 };
  if (profile) {
    legL.x = 5;
    legR.x = 8;
  }
  const stepL = frame === 1 ? 1 : 0;
  const stepR = frame === 2 ? 1 : 0;
  p.fillRect(legL.x, 18 + bob, legL.w, 4 - stepL, s.pants);
  p.fillRect(legR.x, 18 + bob, legR.w, 4 - stepR, s.pants);
  p.fillRect(legL.x, 22 - stepL, legL.w, 2, s.shoes);
  p.fillRect(legR.x, 22 - stepR, legR.w, 2, s.shoes);
  if (profile) {
    // Profilde arka bacak biraz geride görünür.
    p.fillRect(legR.x + 1, 18 + bob, 1, 4 - stepR, P.pantsDark);
  }

  // Gövde
  const bodyX = profile ? 5 : 4;
  const bodyW = profile ? 7 : 8;
  p.fillRect(bodyX, 11 + bob, bodyW, 7, s.shirt);
  p.fillRect(bodyX + bodyW - 1, 11 + bob, 1, 7, s.shirtDark);
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
  p.fillRect(headX, 2 + bob, headW, 3, s.hair);
  p.set(headX, 5 + bob, s.hair);
  p.set(headX + headW - 1, 5 + bob, s.hair);
  if (back) {
    p.fillRect(headX, 2 + bob, headW, 7, s.hair);
  } else if (profile) {
    p.fillRect(headX + 3, 2 + bob, 4, 4, s.hair);
    p.set(headX + 6, 6 + bob, s.hair);
  }
  // Yüz
  if (dir === 0) {
    p.set(6, 7 + bob, P.eye);
    p.set(9, 7 + bob, P.eye);
    p.set(7, 9 + bob, s.skin === P.skin ? P.skinDark : s.skin);
    p.set(8, 9 + bob, s.skin === P.skin ? P.skinDark : s.skin);
  } else if (profile) {
    p.set(6, 7 + bob, P.eye);
  }
  // Şapka
  if (s.hat) {
    p.fillRect(headX - 1, 2 + bob, headW + 2, 1, s.hat);
    p.fillRect(headX, 0 + bob, headW, 2, s.hat);
  }

  p.outline(P.outline);
  return p;
}
