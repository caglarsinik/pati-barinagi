import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import type { Facing } from '../../src/sim/entities/Player';
import { type InteriorItem, buildInterior, sacksOnShelf } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { findPath } from '../../src/sim/world/Pathfinder';
import type { TileWorld } from '../../src/sim/world/TileWorld';

const bag = BALANCE.economy.foodBagPortions;

function frontOf(w: TileWorld, item: InteriorItem): { x: number; y: number; f: Facing } | undefined {
  const cands: Array<{ x: number; y: number; f: Facing }> = [];
  for (let x = item.x; x < item.x + item.w; x++) cands.push({ x, y: item.y + item.h, f: 3 });
  for (let y = item.y; y < item.y + item.h; y++) {
    cands.push({ x: item.x - 1, y, f: 2 });
    cands.push({ x: item.x + item.w, y, f: 1 });
  }
  return cands.find((q) => w.inBounds(q.x, q.y) && !w.isSolid(q.x, q.y));
}

function inPantry(seed: number): Sim {
  const sim = Sim.create(seed);
  const shed = sim.buildings.find((b) => b.type === 'shed')!;
  expect(sim.enterBuilding(shed.id).ok).toBe(true);
  return sim;
}

function face(sim: Sim, item: InteriorItem): void {
  const c = frontOf(sim.interior!.world, item)!;
  sim.player.x = c.x + 0.5;
  sim.player.y = c.y + 0.7;
  sim.player.facing = c.f;
  sim.player.busy = 0;
}

describe('Kiler içi (0.17.0)', () => {
  it('üç çuval rafı, defter ve pano; her birinin önüne girişten yürünür; çizimler dolu', () => {
    const m = buildInterior('pantry');
    expect(m.items.map((i) => i.type)).toEqual(['sacks', 'sacks', 'sacks', 'ledger', 'orderBoard']);
    const start = { x: Math.floor(m.spawn.x), y: Math.floor(m.spawn.y - 0.2) };
    for (const item of m.items) {
      const front = frontOf(m.world, item);
      expect(front, item.type).toBeDefined();
      expect(findPath(m.world, start, front!, { maxNodes: 300 }), item.type).not.toBeNull();
    }
    expect(findPath(m.world, start, m.door, { maxNodes: 300 })).not.toBeNull();
    for (let v = 0; v <= 3; v++) {
      const px = drawInteriorItem('sacks', v);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, `raf ${v}`).toBeGreaterThan(150);
    }
  });

  it('çuval sayısı stoğa göre soldan dolar, en çok 9', () => {
    const shelves = (stock: number) => [0, 1, 2].map((s) => sacksOnShelf(stock, s));
    expect(shelves(0)).toEqual([0, 0, 0]);
    expect(shelves(1)).toEqual([1, 0, 0]);
    expect(shelves(bag * 2)).toEqual([2, 0, 0]);
    expect(shelves(bag * 7.5)).toEqual([3, 3, 2]);
    expect(shelves(bag * 50)).toEqual([3, 3, 3]);
  });

  it('defter sipariş panelini, pano otomatik sipariş ayarını açar; raf stoğu söyler', () => {
    const sim = inPantry(1711);
    const items = sim.interior!.items;
    face(sim, items.find((i) => i.type === 'ledger')!);
    expect(resolveAction(sim).kind).toBe('order');
    expect(performAction(sim).open).toBe('order');
    face(sim, items.find((i) => i.type === 'orderBoard')!);
    expect(resolveAction(sim).hint).toContain(sim.policies.autoOrderFood ? 'açık' : 'kapalı');
    expect(performAction(sim).open).toBe('autoOrder');
    face(sim, items[0]);
    const r = resolveAction(sim);
    expect(r.kind).toBe('none');
    expect(r.hint).toContain(`${Math.floor(sim.foodStock)} porsiyon`);
  });
});
