import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import type { TileWorld } from '../../src/sim/world/TileWorld';
import { generateWorld } from '../../src/sim/world/WorldGen';
import { Biome, Ground, OBJ_INFO, Obj } from '../../src/sim/world/tiles';

/** Doğuş noktasından yürüyerek ulaşılabilen kareler. */
function reachable(world: TileWorld): Uint8Array {
  const seen = new Uint8Array(world.width * world.height);
  const sx = Math.floor(world.spawn.x);
  const sy = Math.floor(world.spawn.y);
  const stack = [world.idx(sx, sy)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % world.width;
    const y = Math.floor(i / world.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.inBounds(nx, ny) || world.isSolid(nx, ny)) continue;
      const j = world.idx(nx, ny);
      if (seen[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

describe('generateWorld', () => {
  const world = generateWorld(12345);

  it('deterministik', () => {
    const again = generateWorld(12345);
    expect(again.ground).toEqual(world.ground);
    expect(again.object).toEqual(world.object);
    expect(again.nests).toEqual(world.nests);
    const other = generateWorld(999);
    expect(other.ground).not.toEqual(world.ground);
  });

  it('arsa temiz, düz ve yürünebilir', () => {
    const p = world.plot;
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        expect(world.biomeAt(x, y)).toBe(Biome.Plot);
        expect(world.groundAt(x, y)).toBe(Ground.Plot);
        expect(world.objectAt(x, y)).toBe(Obj.None);
        expect(world.isSolid(x, y)).toBe(false);
      }
    }
    expect(world.isSolid(Math.floor(world.spawn.x), Math.floor(world.spawn.y))).toBe(false);
  });

  it('yollar harita kenarına ulaşır ve yürünebilir', () => {
    const seen = reachable(world);
    let bottom = false;
    let right = false;
    for (let x = 0; x < world.width; x++) if (seen[world.idx(x, world.height - 1)]) bottom = true;
    for (let y = 0; y < world.height; y++) if (seen[world.idx(world.width - 1, y)]) right = true;
    expect(bottom).toBe(true);
    expect(right).toBe(true);
  });

  it('kenar halkası dağ', () => {
    for (let x = 0; x < world.width; x++) {
      expect(world.isSolid(x, 0)).toBe(true);
      expect(world.isSolid(x, 1) || world.biomeAt(x, 1) === Biome.Road).toBe(true);
    }
  });

  it('biyom oranları makul', () => {
    const counts = new Map<Biome, number>();
    for (let i = 0; i < world.biome.length; i++) {
      const b = world.biome[i] as Biome;
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const total = world.biome.length;
    const pct = (b: Biome) => ((counts.get(b) ?? 0) / total) * 100;
    const summary = Object.values(Biome)
      .filter((v): v is Biome => typeof v === 'number')
      .map((b) => `${Biome[b]}=${pct(b).toFixed(1)}%`)
      .join(' ');
    console.log('biyomlar:', summary);
    expect(pct(Biome.Water) + pct(Biome.Shallow)).toBeGreaterThan(3);
    expect(pct(Biome.Water) + pct(Biome.Shallow)).toBeLessThan(30);
    expect(pct(Biome.Forest)).toBeGreaterThan(8);
    expect(pct(Biome.Meadow) + pct(Biome.Flowers)).toBeGreaterThan(15);
    expect(pct(Biome.Mountain)).toBeLessThan(30);
  });

  it('ağaçların üstü var, üstler geçilebilir', () => {
    let trees = 0;
    for (let y = 1; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const o = world.objectAt(x, y);
        if (o === Obj.TreeTrunk || o === Obj.PineTrunk) {
          trees++;
          const top = world.objectAt(x, y - 1);
          expect(top === Obj.TreeTop || top === Obj.PineTop).toBe(true);
          expect(OBJ_INFO[top].solid).toBe(false);
        }
      }
    }
    expect(trees).toBeGreaterThan(500);
  });

  it('yuvalar yeterli sayıda, aralıklı ve çoğu ulaşılabilir', () => {
    expect(world.nests.length).toBeGreaterThanOrEqual(BALANCE.world.nestTarget * 0.8);
    const min = BALANCE.world.nestMinDistance;
    for (let i = 0; i < world.nests.length; i++) {
      for (let j = i + 1; j < world.nests.length; j++) {
        const dx = world.nests[i].x - world.nests[j].x;
        const dy = world.nests[i].y - world.nests[j].y;
        expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(min * min);
      }
    }
    const seen = reachable(world);
    const ok = world.nests.filter((n) => seen[world.idx(n.x, n.y)]).length;
    console.log(`yuva: ${world.nests.length}, ulaşılabilir: ${ok}`);
    expect(ok / world.nests.length).toBeGreaterThan(0.6);
  });
});
