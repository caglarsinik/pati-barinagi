import { EMOTE_KEYS, type Emote } from '../sim/systems/Emotes';
import { Pixels, type RGBA, TRANSPARENT, hex } from './Pixels';

/** Balon karesi (piksel). 10×10 balon + 1 px dış çizgi. */
export const EMOTE_SIZE = 12;
export const EMOTE_TEX = 'emotes';

const BUBBLE = hex(0xf8f4ec);
const OUTLINE = hex(0x24203a);

const COLORS: Record<string, RGBA> = {
  H: hex(0xe95f7a), // kalp
  Z: hex(0x3b4664), // zzz
  B: hex(0xf0e3b0), // kemik
  W: hex(0x3d7ec6), // su
  L: hex(0x93c7ea),
  P: hex(0x7d5836), // pislik
  G: hex(0x9a9aa8), // cam / gri
  R: hex(0xe4514f), // kırmızı
  N: hex(0xa66bd6), // nota
  T: hex(0x7e522d), // pati
  M: hex(0x62646a), // alet
  Q: hex(0x3f82dc), // soru
};

/** 8×8 ikonlar; '.' saydam, harf renk. */
const ICONS: Record<Emote, string[]> = {
  heart: ['........', '.HH..HH.', 'HHHHHHHH', 'HHHHHHHH', '.HHHHHH.', '..HHHH..', '...HH...', '........'],
  zzz: ['ZZZZ....', '...Z....', '..Z.....', '.Z...ZZZ', 'ZZZZ..Z.', '.....Z..', '.....ZZZ', '........'],
  bone: ['........', '........', 'BB....BB', 'BBBBBBBB', 'BBBBBBBB', 'BB....BB', '........', '........'],
  drop: ['...W....', '...W....', '..WWW...', '..WWW...', '.WWWWW..', '.WLWWW..', '.WWWWW..', '..WWW...'],
  poop: ['........', '...PP...', '..PPP...', '...PPP..', '..PPPPP.', '.PPPPPPP', '.PPPPPPP', '..PPPPP.'],
  thermo: ['...GG...', '...GW...', '...GW...', '...GR...', '...GR...', '..GRRG..', '..GRRG..', '...GG...'],
  alert: ['...RR...', '...RR...', '...RR...', '...RR...', '...RR...', '........', '...RR...', '...RR...'],
  note: ['....NN..', '....N.N.', '....N..N', '....N...', '....N...', '..NNN...', '.NNNN...', '..NN....'],
  paw: ['........', '.T.T.T..', '.T.T.T..', '........', '..TTT...', '.TTTTT..', '.TTTTT..', '..TTT...'],
  tool: ['.....MMM', '.....M.M', '....MMMM', '...MM...', '..MM....', '.MM.....', 'MM......', '........'],
  question: ['..QQQQ..', '.QQ..QQ.', '.....QQ.', '....QQ..', '...QQ...', '...QQ...', '........', '...QQ...'],
};

/** Tek balon: yuvarlak köşeli beyaz zemin, ortada ikon, dış çizgi. */
export function drawEmote(kind: Emote): Pixels {
  const p = new Pixels(EMOTE_SIZE, EMOTE_SIZE);
  p.fillRect(1, 1, 10, 10, BUBBLE);
  for (const [x, y] of [
    [1, 1],
    [10, 1],
    [1, 10],
    [10, 10],
  ]) {
    p.set(x, y, TRANSPARENT);
  }
  const rows = ICONS[kind];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const c = rows[y][x];
      if (c !== '.') p.set(x + 2, y + 2, COLORS[c]);
    }
  }
  p.outline(OUTLINE);
  return p;
}

/** Tüm emote'lar tek satırda, EMOTE_KEYS sırasıyla. */
export function buildEmoteSheet(): Pixels {
  const sheet = new Pixels(EMOTE_SIZE * EMOTE_KEYS.length, EMOTE_SIZE);
  EMOTE_KEYS.forEach((k, i) => sheet.blit(drawEmote(k), i * EMOTE_SIZE, 0));
  return sheet;
}

export function emoteFrame(kind: Emote): number {
  return EMOTE_KEYS.indexOf(kind);
}
