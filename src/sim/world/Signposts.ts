import { BALANCE } from '../../config/balance';
import type { TilePos, TileWorld } from './TileWorld';
import { Biome, Obj } from './tiles';

/** Yol tabelaları (0.20.3). */
export type SignId = 'shelter' | 'east' | 'village';

export const SIGN_NAMES_TR: Record<SignId, string> = {
  shelter: 'Barınak',
  east: 'Doğu yolu',
  village: 'Köy',
};

export interface Signpost {
  id: SignId;
  x: number;
  y: number;
}

const free = (world: TileWorld, x: number, y: number): boolean => world.inBounds(x, y) && !world.isSolid(x, y);

/** Sütundaki yol şeridinin üst ve alt satırı (doğu yolu yataydır). */
function roadRows(world: TileWorld, x: number): [number, number] | null {
  for (let y = 0; y < world.height; y++) {
    if (world.biome[world.idx(x, y)] !== Biome.Road) continue;
    let y1 = y;
    while (y1 + 1 < world.height && world.biome[world.idx(x, y1 + 1)] === Biome.Road) y1++;
    return [y, y1];
  }
  return null;
}

/**
 * Tabelalar: barınağın güney kapısının hemen dışında (arsa büyüyünce kapıyla taşınır), doğu yolunun arsanın hiç
 * ulaşamayacağı ucunda ve köy girişinde. RNG yok; dünyadan ve arsadan hesaplanır, kaydedilmez. Tabela katı değildir: yanında
 * durup E ile hızlı seyahat paneli açılır.
 */
export function signposts(world: TileWorld): Signpost[] {
  const out: Signpost[] = [];
  const p = world.plot;
  const bottom = p.y + p.h - 1;
  let gx = -1;
  for (let x = p.x; x < p.x + p.w && gx < 0; x++) if (world.objectAt(x, bottom) === Obj.Gate) gx = x;
  if (gx < 0) gx = Math.floor(p.x + p.w / 2);
  let gx2 = gx;
  while (world.objectAt(gx2 + 1, bottom) === Obj.Gate) gx2++;
  const shelterCands: TilePos[] = [
    { x: gx2 + 1, y: bottom + 1 },
    { x: gx - 1, y: bottom + 1 },
    { x: gx2 + 1, y: bottom + 2 },
    { x: gx - 1, y: bottom + 2 },
  ];
  const shelter = shelterCands.find((c) => free(world, c.x, c.y)) ?? shelterCands[0];
  out.push({ id: 'shelter', x: shelter.x, y: shelter.y });

  // Doğu yolu: arsanın en büyük hâlinin hemen doğusunda, yolun üstündeki ya da altındaki ilk boş kare; yol dağ arasından
  // geçiyorsa tabela yolun üst şeridinde durur (katı değildir, varış alt şeritte).
  const maxRight = Math.max(BALANCE.world.plot.x, p.x) + BALANCE.world.plotMaxW + 1;
  let east: Signpost | null = null;
  let fallback: Signpost | null = null;
  for (let x = maxRight; x < world.width - 6 && !east; x++) {
    const rows = roadRows(world, x);
    if (!rows) continue;
    fallback ??= { id: 'east', x, y: rows[0] };
    for (const y of [rows[0] - 1, rows[1] + 1]) {
      if (!east && free(world, x, y)) east = { id: 'east', x, y };
    }
  }
  const eastSign = east ?? fallback;
  if (eastSign) out.push(eastSign);

  const v = world.village;
  if (v) out.push({ id: 'village', x: v.x + 13, y: v.y });
  return out;
}

/** Tabela keşfedildi mi (keşif haritasında görüldü). */
export function signKnown(world: TileWorld, s: Signpost): boolean {
  return world.explored[world.idx(s.x, s.y)] !== 0;
}

/** (x, y) noktasının yakınındaki bilinen tabela. */
export function signAt(world: TileWorld, x: number, y: number, reach = 0.8): Signpost | null {
  let best: Signpost | null = null;
  let bestD = reach;
  for (const s of signposts(world)) {
    if (!signKnown(world, s)) continue;
    const d = Math.hypot(s.x + 0.5 - x, s.y + 0.5 - y);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Varış karesi: tabelanın önü (altı), olmazsa yanları. */
export function landingTile(world: TileWorld, s: Signpost): TilePos {
  for (const [dx, dy] of [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ] as const) {
    if (free(world, s.x + dx, s.y + dy)) return { x: s.x + dx, y: s.y + dy };
  }
  return { x: s.x, y: s.y };
}

/** Yol süresi (oyun dakikası): kuş uçuşu uzaklık × kare başına dakika; bisikletle kısa. */
export function travelMinutes(a: Signpost, b: Signpost, bicycle: boolean): number {
  const T = BALANCE.travel;
  return Math.max(T.minMinutes, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * T.minutesPerTile * (bicycle ? T.bicycleMul : 1)));
}
