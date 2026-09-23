import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { type Building, buildingDoorTile, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Facing } from '../../src/sim/entities/Player';
import { type InteriorItem, buildInterior } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { bakesLeft, kitchenWaterPerHour } from '../../src/sim/systems/KitchenSystem';
import { findPath } from '../../src/sim/world/Pathfinder';
import type { TileWorld } from '../../src/sim/world/TileWorld';

const K = BALANCE.kitchen;

function placeKitchen(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 4; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 4; x++) {
      if (canPlaceBuilding(sim.world, 'kitchen', x, y)) {
        const b = sim.placeBuilding('kitchen', x, y)!;
        b.buildLeft = 0;
        return b;
      }
    }
  }
  throw new Error('mutfak yeri yok');
}

function frontOf(w: TileWorld, item: InteriorItem): { x: number; y: number; f: Facing } | undefined {
  const cands: Array<{ x: number; y: number; f: Facing }> = [];
  for (let x = item.x; x < item.x + item.w; x++) cands.push({ x, y: item.y + item.h, f: 3 });
  for (let y = item.y; y < item.y + item.h; y++) {
    cands.push({ x: item.x - 1, y, f: 2 });
    cands.push({ x: item.x + item.w, y, f: 1 });
  }
  return cands.find((q) => w.inBounds(q.x, q.y) && !w.isSolid(q.x, q.y));
}

function faceOven(sim: Sim): void {
  const oven = sim.interior!.items.find((i) => i.type === 'oven')!;
  const c = frontOf(sim.interior!.world, oven)!;
  sim.player.x = c.x + 0.5;
  sim.player.y = c.y + 0.7;
  sim.player.facing = c.f;
  sim.player.busy = 0;
}

/** Mutfağı kurar, kapıda E ile içeri girer. */
function inKitchen(seed: number): { sim: Sim; kitchen: Building } {
  const sim = Sim.create(seed);
  const kitchen = placeKitchen(sim);
  const door = buildingDoorTile(kitchen);
  sim.player.x = door.x + 0.5;
  sim.player.y = door.y + 0.9;
  sim.player.facing = 3;
  expect(resolveAction(sim).kind).toBe('enter');
  expect(performAction(sim).ok).toBe(true);
  expect(sim.interior?.kind).toBe('kitchen');
  return { sim, kitchen };
}

function bakeOnce(sim: Sim) {
  faceOven(sim);
  return performAction(sim);
}

describe('Mutfak içi (0.17.1)', () => {
  it('fırın 2 porsiyon → 1 ödül maması, günde 4; ikinci fırınla +3; ertesi gün yenilenir; kayıtta korunur', () => {
    const { sim, kitchen } = inKitchen(1721);
    sim.foodStock = 100;
    sim.treats = 0;
    for (let i = 0; i < K.bakesPerDay; i++) expect(bakeOnce(sim).ok).toBe(true);
    expect(sim.treats).toBe(K.bakesPerDay);
    expect(sim.foodStock).toBe(100 - K.bakesPerDay * K.foodPerTreat);
    const fifth = bakeOnce(sim);
    expect(fifth.ok).toBe(false);
    expect(fifth.message).toContain('hakkı bitti');
    sim.money = 5000;
    expect(sim.command({ type: 'buyFurniture', buildingId: kitchen.id, item: 'oven2' }).ok).toBe(true);
    expect(sim.interior!.items.filter((i) => i.type === 'oven').length).toBe(2);
    expect(bakesLeft(sim)).toBe(K.secondOvenBakes);
    for (let i = 0; i < K.secondOvenBakes; i++) expect(bakeOnce(sim).ok).toBe(true);
    expect(bakeOnce(sim).ok).toBe(false);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.bakesToday).toBe(K.bakesPerDay + K.secondOvenBakes);
    expect(bakesLeft(back)).toBe(0);
    sim.clock.totalMinutes += 24 * 60;
    expect(bakesLeft(sim)).toBe(K.bakesPerDay + K.secondOvenBakes);
  });

  it('kiler yetmezken ve çanta doluyken pişirmez', () => {
    const { sim } = inKitchen(1722);
    sim.foodStock = K.foodPerTreat - 1;
    faceOven(sim);
    expect(resolveAction(sim).hint).toContain('Kiler yetmiyor');
    expect(performAction(sim).ok).toBe(false);
    sim.foodStock = 100;
    sim.treats = BALANCE.eggs.treatsMax;
    const r = bakeOnce(sim);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('dolu');
    expect(sim.foodStock).toBe(100);
  });

  it('su deposu yalak dolumunu iki katına çıkarır; tezgâh eşya panelini açar', () => {
    const { sim, kitchen } = inKitchen(1723);
    expect(kitchenWaterPerHour(sim)).toBe(BALANCE.shelter.kitchenWaterPerHour);
    const counter = sim.interior!.items.find((i) => i.type === 'counter')!;
    const c = frontOf(sim.interior!.world, counter)!;
    sim.player.x = c.x + 0.5;
    sim.player.y = c.y + 0.7;
    sim.player.facing = c.f;
    expect(performAction(sim).open).toBe('furniture');
    sim.money = 5000;
    expect(sim.command({ type: 'buyFurniture', buildingId: kitchen.id, item: 'waterTank' }).ok).toBe(true);
    expect(kitchenWaterPerHour(sim)).toBe(BALANCE.shelter.kitchenWaterPerHour * K.waterTankMul);
    const trough = sim.buildings.find((b) => b.type === 'trough')!;
    trough.water = 0;
    sim.events.emit('hour', 10);
    expect(trough.water).toBe(Math.min(BALANCE.shelter.troughCapacity, BALANCE.shelter.kitchenWaterPerHour * K.waterTankMul));
  });

  it('tam donanımlı mutfakta her eşya katı, girişten önüne yürünür, çizimi dolu', () => {
    const m = buildInterior('kitchen', ['waterTank', 'oven2']);
    expect(m.items.length).toBe(6);
    const start = { x: Math.floor(m.spawn.x), y: Math.floor(m.spawn.y - 0.2) };
    for (const item of m.items) {
      expect(m.world.isSolid(item.x, item.y), item.type).toBe(true);
      const front = frontOf(m.world, item);
      expect(front, item.type).toBeDefined();
      expect(findPath(m.world, start, front!, { maxNodes: 400 }), item.type).not.toBeNull();
      const px = drawInteriorItem(item.type);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, item.type).toBeGreaterThan(60);
    }
    expect(buildInterior('kitchen').items.map((i) => i.type)).toEqual(['counter', 'oven', 'spiceRack', 'foodShelf']);
  });
});
