import { describe, expect, it } from 'vitest';
import { findPath } from '../../src/sim/world/Pathfinder';
import { TileWorld } from '../../src/sim/world/TileWorld';
import { Ground, Obj } from '../../src/sim/world/tiles';

function grid(w: number, h: number): TileWorld {
  const world = new TileWorld(w, h, { x: 0, y: 0, w, h });
  world.ground.fill(Ground.Grass0);
  world.recomputeAllSolid();
  return world;
}

describe('findPath', () => {
  it('düz yol en kısa', () => {
    const w = grid(10, 10);
    const p = findPath(w, { x: 0, y: 0 }, { x: 5, y: 0 })!;
    expect(p).not.toBeNull();
    expect(p.length).toBe(5);
    expect(p[p.length - 1]).toEqual({ x: 5, y: 0 });
  });

  it('duvarın etrafından dolaşır, köşe kesmez', () => {
    const w = grid(10, 10);
    for (let y = 0; y < 8; y++) w.setObject(5, y, Obj.Rock);
    const p = findPath(w, { x: 2, y: 2 }, { x: 8, y: 2 })!;
    expect(p).not.toBeNull();
    expect(p.some((t) => t.y >= 8)).toBe(true);
    // Ardışık adımlar birbirine komşu
    let prev = { x: 2, y: 2 };
    for (const t of p) {
      expect(Math.abs(t.x - prev.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.y - prev.y)).toBeLessThanOrEqual(1);
      if (t.x !== prev.x && t.y !== prev.y) {
        expect(w.isSolid(t.x, prev.y)).toBe(false);
        expect(w.isSolid(prev.x, t.y)).toBe(false);
      }
      prev = t;
    }
  });

  it('yol yoksa null, hedef geçilmezse adjacentOk ile yanına gelir', () => {
    const w = grid(10, 10);
    for (let y = 0; y < 10; y++) w.setObject(5, y, Obj.Rock);
    expect(findPath(w, { x: 1, y: 1 }, { x: 8, y: 1 })).toBeNull();
    const w2 = grid(10, 10);
    w2.setObject(4, 4, Obj.Rock);
    expect(findPath(w2, { x: 0, y: 4 }, { x: 4, y: 4 })).toBeNull();
    const adj = findPath(w2, { x: 0, y: 4 }, { x: 4, y: 4 }, { adjacentOk: true })!;
    expect(adj).not.toBeNull();
    const last = adj[adj.length - 1];
    expect(Math.abs(last.x - 4) <= 1 && Math.abs(last.y - 4) <= 1).toBe(true);
  });

  it('bölge dışına çıkmaz', () => {
    const w = grid(20, 20);
    const p = findPath(w, { x: 2, y: 2 }, { x: 8, y: 8 }, { region: { x: 0, y: 0, w: 10, h: 10 } })!;
    expect(p).not.toBeNull();
    expect(findPath(w, { x: 2, y: 2 }, { x: 15, y: 15 }, { region: { x: 0, y: 0, w: 10, h: 10 } })).toBeNull();
  });

  it('64x64 labirentte hızlı', () => {
    const w = grid(64, 64);
    for (let x = 0; x < 64; x++) {
      for (let y = 0; y < 64; y++) {
        if (x % 4 === 2 && y % 9 !== 0) w.setObject(x, y, Obj.Rock);
      }
    }
    // Isınma (JIT) sonrası üç ölçümün en iyisi: paylaşımlı CI makinesinde tek ölçüm dalgalanıyordu (47 ms > 40 ms).
    const p = findPath(w, { x: 0, y: 0 }, { x: 63, y: 63 });
    expect(p).not.toBeNull();
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      findPath(w, { x: 0, y: 0 }, { x: 63, y: 63 });
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(40);
  });
});
