import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { buildingDoorTile } from '../../src/sim/entities/Building';
import type { Egg } from '../../src/sim/entities/Egg';
import type { Facing } from '../../src/sim/entities/Player';
import { type InteriorItem, buildInterior } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { tickIncubators } from '../../src/sim/systems/IncubatorSystem';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { findPath } from '../../src/sim/world/Pathfinder';
import type { TileWorld } from '../../src/sim/world/TileWorld';

function frontOf(w: TileWorld, item: InteriorItem): { x: number; y: number; f: Facing } | undefined {
  const cands: Array<{ x: number; y: number; f: Facing }> = [];
  for (let x = item.x; x < item.x + item.w; x++) cands.push({ x, y: item.y + item.h, f: 3 });
  for (let y = item.y; y < item.y + item.h; y++) {
    cands.push({ x: item.x - 1, y, f: 2 });
    cands.push({ x: item.x + item.w, y, f: 1 });
  }
  return cands.find((q) => w.inBounds(q.x, q.y) && !w.isSolid(q.x, q.y));
}

function face(sim: Sim, item: InteriorItem): void {
  const c = frontOf(sim.interior!.world, item)!;
  sim.player.x = c.x + 0.5;
  sim.player.y = c.y + 0.7;
  sim.player.facing = c.f;
  sim.player.busy = 0;
}

/** Başlangıç kuluçkasına bir yumurta koyar. */
function withEgg(seed: number, rarity: 'common' | 'rare' = 'rare') {
  const sim = Sim.create(seed);
  const inc = sim.buildings.find((b) => b.type === 'incubator')!;
  const egg: Egg = { id: sim.nextId++, genome: { ...sim.dogs[0].genome, rarity }, foundDay: 1, hatchLeft: -1 };
  sim.backpack.push(egg);
  expect(sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id }).ok).toBe(true);
  return { sim, inc, egg };
}

describe('Kuluçka içi (0.17.3)', () => {
  it('Sv1 tek tepsi, Sv2 iki tepsi; lamba alınınca yerinde; her eşya katı, erişilir, çizimi dolu', () => {
    expect(buildInterior('hatchery').items.map((i) => i.type)).toEqual(['tray', 'controlPanel', 'supplies']);
    const full = buildInterior('hatchery', ['heatLamp'], 2);
    expect(full.items.map((i) => i.type)).toEqual(['tray', 'controlPanel', 'tray', 'heatLamp', 'supplies']);
    const start = { x: Math.floor(full.spawn.x), y: Math.floor(full.spawn.y - 0.2) };
    for (const item of full.items) {
      expect(full.world.isSolid(item.x, item.y), item.type).toBe(true);
      const front = frontOf(full.world, item);
      expect(front, item.type).toBeDefined();
      expect(findPath(full.world, start, front!, { maxNodes: 300 }), item.type).not.toBeNull();
      const px = drawInteriorItem(item.type);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, item.type).toBeGreaterThan(60);
    }
  });

  it('ısı lambası kalan süreyi %15 kısaltır (içerideki yumurta da); kapıda E hâlâ kuluçka paneli', () => {
    const { sim, inc, egg } = withEgg(1741);
    const full = BALANCE.eggs.hatchDays * 24 * 60;
    expect(egg.hatchLeft).toBe(full);
    tickIncubators(sim, 100);
    expect(egg.hatchLeft).toBe(full - 100);
    sim.money = 5000;
    expect(sim.command({ type: 'buyFurniture', buildingId: inc.id, item: 'heatLamp' }).ok).toBe(true);
    tickIncubators(sim, BALANCE.hatchery.lampTimeMul * 100);
    expect(egg.hatchLeft).toBeCloseTo(full - 200, 6);
    const door = buildingDoorTile(inc);
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.9;
    sim.player.facing = 3;
    const r = resolveAction(sim);
    expect(r.kind).toBe('incubator');
    expect(r.hint).toContain('↑ içeri');
    expect(performAction(sim).open).toBe('incubator');
  });

  it('içeride tepsi yumurtaları söyler, kontrol paneli kuluçka panelini açar; Sv2 yükseltmesi odayı yeniler', () => {
    const { sim, inc } = withEgg(1742, 'rare');
    expect(sim.enterBuilding(inc.id).ok).toBe(true);
    expect(sim.interior?.kind).toBe('hatchery');
    const items = sim.interior!.items;
    face(sim, items.find((i) => i.type === 'tray')!);
    const hint = resolveAction(sim).hint;
    expect(hint).toContain('Tepsi');
    expect(hint).toContain('Nadir');
    face(sim, items.find((i) => i.type === 'controlPanel')!);
    const r = performAction(sim);
    expect(r.open).toBe('incubator');
    expect(r.building?.id).toBe(inc.id);
    sim.money = 10000;
    expect(sim.command({ type: 'upgradeBuilding', buildingId: inc.id }).ok).toBe(true);
    expect(sim.interior!.items.filter((i) => i.type === 'tray').length).toBe(2);
    face(sim, sim.interior!.items.filter((i) => i.type === 'tray')[1]);
    expect(resolveAction(sim).hint).toContain('Boş tepsi');
  });
});
