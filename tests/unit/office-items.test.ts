import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import type { Facing } from '../../src/sim/entities/Player';
import { type InteriorItem, type InteriorItemType, buildInterior } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { findPath } from '../../src/sim/world/Pathfinder';
import type { TileWorld } from '../../src/sim/world/TileWorld';

function inOffice(seed: number): Sim {
  const sim = Sim.create(seed);
  const office = sim.buildings.find((b) => b.type === 'office')!;
  expect(sim.enterBuilding(office.id).ok).toBe(true);
  return sim;
}

/** Eşyanın önündeki ilk boş kare ve oradan eşyaya bakış yönü (önce alt, sonra sol/sağ). */
function frontOf(w: TileWorld, item: InteriorItem): { x: number; y: number; f: Facing } | undefined {
  const cands: Array<{ x: number; y: number; f: Facing }> = [];
  for (let x = item.x; x < item.x + item.w; x++) cands.push({ x, y: item.y + item.h, f: 3 });
  for (let y = item.y; y < item.y + item.h; y++) {
    cands.push({ x: item.x - 1, y, f: 2 });
    cands.push({ x: item.x + item.w, y, f: 1 });
  }
  return cands.find((q) => w.inBounds(q.x, q.y) && !w.isSolid(q.x, q.y));
}

/** Oyuncuyu eşyanın önüne koyup ona döndürür. */
function faceItem(sim: Sim, type: InteriorItemType): void {
  const it = sim.interior!;
  const c = frontOf(it.world, it.items.find((i) => i.type === type)!)!;
  sim.player.x = c.x + 0.5;
  sim.player.y = c.y + 0.7;
  sim.player.facing = c.f;
  sim.player.busy = 0;
}

describe('Ofis eşyaları (0.16.1)', () => {
  it('sekiz eşya yerinde ve katı; her birinin önüne girişten yürünebilir; çizimleri dolu', () => {
    const m = buildInterior('office');
    expect(m.items.map((i) => i.type).sort()).toEqual(['bed', 'board', 'bookshelf', 'coffee', 'desk', 'phone', 'plant', 'window']);
    const start = { x: Math.floor(m.spawn.x), y: Math.floor(m.spawn.y - 0.2) };
    for (const item of m.items) {
      for (let y = item.y; y < item.y + item.h; y++) for (let x = item.x; x < item.x + item.w; x++) expect(m.world.isSolid(x, y), item.type).toBe(true);
      const front = frontOf(m.world, item);
      expect(front, item.type).toBeDefined();
      expect(findPath(m.world, start, front!, { maxNodes: 500 }), item.type).not.toBeNull();
      const px = drawInteriorItem(item.type);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, item.type).toBeGreaterThan(40);
    }
    // Eşyalar kapıyı ve girişi kapatmaz.
    expect(m.world.isSolid(start.x, start.y)).toBe(false);
    expect(findPath(m.world, start, m.door, { maxNodes: 500 })).not.toBeNull();
  });

  it('bilgisayar menüsü, lisans panosu = ofis paneli, telefon = yem siparişi, kitaplık = kontroller; dekor yalnız ipucu', () => {
    const sim = inOffice(1611);
    faceItem(sim, 'desk');
    expect(resolveAction(sim).kind).toBe('computer');
    expect(performAction(sim).open).toBe('computer');
    faceItem(sim, 'board');
    const r = performAction(sim);
    expect(r.open).toBe('office');
    expect(r.building?.type).toBe('office');
    faceItem(sim, 'phone');
    expect(performAction(sim).open).toBe('order');
    faceItem(sim, 'bookshelf');
    expect(performAction(sim).open).toBe('help');
    faceItem(sim, 'window');
    expect(resolveAction(sim).kind).toBe('none');
    expect(resolveAction(sim).hint).toContain('Pencere');
    faceItem(sim, 'plant');
    expect(resolveAction(sim).kind).toBe('none');
    expect(resolveAction(sim).hint).not.toBe('');
  });

  it('yatak: gündüz "henüz erken", gece sabaha uyutur, oyuncu içeride uyanır', () => {
    const sim = inOffice(1612);
    sim.clock.totalMinutes = 12 * 60;
    faceItem(sim, 'bed');
    expect(resolveAction(sim).kind).toBe('sleep');
    const early = performAction(sim);
    expect(early.ok).toBe(false);
    expect(early.message).toContain('Henüz erken');
    expect(sim.clock.hour).toBe(12);
    sim.clock.totalMinutes = 21 * 60;
    expect(performAction(sim).ok).toBe(true);
    expect(sim.clock.hour).toBe(6);
    expect(sim.clock.day).toBe(2);
    expect(sim.stats.slept).toBe(1);
    expect(sim.interior).not.toBeNull();
  });

  it('kahve: dayanıklılığı doldurur, günde bir; ertesi gün yine içilir; kayıtta korunur', () => {
    const sim = inOffice(1613);
    sim.player.stamina = 10;
    sim.player.exhausted = true;
    faceItem(sim, 'coffee');
    expect(resolveAction(sim).kind).toBe('coffee');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.player.stamina).toBe(BALANCE.player.staminaMax);
    expect(sim.player.exhausted).toBe(false);
    expect(resolveAction(sim).kind).toBe('none');
    expect(resolveAction(sim).hint).toContain('içtin');
    sim.player.busy = 0;
    expect(performAction(sim).ok).toBe(false);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.coffeeDay).toBe(sim.clock.day);
    sim.clock.totalMinutes += 24 * 60;
    expect(resolveAction(sim).kind).toBe('coffee');
  });
});
