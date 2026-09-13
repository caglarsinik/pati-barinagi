import { NEIGHBORS4, type TilePos, type TileWorld } from './TileWorld';
import { Obj } from './tiles';

/** Kapının arsa çitinin hangi kenarında olduğu; iç çitlerdeki kapı `inner`. */
export type GateSide = 'north' | 'south' | 'east' | 'west' | 'inner';

/** Bitişik kapı kareleri tek grup (başlangıç kapıları 2 kare geniştir). */
export function gateGroups(world: TileWorld): TilePos[][] {
  const tiles = world.gateTiles();
  const all = new Set(tiles.map((t) => world.idx(t.x, t.y)));
  const seen = new Set<number>();
  const groups: TilePos[][] = [];
  for (const t of tiles) {
    const i = world.idx(t.x, t.y);
    if (seen.has(i)) continue;
    seen.add(i);
    const group: TilePos[] = [];
    const stack: TilePos[] = [t];
    while (stack.length > 0) {
      const c = stack.pop()!;
      group.push(c);
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (!world.inBounds(nx, ny)) continue;
        const ni = world.idx(nx, ny);
        if (all.has(ni) && !seen.has(ni)) {
          seen.add(ni);
          stack.push({ x: nx, y: ny });
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export function gateSide(world: TileWorld, g: TilePos): GateSide {
  const p = world.plot;
  if (g.y === p.y + p.h - 1) return 'south';
  if (g.y === p.y) return 'north';
  if (g.x === p.x + p.w - 1) return 'east';
  if (g.x === p.x) return 'west';
  return 'inner';
}

const OUTWARD: Record<GateSide, readonly [number, number]> = {
  south: [0, 1],
  north: [0, -1],
  east: [1, 0],
  west: [-1, 0],
  inner: [0, 0],
};

function step(world: TileWorld, g: TilePos, sign: 1 | -1): TilePos {
  const [dx, dy] = OUTWARD[gateSide(world, g)];
  const c = { x: g.x + dx * sign, y: g.y + dy * sign };
  return world.inBounds(c.x, c.y) && !world.isSolid(c.x, c.y) ? c : g;
}

/** Kapının hemen dışındaki yürünebilir kare (yoksa kapının kendisi). */
export function outsideOf(world: TileWorld, g: TilePos): TilePos {
  return step(world, g, 1);
}

/** Kapının hemen içindeki yürünebilir kare (yoksa kapının kendisi). */
export function insideOf(world: TileWorld, g: TilePos): TilePos {
  return step(world, g, -1);
}

/** Arsa çitindeki ilk kapı karesi: sahiplenici doğuyu, personel güneyi tercih eder. */
export function findGate(world: TileWorld, prefer: 'east' | 'south'): TilePos | null {
  const p = world.plot;
  const east = (): TilePos | null => {
    const right = p.x + p.w - 1;
    for (let y = p.y; y < p.y + p.h; y++) if (world.objectAt(right, y) === Obj.Gate) return { x: right, y };
    return null;
  };
  const south = (): TilePos | null => {
    const bottom = p.y + p.h - 1;
    for (let x = p.x; x < p.x + p.w; x++) if (world.objectAt(x, bottom) === Obj.Gate) return { x, y: bottom };
    return null;
  };
  return prefer === 'east' ? (east() ?? south()) : (south() ?? east());
}

export interface GateEntry {
  gate: TilePos;
  outside: TilePos;
  inside: TilePos;
}

/** Gelen/giden NPC'ler için giriş noktası: kapı, dış kare ve iç kare. Kapı yoksa null. */
export function entryPoint(world: TileWorld, prefer: 'east' | 'south'): GateEntry | null {
  const gate = findGate(world, prefer);
  if (!gate) return null;
  return { gate, outside: outsideOf(world, gate), inside: insideOf(world, gate) };
}
