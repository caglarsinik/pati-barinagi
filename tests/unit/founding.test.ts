import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { BUILDING_DEFS, PLOT_EXPANSION_COST, type BuildingType } from '../../src/content/buildings';
import { SaveManager } from '../../src/core/SaveManager';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { FOUNDING_GOALS, GOALS, goalReward } from '../../src/sim/systems/Goals';
import { findPath } from '../../src/sim/world/Pathfinder';
import { plotCoreRect } from '../../src/sim/world/PlotReserve';
import { Biome, Ground, Obj } from '../../src/sim/world/tiles';

const R = BALANCE.world.plot;

/** Köpekler yerleştirmeyi engellemesin: hepsi çekirdeğin sağ alt köşesine. */
function park(sim: Sim): void {
  for (const d of sim.shelterDogs()) {
    d.x = sim.world.plot.x + sim.world.plot.w - 3.5;
    d.y = sim.world.plot.y + sim.world.plot.h - 3.5;
    d.path = [];
  }
}

function place(sim: Sim, building: BuildingType, x: number, y: number): void {
  park(sim);
  const r = sim.command({ type: 'placeBuilding', building, x, y });
  expect(r.ok, `${building} @ ${x},${y}: ${r.message}`).toBe(true);
}

function minutes(sim: Sim, n: number): void {
  const frames = Math.ceil((n / BALANCE.time.minutesPerRealSecond) * 30);
  for (let i = 0; i < frames; i++) sim.update(1 / 30, IDLE_INPUT);
}

describe('Kuruluş açılışı (0.19.0)', () => {
  it('kuruluş dünyası: çekirdek arsa, yalnız ofis, kapılar yollarla hizalı, rezerv şeridi çayır', () => {
    const core = plotCoreRect();
    expect(core).toEqual({ x: 88, y: 90, w: 24, h: 20 });
    for (const seed of [1901, 7, 424242]) {
      const sim = Sim.create(seed, 'normal', 'guided');
      const w = sim.world;
      expect(sim.starter).toBe('guided');
      expect(w.plot).toEqual(core);
      expect(sim.buildings.map((b) => b.type)).toEqual(['office']);
      expect(sim.shelterDogs()).toHaveLength(1);
      expect(sim.goals.current?.id).toBe('kennel');
      // Çit köşeleri ve kapılar.
      expect(w.objectAt(core.x, core.y)).toBe(Obj.Fence);
      expect(w.objectAt(core.x + core.w - 1, core.y + core.h - 1)).toBe(Obj.Fence);
      for (const [x, y] of [[100, 109], [101, 109], [111, 100], [111, 101]]) expect(w.objectAt(x, y), `kapı ${x},${y}`).toBe(Obj.Gate);
      // Kapılardan üretimdeki yolların başına kısa yol.
      const links: Array<[number, number]> = [];
      for (let y = 110; y < R.y + R.h; y++) links.push([100, y], [101, y]);
      for (let x = 112; x < R.x + R.w; x++) links.push([x, 100], [x, 101]);
      for (const [x, y] of links) {
        expect(w.biomeAt(x, y), `yol ${x},${y}`).toBe(Biome.Road);
        expect(w.groundAt(x, y)).toBe(Ground.Path);
        expect(w.isSolid(x, y)).toBe(false);
      }
      expect(w.biomeAt(100, R.y + R.h)).toBe(Biome.Road);
      expect(w.biomeAt(R.x + R.w, 100)).toBe(Biome.Road);
      // Rezervin geri kalanı çayır ve boş; tek istisna kapı dışındaki öğretici yuva.
      const isLink = (x: number, y: number) => links.some(([lx, ly]) => lx === x && ly === y);
      for (let y: number = R.y; y < R.y + R.h; y++) {
        for (let x: number = R.x; x < R.x + R.w; x++) {
          if (w.inPlot(x, y) || isLink(x, y)) continue;
          expect(w.biomeAt(x, y), `şerit ${x},${y}`).toBe(Biome.Meadow);
          if (x === 104 && y === 113) continue;
          expect(w.objectAt(x, y), `şerit nesne ${x},${y}`).toBe(Obj.None);
        }
      }
      expect(w.nests.some((n) => n.x === 104 && n.y === 113)).toBe(true);
      expect(w.objectAt(104, 113)).toBe(Obj.NestEggs);
      // Ofis kapısından iki yolun ucuna yürünebilir (kapılar açılır).
      const office = sim.buildings[0];
      const door = { x: office.x + 1, y: office.y + 3 };
      expect(findPath(w, door, { x: 100, y: 118 }, { throughGates: true, maxNodes: 30000 }), 'güney yol').not.toBeNull();
      expect(findPath(w, door, { x: 122, y: 100 }, { throughGates: true, maxNodes: 30000 }), 'doğu yol').not.toBeNull();
      // Hazır barınak eskisi gibi.
      const ready = Sim.create(seed);
      expect(ready.starter).toBe('ready');
      expect(ready.world.plot).toEqual({ x: R.x, y: R.y, w: R.w, h: R.h });
      expect(ready.buildings).toHaveLength(9);
      expect(ready.goals.index).toBe(FOUNDING_GOALS);
    }
  });

  it('belediye hedefleri sırayla bir kez ödüllenir; ödül mesajı ve olay', () => {
    const sim = Sim.create(1902, 'normal', 'guided');
    const msgs: string[] = [];
    const done: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.events.on('goal', (g) => done.push(g.id));
    const rep0 = sim.reputation;

    // Kuluçka önce kurulsa da sıra korunur: önce kulübe hedefi beklenir.
    place(sim, 'incubator', 104, 92);
    minutes(sim, 3);
    expect(done).toEqual([]);
    let m0 = sim.money;
    place(sim, 'kennelSmall', 90, 92);
    const kennelCost = BUILDING_DEFS.kennelSmall.cost;
    minutes(sim, 3);
    expect(done).toEqual(['kennel']);
    expect(sim.money).toBe(m0 - kennelCost + goalReward(GOALS[0]));
    expect(msgs.some((m) => m.includes('Hedef tamam') && m.includes('Köpeğine kulübe kur'))).toBe(true);

    place(sim, 'bowl', 93, 92);
    minutes(sim, 3);
    expect(done).toEqual(['kennel']);
    m0 = sim.money;
    place(sim, 'trough', 94, 92);
    minutes(sim, 3);
    // Kap + yalak biter; kuluçka zaten kurulu olduğu için bir sonraki dakikada o da biter.
    expect(done).toEqual(['kennel', 'bowlTrough', 'incubator']);
    expect(sim.money).toBe(m0 - BUILDING_DEFS.trough.cost + goalReward(GOALS[1]) + goalReward(GOALS[2]));
    expect(sim.goals.current).toBeNull();
    expect(sim.reputation).toBeGreaterThanOrEqual(rep0 + 3 * BALANCE.goals.reputation - 0.001);
    // Zincir bitince yeni ödül yok.
    minutes(sim, 3);
    expect(done).toHaveLength(3);
  });

  it('kayıt/yükleme: arsa, şerit, yol bağı ve hedef sırası korunur; ilk genişletme ucuz; eski kayıt hazır sayılır', () => {
    const sim = Sim.create(1903, 'normal', 'guided');
    sim.money = 10000;
    expect(sim.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(true);
    expect(sim.world.plot).toEqual({ x: 88, y: 90, w: 40, h: 20 });
    expect(sim.money).toBe(10000 - BALANCE.world.firstExpansionCost);
    expect(sim.command({ type: 'expandPlot', dir: 'south' }).ok).toBe(true);
    expect(sim.world.plot).toEqual({ x: 88, y: 90, w: 40, h: 36 });
    expect(sim.money).toBe(10000 - BALANCE.world.firstExpansionCost - PLOT_EXPANSION_COST);
    place(sim, 'kennelSmall', 90, 92);
    minutes(sim, 3);
    expect(sim.goals.index).toBe(1);

    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.starter).toBe('guided');
    expect(back.goals.index).toBe(1);
    expect(back.world.plot).toEqual(sim.world.plot);
    expect(back.buildings.map((b) => b.type)).toEqual(sim.buildings.map((b) => b.type));
    for (let y = R.y - 2; y < R.y + R.h + 22; y++) {
      for (let x = R.x - 2; x < R.x + R.w + 12; x++) {
        const i = sim.world.idx(x, y);
        expect(back.world.biome[i], `biyom ${x},${y}`).toBe(sim.world.biome[i]);
        expect(back.world.ground[i], `zemin ${x},${y}`).toBe(sim.world.ground[i]);
        expect(back.world.object[i], `nesne ${x},${y}`).toBe(sim.world.object[i]);
      }
    }
    // Genişlemeyen kuruluş kaydı da aynı dünyaya döner.
    const small = Sim.create(1904, 'normal', 'guided');
    const b2 = Sim.fromJSON(SaveManager.parse(JSON.stringify(small.toJSON()))!);
    expect(b2.world.plot).toEqual(plotCoreRect());
    expect(Array.from(b2.world.biome)).toEqual(Array.from(small.world.biome));
    expect(Array.from(b2.world.ground)).toEqual(Array.from(small.world.ground));

    // 0.19.0 öncesi kayıt: başlangıç ve hedef alanı yok → hazır barınak, kuruluş hedefleri tamam.
    const old = Sim.create(1905).toJSON() as unknown as Record<string, unknown>;
    delete old.starter;
    delete old.goals;
    const b3 = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    expect(b3.starter).toBe('ready');
    expect(b3.goals.index).toBe(FOUNDING_GOALS);
    expect(b3.world.plot).toEqual({ x: R.x, y: R.y, w: R.w, h: R.h });
    // Hazır barınakta genişletme eski fiyatla.
    b3.money = 10000;
    expect(b3.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(true);
    expect(b3.money).toBe(10000 - PLOT_EXPANSION_COST);
  });
});
