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
  }
}

/** Ofis masası: ahşap tabla, çekmeceler, üstünde bilgisayar ve kâğıtlar (2 kare genişlik). */
function drawDesk(): Pixels {
  const w = TILE * 2;
  const h = 28;
  const p = new Pixels(w, h);
  const top = 12;
  // Bacaklar ve ön panel.
  p.fillRect(2, top + 4, 28, 10, P.trunk);
  p.fillRect(2, top + 4, 28, 1, P.trunkDark);
  p.fillRect(4, top + 6, 9, 3, P.trunkLight);
  p.fillRect(4, top + 10, 9, 3, P.trunkLight);
  p.fillRect(8, top + 7, 2, 1, P.flowerYellow);
  p.fillRect(8, top + 11, 2, 1, P.flowerYellow);
  p.fillRect(26, top + 5, 3, 11, P.trunkDark);
  // Tabla.
  p.fillRect(0, top, w, 4, P.trunkLight);
  p.fillRect(0, top + 3, w, 1, P.trunk);
  // Bilgisayar: ekran, ayak, klavye.
  p.fillRect(15, 1, 13, 10, hex(0x3b4664));
  p.fillRect(16, 2, 11, 7, hex(0x7ec4e8));
  p.fillRect(17, 3, 5, 1, hex(0xd9edf8));
  p.fillRect(17, 5, 7, 1, hex(0xb3dcf0));
  p.fillRect(20, 11, 3, 1, hex(0x3b4664));
  p.fillRect(14, top + 1, 12, 2, hex(0xdcdce4));
  // Kâğıtlar ve kalem kutusu.
  p.fillRect(3, top - 2, 8, 3, P.flowerWhite);
  p.fillRect(4, top - 3, 7, 1, hex(0xe8e2d4));
  p.fillRect(28, top - 4, 3, 5, hex(0x3f82dc));
  p.fillRect(28, top - 6, 1, 2, P.flowerRed);
  p.fillRect(30, top - 6, 1, 2, P.flowerYellow);
  p.outline(P.outline);
  return p;
}
