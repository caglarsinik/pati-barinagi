import { ADOPTER_TYPES } from '../../src/sim/entities/AdopterType';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { type BuildingType } from '../../src/content/buildings';
import { canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Staff } from '../../src/sim/entities/Staff';
import { Sim } from '../../src/sim/Sim';
import { runInspection } from '../../src/sim/systems/EconomySystem';

/** Arsa içinde boş bir yere bina koyar (hazır). */
function put(sim: Sim, type: BuildingType) {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 4; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 4; x++) {
      if (canPlaceBuilding(sim.world, type, x, y)) return sim.placeBuilding(type, x, y)!;
    }
  }
  throw new Error('yer yok: ' + type);
}

describe('Dekor', () => {
  it('puan çiçek/bank/tabela/lambadan toplanır, tek tabela sayılır, tavan var', () => {
    const sim = Sim.create(201);
    const D = BALANCE.decor;
    const base = sim.decorScore();
    put(sim, 'flower');
    expect(sim.decorScore()).toBeCloseTo(base + D.points.flower);
    put(sim, 'bench');
    expect(sim.decorScore()).toBeCloseTo(base + D.points.flower + D.points.bench);
    put(sim, 'sign');
    put(sim, 'sign');
    expect(sim.decorScore()).toBeCloseTo(base + D.points.flower + D.points.bench + D.points.sign);
    for (let i = 0; i < 30; i++) put(sim, 'flower');
    expect(sim.decorScore()).toBe(D.max);
  });

  it('inşaatı bitmemiş dekor sayılmaz', () => {
    const sim = Sim.create(202);
    const base = sim.decorScore();
    const p = sim.world.plotInterior();
    let b = null;
    for (let y = p.y + 2; y < p.y + p.h - 4 && !b; y++) for (let x = p.x + 2; x < p.x + p.w - 4 && !b; x++) if (canPlaceBuilding(sim.world, 'bench', x, y)) b = sim.placeBuilding('bench', x, y, 120);
    expect(b).not.toBeNull();
    expect(sim.decorScore()).toBe(base);
    b!.buildLeft = 0;
    expect(sim.decorScore()).toBeCloseTo(base + BALANCE.decor.points.bench);
  });

  it('dekor sahiplenici sabrını uzatır', () => {
    const sim = Sim.create(203);
    sim.clock.totalMinutes = 10 * 60;
    const a0 = sim.adoption.spawnAdopter()!;
    const p0 = a0.patienceLeft;
    for (let i = 0; i < 3; i++) put(sim, 'bench');
    const a1 = sim.adoption.spawnAdopter()!;
    // Temel sabır kişilik tipine göre çarpılır (0.21.0); dekor payı ayrıca eklenir.
    const typed = (a: typeof a0): number => BALANCE.adoption.patienceMinutes * ADOPTER_TYPES[a.type].patienceMul;
    expect(a1.patienceLeft - typed(a1)).toBeCloseTo(p0 - typed(a0) + 3 * BALANCE.decor.points.bench * BALANCE.decor.patiencePerPoint);
  });

  it('denetimde Çevre kalemi dekorla artar', () => {
    const sim = Sim.create(204);
    const item = () => runInspection(sim).items.find((i) => i.name === 'Çevre')!;
    const e0 = item().effect;
    put(sim, 'sign');
    put(sim, 'bench');
    expect(item().effect).toBeGreaterThan(e0);
  });

  it('mutfak personelin yem/su süresini kısaltır', () => {
    const sim = Sim.create(205);
    const c = sim.candidates[0];
    c.role = 'caretaker';
    sim.command({ type: 'hire', candidateId: c.id });
    const s = sim.staff[0];
    // private duration: aynı formülü dışarıdan doğrula
    const base = BALANCE.staff.taskMinutes.feed;
    const noKitchen = Math.max(3, Math.round(base / Math.max(0.2, s.efficiency('feed'))));
    const withKitchen = Math.max(3, Math.round((base * BALANCE.staff.kitchenPrepMul) / Math.max(0.2, s.efficiency('feed'))));
    expect(withKitchen).toBeLessThan(noKitchen);
    // Gerçek sistemden: mutfak kurulunca görev süresi kısalır
    const dur = (sim.staffSystem as unknown as { duration: (st: Staff, t: { type: 'feed'; tile: { x: number; y: number } }) => number }).duration.bind(sim.staffSystem);
    const feedTask = { type: 'feed' as const, tile: { x: 0, y: 0 } };
    expect(dur(s, feedTask)).toBe(noKitchen);
    put(sim, 'kitchen');
    expect(dur(s, feedTask)).toBe(withKitchen);
  });
});
