import { Rng, hashStr } from '../core/Rng';
import type { GrowthStage } from '../sim/entities/Dog';
import { COAT_COLORS, type DogGenome, genomeKey } from '../sim/entities/DogGenome';
import { Pixels, type RGBA, hex, shade } from './Pixels';
import { P } from './palette';

export const DOG_FRAME = 32;
/** Yön başına kare: 0 duruş, 1-2 yürüyüş, 3 oturuş, 4 yatış, 5 yeme. */
export const DOG_FRAMES = 6;
export const DOG_DIRS = 4;

export const DOG_FRAME_IDLE = 0;
export const DOG_FRAME_WALK1 = 1;
export const DOG_FRAME_WALK2 = 2;
export const DOG_FRAME_SIT = 3;
export const DOG_FRAME_LIE = 4;
export const DOG_FRAME_EAT = 5;

export const SIZE_SCALE = { S: 0.8, M: 1, L: 1.25 } as const;
export const STAGE_SCALE = { puppy: 0.55, young: 0.8, adult: 1, senior: 1 } as const;

export function dogTextureKey(g: DogGenome, stage: GrowthStage): string {
  return `dog-${genomeKey(g)}-${stage}`;
}

interface Dims {
  s: number;
  bodyLen: number;
  bodyH: number;
  headR: number;
  legH: number;
  legW: number;
  base: RGBA;
  dark: RGBA;
  light: RGBA;
  secondary: RGBA;
  rng: Rng;
  /** Yaşlı: gri burun ve kaş. */
  senior: boolean;
  muzzle: RGBA;
}

function dims(g: DogGenome, stage: GrowthStage): Dims {
  const s = SIZE_SCALE[g.size] * STAGE_SCALE[stage];
  let bodyLen = 12 * s;
  let bodyH = 7 * s;
  let headR = 4 * s;
  if (g.body === 'stocky') {
    bodyLen *= 0.9;
    bodyH *= 1.25;
  } else if (g.body === 'slim') {
    bodyLen *= 1.15;
    bodyH *= 0.8;
  }
  if (stage === 'puppy') {
    headR *= 1.4;
    bodyLen *= 0.9;
  } else if (stage === 'young') headR *= 1.15;
  const coat = COAT_COLORS[g.coat];
  const sec = COAT_COLORS[g.secondary];
  const senior = stage === 'senior';
  return {
    senior,
    muzzle: senior ? hex(0xdcdcdc) : hex(coat.light),
    s,
    bodyLen: Math.max(5, Math.round(bodyLen)),
    bodyH: Math.max(3, Math.round(bodyH)),
    headR: Math.max(2, Math.round(headR)),
    legH: Math.max(2, Math.round(4 * s)),
    legW: s < 0.7 ? 1 : 2,
    base: hex(coat.base),
    dark: hex(coat.dark),
    light: hex(coat.light),
    secondary: hex(sec.base),
    rng: new Rng(hashStr(genomeKey(g))),
  };
}

/** 24 kareli sprite şeridi: yön (0 aşağı, 1 sol, 2 sağ, 3 yukarı) × 6 kare. */
export function buildDogSheet(g: DogGenome, stage: GrowthStage): Pixels {
  const sheet = new Pixels(DOG_FRAME * DOG_DIRS * DOG_FRAMES, DOG_FRAME);
  for (let dir = 0; dir < DOG_DIRS; dir++) {
    for (let f = 0; f < DOG_FRAMES; f++) {
      let frame: Pixels;
      if (dir === 1) frame = drawSide(g, stage, f);
      else if (dir === 2) frame = drawSide(g, stage, f).flipH();
      else frame = drawFront(g, stage, f, dir === 3);
      sheet.blit(frame, (dir * DOG_FRAMES + f) * DOG_FRAME, 0);
    }
  }
  return sheet;
}

/** Panel portresi: sol profil, duruş karesi. */
export function drawDogPortrait(g: DogGenome, stage: GrowthStage): Pixels {
  return drawSide(g, stage, DOG_FRAME_IDLE);
}

// ---------------------------------------------------------------------------
// Yan görünüm (sola bakar)
// ---------------------------------------------------------------------------

function drawSide(g: DogGenome, stage: GrowthStage, frame: number): Pixels {
  const p = new Pixels(DOG_FRAME, DOG_FRAME);
  const d = dims(g, stage);
  const baseline = DOG_FRAME - 1;
  const sit = frame === DOG_FRAME_SIT;
  const lie = frame === DOG_FRAME_LIE;
  const eat = frame === DOG_FRAME_EAT;

  let rx = d.bodyLen / 2;
  let ry = d.bodyH / 2;
  let legH = d.legH;
  if (sit) {
    rx = d.bodyLen * 0.32;
    ry = d.bodyH * 0.72;
    legH = Math.max(1, Math.round(d.legH * 0.8));
  } else if (lie) {
    ry = d.bodyH * 0.36;
    legH = 1;
  }
  const cx = 16 + d.headR * 0.55;
  const cy = baseline - legH - ry + 0.5;

  // Bacaklar
  const bob = frame === DOG_FRAME_WALK1 || frame === DOG_FRAME_WALK2 ? 1 : 0;
  if (!lie) {
    const frontX = Math.round(cx - rx + 1);
    const backX = Math.round(cx + rx - 1 - d.legW);
    const a = frame === DOG_FRAME_WALK1 ? 1 : frame === DOG_FRAME_WALK2 ? -1 : 0;
    const legTop = Math.round(cy + ry) - 1;
    if (!sit) {
      p.fillRect(backX + 1 - a, legTop, d.legW, baseline - legTop + 1, d.dark);
      p.fillRect(frontX + 1 + a, legTop, d.legW, baseline - legTop + 1, d.dark);
    }
    p.fillRect(backX + a, legTop, d.legW, baseline - legTop + 1, d.base);
    p.fillRect(frontX - a, legTop, d.legW, baseline - legTop + 1, d.base);
  } else {
    p.fillRect(Math.round(cx - rx + 1), baseline, 2, 1, d.dark);
  }

  // Kuyruk (gövdenin arkasında, sağda)
  drawTailSide(p, g, d, cx + rx, cy - ry * 0.4, lie);

  // Gövde
  p.ellipse(cx, cy - bob * 0.5, rx, ry, d.base);
  p.ellipse(cx, cy + ry * 0.45, rx * 0.8, Math.max(1, ry * 0.4), d.dark);
  p.ellipse(cx - rx * 0.1, cy - ry * 0.5, rx * 0.55, Math.max(0.8, ry * 0.3), d.light);
  drawPattern(p, g, d, cx, cy, rx, ry);

  // Kafa
  let hx = cx - rx - d.headR * 0.35;
  let hy = cy - ry * 0.55 - d.headR * 0.35;
  if (sit) hy = cy - ry - d.headR * 0.3;
  if (lie) hy = cy - ry * 0.3 - d.headR * 0.4;
  if (eat) {
    hx = cx - rx - d.headR * 0.2;
    hy = baseline - d.headR + 0.5;
  }
  drawHeadSide(p, g, d, hx, hy);

  p.outline(P.outline);
  return p;
}

function drawHeadSide(p: Pixels, g: DogGenome, d: Dims, hx: number, hy: number): void {
  const r = d.headR;
  // Kulaklar (kafanın arkasında olanlar önce)
  if (g.ears === 'floppy') {
    p.fillRect(Math.round(hx + r * 0.35), Math.round(hy - r * 0.6), Math.max(1, Math.round(r * 0.5)), Math.max(2, Math.round(r * 1.3)), d.dark);
  } else if (g.ears === 'pointy') {
    const ex = Math.round(hx + r * 0.3);
    const top = Math.round(hy - r - r * 0.7);
    const h = Math.max(2, Math.round(r * 0.9));
    for (let i = 0; i < h; i++) p.fillRect(ex - Math.floor(i / 2), top + i, 1 + Math.floor(i / 2) * 2, 1, d.base);
    p.set(ex, top + 1, d.light);
  } else {
    p.ellipse(hx + r * 0.5, hy - r * 0.8, Math.max(1, r * 0.5), Math.max(1, r * 0.45), d.dark);
  }
  p.ellipse(hx, hy, r, r, d.base);
  // Burun
  const mx = hx - r * 0.75;
  const my = hy + r * 0.3;
  p.ellipse(mx, my, Math.max(1, r * 0.6), Math.max(0.8, r * 0.45), d.muzzle);
  p.set(Math.round(mx - r * 0.55), Math.round(my - 0.5), P.outline);
  if (d.senior) p.set(Math.round(hx - r * 0.35), Math.round(hy - r * 0.55), d.muzzle);
  // Göz
  const eyeSize = r >= 5 ? 2 : 1;
  p.fillRect(Math.round(hx - r * 0.35), Math.round(hy - r * 0.25), eyeSize, eyeSize, P.eye);
}

function drawTailSide(p: Pixels, g: DogGenome, d: Dims, x: number, y: number, lie: boolean): void {
  const s = d.s;
  if (lie) {
    p.fillRect(Math.round(x), Math.round(y + d.bodyH * 0.2), Math.max(2, Math.round(3 * s)), 1, d.base);
    return;
  }
  if (g.tail === 'curly') {
    p.ellipse(x, y - d.bodyH * 0.35, Math.max(1.2, 2.2 * s), Math.max(1.2, 2.2 * s), d.base);
    p.set(Math.round(x), Math.round(y - d.bodyH * 0.35), d.dark);
  } else if (g.tail === 'straight') {
    p.line(Math.round(x), Math.round(y), Math.round(x + 3 * s + 1), Math.round(y - 3 * s - 1), d.base);
    p.line(Math.round(x), Math.round(y + 1), Math.round(x + 3 * s + 1), Math.round(y - 3 * s), d.dark);
  } else {
    p.ellipse(x + 2 * s, y - 1.5 * s, Math.max(1.5, 3 * s), Math.max(1.2, 2 * s), d.base);
    p.ellipse(x + 2.5 * s, y - 0.5 * s, Math.max(1, 2 * s), Math.max(0.8, 1 * s), d.dark);
  }
}

function drawPattern(p: Pixels, g: DogGenome, d: Dims, cx: number, cy: number, rx: number, ry: number): void {
  const rng = new Rng(d.rng.state);
  const inside = (x: number, y: number): boolean => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 0.92;
  };
  const stamp = (sx: number, sy: number, srx: number, sry: number, c: RGBA): void => {
    for (let y = Math.floor(sy - sry - 1); y <= Math.ceil(sy + sry + 1); y++) {
      for (let x = Math.floor(sx - srx - 1); x <= Math.ceil(sx + srx + 1); x++) {
        const dx = (x + 0.5 - sx) / srx;
        const dy = (y + 0.5 - sy) / sry;
        if (dx * dx + dy * dy <= 1 && inside(x, y)) p.set(x, y, c);
      }
    }
  };
  switch (g.pattern) {
    case 'spots': {
      const n = 3 + Math.round(rx / 3);
      for (let i = 0; i < n; i++) {
        stamp(cx + rng.float(-rx, rx), cy + rng.float(-ry, ry), Math.max(0.8, d.s * 1.1), Math.max(0.8, d.s * 0.9), d.secondary);
      }
      break;
    }
    case 'patches': {
      stamp(cx + rng.float(-rx * 0.5, rx * 0.5), cy + rng.float(-ry * 0.5, ry * 0.3), Math.max(1.5, rx * 0.45), Math.max(1, ry * 0.7), d.secondary);
      if (rng.chance(0.6)) stamp(cx + rng.float(-rx, rx), cy + rng.float(-ry, ry), Math.max(1, rx * 0.3), Math.max(1, ry * 0.5), d.secondary);
      break;
    }
    case 'stripes': {
      const n = Math.max(2, Math.round(rx / 2.2));
      for (let i = 0; i < n; i++) {
        const x = Math.round(cx - rx * 0.7 + ((i + 0.5) * (rx * 1.4)) / n);
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) if (inside(x, y)) p.set(x, y, shade(d.secondary, 0.95));
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Ön / arka görünüm
// ---------------------------------------------------------------------------

function drawFront(g: DogGenome, stage: GrowthStage, frame: number, back: boolean): Pixels {
  const p = new Pixels(DOG_FRAME, DOG_FRAME);
  const d = dims(g, stage);
  const baseline = DOG_FRAME - 1;
  const sit = frame === DOG_FRAME_SIT;
  const lie = frame === DOG_FRAME_LIE;
  const cx = 16;
  let rx = d.bodyH * 0.6;
  let ry = d.bodyLen * 0.32;
  let legH = d.legH;
  if (sit) {
    rx = d.bodyH * 0.62;
    ry = d.bodyLen * 0.4;
    legH = Math.max(1, Math.round(d.legH * 0.7));
  } else if (lie) {
    rx = d.bodyLen * 0.45;
    ry = d.bodyH * 0.33;
    legH = 1;
  }
  const cy = baseline - legH - ry + 0.5;

  // Bacaklar
  if (!lie) {
    const a = frame === DOG_FRAME_WALK1 ? 1 : frame === DOG_FRAME_WALK2 ? -1 : 0;
    const lx = Math.round(cx - rx * 0.55 - d.legW / 2);
    const rxp = Math.round(cx + rx * 0.55 - d.legW / 2);
    const legTop = Math.round(cy + ry) - 1;
    p.fillRect(lx, legTop - (a > 0 ? 1 : 0), d.legW, baseline - legTop + 1 + (a > 0 ? 1 : 0), d.base);
    p.fillRect(rxp, legTop - (a < 0 ? 1 : 0), d.legW, baseline - legTop + 1 + (a < 0 ? 1 : 0), d.base);
  }

  // Kuyruk arkadan görünür
  if (back && !lie) {
    const ty = cy + ry * 0.6;
    if (g.tail === 'curly') p.ellipse(cx, ty - 2 * d.s, Math.max(1.2, 2 * d.s), Math.max(1.2, 2 * d.s), d.dark);
    else if (g.tail === 'straight') p.fillRect(cx, Math.round(ty - 5 * d.s), 1, Math.max(2, Math.round(5 * d.s)), d.dark);
    else p.ellipse(cx, ty - 2 * d.s, Math.max(1.2, 2 * d.s), Math.max(1.5, 3 * d.s), d.dark);
  }

  // Gövde
  p.ellipse(cx, cy, rx, ry, d.base);
  p.ellipse(cx, cy + ry * 0.5, rx * 0.75, Math.max(0.8, ry * 0.35), d.dark);
  drawPattern(p, g, d, cx, cy, rx, ry);

  // Kafa
  const r = d.headR;
  let hy = cy - ry - r * 0.15;
  if (lie) hy = cy - ry * 0.2 - r * 0.6;
  if (frame === DOG_FRAME_EAT) hy += r * 0.6;
  // Kulaklar
  if (g.ears === 'floppy') {
    const w = Math.max(1, Math.round(r * 0.5));
    const h = Math.max(2, Math.round(r * 1.2));
    p.fillRect(Math.round(cx - r - w + 0.5), Math.round(hy - r * 0.5), w, h, d.dark);
    p.fillRect(Math.round(cx + r - 0.5), Math.round(hy - r * 0.5), w, h, d.dark);
  } else if (g.ears === 'pointy') {
    const h = Math.max(2, Math.round(r * 0.9));
    for (const side of [-1, 1]) {
      const ex = Math.round(cx + side * r * 0.65);
      const top = Math.round(hy - r - h * 0.6);
      for (let i = 0; i < h; i++) p.fillRect(ex - Math.floor(i / 2), top + i, 1 + Math.floor(i / 2) * 2, 1, d.base);
    }
  } else {
    p.ellipse(cx - r * 0.85, hy - r * 0.7, Math.max(1, r * 0.5), Math.max(1, r * 0.5), d.dark);
    p.ellipse(cx + r * 0.85, hy - r * 0.7, Math.max(1, r * 0.5), Math.max(1, r * 0.5), d.dark);
  }
  p.ellipse(cx, hy, r, r, d.base);
  if (!back) {
    p.ellipse(cx, hy + r * 0.4, Math.max(1, r * 0.55), Math.max(0.8, r * 0.4), d.muzzle);
    if (d.senior) {
      p.set(Math.round(cx - r * 0.5), Math.round(hy - r * 0.5), d.muzzle);
      p.set(Math.round(cx + r * 0.5), Math.round(hy - r * 0.5), d.muzzle);
    }
    p.fillRect(Math.round(cx - 0.5), Math.round(hy + r * 0.2), r >= 5 ? 2 : 1, 1, P.outline);
    const eyeSize = r >= 5 ? 2 : 1;
    p.fillRect(Math.round(cx - r * 0.5 - eyeSize / 2), Math.round(hy - r * 0.2), eyeSize, eyeSize, P.eye);
    p.fillRect(Math.round(cx + r * 0.5 - eyeSize / 2), Math.round(hy - r * 0.2), eyeSize, eyeSize, P.eye);
  } else {
    p.ellipse(cx, hy - r * 0.3, Math.max(1, r * 0.5), Math.max(0.8, r * 0.35), d.dark);
  }

  p.outline(P.outline);
  return p;
}
