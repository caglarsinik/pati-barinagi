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
  roofGreen: hex(0x4f8a4a),
  roofPink: hex(0xd9738f),
  roofPinkDark: hex(0xa8506a),
  heart: hex(0xe4514f),
  roofGreenDark: hex(0x376334),
  door: hex(0x4a2f1c),
  glass: hex(0xbfe6f5),
  glassDark: hex(0x7fbedd),
  metal: hex(0x9aa0ab),
  metalDark: hex(0x6a707a),
  metalLight: hex(0xc3c8d1),
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
  cross: hex(0xe4514f),
  white: hex(0xf7f3ea),
  rope: hex(0xd9b36a),
  ropeDark: hex(0xa8833f),
  tunnel: hex(0x3f8fd6),
  tunnelDark: hex(0x2a6aa6),
  tunnelInner: hex(0x1d2a44),
  lampGlow: hex(0xffe58a),
  pot: hex(0xc4643c),
  potDark: hex(0x8f4527),
};

/** Bina görseli: w*16 x (h*16 + overhang). Kökeni sol alt. rot 1: genişlik/yükseklik takas, ön yüz yine altta. */
export function drawBuilding(type: BuildingType, variant = 0, rot: 0 | 1 = 0): Pixels {
  const def = BUILDING_DEFS[type];
  const size = rot === 1 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
  const W = size.w * T;
  const H = size.h * T + BUILDING_OVERHANG;
  const p = new Pixels(W, H);
  const y0 = BUILDING_OVERHANG; // bina tabanı bu satırdan başlar
  const bottom = y0 + size.h * T; // taban alt kenarı (dışlayıcı)
  switch (type) {
    case 'office':
      // variant = ofis seviyesi - 1 (lisansla büyür): Sv2 bayrak + yan pencere, Sv3 çatı penceresi + yıldızlı tabela.
      drawHouse(p, 0, y0, W, size.h * T, C.wall, C.wallDark, C.roof, C.roofDark, C.roofLight, true);
      p.fillRect(Math.floor(W / 2) - 7, y0 + 10, 14, 5, C.sign);
      p.fillRect(Math.floor(W / 2) - 6, y0 + 12, 12, 1, P.outline);
      if (variant >= 1) {
        p.fillRect(W - 9, y0 - 12, 1, 12, C.metalDark);
        p.fillRect(W - 8, y0 - 12, 6, 4, C.bowlRed);
        p.fillRect(4, bottom - 18, 7, 6, P.waterLight);
        p.fillRect(4, bottom - 15, 7, 1, C.wallDark);
      }
      if (variant >= 2) {
        p.fillRect(Math.floor(W / 2) - 4, y0 - 6, 8, 5, P.waterLight);
        p.fillRect(Math.floor(W / 2) - 5, y0 - 7, 10, 1, C.roofDark);
        p.set(Math.floor(W / 2), y0 + 11, C.lampGlow);
        p.set(Math.floor(W / 2) - 1, y0 + 12, C.lampGlow);
        p.set(Math.floor(W / 2) + 1, y0 + 12, C.lampGlow);
        p.fillRect(W - 15, bottom - 18, 7, 6, P.waterLight);
        p.fillRect(W - 15, bottom - 15, 7, 1, C.wallDark);
      }
      break;
    case 'feeder':
      // Hazne (üstte yem görünür), boru ve altta küçük kap.
      p.fillRect(3, y0 - 4, 10, 10, C.metal);
      p.fillRect(3, y0 - 4, 10, 1, C.metalLight);
      p.fillRect(3, y0 + 5, 10, 1, C.metalDark);
      p.fillRect(5, y0 - 3, 6, 2, C.kibble);
      p.fillRect(7, y0 + 6, 2, 5, C.metalDark);
      p.ellipse(8, y0 + 12, 5, 2.5, C.bowlRed);
      p.ellipse(8, y0 + 11.5, 3.5, 1.5, C.kibble);
      break;
    case 'kennelSmall':
    case 'kennelLarge': {
      const houseH = (size.h - 1) * T;
      drawHouse(p, 0, y0, W, houseH, C.woodWall, C.woodWallDark, C.roof, C.roofDark, C.roofLight, false);
      const doors = type === 'kennelLarge' ? 2 : 1;
      for (let i = 0; i < doors; i++) {
        const dx = Math.floor(((i + 0.5) * W) / doors);
        p.ellipse(dx, y0 + houseH - 2, 3.5, 5, C.door);
      }
      for (let i = 0; i < size.w; i++) {
        p.fillRect(i * T + 2, y0 + houseH + 4, T - 4, T - 6, C.mat);
        p.fillRect(i * T + 3, y0 + houseH + 5, T - 6, T - 8, C.matDark);
      }
      break;
    }
    case 'shed':
      drawHouse(p, 0, y0, W, size.h * T, C.metal, C.metalDark, C.roofBlue, C.roofBlueDark, C.roofBlue, false);
      p.fillRect(Math.floor(W / 2) - 4, bottom - 11, 8, 11, C.door);
      p.line(Math.floor(W / 2) - 4, bottom - 11, Math.floor(W / 2) + 3, bottom - 1, C.woodWall);
      p.line(Math.floor(W / 2) + 3, bottom - 11, Math.floor(W / 2) - 4, bottom - 1, C.woodWall);
      p.ellipse(5, bottom - 3, 3, 2.5, C.kibble);
      p.ellipse(W - 6, bottom - 3, 3, 2.5, C.kibble);
      break;
    case 'kitchen':
      drawHouse(p, 0, y0, W, size.h * T, C.wall, C.wallDark, C.roofGreen, C.roofGreenDark, C.roofGreen, false);
      // Baca
      p.fillRect(W - 10, y0 - 9, 4, 9, C.metalDark);
      p.fillRect(W - 10, y0 - 10, 4, 1, C.metalLight);
      // Pencere ve kapı
      p.fillRect(4, y0 + 5, 8, 6, P.waterLight);
      p.fillRect(4, y0 + 8, 8, 1, C.wallDark);
      p.fillRect(Math.floor(W / 2) - 3, bottom - 9, 6, 9, C.door);
      // Tezgâh ve tencere
      p.fillRect(W - 14, bottom - 6, 10, 2, C.metalLight);
      p.ellipse(W - 9, bottom - 8, 3, 2, C.metalDark);
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
      // variant 0 boş, 1 yarım, 2 dolu
      p.fillRect(1, y0 + 6, 14, 7, C.woodWallDark);
      if (variant >= 2) {
        p.fillRect(2, y0 + 7, 12, 4, P.water);
        p.set(4, y0 + 8, P.waterLight);
        p.set(9, y0 + 9, P.waterLight);
      } else if (variant === 1) {
        p.fillRect(2, y0 + 9, 12, 2, P.water);
        p.set(5, y0 + 9, P.waterLight);
      }
      p.fillRect(1, y0 + 5, 14, 1, C.woodWall);
      break;
    case 'groomStation':
      // Küvet + raf
      p.fillRect(2, y0 + 4, W - 4, 4, C.woodWall);
      p.fillRect(3, y0 + 5, W - 6, 2, C.woodWallDark);
      p.ellipse(W / 2, bottom - 8, W / 2 - 3, 7, C.white);
      p.ellipse(W / 2, bottom - 9, W / 2 - 5, 4.5, P.waterLight);
      p.set(W / 2 - 4, bottom - 10, C.white);
      p.set(W / 2 + 3, bottom - 8, C.white);
      p.fillRect(W / 2 - 6, bottom - 3, 12, 2, C.metalDark);
      p.fillRect(4, y0 + 1, 3, 3, C.bowlRed);
      p.fillRect(9, y0 + 1, 3, 3, C.tunnel);
      p.fillRect(14, y0 + 1, 3, 3, C.sign);
      break;
    case 'vetClinic':
      drawHouse(p, 0, y0, W, size.h * T, C.white, C.wallDark, C.roofBlue, C.roofBlueDark, C.roofBlue, true);
      // Kırmızı haç
      p.fillRect(Math.floor(W / 2) - 1, y0 + 8, 3, 9, C.cross);
      p.fillRect(Math.floor(W / 2) - 4, y0 + 11, 9, 3, C.cross);
      break;
    case 'nursery': {
      // Pembe çatılı küçük ev, kalpli tabela, iki kapı ve önünde minder.
      drawHouse(p, 0, y0, W, size.h * T - 6, C.wall, C.wallDark, C.roofPink, C.roofPinkDark, C.roofPink, false);
      const cx = Math.floor(W / 2);
      p.ellipse(cx - 2, y0 + 12, 2.5, 2.5, C.heart);
      p.ellipse(cx + 2, y0 + 12, 2.5, 2.5, C.heart);
      p.fillRect(cx - 4, y0 + 12, 9, 2, C.heart);
      p.fillRect(cx - 3, y0 + 14, 7, 2, C.heart);
      p.fillRect(cx - 1, y0 + 16, 3, 2, C.heart);
      p.ellipse(W / 4, bottom - 12, 3.5, 5, C.door);
      p.ellipse((3 * W) / 4, bottom - 12, 3.5, 5, C.door);
      p.fillRect(4, bottom - 5, W - 8, 4, C.mat);
      p.fillRect(5, bottom - 4, W - 10, 2, C.matDark);
      break;
    }
    case 'incubator':
      p.fillRect(2, y0 + 12, W - 4, T + 2, C.metal);
      p.fillRect(2, y0 + T + 8, W - 4, 4, C.metalDark);
      p.ellipse(W / 2, y0 + 10, W / 2 - 3, 9, C.glass);
      p.ellipse(W / 2 - 3, y0 + 7, 5, 4, hex(0xe6f6fb));
      p.fillRect(2, y0 + 12, W - 4, 1, C.glassDark);
      p.fillRect(W / 2 - 1, y0 + 2, 3, 3, hex(0xf6a23c));
      for (let i = 0; i < 3; i++) p.ellipse(8 + i * 8, y0 + 13, 3, 1.5, P.twigDark);
      break;
    case 'toyBall':
      p.ellipse(8, y0 + 10, 4, 4, C.ball);
      p.ellipse(7, y0 + 9, 2, 1.5, C.ballWhite);
      p.set(10, y0 + 12, C.bowlDark);
      break;
    case 'toyRope':
      p.ellipse(8, y0 + 11, 6, 3, C.rope);
      p.ellipse(8, y0 + 11, 3.5, 1.5, C.ropeDark);
      p.ellipse(8, y0 + 11, 2, 0.8, C.rope);
      p.fillRect(2, y0 + 8, 2, 2, C.ropeDark);
      p.fillRect(12, y0 + 12, 2, 2, C.ropeDark);
      break;
    case 'toyTunnel':
      if (rot === 1) {
        // Dikey boru: delikler üstte ve altta.
        const len = bottom - y0;
        p.fillRect(3, y0, 10, len, C.tunnel);
        p.fillRect(11, y0, 2, len, C.tunnelDark);
        for (let y = y0 + 6; y < bottom - 2; y += 8) p.fillRect(3, y, 10, 1, C.tunnelDark);
        p.ellipse(8, y0 + 3, 4.5, 2.5, C.tunnelInner);
        p.ellipse(8, bottom - 4, 4.5, 2.5, C.tunnelInner);
        break;
      }
      p.fillRect(0, y0 + 4, W, 10, C.tunnel);
      p.fillRect(0, y0 + 12, W, 2, C.tunnelDark);
      for (let x = 6; x < W; x += 8) p.fillRect(x, y0 + 4, 1, 10, C.tunnelDark);
      p.ellipse(3, y0 + 9, 2.5, 4.5, C.tunnelInner);
      p.ellipse(W - 4, y0 + 9, 2.5, 4.5, C.tunnelInner);
      break;
    case 'obstacle':
      p.fillRect(2, y0 + 3, 2, 12, C.woodWall);
      p.fillRect(12, y0 + 3, 2, 12, C.woodWall);
      p.fillRect(2, y0 + 7, 12, 2, C.sign);
      p.fillRect(2, y0 + 7, 3, 2, C.cross);
      p.fillRect(8, y0 + 7, 3, 2, C.cross);
      break;
    case 'staffToilet': {
      // Küçük mavi çatılı kulübe: kalp oyuklu kapı, üstte "WC" tabelası.
      drawHouse(p, 0, y0, W, size.h * T, C.white, C.wallDark, C.roofBlue, C.roofBlueDark, C.roofBlue, false);
      const cx = Math.floor(W / 2);
      p.fillRect(cx - 4, bottom - 15, 8, 15, C.door);
      p.fillRect(cx - 1, bottom - 12, 2, 2, C.wallDark);
      p.set(cx + 2, bottom - 7, P.flowerYellow);
      p.fillRect(cx - 5, y0 + 3, 11, 5, C.sign);
      const ink = C.woodWallDark;
      // W (5×3) ve C (3×3)
      for (const [dx, dy] of [[0, 0], [2, 0], [4, 0], [0, 1], [2, 1], [4, 1], [1, 2], [3, 2]]) p.set(cx - 4 + dx, y0 + 4 + dy, ink);
      for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [1, 2], [2, 2]]) p.set(cx + 2 + dx, y0 + 4 + dy, ink);
      break;
    }
    case 'staffRoom':
      drawHouse(p, 0, y0, W, size.h * T, C.wall, C.wallDark, C.roofGreen, C.roofGreenDark, C.roofGreen, true);
      // Kahve fincanı tabelası
      p.fillRect(W - 12, y0 + 3, 8, 6, C.sign);
      p.fillRect(W - 10, y0 + 4, 4, 3, C.woodWallDark);
      p.set(W - 5, y0 + 5, C.woodWallDark);
      break;
    case 'lamp':
      p.fillRect(7, y0 + 2, 2, 13, C.metalDark);
      p.fillRect(5, bottom - 2, 6, 2, C.metalDark);
      p.fillRect(5, y0 - 4, 6, 6, C.lampGlow);
      p.fillRect(4, y0 - 5, 8, 1, C.metalDark);
      p.fillRect(6, y0 + 2, 4, 1, C.metalDark);
      break;
    case 'bin':
      p.fillRect(3, y0 + 5, 10, 10, C.green);
      p.fillRect(3, y0 + 5, 10, 1, C.greenDark);
      p.fillRect(2, y0 + 3, 12, 3, C.greenDark);
      p.fillRect(6, y0 + 8, 4, 5, C.greenDark);
      break;
    case 'flower':
      p.fillRect(4, y0 + 9, 8, 6, C.pot);
      p.fillRect(3, y0 + 8, 10, 2, C.potDark);
      p.fillRect(5, y0 + 5, 1, 4, P.grassDark);
      p.fillRect(8, y0 + 4, 1, 5, P.grassDark);
      p.fillRect(11, y0 + 6, 1, 3, P.grassDark);
      p.set(5, y0 + 4, P.flowerPink);
      p.set(4, y0 + 5, P.flowerPink);
      p.set(6, y0 + 5, P.flowerPink);
      p.set(8, y0 + 3, P.flowerYellow);
      p.set(7, y0 + 4, P.flowerYellow);
      p.set(9, y0 + 4, P.flowerYellow);
      p.set(11, y0 + 5, P.flowerRed);
      p.set(10, y0 + 6, P.flowerRed);
      p.set(12, y0 + 6, P.flowerRed);
      break;
    case 'bench':
      if (rot === 1) {
        // Dikey bank: çıtalar yukarıdan aşağı, ayaklar sağda.
        const len = bottom - y0;
        p.fillRect(6, y0 + 2, 3, len - 4, C.woodWall);
        p.fillRect(10, y0 + 2, 3, len - 4, C.woodWall);
        p.fillRect(12, y0 + 2, 1, len - 4, C.woodWallDark);
        p.fillRect(13, y0 + 4, 3, 2, C.metalDark);
        p.fillRect(13, bottom - 6, 3, 2, C.metalDark);
        p.fillRect(9, y0 + 4, 1, 2, C.metalDark);
        p.fillRect(9, bottom - 6, 1, 2, C.metalDark);
        break;
      }
      p.fillRect(2, y0 + 6, W - 4, 3, C.woodWall);
      p.fillRect(2, y0 + 10, W - 4, 3, C.woodWall);
      p.fillRect(2, y0 + 12, W - 4, 1, C.woodWallDark);
      p.fillRect(4, y0 + 13, 2, 3, C.metalDark);
      p.fillRect(W - 6, y0 + 13, 2, 3, C.metalDark);
      p.fillRect(4, y0 + 9, 2, 1, C.metalDark);
      p.fillRect(W - 6, y0 + 9, 2, 1, C.metalDark);
      break;
    case 'sign':
      p.fillRect(7, y0 + 4, 2, 11, C.woodWallDark);
      p.fillRect(2, y0 - 2, 12, 7, C.sign);
      p.fillRect(3, y0 - 1, 10, 5, C.woodWall);
      p.fillRect(4, y0, 8, 1, C.sign);
      p.fillRect(4, y0 + 2, 6, 1, C.sign);
      break;
    default:
      p.fillRect(0, y0, W, size.h * T, C.wall);
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
  p.fillRect(x, y, w, h, wall);
  p.fillRect(x + w - 2, y, 2, h, wallDark);
  for (let i = 0; i < roofH; i++) {
    const inset = Math.round(((roofH - 1 - i) * (w / 2 - 2)) / roofH);
    p.fillRect(x + inset, y - roofH + i, w - inset * 2, 1, i % 3 === 0 ? roofDark : roof);
  }
  p.fillRect(x, y, w, 1, roofDark);
  p.fillRect(x + 1, y - 2, 2, 1, roofLight);
  if (withDoor) {
    p.fillRect(x + Math.floor(w / 2) - 3, y + h - 9, 6, 9, P.trunkDark);
    p.set(x + Math.floor(w / 2) + 1, y + h - 5, P.flowerYellow);
    p.fillRect(x + 3, y + 4, 5, 5, P.waterLight);
    p.fillRect(x + w - 8, y + 4, 5, 5, P.waterLight);
    p.fillRect(x + 3, y + 6, 5, 1, wallDark);
    p.fillRect(x + w - 8, y + 6, 5, 1, wallDark);
  }
}

/** Köy binaları (0.18.2): oyuncuya ait değil; dükkân tabelaları kodla. Kökeni sol alt. */
export function drawVillageBuilding(kind: 'wholesaler' | 'toyShop' | 'house' | 'fountain' | 'market' | 'postOffice' | 'bench', wTiles: number, hTiles: number): Pixels {
  const W = wTiles * T;
  const H = hTiles * T + BUILDING_OVERHANG;
  const p = new Pixels(W, H);
  const y0 = BUILDING_OVERHANG;
  const bottom = y0 + hTiles * T;
  const cx = Math.floor(W / 2);
  switch (kind) {
    case 'wholesaler':
      drawHouse(p, 0, y0, W, hTiles * T, C.woodWall, C.woodWallDark, C.roof, C.roofDark, C.roofLight, true);
      // Tabela: çuval işareti; kapı yanında çuval yığını.
      p.fillRect(cx - 9, y0 + 12, 18, 7, C.sign);
      p.fillRect(cx - 3, y0 + 13, 6, 5, C.rope);
      p.fillRect(cx - 2, y0 + 12, 4, 1, C.ropeDark);
      p.fillRect(W - 12, bottom - 7, 8, 6, C.rope);
      p.fillRect(W - 11, bottom - 9, 6, 2, C.ropeDark);
      break;
    case 'toyShop':
      drawHouse(p, 0, y0, W, hTiles * T, C.white, C.wallDark, C.roofPink, C.roofPinkDark, C.roofPink, true);
      // Tabela: top ve ilaç haçı.
      p.fillRect(cx - 9, y0 + 12, 18, 7, C.sign);
      p.ellipse(cx - 4, y0 + 15.5, 2.5, 2.5, C.ball);
      p.fillRect(cx + 4, y0 + 13, 1, 5, C.cross);
      p.fillRect(cx + 2, y0 + 15, 5, 1, C.cross);
      break;
    case 'house':
      drawHouse(p, 0, y0, W, hTiles * T, C.wall, C.wallDark, C.roofGreen, C.roofGreenDark, C.roofGreen, true);
      p.fillRect(3, y0 + 11, 6, 2, C.green);
      p.set(4, y0 + 10, C.heart);
      p.set(7, y0 + 10, C.sign);
      break;
    case 'fountain':
      // Taş havuz, su ve ortada fıskiye.
      p.ellipse(W / 2, bottom - 8, W / 2 - 1, 7, C.metalDark);
      p.ellipse(W / 2, bottom - 9, W / 2 - 3, 5, C.glassDark);
      p.ellipse(W / 2, bottom - 10, W / 2 - 6, 3, C.glass);
      p.fillRect(cx - 2, bottom - 22, 4, 12, C.metal);
      p.fillRect(cx - 1, bottom - 27, 2, 5, C.glass);
      break;
    case 'market': {
      // Pazar tezgâhı (0.20.0): çizgili tente, iki direk, tahta tezgâh; üstünde çuval, top ve ilaç şişesi.
      const top = y0 + 2;
      p.fillRect(0, top, W, 8, C.white);
      for (let x = 0; x < W; x += 8) p.fillRect(x, top, 4, 8, C.roofPink);
      p.fillRect(0, top + 8, W, 1, C.roofPinkDark);
      p.fillRect(2, top + 9, 2, bottom - top - 9, C.woodWallDark);
      p.fillRect(W - 4, top + 9, 2, bottom - top - 9, C.woodWallDark);
      p.fillRect(0, bottom - 11, W, 11, C.woodWall);
      p.fillRect(0, bottom - 11, W, 2, C.woodWallDark);
      for (let x = 6; x < W; x += 10) p.fillRect(x, bottom - 8, 1, 7, C.woodWallDark);
      // Mallar yanlarda; orta boş kalır, satıcı Pazar günü tezgâhın arkasında görünür.
      p.fillRect(5, bottom - 17, 9, 6, C.rope);
      p.fillRect(5, bottom - 17, 9, 1, C.ropeDark);
      p.ellipse(16, bottom - 14, 3, 3, C.ball);
      p.fillRect(36, bottom - 18, 4, 7, C.white);
      p.fillRect(37, bottom - 16, 2, 1, C.cross);
      p.fillRect(37, bottom - 17, 1, 3, C.cross);
      break;
    }
    case 'postOffice':
      // Postane (0.20.2): beyaz duvar, kiremit çatı, sarı tabelada zarf; kapı yanında kırmızı posta kutusu.
      drawHouse(p, 0, y0, W, hTiles * T, C.white, C.wallDark, C.roof, C.roofDark, C.roofLight, true);
      p.fillRect(cx - 9, y0 + 12, 18, 7, C.sign);
      p.fillRect(cx - 4, y0 + 13, 8, 5, C.white);
      for (let i = 0; i < 4; i++) {
        p.set(cx - 4 + i, y0 + 13 + i, C.ropeDark);
        p.set(cx + 3 - i, y0 + 13 + i, C.ropeDark);
      }
      p.fillRect(W - 10, bottom - 11, 5, 9, C.ball);
      p.fillRect(W - 10, bottom - 11, 5, 2, C.roofDark);
      p.fillRect(W - 9, bottom - 2, 3, 2, C.woodWallDark);
      break;
    case 'bench':
      // Köy parkının bankı (0.20.2).
      p.fillRect(2, bottom - 14, W - 4, 3, C.woodWall);
      p.fillRect(2, bottom - 9, W - 4, 3, C.woodWall);
      p.fillRect(2, bottom - 9, W - 4, 1, C.woodWallDark);
      for (const x of [4, W - 6]) p.fillRect(x, bottom - 14, 2, 14, C.woodWallDark);
      break;
  }
  p.outline(P.outline);
  return p;
}

/** Sahiplendirme günü balonları (0.21.3): üç balon ve ipleri. */
export function drawBalloons(): Pixels {
  const p = new Pixels(22, 34);
  p.line(6, 13, 11, 33, C.ropeDark);
  p.line(16, 12, 11, 33, C.ropeDark);
  p.line(11, 17, 11, 33, C.ropeDark);
  p.ellipse(6, 8, 4.5, 5.5, C.heart);
  p.ellipse(16, 7, 4.5, 5.5, C.sign);
  p.ellipse(11, 12, 4.5, 5.5, C.tunnel);
  p.set(4, 5, C.white);
  p.set(14, 4, C.white);
  p.set(9, 9, C.white);
  p.outline(P.outline);
  return p;
}

/** Köy görev panosu (0.20.4): iki direkli, çatılı tahta pano; üstünde iğneli ilan kâğıtları. */
export function drawQuestBoard(): Pixels {
  const p = new Pixels(28, 28);
  p.fillRect(4, 12, 2, 16, C.woodWallDark);
  p.fillRect(22, 12, 2, 16, C.woodWallDark);
  p.fillRect(1, 2, 26, 3, C.roofDark);
  p.fillRect(2, 5, 24, 14, C.woodWall);
  p.fillRect(2, 18, 24, 1, C.woodWallDark);
  p.fillRect(4, 7, 6, 8, C.white);
  p.fillRect(12, 8, 5, 6, C.white);
  p.fillRect(19, 7, 5, 8, C.sign);
  p.set(7, 7, C.heart);
  p.set(14, 8, C.heart);
  p.set(21, 7, C.heart);
  p.fillRect(5, 10, 4, 1, C.ropeDark);
  p.fillRect(5, 12, 3, 1, C.ropeDark);
  p.fillRect(13, 10, 3, 1, C.ropeDark);
  p.fillRect(20, 10, 3, 1, C.ropeDark);
  p.fillRect(20, 12, 3, 1, C.ropeDark);
  p.outline(P.outline);
  return p;
}

/** Yol tabelası (0.20.3): direk ve iki ok levha (üstteki sağa, alttaki sola). */
export function drawSignpost(): Pixels {
  const p = new Pixels(T, 26);
  p.fillRect(7, 6, 2, 20, C.woodWallDark);
  p.fillRect(2, 3, 10, 5, C.sign);
  p.fillRect(12, 4, 1, 3, C.sign);
  p.set(13, 5, C.sign);
  p.fillRect(4, 5, 6, 1, C.ropeDark);
  p.fillRect(4, 10, 10, 5, C.sign);
  p.fillRect(3, 11, 1, 3, C.sign);
  p.set(2, 12, C.sign);
  p.fillRect(6, 12, 6, 1, C.ropeDark);
  p.outline(P.outline);
  return p;
}
