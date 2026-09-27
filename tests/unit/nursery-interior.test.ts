import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/Rng';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { type Building, canPlaceBuilding } from '../../src/sim/entities/Building';
import { createEgg } from '../../src/sim/entities/Egg';
import { buildInterior, interiorItemAt, interiorKindFor, nurseryRestSpotInside } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';

function opaqueCount(p: { w: number; h: number; isOpaque(x: number, y: number): boolean }): number {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
}

/** Arsada ilk sığan yere hazır bir yuva evi kurar. */
function placeNursery(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y; y < p.y + p.h - 3; y++) {
    for (let x = p.x; x < p.x + p.w - 3; x++) {
      if (!canPlaceBuilding(sim.world, 'nursery', x, y)) continue;
      const b = sim.placeBuilding('nursery', x, y)!;
      b.buildLeft = 0;
      return b;
    }
  }
  throw new Error('yuva evine yer yok');
}

/** Oyuncuyu içeride `tile` karesine koyar, `facing` yönüne bakar (0 aşağı, 1 sol, 2 sağ, 3 yukarı). */
function standAt(sim: Sim, x: number, y: number, facing: 0 | 1 | 2 | 3): void {
  sim.player.x = x + 0.5;
  sim.player.y = y + 0.7;
  sim.player.facing = facing;
  sim.player.busy = 0;
}

describe('Yuva evi içi (0.25.0)', () => {
  it('şablon 8×6: kapı alt ortada, pano/yataklar/sepet katı, önleri yürünür; yatış yerleri', () => {
    expect(interiorKindFor('nursery')).toBe('nursery');
    const m = buildInterior('nursery');
    expect(m.world.width).toBe(8);
    expect(m.world.height).toBe(6);
    expect(m.door).toEqual({ x: 3, y: 5 });
    expect(m.items.map((i) => i.type).sort()).toEqual(['eggBasket', 'nestBed', 'nestBed', 'nestBoard', 'window']);
    for (const it of m.items) for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) expect(m.world.isSolid(x, y)).toBe(true);
    // Önler: pano (1..2,2), yataklar (1..2,4) ve (5,4), sepet (5,4)'ten sağa.
    for (const [x, y] of [
      [1, 2],
      [2, 2],
      [1, 4],
      [2, 4],
      [5, 4],
      [3, 4],
    ]) expect(m.world.isSolid(x, y)).toBe(false);
    expect(interiorItemAt(m, 6, 4)?.type).toBe('eggBasket');
    expect(interiorItemAt(m, 3, 4)).toBeNull();
    expect(nurseryRestSpotInside(m, 0)).toEqual({ x: 2, y: 4 });
    expect(nurseryRestSpotInside(m, 1)).toEqual({ x: 6, y: 4 });
    expect(nurseryRestSpotInside(m, 2)).toBeNull();
  });

  it('kapıdan girilir ve çıkılır; dış ipucu ↑ içeri der', () => {
    const sim = Sim.create(2501);
    const b = placeNursery(sim);
    expect(sim.enterBuilding(b.id).ok).toBe(true);
    expect(sim.interior?.kind).toBe('nursery');
    expect(sim.interior?.buildingId).toBe(b.id);
    expect(sim.world.buildingIdAt(sim.player.tileX, sim.player.tileY)).toBe(-1);
    sim.exitInterior();
    expect(sim.interior).toBeNull();
    // Kapı önünde yüzü binaya dönük: eski E davranışı (panel) ve ↑ içeri ipucu.
    sim.player.facing = 3;
    const r = resolveAction(sim);
    expect(r.kind).toBe('nursery');
    expect(r.hint).toContain('↑ içeri');
  });

  it('pano paneli açar; yatak boş/dolu adı söyler; sepet boşken bekleme, yumurta varken alınır, çanta doluysa uyarır', () => {
    const sim = Sim.create(2502);
    const b = placeNursery(sim);
    sim.enterBuilding(b.id);
    standAt(sim, 1, 2, 3);
    expect(resolveAction(sim).kind).toBe('nurseryBoard');
    expect(performAction(sim).open).toBe('nursery');
    standAt(sim, 1, 4, 3);
    expect(resolveAction(sim).hint).toContain('boş');
    standAt(sim, 5, 4, 2);
    expect(resolveAction(sim).hint).toContain('çift seç');
    // Çift seçilince yatak adı söyler, sepet gün sayar.
    while (sim.shelterDogs().length < 2) {
      const d0 = sim.dogs[0];
      sim.addDog({ ...d0.genome }, 'egg', 60, d0.x + 1, d0.y + 1);
    }
    const dogs = sim.shelterDogs().slice(0, 2);
    for (const d of dogs) d.ageWeeks = Math.max(d.ageWeeks, 60);
    expect(sim.command({ type: 'setNurseryPair', buildingId: b.id, dogIds: [dogs[0].id, dogs[1].id] }).ok).toBe(true);
    standAt(sim, 1, 4, 3);
    expect(resolveAction(sim).hint).toContain(dogs[0].name);
    standAt(sim, 5, 4, 2);
    expect(resolveAction(sim).hint).toContain('gün');
    // Yumurta: sepetten çantaya.
    const egg = createEgg(sim.nextId++, new Rng(5), 'common', sim.clock.day);
    egg.parentNames = [dogs[0].name, dogs[1].name];
    b.eggs.push(egg);
    const r = resolveAction(sim);
    expect(r.kind).toBe('nurseryEgg');
    expect(r.hint).toContain(dogs[0].name);
    const n0 = sim.backpack.length;
    expect(performAction(sim).ok).toBe(true);
    expect(sim.backpack.length).toBe(n0 + 1);
    expect(b.eggs.length).toBe(0);
    expect(sim.player.busy).toBeGreaterThan(0);
    // Çanta doluysa alınmaz.
    b.eggs.push(createEgg(sim.nextId++, new Rng(6), 'common', sim.clock.day));
    while (sim.backpack.length < sim.backpackSlots()) sim.backpack.push(createEgg(sim.nextId++, new Rng(7), 'common', sim.clock.day));
    sim.player.busy = 0;
    const full = resolveAction(sim);
    expect(full.kind).toBe('none');
    expect(full.hint).toContain('yer aç');
    expect(b.eggs.length).toBe(1);
  });

  it('eşya çizimleri', () => {
    const board = drawInteriorItem('nestBoard');
    const bed = drawInteriorItem('nestBed');
    const basket = drawInteriorItem('eggBasket');
    expect([board.w, board.h]).toEqual([32, 16]);
    expect([bed.w, bed.h]).toEqual([32, 16]);
    expect([basket.w, basket.h]).toEqual([16, 15]);
    expect(opaqueCount(board)).toBeGreaterThan(200);
    expect(opaqueCount(bed)).toBeGreaterThan(150);
    expect(opaqueCount(basket)).toBeGreaterThan(80);
  });
});
