import type { InteriorItemType } from '../sim/interior/Interiors';
import { Pixels, hex } from './Pixels';
import { P } from './palette';
import { TILE } from './TileArt';

/** İç mekân eşyalarının doku anahtarı. */
export function interiorItemTextureKey(type: InteriorItemType): string {
  return `int-${type}`;
}

/** Eşya çizimi: taban eşyanın kare dikdörtgeni, üst kısmı duvara taşabilir (sprite alt-sol kökenli çizilir). */
export function drawInteriorItem(type: InteriorItemType): Pixels {
  switch (type) {
    case 'desk':
      return drawDesk();
    case 'board':
      return drawBoard();
    case 'window':
      return drawWindow();
    case 'bookshelf':
      return drawBookshelf();
    case 'coffee':
      return drawCoffee();
    case 'phone':
      return drawPhone();
    case 'bed':
      return drawBed();
    case 'plant':
      return drawPlant();
  }
}

const SCREEN = hex(0x3b4664);
const GLASS = hex(0x7ec4e8);
const GLASS_LIGHT = hex(0xd9edf8);
const CORK = hex(0xc49a62);
const CORK_DARK = hex(0xa87f4c);
const PAPER = hex(0xf8f4ec);
const GOLD = hex(0xe8b84a);
const POT = hex(0xc4643c);
const POT_DARK = hex(0x9c4a2c);
const SHEET = hex(0x4f7fc9);
const SHEET_DARK = hex(0x3a62a3);
const METAL = hex(0x9ea3ad);
const METAL_DARK = hex(0x6d717b);

/** Ofis masası: ahşap tabla, çekmeceler, üstünde bilgisayar ve kâğıtlar (2 kare genişlik). */
function drawDesk(): Pixels {
  const w = TILE * 2;
  const p = new Pixels(w, 28);
  const top = 12;
  p.fillRect(2, top + 4, 28, 10, P.trunk);
  p.fillRect(2, top + 4, 28, 1, P.trunkDark);
  p.fillRect(4, top + 6, 9, 3, P.trunkLight);
  p.fillRect(4, top + 10, 9, 3, P.trunkLight);
  p.fillRect(8, top + 7, 2, 1, P.flowerYellow);
  p.fillRect(8, top + 11, 2, 1, P.flowerYellow);
  p.fillRect(26, top + 5, 3, 11, P.trunkDark);
  p.fillRect(0, top, w, 4, P.trunkLight);
  p.fillRect(0, top + 3, w, 1, P.trunk);
  p.fillRect(15, 1, 13, 10, SCREEN);
  p.fillRect(16, 2, 11, 7, GLASS);
  p.fillRect(17, 3, 5, 1, GLASS_LIGHT);
  p.fillRect(17, 5, 7, 1, hex(0xb3dcf0));
  p.fillRect(20, 11, 3, 1, SCREEN);
  p.fillRect(14, top + 1, 12, 2, hex(0xdcdce4));
  p.fillRect(3, top - 2, 8, 3, P.flowerWhite);
  p.fillRect(4, top - 3, 7, 1, hex(0xe8e2d4));
  p.fillRect(28, top - 4, 3, 5, hex(0x3f82dc));
  p.fillRect(28, top - 6, 1, 2, P.flowerRed);
  p.fillRect(30, top - 6, 1, 2, P.flowerYellow);
  p.outline(P.outline);
  return p;
}

/** Lisans panosu (duvarda): mantar pano, çerçeveli lisans belgesi ve iğneli notlar. Alt 3 satır süpürgelik için boş. */
function drawBoard(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.fillRect(1, 1, 30, 11, P.trunk);
  p.fillRect(2, 2, 28, 9, CORK);
  p.fillRect(3, 8, 26, 1, CORK_DARK);
  // Lisans belgesi: altın mühürlü beyaz kâğıt.
  p.fillRect(4, 3, 11, 7, PAPER);
  p.fillRect(5, 4, 8, 1, hex(0x8f9196));
  p.fillRect(5, 6, 6, 1, hex(0xbabcc1));
  p.fillRect(12, 7, 2, 2, GOLD);
  // Notlar.
  p.fillRect(18, 3, 5, 5, P.flowerYellow);
  p.fillRect(24, 4, 5, 5, hex(0xf3b6cb));
  p.set(20, 3, P.flowerRed);
  p.set(26, 4, P.flowerBlue);
  p.fillRect(19, 5, 3, 1, hex(0xcdb977));
  p.outline(P.outline);
  return p;
}

/** Pencere (duvarda): gökyüzü camı, çapraz kayıt. */
function drawWindow(): Pixels {
  const p = new Pixels(TILE, TILE);
  p.fillRect(1, 1, 14, 11, P.trunkLight);
  p.fillRect(2, 2, 12, 9, GLASS);
  p.fillRect(3, 3, 3, 1, GLASS_LIGHT);
  p.fillRect(3, 4, 1, 2, GLASS_LIGHT);
  p.fillRect(2, 8, 12, 3, P.grassLight);
  p.fillRect(7, 2, 2, 9, P.trunkLight);
  p.fillRect(2, 6, 12, 1, P.trunkLight);
  p.fillRect(0, 12, 16, 1, P.trunk);
  p.outline(P.outline);
  return p;
}

/** Kitaplık: üç raf, renkli kitaplar (2 kare genişlik, duvara taşar). */
function drawBookshelf(): Pixels {
  const w = TILE * 2;
  const h = 30;
  const p = new Pixels(w, h);
  p.fillRect(1, 0, 30, h, P.trunk);
  p.fillRect(3, 2, 26, h - 4, P.trunkDark);
  const colors = [P.flowerRed, P.flowerBlue, P.grassDark, P.flowerYellow, hex(0xa66bd6), P.flowerWhite, hex(0x3f82dc)];
  let k = 0;
  for (const shelfY of [2, 11, 20]) {
    let x = 4;
    while (x < 27) {
      const bw = 2 + (k % 2);
      const bh = 6 + ((k * 5) % 3);
      p.fillRect(x, shelfY + 8 - bh, bw, bh, colors[k % colors.length]);
      x += bw + (k % 4 === 3 ? 2 : 0);
      k++;
    }
    p.fillRect(2, shelfY + 8, 28, 1, P.trunkLight);
  }
  p.outline(P.outline);
  return p;
}

/** Kahve köşesi: küçük dolap, üstünde kahve makinesi ve fincan (duvara taşar). */
function drawCoffee(): Pixels {
  const p = new Pixels(TILE, 26);
  p.fillRect(0, 14, 16, 12, P.trunk);
  p.fillRect(0, 14, 16, 2, P.trunkLight);
  p.fillRect(2, 18, 12, 6, P.trunkDark);
  p.set(7, 20, P.flowerYellow);
  // Makine.
  p.fillRect(3, 2, 9, 12, METAL_DARK);
  p.fillRect(4, 3, 7, 3, METAL);
  p.fillRect(5, 4, 2, 1, P.flowerRed);
  p.fillRect(6, 8, 3, 1, METAL);
  p.fillRect(6, 11, 3, 3, PAPER);
  p.fillRect(12, 11, 3, 3, PAPER);
  p.set(13, 10, hex(0xd9edf8));
  p.outline(P.outline);
  return p;
}

/** Telefon sehpası: küçük masa, kırmızı telefon ve not defteri. */
function drawPhone(): Pixels {
  const p = new Pixels(TILE, 20);
  p.fillRect(1, 8, 14, 3, P.trunkLight);
  p.fillRect(2, 11, 2, 9, P.trunk);
  p.fillRect(12, 11, 2, 9, P.trunk);
  p.fillRect(2, 15, 12, 1, P.trunkDark);
  // Telefon: gövde, ahize, tuşlar.
  p.fillRect(3, 4, 7, 4, P.flowerRed);
  p.fillRect(2, 2, 9, 2, hex(0xb83a3a));
  p.fillRect(5, 5, 3, 2, PAPER);
  p.fillRect(11, 6, 3, 2, PAPER);
  p.outline(P.outline);
  return p;
}

/** Tek kişilik yatak (dikey, 2 kare): başlık, yastık, battaniye. */
function drawBed(): Pixels {
  const h = TILE * 2 + 2;
  const p = new Pixels(TILE, h);
  p.fillRect(0, 0, 16, 6, P.trunk);
  p.fillRect(1, 1, 14, 2, P.trunkLight);
  p.fillRect(1, 6, 14, h - 7, P.trunkDark);
  p.fillRect(2, 6, 12, h - 9, PAPER);
  p.fillRect(3, 7, 10, 5, hex(0xe8e2d4));
  p.fillRect(2, 14, 12, h - 17, SHEET);
  p.fillRect(2, 14, 12, 2, hex(0x7aa6f0));
  for (let y = 19; y < h - 4; y += 4) p.fillRect(2, y, 12, 1, SHEET_DARK);
  p.outline(P.outline);
  return p;
}

/** Saksı çiçeği: toprak saksı, yapraklar, bir çiçek. */
function drawPlant(): Pixels {
  const p = new Pixels(TILE, 24);
  p.fillRect(3, 15, 10, 8, POT);
  p.fillRect(2, 14, 12, 2, POT_DARK);
  p.fillRect(4, 17, 8, 1, POT_DARK);
  p.ellipse(8, 9, 6, 5, P.leaf);
  p.ellipse(5, 6, 3, 3, P.leafLight);
  p.ellipse(11, 7, 3, 3, P.leafDark);
  p.fillRect(7, 11, 2, 4, P.leafDark);
  p.fillRect(9, 3, 3, 3, P.flowerPink);
  p.set(10, 4, P.flowerYellow);
  p.outline(P.outline);
  return p;
}
