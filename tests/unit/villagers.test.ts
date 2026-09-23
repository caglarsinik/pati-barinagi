import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import type { VillagerPlace, VillagerRole } from '../../src/sim/entities/Villager';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { findPath } from '../../src/sim/world/Pathfinder';

/** Saati haftanın gününe ve saate getirir (olay tetiklemeden; 0 = Pazartesi). */
function setTime(sim: Sim, weekday: number, hour: number, minute = 0): void {
  let d = Math.floor(sim.clock.totalMinutes / MINUTES_PER_DAY);
  while (d % 7 !== weekday) d++;
  sim.clock.totalMinutes = d * MINUTES_PER_DAY + hour * 60 + minute;
}

const by = (sim: Sim, role: VillagerRole) => sim.villagers.list.find((v) => v.role === role)!;

describe('Köylüler (0.20.1)', () => {
  it('köy bulunmadan köylü yok; bulununca tohumdan aynı altı köylü; ana RNG sırası değişmez', () => {
    const a = Sim.create(2101);
    const b = Sim.create(2101);
    const twin = Sim.create(2101);
    a.villagers.update(0.1);
    expect(a.villagers.list).toHaveLength(0);
    a.villageFound = true;
    b.villageFound = true;
    a.villagers.update(0.1);
    b.villagers.update(0.1);
    expect(a.villagers.list).toHaveLength(6);
    const sig = (s: Sim) => s.villagers.list.map((v) => [v.name, v.role, v.home, v.work, v.look]);
    expect(sig(a)).toEqual(sig(b));
    expect(new Set(a.villagers.list.map((v) => v.name)).size).toBe(6);
    expect(new Set(a.villagers.list.map((v) => v.home)).size).toBe(3);
    expect(a.world.villageBuildings[by(a, 'clerk').work!].kind).toBe('wholesaler');
    expect(a.world.villageBuildings[by(a, 'shopkeeper').work!].kind).toBe('toyShop');
    expect(a.rng.next()).toBe(twin.rng.next());
  });

  it('çizelge: hafta içi iş yerinde ya da meydanda; gece herkes evde; Pazar herkes meydanda', () => {
    const sim = Sim.create(2102);
    sim.villageFound = true;
    // Oyuncu arsada (köyden uzak): köylüler saate göre yerleşir.
    setTime(sim, 1, 10);
    sim.villagers.update(0.1);
    expect(by(sim, 'clerk').place).toBe('work');
    expect(by(sim, 'clerk').inside).toBe(true);
    expect(by(sim, 'shopkeeper').place).toBe('work');
    const elder = by(sim, 'elder');
    expect(elder.place).toBe('spot');
    expect(elder.inside).toBe(false);
    expect(Math.floor(elder.x)).toBe(sim.villagers.placeTile(elder, 'spot')!.x);
    setTime(sim, 1, 23);
    sim.villagers.update(0.1);
    expect(sim.villagers.list.every((v) => v.inside && v.place === 'home')).toBe(true);
    setTime(sim, BALANCE.shop.marketWeekday, 12);
    sim.villagers.update(0.1);
    expect(sim.villagers.list.every((v) => v.place === 'plaza' && !v.inside)).toBe(true);
  });

  it('oyuncu köydeyken köylü yol bularak adım adım yürür: evden çıkar, iş yerine girer', () => {
    const sim = Sim.create(2103);
    sim.villageFound = true;
    const r = sim.world.village!;
    sim.player.x = r.x + 11.5;
    sim.player.y = r.y + 6.7;
    setTime(sim, 1, 6, 50);
    sim.villagers.update(0.1);
    const clerk = by(sim, 'clerk');
    expect(clerk.place).toBe('home');
    expect(clerk.inside).toBe(true);
    setTime(sim, 1, 7, 0);
    let prev = { x: clerk.x, y: clerk.y };
    let maxStep = 0;
    let steps = 0;
    let outside = false;
    let walked = false;
    for (let i = 0; i < 600 && clerk.place !== 'work'; i++) {
      sim.villagers.update(0.1);
      if (!clerk.inside) outside = true;
      if (clerk.moving) walked = true;
      maxStep = Math.max(maxStep, Math.hypot(clerk.x - prev.x, clerk.y - prev.y));
      prev = { x: clerk.x, y: clerk.y };
      steps++;
    }
    expect(outside).toBe(true);
    expect(walked).toBe(true);
    expect(clerk.place).toBe('work');
    expect(clerk.inside).toBe(true);
    expect(steps).toBeGreaterThan(5);
    expect(maxStep).toBeLessThanOrEqual(BALANCE.villagers.speed * 0.1 + 1e-6);
  });

  it('E ile konuş: baktığın köylü adıyla bir satır söyler, ikinci konuşmada başka satır', () => {
    const sim = Sim.create(2104);
    sim.villageFound = true;
    setTime(sim, 1, 10);
    sim.villagers.update(0.1);
    const elder = by(sim, 'elder');
    sim.player.x = elder.x;
    sim.player.y = elder.y + 1;
    sim.player.facing = 3;
    const r = resolveAction(sim);
    expect(r.kind).toBe('talk');
    expect(r.hint).toContain(elder.name);
    const a = performAction(sim);
    expect(a.ok).toBe(true);
    expect(a.message).toContain(elder.name);
    const b = performAction(sim);
    expect(b.message).not.toBe(a.message);
    // Evdeki köylüyle konuşulmaz.
    expect(sim.villagers.talk(by(sim, 'clerk').index).ok).toBe(false);
  });

  it('bütün yerler yürünebilir ve evden hepsine yol var (üç tohum)', () => {
    const places: VillagerPlace[] = ['home', 'work', 'spot', 'spot2', 'plaza'];
    for (const seed of [2105, 7, 424242]) {
      const sim = Sim.create(seed);
      sim.villageFound = true;
      sim.villagers.update(0.1);
      expect(sim.villagers.list, `tohum ${seed}`).toHaveLength(6);
      for (const v of sim.villagers.list) {
        const home = sim.villagers.placeTile(v, 'home')!;
        for (const place of places) {
          const tile = sim.villagers.placeTile(v, place);
          if (!tile) continue;
          expect(sim.world.isSolid(tile.x, tile.y), `${seed} ${v.role} ${place}`).toBe(false);
          expect(findPath(sim.world, home, tile, { maxNodes: 4000 }), `${seed} ${v.role} ${place} yolu`).not.toBeNull();
        }
      }
    }
  });
});
