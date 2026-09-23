import type { InteriorItemType } from '../sim/interior/Interiors';
import { Pixels, hex } from './Pixels';
import { P } from './palette';
import { TILE } from './TileArt';

/** İç mekân eşyalarının doku anahtarı. */
export function interiorItemTextureKey(type: InteriorItemType, variant = 0): string {
  return type === 'sacks' ? `int-sacks-${variant}` : `int-${type}`;
}

/** Eşya çizimi: taban eşyanın kare dikdörtgeni, üst kısmı duvara taşabilir (sprite alt-sol kökenli çizilir). */
export function drawInteriorItem(type: InteriorItemType, variant = 3): Pixels {
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
    case 'tray':
      return drawTray();
    case 'controlPanel':
      return drawControlPanel();
    case 'heatLamp':
      return drawHeatLamp();
    case 'supplies':
      return drawSupplies();
    case 'examTable':
      return drawExamTable();
    case 'medCabinet':
      return drawMedCabinet();
    case 'reception':
      return drawReception();
    case 'waitChairs':
      return drawWaitChairs();
    case 'xray':
      return drawXray();
    case 'counter':
      return drawCounter();
    case 'oven':
      return drawOven();
    case 'waterTank':
      return drawWaterTank();
    case 'spiceRack':
      return drawSpiceRack();
    case 'foodShelf':
      return drawFoodShelf();
    case 'sacks':
      return drawSackShelf(variant);
    case 'ledger':
      return drawLedger();
    case 'orderBoard':
      return drawOrderBoard();
    case 'restBoard':
      return drawNotice();
    case 'sofa':
      return drawSofa();
    case 'tv':
      return drawTv();
    case 'fridge':
      return drawFridge();
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

/** Duyuru panosu (dinlenme odası, duvarda): mantar pano, renkli notlar ve kahve fincanı çizimi. */
function drawNotice(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.fillRect(1, 1, 30, 11, P.trunk);
  p.fillRect(2, 2, 28, 9, CORK);
  p.fillRect(4, 3, 7, 6, PAPER);
  p.fillRect(5, 4, 5, 1, hex(0xbabcc1));
  p.fillRect(5, 6, 4, 1, hex(0xbabcc1));
  p.fillRect(13, 4, 6, 5, P.flowerYellow);
  p.fillRect(21, 3, 7, 6, hex(0xa3d5e9));
  p.fillRect(23, 5, 3, 2, P.trunkDark);
  p.set(26, 5, P.trunkDark);
  p.set(7, 3, P.flowerRed);
  p.set(15, 4, P.flowerBlue);
  p.outline(P.outline);
  return p;
}

/** Kanepe (arkadan: TV'ye bakar): koltuk minderleri, alçak sırt ve kolçaklar (2 kare). */
function drawSofa(): Pixels {
  const p = new Pixels(TILE * 2, 18);
  const fab = hex(0x7a5c9e);
  const fabDark = hex(0x5d4580);
  const fabLight = hex(0x9a7cc0);
  p.fillRect(3, 2, 26, 7, fabLight);
  p.fillRect(15, 2, 2, 7, fab);
  p.fillRect(0, 2, 4, 15, fab);
  p.fillRect(28, 2, 4, 15, fab);
  p.fillRect(2, 8, 28, 9, fab);
  p.fillRect(2, 8, 28, 2, fabLight);
  p.fillRect(2, 15, 28, 2, fabDark);
  p.fillRect(1, 2, 2, 1, fabLight);
  p.fillRect(29, 2, 2, 1, fabLight);
  p.outline(P.outline);
  return p;
}

/** TV: ahşap sehpa üstünde ekran (2 kare, duvara taşar). */
function drawTv(): Pixels {
  const p = new Pixels(TILE * 2, 26);
  p.fillRect(1, 16, 30, 10, P.trunk);
  p.fillRect(1, 16, 30, 2, P.trunkLight);
  p.fillRect(4, 20, 10, 4, P.trunkDark);
  p.fillRect(18, 20, 10, 4, P.trunkDark);
  p.fillRect(3, 1, 26, 14, SCREEN);
  p.fillRect(5, 3, 22, 10, hex(0x4fb3e8));
  p.fillRect(5, 9, 22, 4, P.grassLight);
  p.fillRect(18, 4, 4, 4, P.flowerYellow);
  p.fillRect(7, 4, 6, 1, GLASS_LIGHT);
  p.fillRect(14, 15, 4, 1, SCREEN);
  p.outline(P.outline);
  return p;
}

/** Buzdolabı: iki kapılı beyaz dolap, kulplar ve bir magnet (duvara taşar). */
function drawFridge(): Pixels {
  const p = new Pixels(TILE, 30);
  p.fillRect(1, 0, 14, 30, hex(0xe8ecf0));
  p.fillRect(13, 0, 2, 30, hex(0xc4cad3));
  p.fillRect(1, 11, 14, 1, METAL_DARK);
  p.fillRect(3, 4, 1, 5, METAL_DARK);
  p.fillRect(3, 14, 1, 7, METAL_DARK);
  p.fillRect(8, 3, 3, 3, P.flowerRed);
  p.fillRect(7, 17, 3, 2, P.flowerYellow);
  p.fillRect(1, 28, 14, 2, METAL);
  p.outline(P.outline);
  return p;
}

const BURLAP = hex(0xc9a36b);
const BURLAP_DARK = hex(0xa4814f);
const CHALK = hex(0x2f4a3a);

/** Kiler rafı: iki katlı ahşap raf, üstünde n çuval (0–3). Duvara taşar. */
function drawSackShelf(n: number): Pixels {
  const w = TILE * 2;
  const h = 28;
  const p = new Pixels(w, h);
  p.fillRect(1, 0, 3, h, P.trunk);
  p.fillRect(28, 0, 3, h, P.trunk);
  p.fillRect(1, 12, 30, 2, P.trunkLight);
  p.fillRect(1, 25, 30, 3, P.trunkLight);
  p.fillRect(4, 1, 24, 11, P.trunkDark);
  p.fillRect(4, 14, 24, 11, P.trunkDark);
  const spots: Array<[number, number]> = [
    [4, 14],
    [16, 14],
    [10, 1],
  ];
  for (let i = 0; i < Math.min(3, n); i++) {
    const [x, y] = spots[i];
    p.fillRect(x + 1, y + 2, 11, 9, BURLAP);
    p.fillRect(x + 3, y, 7, 2, BURLAP_DARK);
    p.fillRect(x + 1, y + 9, 11, 2, BURLAP_DARK);
    p.set(x + 6, y + 5, P.trunkDark);
    p.set(x + 5, y + 4, P.trunkDark);
    p.set(x + 7, y + 4, P.trunkDark);
  }
  p.outline(P.outline);
  return p;
}

/** Sipariş defteri: ahşap kürsü üstünde açık defter ve kalem. */
function drawLedger(): Pixels {
  const p = new Pixels(TILE, 22);
  p.fillRect(6, 9, 4, 12, P.trunk);
  p.fillRect(3, 19, 10, 3, P.trunkDark);
  p.fillRect(1, 5, 14, 5, P.trunkLight);
  p.fillRect(2, 2, 6, 5, PAPER);
  p.fillRect(8, 2, 6, 5, hex(0xe8e2d4));
  p.fillRect(3, 3, 4, 1, hex(0xbabcc1));
  p.fillRect(9, 4, 4, 1, hex(0xbabcc1));
  p.fillRect(12, 1, 1, 4, P.flowerBlue);
  p.outline(P.outline);
  return p;
}

/** Otomatik sipariş panosu: şövale üstünde yeşil kara tahta, tebeşir çizgileri ve çuval işareti. */
function drawOrderBoard(): Pixels {
  const p = new Pixels(TILE, 26);
  p.fillRect(2, 14, 2, 12, P.trunk);
  p.fillRect(12, 14, 2, 12, P.trunk);
  p.fillRect(1, 1, 14, 14, P.trunkLight);
  p.fillRect(2, 2, 12, 12, CHALK);
  p.fillRect(4, 4, 5, 1, PAPER);
  p.fillRect(4, 7, 7, 1, PAPER);
  p.fillRect(9, 9, 4, 4, BURLAP);
  p.set(4, 11, P.flowerYellow);
  p.set(6, 11, P.flowerYellow);
  p.outline(P.outline);
  return p;
}

const STEEL = hex(0xd6dae0);
const STEEL_DARK = hex(0x9ea3ad);
const GLOW = hex(0xf2a33a);
const TANK = hex(0x3f82dc);
const TANK_DARK = hex(0x2e63ad);

/** Mutfak tezgâhı (3 kare): dolap gövde, açık renk tabla, kesme tahtasında havuç, kâse. Duvara taşar. */
function drawCounter(): Pixels {
  const w = TILE * 3;
  const p = new Pixels(w, 26);
  p.fillRect(0, 12, w, 14, P.trunk);
  p.fillRect(2, 15, 13, 9, P.trunkLight);
  p.fillRect(17, 15, 13, 9, P.trunkLight);
  p.fillRect(32, 15, 14, 9, P.trunkLight);
  p.set(8, 19, P.flowerYellow);
  p.set(23, 19, P.flowerYellow);
  p.set(39, 19, P.flowerYellow);
  p.fillRect(0, 9, w, 4, STEEL);
  p.fillRect(0, 12, w, 1, STEEL_DARK);
  p.fillRect(5, 6, 12, 4, P.trunkLight);
  p.fillRect(7, 7, 6, 2, hex(0xf28c38));
  p.set(13, 7, P.grassLight);
  p.fillRect(24, 5, 9, 4, PAPER);
  p.fillRect(25, 4, 7, 1, PAPER);
  p.fillRect(38, 7, 6, 1, STEEL_DARK);
  p.outline(P.outline);
  return p;
}

/** Fırın: beyaz ocak, üstte iki göz, turuncu ışıklı fırın camı, düğmeler. Duvara taşar. */
function drawOven(): Pixels {
  const p = new Pixels(TILE, 28);
  p.fillRect(0, 8, 16, 20, STEEL);
  p.fillRect(0, 8, 16, 2, STEEL_DARK);
  p.fillRect(2, 6, 5, 2, SCREEN);
  p.fillRect(9, 6, 5, 2, SCREEN);
  p.fillRect(2, 11, 12, 1, STEEL_DARK);
  p.set(4, 11, P.flowerRed);
  p.set(8, 11, P.flowerRed);
  p.set(12, 11, P.flowerRed);
  p.fillRect(2, 14, 12, 9, SCREEN);
  p.fillRect(3, 15, 10, 7, GLOW);
  p.fillRect(4, 16, 4, 1, P.flowerYellow);
  p.fillRect(2, 24, 12, 1, STEEL_DARK);
  p.outline(P.outline);
  return p;
}

/** Su deposu: mavi varil, bantlar, alt musluk. Duvara taşar. */
function drawWaterTank(): Pixels {
  const p = new Pixels(TILE, 30);
  p.fillRect(2, 4, 12, 24, TANK);
  p.ellipse(8, 4, 6, 2.5, hex(0x7aa6f0));
  p.fillRect(2, 10, 12, 2, TANK_DARK);
  p.fillRect(2, 20, 12, 2, TANK_DARK);
  p.fillRect(4, 6, 2, 12, hex(0x7aa6f0));
  p.fillRect(12, 24, 3, 2, STEEL_DARK);
  p.fillRect(2, 28, 12, 2, TANK_DARK);
  p.outline(P.outline);
  return p;
}

/** Baharat rafı (duvarda): ahşap raf, renkli kavanozlar. Alt 3 satır süpürgelik için boş. */
function drawSpiceRack(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.fillRect(1, 10, 30, 2, P.trunkLight);
  p.fillRect(1, 12, 30, 1, P.trunk);
  const jars = [P.flowerRed, P.flowerYellow, P.grassDark, hex(0xf28c38), P.trunkLight, P.flowerWhite];
  jars.forEach((c, i) => {
    const x = 3 + i * 5;
    p.fillRect(x, 5, 3, 5, c);
    p.fillRect(x, 4, 3, 1, P.trunkDark);
  });
  p.outline(P.outline);
  return p;
}

/** Mama rafı: alçak ahşap raf, iki köpek kabı ve pati etiketli mama kutuları. */
function drawFoodShelf(): Pixels {
  const w = TILE * 2;
  const p = new Pixels(w, 22);
  p.fillRect(1, 8, 30, 14, P.trunk);
  p.fillRect(1, 14, 30, 1, P.trunkLight);
  p.fillRect(3, 16, 26, 5, P.trunkDark);
  p.fillRect(1, 7, 30, 2, P.trunkLight);
  p.ellipse(7, 5, 4, 2, P.flowerRed);
  p.ellipse(16, 5, 4, 2, P.flowerBlue);
  p.fillRect(22, 1, 4, 6, BURLAP);
  p.fillRect(27, 2, 3, 5, PAPER);
  p.set(23, 3, P.trunkDark);
  p.fillRect(5, 17, 5, 3, BURLAP);
  p.fillRect(13, 17, 5, 3, BURLAP);
  p.fillRect(21, 17, 5, 3, BURLAP);
  p.outline(P.outline);
  return p;
}

const MAT = hex(0x4fb3e8);
const CROSS = hex(0xe4514f);
const SEAT = hex(0x3f82dc);

/** Muayene masası: çelik ayaklı masa, mavi minder üstünde pati izi. */
function drawExamTable(): Pixels {
  const p = new Pixels(TILE * 2, 20);
  p.fillRect(3, 9, 3, 11, STEEL_DARK);
  p.fillRect(26, 9, 3, 11, STEEL_DARK);
  p.fillRect(3, 16, 26, 2, STEEL_DARK);
  p.fillRect(0, 6, 32, 4, STEEL);
  p.fillRect(2, 3, 28, 4, MAT);
  p.fillRect(2, 3, 28, 1, hex(0x93c7ea));
  p.fillRect(15, 4, 2, 2, PAPER);
  p.set(13, 3, PAPER);
  p.set(18, 3, PAPER);
  p.outline(P.outline);
  return p;
}

/** İlaç dolabı: beyaz dolap, cam kapakta ilaç şişeleri, kırmızı haç. Duvara taşar. */
function drawMedCabinet(): Pixels {
  const p = new Pixels(TILE, 30);
  p.fillRect(1, 0, 14, 30, PAPER);
  p.fillRect(13, 0, 2, 30, hex(0xd8d2c4));
  p.fillRect(3, 6, 10, 16, GLASS);
  p.fillRect(3, 13, 10, 1, STEEL_DARK);
  p.fillRect(4, 9, 2, 4, P.flowerRed);
  p.fillRect(7, 10, 2, 3, P.flowerYellow);
  p.fillRect(10, 9, 2, 4, P.grassDark);
  p.fillRect(5, 16, 2, 5, hex(0xa66bd6));
  p.fillRect(9, 17, 2, 4, PAPER);
  p.fillRect(7, 1, 2, 4, CROSS);
  p.fillRect(6, 2, 4, 2, CROSS);
  p.fillRect(3, 24, 10, 4, hex(0xd8d2c4));
  p.outline(P.outline);
  return p;
}

/** Resepsiyon: ahşap tezgâh, küçük ekran, zil. */
function drawReception(): Pixels {
  const p = new Pixels(TILE * 2, 24);
  p.fillRect(0, 10, 32, 14, P.trunk);
  p.fillRect(0, 10, 32, 3, P.trunkLight);
  p.fillRect(3, 15, 26, 1, P.trunkDark);
  p.fillRect(14, 17, 4, 4, CROSS);
  p.fillRect(15, 16, 2, 6, CROSS);
  p.fillRect(3, 2, 10, 7, SCREEN);
  p.fillRect(4, 3, 8, 5, GLASS);
  p.fillRect(7, 9, 3, 1, SCREEN);
  p.ellipse(24, 8, 3, 2, P.flowerYellow);
  p.set(24, 5, P.trunkDark);
  p.outline(P.outline);
  return p;
}

/** Bekleme sandalyeleri: iki mavi sandalye. */
function drawWaitChairs(): Pixels {
  const p = new Pixels(TILE * 2, 18);
  for (const x of [2, 18]) {
    p.fillRect(x, 1, 12, 8, SEAT);
    p.fillRect(x, 1, 12, 2, hex(0x7aa6f0));
    p.fillRect(x, 9, 12, 4, hex(0x2e63ad));
    p.fillRect(x + 1, 13, 2, 5, STEEL_DARK);
    p.fillRect(x + 9, 13, 2, 5, STEEL_DARK);
  }
  p.outline(P.outline);
  return p;
}

/** Röntgen panosu (duvarda): ışıklı kutuda köpek kemiği görüntüsü. Alt 3 satır süpürgelik için boş. */
function drawXray(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.fillRect(1, 1, 30, 11, STEEL_DARK);
  p.fillRect(2, 2, 28, 9, hex(0x24324a));
  p.fillRect(8, 6, 16, 1, GLASS_LIGHT);
  p.fillRect(6, 5, 3, 3, GLASS_LIGHT);
  p.fillRect(23, 5, 3, 3, GLASS_LIGHT);
  p.fillRect(12, 3, 1, 2, GLASS);
  p.fillRect(18, 8, 1, 2, GLASS);
  p.outline(P.outline);
  return p;
}

const STRAW = hex(0xe3c16f);
const STRAW_DARK = hex(0xb8953f);

/** Kuluçka tepsisi: ayaklı sehpa üstünde samanlı tepsi, üç yuva çukuru (yumurtalar sahnede ayrı çizilir). */
function drawTray(): Pixels {
  const p = new Pixels(TILE * 2, 20);
  p.fillRect(3, 11, 2, 9, P.trunk);
  p.fillRect(27, 11, 2, 9, P.trunk);
  p.fillRect(1, 9, 30, 3, P.trunkLight);
  p.fillRect(1, 4, 30, 5, STRAW);
  p.fillRect(1, 8, 30, 1, STRAW_DARK);
  for (const cx of [6, 16, 26]) p.ellipse(cx, 6, 4, 1.8, STRAW_DARK);
  p.outline(P.outline);
  return p;
}

/** Kuluçka makinesi: gövde, yeşil sıcaklık göstergesi, kadran ve havalandırma. Duvara taşar. */
function drawControlPanel(): Pixels {
  const p = new Pixels(TILE, 28);
  p.fillRect(1, 2, 14, 26, STEEL);
  p.fillRect(13, 2, 2, 26, STEEL_DARK);
  p.fillRect(3, 5, 9, 5, SCREEN);
  p.fillRect(4, 6, 2, 3, P.grassLight);
  p.fillRect(7, 6, 2, 3, P.grassLight);
  p.set(10, 8, P.grassLight);
  p.ellipse(7.5, 15, 2.5, 2.5, STEEL_DARK);
  p.set(8, 14, P.flowerRed);
  for (let y = 20; y < 26; y += 2) p.fillRect(3, y, 9, 1, STEEL_DARK);
  p.outline(P.outline);
  return p;
}

/** Isı lambası: ayaklı gövde, eğik başlık, turuncu-kırmızı ampul ışığı. Duvara taşar. */
function drawHeatLamp(): Pixels {
  const p = new Pixels(TILE, 30);
  p.fillRect(7, 8, 2, 20, STEEL_DARK);
  p.fillRect(4, 27, 8, 3, STEEL_DARK);
  p.fillRect(2, 2, 10, 5, SCREEN);
  p.fillRect(3, 7, 8, 2, hex(0xe4514f));
  p.fillRect(4, 9, 6, 1, GLOW);
  p.set(6, 10, P.flowerYellow);
  p.outline(P.outline);
  return p;
}

/** Malzeme rafı: saman balyası ve yumurta kolileri. */
function drawSupplies(): Pixels {
  const p = new Pixels(TILE, 26);
  p.fillRect(1, 2, 14, 24, P.trunk);
  p.fillRect(2, 10, 12, 1, P.trunkLight);
  p.fillRect(2, 18, 12, 1, P.trunkLight);
  p.fillRect(3, 4, 10, 6, STRAW);
  p.fillRect(3, 6, 10, 1, STRAW_DARK);
  p.fillRect(3, 13, 10, 5, hex(0xcdb977));
  for (const x of [4, 7, 10]) p.ellipse(x + 0.5, 14, 1.2, 1, PAPER);
  p.fillRect(3, 20, 10, 5, hex(0xcdb977));
  p.outline(P.outline);
  return p;
}
