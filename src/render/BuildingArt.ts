import { BUILDING_DEFS, type BuildingType } from '../content/buildings';
import { Pixels, type RGBA, hex } from './Pixels';
import { P } from './palette';

const T = 16;
/** Çatıların taban karelerinin üstüne taşan piksel sayısı. */
export const BUILDING_OVERHANG = 10;

const C = {
  wall: hex(0xe8dcc0),
  wallDark: hex(0xc9b995),
  woodWall: hex(0xb37a48),
  woodWallDark: hex(0x8d5d33),
  roof: hex(0xb8443a),
  roofDark: hex(0x8a3029),
  roofLight: hex(0xd45f52),
  roofBlue: hex(0x4b6f9e),
  roofBlueDark: hex(0x35516f),
  door: hex(0x4a2f1c),
  glass: hex(0xbfe6f5),
  glassDark: hex(0x7fbedd),
  metal: hex(0x9aa0ab),
  metalDark: hex(0x6a707a),
  bowlRed: hex(0xd8503f),
  bowlDark: hex(0x9c3327),
  kibble: hex(0x8a5a2b),
  ball: hex(0xe84d4d),
  ballWhite: hex(0xf6f1e4),
  green: hex(0x3f8f4a),
  greenDark: hex(0x2c6534),
  mat: hex(0x6b5a4a),
  matDark: hex(0x4d3f33),
  sign: hex(0xf6d55c),
};

/** Bina görseli: w*16 x (h*16 + overhang). Kökeni sol alt. */
export function drawBuilding(type: BuildingType, variant = 0): Pixels {
  const def = BUILDING_DEFS[type];
  const W = def.w * T;
  const H = def.h * T + BUILDING_OVERHANG;
  const p = new Pixels(W, H);
  const y0 = BUILDING_OVERHANG; // bina tabanı bu satırdan başlar
  switch (type) {
    case 'office':
      drawHouse(p, 0, y0, W, def.h * T, C.wall, C.wallDark, C.roof, C.roofDark, C.roofLight, true);
      p.fillRect(Math.floor(W / 2) - 7, y0 + 10, 14, 5, C.sign);
      p.fillRect(Math.floor(W / 2) - 6, y0 + 12, 12, 1, P.outline);
      break;
    case 'kennelSmall':
    case 'kennelLarge': {
      // Ön satır: yatak/paspas; arka satır: kulübe.
      const houseH = T;
      drawHouse(p, 0, y0, W, houseH, C.woodWall, C.woodWallDark, C.roof, C.roofDark, C.roofLight, false);
      const doors = type === 'kennelLarge' ? 2 : 1;
      for (let i = 0; i < doors; i++) {
        const dx = Math.floor(((i + 0.5) * W) / doors);
        p.ellipse(dx, y0 + houseH - 2, 3.5, 5, C.door);
      }
      for (let i = 0; i < def.w; i++) {
        p.fillRect(i * T + 2, y0 + houseH + 4, T - 4, T - 6, C.mat);
        p.fillRect(i * T + 3, y0 + houseH + 5, T - 6, T - 8, C.matDark);
      }
      break;
    }
    case 'shed':
      drawHouse(p, 0, y0, W, def.h * T, C.metal, C.metalDark, C.roofBlue, C.roofBlueDark, C.roofBlue, false);
      p.fillRect(Math.floor(W / 2) - 4, y0 + def.h * T - 11, 8, 11, C.door);
      p.line(Math.floor(W / 2) - 4, y0 + def.h * T - 11, Math.floor(W / 2) + 3, y0 + def.h * T - 1, C.woodWall);
      p.line(Math.floor(W / 2) + 3, y0 + def.h * T - 11, Math.floor(W / 2) - 4, y0 + def.h * T - 1, C.woodWall);
      // Yem çuvalları
      p.ellipse(5, y0 + def.h * T - 3, 3, 2.5, C.kibble);
      p.ellipse(W - 6, y0 + def.h * T - 3, 3, 2.5, C.kibble);
      break;
    case 'bowl': {
      p.ellipse(8, y0 + 10, 6.5, 3.5, C.bowlRed);
      p.ellipse(8, y0 + 9, 5.5, 2.5, C.bowlDark);
      if (variant >= 1) {
        p.ellipse(8, y0 + 9, 4.5, 2, C.kibble);
        p.set(6, y0 + 8, P.trunkLight);
        p.set(9, y0 + 9, P.trunkLight);
        if (variant >= 2) {
          p.ellipse(8, y0 + 8, 4, 1.8, C.kibble);
          p.set(7, y0 + 7, P.trunkLight);
          p.set(10, y0 + 8, P.trunkLight);
        }
      }
      break;
    }
    case 'trough':
      p.fillRect(1, y0 + 6, 14, 7, C.woodWallDark);
      p.fillRect(2, y0 + 7, 12, 4, P.water);
      p.set(4, y0 + 8, P.waterLight);
      p.set(9, y0 + 9, P.waterLight);
      p.fillRect(1, y0 + 5, 14, 1, C.woodWall);
      break;
    case 'incubator':
      p.fillRect(2, y0 + 12, W - 4, T + 2, C.metal);
      p.fillRect(2, y0 + T + 8, W - 4, 4, C.metalDark);
      p.ellipse(W / 2, y0 + 10, W / 2 - 3, 9, C.glass);
      p.ellipse(W / 2 - 3, y0 + 7, 5, 4, hex(0xe6f6fb));
      p.fillRect(2, y0 + 12, W - 4, 1, C.glassDark);
      p.fillRect(W / 2 - 1, y0 + 2, 3, 3, hex(0xf6a23c));
      // Yumurta yuvaları
      for (let i = 0; i < 3; i++) p.ellipse(8 + i * 8, y0 + 13, 3, 1.5, P.twigDark);
      break;
    case 'toyBall':
      p.ellipse(8, y0 + 10, 4, 4, C.ball);
      p.ellipse(7, y0 + 9, 2, 1.5, C.ballWhite);
      p.set(10, y0 + 12, C.bowlDark);
      break;
    case 'bin':
      p.fillRect(3, y0 + 5, 10, 10, C.green);
      p.fillRect(3, y0 + 5, 10, 1, C.greenDark);
      p.fillRect(2, y0 + 3, 12, 3, C.greenDark);
      p.fillRect(6, y0 + 8, 4, 5, C.greenDark);
      break;
    default:
      p.fillRect(0, y0, W, def.h * T, C.wall);
  }
  p.outline(P.outline);
  return p;
}

function drawHouse(
  p: Pixels,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: RGBA,
  wallDark: RGBA,
  roof: RGBA,
  roofDark: RGBA,
  roofLight: RGBA,
  withDoor: boolean,
): void {
  const roofH = Math.min(BUILDING_OVERHANG, 10);
  // Duvar
  p.fillRect(x, y, w, h, wall);
  p.fillRect(x + w - 2, y, 2, h, wallDark);
  // Çatı: üstte daralan trapez
  for (let i = 0; i < roofH; i++) {
    const inset = Math.round(((roofH - 1 - i) * (w / 2 - 2)) / roofH);
    p.fillRect(x + inset, y - roofH + i, w - inset * 2, 1, i % 3 === 0 ? roofDark : roof);
  }
  p.fillRect(x, y, w, 1, roofDark);
  p.fillRect(x + 1, y - 2, 2, 1, roofLight);
  // Kapı
  if (withDoor) {
    p.fillRect(x + Math.floor(w / 2) - 3, y + h - 9, 6, 9, P.trunkDark);
    p.set(x + Math.floor(w / 2) + 1, y + h - 5, P.flowerYellow);
    // Pencereler
    p.fillRect(x + 3, y + 4, 5, 5, P.waterLight);
    p.fillRect(x + w - 8, y + 4, 5, 5, P.waterLight);
    p.fillRect(x + 3, y + 6, 5, 1, wallDark);
    p.fillRect(x + w - 8, y + 6, 5, 1, wallDark);
  }
}
