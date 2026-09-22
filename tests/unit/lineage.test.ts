import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { canPlaceBuilding } from '../../src/sim/entities/Building';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { lineageOf } from '../../src/sim/systems/Lineage';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

describe('Soy ağacı', () => {
  it('anne-baba, dede-nine ve yavrular', () => {
    const sim = Sim.create(2401);
    const g = sim.dogs[0].genome;
    const a = sim.dogs[0];
    const b = sim.addDog(g, 'egg', 20, a.x + 1, a.y, 'Bal');
    const c = sim.addDog(g, 'egg', 14, a.x + 2, a.y, 'Cici');
    c.parents = [a.id, b.id];
    c.parentNames = [a.name, b.name];
    const x = sim.addDog(g, 'stray', 20, a.x + 3, a.y, 'Kont');
    const gc = sim.addDog(g, 'egg', 1, a.x + 4, a.y, 'Minik');
    gc.parents = [c.id, x.id];
    gc.parentNames = [c.name, x.name];

    const lc = lineageOf(sim, c);
    expect(lc.parents.map((p) => [p.name, p.here])).toEqual([
      [a.name, true],
      ['Bal', true],
    ]);
    expect(lc.children).toEqual([{ id: gc.id, name: 'Minik' }]);
    const lg = lineageOf(sim, gc);
    expect(lg.grandparents).toEqual([a.name, 'Bal']);
    expect(lineageOf(sim, a).children.map((d) => d.name)).toEqual(['Cici']);
    expect(lineageOf(sim, x).parents).toEqual([]);
    // Ebeveyn barınaktan ayrıldıysa adı kalır, tıklanamaz.
    b.wild = true;
    expect(lineageOf(sim, c).parents[1]).toMatchObject({ name: 'Bal', here: false });
  });

  it('soylu yavru doğunca "İlk soy", efsanevi soylu yavruda "Efsanevi soy" açılır', () => {
    const sim = Sim.create(2402);
    const inc = sim.buildings.find((q) => q.type === 'incubator')!;
    const a = sim.dogs[0];
    const egg = { id: sim.nextId++, genome: { ...a.genome, rarity: 'legendary' as const }, foundDay: 1, hatchLeft: -1, parents: [a.id, a.id] as [number, number], parentNames: [a.name, a.name] as [string, string] };
    sim.backpack.push(egg);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id });
    runMinutes(sim, BALANCE.eggs.hatchDays * 24 * 60 + 30);
    expect(sim.stats.bredHatched).toBe(1);
    expect(sim.stats.bredLegendary).toBe(1);
    expect(sim.achievements.unlocked.has('lineage-1')).toBe(true);
    expect(sim.achievements.unlocked.has('lineage-legend')).toBe(true);
  });

  it('otopilot yuva evindeki yumurtayı alıp kuluçkaya koyar', () => {
    const sim = Sim.create(2403);
    const p = sim.world.plotInterior();
    let n = null as ReturnType<Sim['placeBuilding']>;
    for (let y = p.y + 2; y < p.y + p.h - 5 && !n; y++) for (let x = p.x + 2; x < p.x + p.w - 5 && !n; x++) if (canPlaceBuilding(sim.world, 'nursery', x, y)) n = sim.placeBuilding('nursery', x, y);
    expect(n).not.toBeNull();
    const a = sim.dogs[0];
    const egg = { id: sim.nextId++, genome: a.genome, foundDay: 1, hatchLeft: -1, parents: [a.id, a.id] as [number, number], parentNames: [a.name, a.name] as [string, string] };
    n!.eggs.push(egg);
    for (const d of sim.dogs) {
      d.needs.play = 100;
      d.needs.hygiene = 100;
      d.needs.health = 100;
      d.petsToday = 1;
      d.state = 'sit';
      d.stateTimer = 9999;
    }
    sim.policies.trainTarget = 0;
    sim.setSpeed(1);
    sim.command({ type: 'setAutopilot', on: true });
    const inc = sim.buildings.find((q) => q.type === 'incubator')!;
    for (let i = 0; i < 30 * 120 && !inc.eggs.some((e) => e.id === egg.id); i++) sim.update(1 / 30, IDLE_INPUT);
    expect(n!.eggs.length).toBe(0);
    expect(inc.eggs.some((e) => e.id === egg.id)).toBe(true);
  });
});
