import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Sim } from '../../src/sim/Sim';
import { findPath } from '../../src/sim/world/Pathfinder';
import { TileWorld, type TilePos } from '../../src/sim/world/TileWorld';
import { entryPoint, gateGroups, outsideOf } from '../../src/sim/world/gates';
import { Obj } from '../../src/sim/world/tiles';

/** Oyun dakikası cinsinden ilerletir (hız 4x, yarım saniyelik adımlar). */
function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Güney kapının sol karesi. */
function southGate(sim: Sim): TilePos {
  const p = sim.world.plot;
  return { x: Math.floor(p.x + p.w / 2), y: p.y + p.h - 1 };
}

describe('Kapı durumu (TileWorld)', () => {
  it('kapı varsayılan kapalı ve geçilmez; açılınca geçilir; silinince bayrak düşer', () => {
    const w = new TileWorld(8, 8, { x: 0, y: 0, w: 8, h: 8 });
    w.setObject(3, 3, Obj.Gate);
    const v0 = w.gateVersion;
    expect(w.isSolid(3, 3)).toBe(true);
    expect(w.isGateOpen(3, 3)).toBe(false);
    expect(w.setGateOpen(3, 3, true)).toBe(true);
    expect(w.setGateOpen(3, 3, true)).toBe(false); // değişmedi
    expect(w.isSolid(3, 3)).toBe(false);
    expect(w.isGateOpen(3, 3)).toBe(true);
    expect(w.gateTiles()).toEqual([{ x: 3, y: 3 }]);
    w.setObject(3, 3, Obj.None);
    expect(w.gateVersion).toBeGreaterThan(v0);
    expect(w.isGateOpen(3, 3)).toBe(false);
    expect(w.isSolid(3, 3)).toBe(false);
    expect(w.gateTiles()).toEqual([]);
    // Kapı olmayan kare açılamaz.
    expect(w.setGateOpen(3, 3, true)).toBe(false);
    // Yeniden kapı: kapalı başlar.
    w.setObject(3, 3, Obj.Gate);
    expect(w.isSolid(3, 3)).toBe(true);
  });

  it('bitişik kapı kareleri tek grup, dış/iç kare kenara göre', () => {
    const sim = Sim.create(1101);
    const groups = gateGroups(sim.world);
    expect(groups.length).toBe(2);
    for (const g of groups) expect(g.length).toBe(2);
    const south = entryPoint(sim.world, 'south')!;
    expect(south.gate).toEqual(southGate(sim));
    expect(south.outside).toEqual({ x: south.gate.x, y: south.gate.y + 1 });
    expect(south.inside).toEqual({ x: south.gate.x, y: south.gate.y - 1 });
    expect(sim.world.inPlot(south.outside.x, south.outside.y)).toBe(false);
    const east = entryPoint(sim.world, 'east')!;
    expect(east.gate.x).toBe(sim.world.plot.x + sim.world.plot.w - 1);
    expect(outsideOf(sim.world, east.gate)).toEqual({ x: east.gate.x + 1, y: east.gate.y });
  });
});

describe('Yol bulma ve kapı', () => {
  it('kapalı kapı throughGates olmadan yolu keser, seçenekle geçilir, köşe kesilmez', () => {
    const w = new TileWorld(10, 10, { x: 0, y: 0, w: 10, h: 10 });
    for (let x = 0; x < 10; x++) w.setObject(x, 5, x === 5 ? Obj.Gate : Obj.Fence);
    expect(findPath(w, { x: 5, y: 2 }, { x: 5, y: 8 })).toBeNull();
    const path = findPath(w, { x: 5, y: 2 }, { x: 5, y: 8 }, { throughGates: true })!;
    expect(path).not.toBeNull();
    const i = path.findIndex((t) => t.x === 5 && t.y === 5);
    expect(i).toBeGreaterThan(0);
    expect(path[i - 1]).toEqual({ x: 5, y: 4 });
    expect(path[i + 1]).toEqual({ x: 5, y: 6 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 8 });
  });
});

describe('Otomatik kapı (GateSystem)', () => {
  it('oyuncu yaklaşınca iki yarı açılır, uzaklaşınca gecikmeyle kapanır', () => {
    const sim = Sim.create(1102);
    const g = southGate(sim);
    const events: boolean[] = [];
    sim.events.on('gate', (e) => events.push(e.open));
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(false);
    sim.player.x = g.x + 0.5;
    sim.player.y = g.y - 0.5; // ayak kutusu merkezi kapı merkezine 1,2 kare
    sim.update(1 / 30);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(true);
    expect(sim.world.isGateOpen(g.x + 1, g.y)).toBe(true);
    expect(sim.world.isSolid(g.x, g.y)).toBe(false);
    expect(events).toEqual([true]);
    // Uzaklaş: kapanma gecikmesi dolana kadar açık kalır.
    sim.player.y = g.y - 4;
    sim.update(0.5);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(true);
    sim.update(0.5);
    sim.update(0.5);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(false);
    expect(sim.world.isGateOpen(g.x + 1, g.y)).toBe(false);
    expect(sim.world.isSolid(g.x, g.y)).toBe(true);
    expect(events).toEqual([true, false]);
  });

  it('kapıda duran oyuncu varken kapanmaz', () => {
    const sim = Sim.create(1103);
    const g = southGate(sim);
    sim.player.x = g.x + 0.5;
    sim.player.y = g.y + 0.9;
    for (let i = 0; i < 10; i++) sim.gates.update(0.5);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(true);
    // Oyuncu çekilince kapanır.
    sim.player.y = g.y - 5;
    for (let i = 0; i < 4; i++) sim.gates.update(0.5);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(false);
  });

  it('serbest köpek kapıyı açamaz, tasmalı köpek açar', () => {
    const sim = Sim.create(1104);
    const g = southGate(sim);
    sim.player.y = g.y - 6;
    const dog = sim.shelterDogs()[0];
    dog.x = g.x + 0.5;
    dog.y = g.y - 0.5;
    sim.gates.update(0.1);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(false);
    dog.walking = true;
    sim.gates.update(0.1);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(true);
  });

  it('sahiplenici kapının dışında belirir, kapıdan girip ofis önünde bekler', () => {
    const sim = Sim.create(1105);
    sim.reputation = 100;
    const a = sim.adoption.spawnAdopter()!;
    expect(a).not.toBeNull();
    const tile = { x: Math.floor(a.x), y: Math.floor(a.y) };
    expect(sim.world.inPlot(tile.x, tile.y)).toBe(false);
    expect(tile).toEqual(entryPoint(sim.world, 'east')!.outside);
    expect(a.path.length).toBeGreaterThan(0);
    runMinutes(sim, 60);
    expect(a.state).toBe('waiting');
    expect(sim.world.inPlotInterior(Math.floor(a.x), Math.floor(a.y))).toBe(true);
  });

  it('personel vardiyada kapının dışından gelir, vardiya bitince dışarı çıkar', () => {
    const sim = Sim.create(1106);
    const c = sim.candidates[0];
    expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
    const s = sim.staff[0];
    expect(sim.world.inPlot(s.tileX, s.tileY)).toBe(false);
    s.schedule = new Array(24).fill(1) as typeof s.schedule;
    runMinutes(sim, 10);
    expect(s.onDuty).toBe(true);
    expect(sim.world.inPlotInterior(s.tileX, s.tileY)).toBe(true);
    s.schedule = new Array(24).fill(0) as typeof s.schedule;
    runMinutes(sim, 30);
    expect(s.state).toBe('offDuty');
    expect(sim.world.inPlotInterior(s.tileX, s.tileY)).toBe(false);
  });

  it('açık kapı yıkılınca bayrak düşer; genişleyen arsanın yeni kapısı kapalıdır', () => {
    const sim = Sim.create(1107);
    const g = southGate(sim);
    sim.world.setGateOpen(g.x, g.y, true);
    expect(sim.command({ type: 'demolish', x: g.x, y: g.y }).ok).toBe(true);
    expect(sim.world.objectAt(g.x, g.y)).toBe(Obj.None);
    expect(sim.world.isSolid(g.x, g.y)).toBe(false);
    expect(sim.world.isGateOpen(g.x, g.y)).toBe(false);
    sim.money = 10000;
    expect(sim.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(true);
    const east = entryPoint(sim.world, 'east')!;
    expect(east.gate.x).toBe(sim.world.plot.x + sim.world.plot.w - 1);
    expect(sim.world.isGateOpen(east.gate.x, east.gate.y)).toBe(false);
    expect(sim.world.isSolid(east.gate.x, east.gate.y)).toBe(true);
  });

  it('açık kapı kayda yazılmaz: yüklemede kapalı', () => {
    const sim = Sim.create(1108);
    const g = southGate(sim);
    sim.world.setGateOpen(g.x, g.y, true);
    sim.world.setGateOpen(g.x + 1, g.y, true);
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect(back.world.isGateOpen(g.x, g.y)).toBe(false);
    expect(back.world.isSolid(g.x, g.y)).toBe(true);
  });
});
