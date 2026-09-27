import type { InteriorItemType } from '../sim/interior/Interiors';
import { Pixels, hex } from './Pixels';
import { P } from './palette';
import { TILE } from './TileArt';

/** İç mekân eşyalarının doku anahtarı. */
export function interiorItemTextureKey(type: InteriorItemType, variant = 0): string {
  return type === 'sacks' || type === 'chest' || type === 'ruinCabinet' || type === 'hearth' ? `int-${type}-${variant}` : `int-${type}`;
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
    case 'bulkSacks':
      return drawSackShelf(3);
    case 'shopCounter':
      return drawShopCounter();
    case 'crates':
      return drawCrates();
    case 'toyShelf':
      return drawToyShelf();
    case 'vitaminShelf':
      return drawMedCabinet();
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
    case 'kennelBoard':
      return drawKennelBoard();
    case 'dogBed':
      return drawDogBed();
    case 'blanket':
      return drawBlanket();
    case 'dogBowl':
      return drawDogBowl();
    case 'dogToy':
      return drawDogToy();
    case 'chest':
      return drawChest(variant);
    case 'ruinCabinet':
      return drawRuinCabinet(variant);
    case 'ruinDesk':
      return drawRuinDesk();
    case 'hearth':
      return drawHearth(variant);
    case 'brokenBed':
      return drawBrokenBed();
    case 'cobweb':
      return drawCobweb();
    case 'nestBoard':
      return drawNestBoard();
    case 'nestBed':
      return drawNestBed();
    case 'eggBasket':
      return drawEggBasket();
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
/** Yuva evi panosu (0.25.0): mantar pano, iki köpek kâğıdı, ortada kalp. */
function drawNestBoard(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.fillRect(1, 1, 30, 11, P.trunk);
  p.fillRect(2, 2, 28, 9, CORK);
  p.fillRect(4, 3, 7, 6, PAPER);
  p.fillRect(21, 3, 7, 6, PAPER);
  p.fillRect(5, 4, 5, 1, hex(0xbabcc1));
  p.fillRect(5, 6, 4, 1, hex(0xbabcc1));
  p.fillRect(22, 4, 5, 1, hex(0xbabcc1));
  p.fillRect(22, 6, 4, 1, hex(0xbabcc1));
  const h = P.flowerRed;
  p.fillRect(13, 4, 2, 1, h);
  p.fillRect(16, 4, 2, 1, h);
  p.fillRect(12, 5, 7, 1, h);
  p.fillRect(13, 6, 5, 1, h);
  p.fillRect(14, 7, 3, 1, h);
  p.set(15, 8, h);
  p.outline(P.outline);
  return p;
}

/** Yuva yatağı (0.25.0): pembe kenarlı minder, ortada kalp (2 kare). */
function drawNestBed(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  const rim = hex(0xd97aa0);
  const rimDark = hex(0xa8567a);
  const rimLight = hex(0xf0a3c2);
  const cushion = hex(0xfbe7ee);
  const cushionDark = hex(0xefcbd8);
  p.ellipse(16, 9, 14.5, 6, rimDark);
  p.ellipse(16, 8, 14.5, 6, rim);
  p.ellipse(16, 7, 13, 4.5, rimLight);
  p.ellipse(16, 8.5, 11, 3.8, cushionDark);
  p.ellipse(16, 8, 10, 3, cushion);
  p.fillRect(8, 12, 16, 1, rimDark);
  p.set(15, 7, P.flowerRed);
  p.set(17, 7, P.flowerRed);
  p.fillRect(15, 8, 3, 1, P.flowerRed);
  p.set(16, 9, P.flowerRed);
  p.outline(P.outline);
  return p;
}

/** Yumurta sepeti (0.25.0): kulplu hasır sepet, içinde saman; yumurta ayrı sprite olarak üstüne çizilir. */
function drawEggBasket(): Pixels {
  const p = new Pixels(TILE, 15);
  p.fillRect(5, 1, 6, 1, WICKER);
  p.fillRect(4, 2, 1, 3, WICKER);
  p.fillRect(11, 2, 1, 3, WICKER);
  p.fillRect(2, 5, 12, 9, WICKER);
  p.fillRect(2, 5, 12, 1, WICKER_LIGHT);
  p.fillRect(2, 13, 12, 1, WICKER_DARK);
  p.fillRect(3, 6, 10, 2, P.flowerYellow);
  p.fillRect(4, 7, 8, 1, hex(0xd9b34a));
  p.outline(P.outline);
  return p;
}

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

/** Dükkân tezgâhı (3 kare): tahta ön yüz, tabla, terazi, kasa ve fiyat kâğıdı. */
function drawShopCounter(): Pixels {
  const w = TILE * 3;
  const p = new Pixels(w, 24);
  p.fillRect(0, 10, w, 14, P.trunk);
  for (let x = 4; x < w; x += 8) p.fillRect(x, 12, 1, 12, P.trunkDark);
  p.fillRect(0, 8, w, 3, P.trunkLight);
  p.fillRect(5, 3, 10, 2, STEEL_DARK);
  p.fillRect(9, 5, 2, 3, STEEL_DARK);
  p.fillRect(4, 1, 5, 2, BURLAP);
  p.fillRect(30, 2, 10, 6, SCREEN);
  p.fillRect(31, 3, 8, 2, P.grassLight);
  p.fillRect(20, 4, 6, 4, PAPER);
  p.fillRect(21, 5, 4, 1, hex(0xbabcc1));
  p.outline(P.outline);
  return p;
}

/** Üst üste iki tahta kasa. */
function drawCrates(): Pixels {
  const p = new Pixels(TILE, 22);
  for (const [y, h] of [
    [12, 10],
    [3, 9],
  ] as const) {
    p.fillRect(1, y, 14, h, P.trunkLight);
    p.fillRect(1, y, 14, 1, P.trunk);
    p.fillRect(1, y + h - 1, 14, 1, P.trunk);
    p.fillRect(4, y + 1, 1, h - 2, P.trunk);
    p.fillRect(11, y + 1, 1, h - 2, P.trunk);
  }
  p.set(7, 6, BURLAP_DARK);
  p.set(8, 16, BURLAP_DARK);
  p.outline(P.outline);
  return p;
}

/** Oyuncak rafı (2 kare): renkli toplar, halat, kemik, peluş ve kutu. */
function drawToyShelf(): Pixels {
  const w = TILE * 2;
  const p = new Pixels(w, 30);
  p.fillRect(1, 2, w - 2, 28, P.trunk);
  p.fillRect(2, 11, w - 4, 1, P.trunkLight);
  p.fillRect(2, 20, w - 4, 1, P.trunkLight);
  p.ellipse(7, 7, 3, 3, P.flowerRed);
  p.ellipse(16, 7, 3, 3, P.flowerYellow);
  p.ellipse(25, 7, 3, 3, hex(0x5aa0e6));
  p.fillRect(4, 15, 10, 3, hex(0xe8d5a8));
  p.fillRect(4, 16, 10, 1, hex(0xc9a86a));
  p.fillRect(19, 15, 8, 3, PAPER);
  for (const [x, y] of [
    [19, 15],
    [19, 18],
    [27, 15],
    [27, 18],
  ] as const)
    p.ellipse(x, y, 1.5, 1.5, PAPER);
  p.fillRect(5, 24, 7, 5, hex(0xb07a4f));
  p.ellipse(8.5, 23, 3, 2.5, hex(0xb07a4f));
  p.fillRect(18, 23, 9, 6, hex(0xa66bd6));
  p.fillRect(18, 25, 9, 1, PAPER);
  p.outline(P.outline);
  return p;
}

// Kulübe içi (0.22.3).
const PAW = hex(0x6b4a2e);
const BED_RIM = hex(0xc0603f);
const BED_RIM_DARK = hex(0x96452c);
const BED_RIM_LIGHT = hex(0xdc8a5e);
const CUSHION = hex(0xf2e2c4);
const CUSHION_DARK = hex(0xdcc7a0);
const WICKER = hex(0xc99a5b);
const WICKER_DARK = hex(0x9c7240);
const WICKER_LIGHT = hex(0xe0b878);
const PLAID = hex(0xc0443c);
const PLAID_DARK = hex(0x7e2a2a);
const PLAID_LIGHT = hex(0xe07a62);
const BOWL = hex(0x3f82dc);
const BOWL_DARK = hex(0x2e63ad);
const BOWL_LIGHT = hex(0x7aa6f0);

/** Kulübe panosu (duvarda): mantar pano, pati izli kâğıt, kemik biçimli not ve küçük köpek fotoğrafı. Alt 3 satır boş. */
function drawKennelBoard(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.fillRect(1, 1, 30, 11, P.trunk);
  p.fillRect(2, 2, 28, 9, CORK);
  p.fillRect(3, 9, 26, 1, CORK_DARK);
  // Pati izli kâğıt: taban ve dört parmak.
  p.fillRect(4, 3, 8, 7, PAPER);
  p.ellipse(8.5, 7.5, 2, 1.5, PAW);
  for (const [x, y] of [
    [5, 5],
    [7, 4],
    [9, 4],
    [11, 5],
  ] as const)
    p.set(x, y, PAW);
  // Kemik biçimli not.
  p.fillRect(15, 5, 6, 2, P.flowerYellow);
  for (const [x, y] of [
    [14, 4],
    [14, 7],
    [21, 4],
    [21, 7],
  ] as const)
    p.set(x, y, P.flowerYellow);
  // Fotoğraf: gökyüzü, çimen, köpek; kırmızı raptiye.
  p.fillRect(23, 3, 6, 6, PAPER);
  p.fillRect(24, 4, 4, 3, hex(0xa3d5e9));
  p.fillRect(24, 7, 4, 1, P.grassLight);
  p.fillRect(25, 6, 2, 1, P.trunkLight);
  p.set(26, 5, P.trunkLight);
  p.set(25, 2, P.flowerRed);
  p.outline(P.outline);
  return p;
}

/** Köpek yatağı (2 kare): kalın kenarlı oval minder, ortası çukur. Köpek sahnede üstüne yatırılır. */
function drawDogBed(): Pixels {
  const p = new Pixels(TILE * 2, TILE);
  p.ellipse(16, 9, 14.5, 6, BED_RIM_DARK);
  p.ellipse(16, 8, 14.5, 6, BED_RIM);
  p.ellipse(16, 7, 13, 4.5, BED_RIM_LIGHT);
  p.ellipse(16, 8.5, 11, 3.8, CUSHION_DARK);
  p.ellipse(16, 8, 10, 3, CUSHION);
  p.fillRect(8, 12, 16, 1, BED_RIM_DARK);
  p.outline(P.outline);
  return p;
}

/** Battaniye: hasır sepette katlanmış ekose battaniye (kırmızı, koyu çizgili, sarı şerit). */
function drawBlanket(): Pixels {
  const p = new Pixels(TILE, 15);
  p.fillRect(2, 1, 12, 7, PLAID);
  p.fillRect(2, 1, 12, 1, PLAID_LIGHT);
  p.fillRect(2, 4, 12, 1, PLAID_DARK);
  p.fillRect(5, 1, 1, 7, PLAID_DARK);
  p.fillRect(10, 1, 1, 7, PLAID_DARK);
  p.fillRect(2, 6, 12, 1, P.flowerYellow);
  p.fillRect(1, 7, 14, 8, WICKER);
  p.fillRect(1, 7, 14, 1, WICKER_LIGHT);
  for (let x = 3; x < 14; x += 3) p.fillRect(x, 9, 1, 5, WICKER_DARK);
  p.fillRect(1, 11, 14, 1, WICKER_DARK);
  p.outline(P.outline);
  return p;
}

/** Su kabı: yerde mavi kap, içinde su ve parıltı. */
function drawDogBowl(): Pixels {
  const p = new Pixels(TILE, 10);
  p.ellipse(8, 6.5, 6.5, 3, BOWL_DARK);
  p.fillRect(2, 4, 12, 3, BOWL);
  p.ellipse(8, 4, 6.5, 2.2, BOWL_LIGHT);
  p.ellipse(8, 4, 4.8, 1.3, P.water);
  p.fillRect(5, 3, 2, 1, P.foam);
  p.fillRect(6, 6, 4, 1, PAPER);
  p.outline(P.outline);
  return p;
}

/** Oyuncak sepeti: hasır sepetten taşan kırmızı top, beyaz kemik ve halat. */
function drawDogToy(): Pixels {
  const p = new Pixels(TILE, 16);
  // Halat (arkada, dik).
  p.fillRect(10, 1, 2, 8, hex(0xe8d5a8));
  for (let y = 2; y < 9; y += 2) p.set(10, y, hex(0xc9a86a));
  p.fillRect(9, 0, 4, 2, hex(0x5aa0e6));
  // Kemik.
  p.fillRect(3, 4, 6, 2, PAPER);
  p.ellipse(3, 4, 1.4, 1.4, PAPER);
  p.ellipse(3, 6, 1.4, 1.4, PAPER);
  p.ellipse(9, 4, 1.4, 1.4, PAPER);
  p.ellipse(9, 6, 1.4, 1.4, PAPER);
  // Top.
  p.ellipse(6, 8, 3, 3, P.flowerRed);
  p.set(5, 6, P.flowerWhite);
  // Sepet.
  p.fillRect(1, 9, 14, 7, WICKER);
  p.fillRect(1, 9, 14, 1, WICKER_LIGHT);
  for (let x = 3; x < 14; x += 3) p.fillRect(x, 11, 1, 4, WICKER_DARK);
  p.fillRect(1, 13, 14, 1, WICKER_DARK);
  p.outline(P.outline);
  return p;
}

// --- Terk edilmiş ev (0.23.2) ---
const OLD_WOOD = hex(0x6f5a44);
const OLD_WOOD_DARK = hex(0x4f3f30);
const OLD_WOOD_LIGHT = hex(0x8a735a);
const IRON = hex(0x5b5f68);
const SOOT = hex(0x2f2b2e);
const ASH = hex(0x9a9794);
const WEB = hex(0xdcdce4);
const HOLLOW = hex(0x2a211a);

/** Sandık: 0 kapalı ve kilitli; 1 açık, dipte yumurta; 2 (ve üstü) açık ve boş. Kapak açıkken arkaya devrik. */
function drawChest(state: number): Pixels {
  const p = new Pixels(TILE, 20);
  if (state === 0) {
    p.fillRect(1, 9, 14, 10, P.trunk);
    p.fillRect(1, 4, 14, 5, P.trunkLight);
    p.fillRect(2, 5, 12, 1, hex(0xb38352));
    p.fillRect(1, 9, 14, 1, P.trunkDark);
    for (const x of [3, 11]) p.fillRect(x, 4, 2, 15, IRON);
    p.fillRect(7, 9, 2, 3, GOLD);
    p.set(7, 11, P.trunkDark);
  } else {
    p.fillRect(1, 0, 14, 6, P.trunkLight);
    p.fillRect(2, 1, 12, 1, hex(0xb38352));
    for (const x of [3, 11]) p.fillRect(x, 0, 2, 6, IRON);
    p.fillRect(1, 6, 14, 1, P.trunkDark);
    p.fillRect(1, 7, 14, 4, HOLLOW);
    if (state === 1) {
      p.ellipse(8, 8.5, 2.5, 2, P.eggYellow);
      p.set(7, 8, P.eggSpot);
    }
    p.fillRect(1, 11, 14, 8, P.trunk);
    p.fillRect(1, 11, 14, 1, P.trunkDark);
    for (const x of [3, 11]) p.fillRect(x, 11, 2, 8, IRON);
  }
  p.outline(P.outline);
  return p;
}

/** Yıpranmış dolap (duvara taşar): kapalıyken çatlak kapaklar; açıkken boş askılar ve eski bir palto. */
function drawRuinCabinet(open: number): Pixels {
  const p = new Pixels(TILE, 28);
  p.fillRect(0, 0, 16, 26, OLD_WOOD);
  p.fillRect(0, 0, 16, 2, OLD_WOOD_LIGHT);
  p.fillRect(15, 2, 1, 24, OLD_WOOD_DARK);
  if (open === 0) {
    p.fillRect(2, 3, 5, 22, OLD_WOOD_LIGHT);
    p.fillRect(9, 3, 5, 22, OLD_WOOD_LIGHT);
    p.fillRect(7, 3, 2, 22, OLD_WOOD_DARK);
    p.set(6, 14, GOLD);
    p.set(9, 14, GOLD);
    p.line(3, 7, 5, 12, OLD_WOOD_DARK);
    p.line(11, 17, 12, 21, OLD_WOOD_DARK);
  } else {
    p.fillRect(2, 3, 12, 22, HOLLOW);
    p.fillRect(3, 6, 10, 1, OLD_WOOD_DARK);
    p.set(4, 7, METAL);
    p.set(6, 7, METAL);
    p.fillRect(8, 7, 4, 12, hex(0x5a6b4e));
    p.fillRect(8, 7, 4, 1, hex(0x44523b));
    p.fillRect(9, 12, 2, 1, hex(0x44523b));
  }
  p.fillRect(1, 26, 2, 2, OLD_WOOD_DARK);
  p.fillRect(13, 26, 2, 2, OLD_WOOD_DARK);
  p.outline(P.outline);
  return p;
}

/** Eski masa (2 kare): üstünde deri kaplı günlük, sönmüş mum, dağınık kâğıt; bir ayağı takozlu. */
function drawRuinDesk(): Pixels {
  const w = TILE * 2;
  const p = new Pixels(w, 26);
  const top = 12;
  p.fillRect(0, top, w, 3, OLD_WOOD_LIGHT);
  p.fillRect(0, top + 2, w, 1, OLD_WOOD_DARK);
  p.fillRect(2, top + 3, 3, 11, OLD_WOOD);
  p.fillRect(w - 5, top + 3, 3, 8, OLD_WOOD);
  p.fillRect(w - 6, top + 11, 5, 3, P.rock);
  p.fillRect(7, top + 3, 12, 5, OLD_WOOD);
  p.fillRect(8, top + 4, 10, 1, OLD_WOOD_DARK);
  p.set(12, top + 6, GOLD);
  // Günlük: kahverengi deri kapak, kayış ve toka.
  p.fillRect(3, top - 5, 11, 5, hex(0x7a4a2a));
  p.fillRect(3, top - 5, 11, 1, hex(0x94603a));
  p.fillRect(4, top - 1, 9, 1, PAPER);
  p.fillRect(10, top - 5, 1, 5, hex(0x4e2e19));
  p.set(10, top - 3, GOLD);
  // Mum ve kâğıt.
  p.fillRect(24, top - 6, 3, 6, PAPER);
  p.set(25, top - 7, SOOT);
  p.fillRect(23, top - 1, 5, 1, hex(0xe8e2d4));
  p.fillRect(16, top - 2, 5, 2, hex(0xe8e2d4));
  p.outline(P.outline);
  return p;
}

/** Ocak (2 kare, duvara yaslı): taş örgü, rafı, isli ağız, kül ve kütükler; `lit` (orman evi, 0.23.3) alevli. */
function drawHearth(lit = 0): Pixels {
  const w = TILE * 2;
  const h = 30;
  const p = new Pixels(w, h);
  p.fillRect(3, 0, w - 6, h, P.rock);
  for (let row = 0; row * 5 + 2 < h - 2; row++) {
    for (let x = 4 + (row % 2) * 3; x < w - 6; x += 7) p.fillRect(x, row * 5 + 2, 5, 3, P.rockLight);
  }
  p.fillRect(0, 11, w, 3, OLD_WOOD);
  p.fillRect(0, 11, w, 1, OLD_WOOD_LIGHT);
  p.fillRect(8, 16, w - 16, h - 16, SOOT);
  p.fillRect(9, 14, w - 18, 2, hex(0x4a4547));
  p.fillRect(9, h - 3, w - 18, 2, ASH);
  p.fillRect(11, h - 5, 10, 2, P.trunkDark);
  p.fillRect(13, h - 7, 7, 2, P.trunk);
  if (lit > 0) {
    p.ellipse(16, h - 9, 5, 4, hex(0xf08a2c));
    p.ellipse(16, h - 9.5, 3, 3.2, P.flowerYellow);
    p.set(12, h - 12, hex(0xf08a2c));
    p.set(19, h - 13, P.flowerYellow);
    p.fillRect(9, h - 3, w - 18, 1, hex(0xf0b060));
  }
  p.outline(P.outline);
  return p;
}

/** Kırık yatak (dikey, 2 kare): solmuş şilte, yırtık, çökmüş ayak ucu, dökülen saman. */
function drawBrokenBed(): Pixels {
  const h = TILE * 2 + 2;
  const p = new Pixels(TILE, h);
  p.fillRect(0, 0, 16, 6, OLD_WOOD);
  p.fillRect(1, 1, 14, 2, OLD_WOOD_LIGHT);
  p.fillRect(1, 6, 14, h - 7, OLD_WOOD_DARK);
  p.fillRect(2, 6, 12, h - 9, hex(0xc9bfa6));
  p.fillRect(3, 7, 10, 4, hex(0xb3a88d));
  p.line(3, 14, 12, 21, hex(0x8f8266));
  p.fillRect(2, h - 11, 12, 7, hex(0x9c8f72));
  p.set(5, h - 8, P.sandLight);
  p.set(9, h - 7, P.sandLight);
  p.set(11, h - 9, P.sandLight);
  p.fillRect(12, h - 4, 3, 3, OLD_WOOD_DARK);
  p.outline(P.outline);
  return p;
}

/** Örümcek ağı (duvarda): köşeden açılan teller ve halkalar, küçük örümcek. */
function drawCobweb(): Pixels {
  const p = new Pixels(TILE, TILE);
  for (const [x, y] of [
    [14, 1],
    [11, 8],
    [4, 13],
  ]) {
    p.line(0, 0, x, y, WEB);
  }
  for (const r of [4, 8, 12]) {
    for (let a = 0; a <= 90; a += 12) {
      const rad = (a * Math.PI) / 180;
      p.set(Math.round(r * Math.cos(rad)), Math.round(r * Math.sin(rad)), WEB);
    }
  }
  p.set(8, 9, SOOT);
  p.set(8, 10, SOOT);
  p.line(8, 5, 8, 8, WEB);
  return p;
}
