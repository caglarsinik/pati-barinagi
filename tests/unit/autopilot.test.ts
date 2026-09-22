import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { PILOT_ID } from '../../src/sim/systems/Autopilot';
import { placeMess } from '../../src/sim/systems/MessSystem';

function runSeconds(sim: Sim, sec: number): void {
  for (let i = 0; i < Math.ceil(sec * 30); i++) sim.update(1 / 30, IDLE_INPUT);
}

function pilotOn(seed: number): Sim {
  const sim = Sim.create(seed);
  sim.setSpeed(1);
  expect(sim.command({ type: 'setAutopilot', on: true }).ok).toBe(true);
  expect(sim.autopilot).toBe(true);
  return sim;
}

describe('Otopilot 1: bakım', () => {
  it('boş yem kabını görev tahtasından seçip doldurur', () => {
    const sim = pilotOn(1301);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    expect(sim.foodStock).toBeGreaterThan(0);
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.bowlsFilled).toBeGreaterThanOrEqual(1);
    expect(bowl.food).toBeGreaterThan(0);
    expect(sim.autopilot).toBe(true);
  });

  it('boş yalağı doldurur', () => {
    const sim = pilotOn(1302);
    const trough = sim.buildings.find((b) => b.type === 'trough')!;
    trough.water = 0;
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.watered).toBeGreaterThanOrEqual(1);
  });

  it('pisliği temizler', () => {
    const sim = pilotOn(1303);
    const p = sim.player;
    const tile = placeMess(sim, p.tileX + 2, p.tileY);
    expect(tile).not.toBeNull();
    sim.tasks.refresh();
    runSeconds(sim, 20);
    expect(sim.stats.cleaned).toBeGreaterThanOrEqual(1);
    expect(sim.messTiles.size).toBe(0);
  });

  it('kiler boşsa ve para varsa bir çuval sipariş edip kabı doldurur', () => {
    const sim = pilotOn(1304);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.foodStock = 0;
    sim.money = 5000;
    sim.tasks.refresh();
    runSeconds(sim, 4);
    expect(sim.ledger.some((e) => e.category === 'food')).toBe(true);
    expect(sim.foodStock).toBeGreaterThan(0);
    runSeconds(sim, 30);
    expect(sim.stats.bowlsFilled).toBeGreaterThanOrEqual(1);
  });

  it('parası yoksa sipariş vermez', () => {
    const sim = pilotOn(1305);
    sim.buildings.find((b) => b.type === 'bowl')!.food = 0;
    sim.foodStock = 0;
    sim.money = 0;
    runSeconds(sim, 5);
    expect(sim.ledger.some((e) => e.category === 'food')).toBe(false);
  });

  it('elle girdi ve dokunma komutları otopilotu kapatır', () => {
    const sim = pilotOn(1306);
    sim.update(1 / 30, { dx: 1, dy: 0, run: false });
    expect(sim.autopilot).toBe(false);
    sim.command({ type: 'setAutopilot', on: true });
    sim.command({ type: 'goTo', x: sim.player.tileX + 1, y: sim.player.tileY });
    expect(sim.autopilot).toBe(false);
    sim.command({ type: 'setAutopilot', on: true });
    sim.command({ type: 'interact' });
    expect(sim.autopilot).toBe(false);
    // Kapatınca üstlenilen görev serbest kalır ve yürüyüş durur.
    sim.command({ type: 'setAutopilot', on: true });
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(true);
    sim.command({ type: 'setAutopilot', on: false });
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
    expect(sim.nav.active).toBe(false);
  });

  it('yönetim modunda açılınca avatara geçer; yönetime dönünce görev bırakılır', () => {
    const sim = Sim.create(1307);
    sim.setMode('manage');
    sim.command({ type: 'setAutopilot', on: true });
    expect(sim.mode).toBe('avatar');
    sim.buildings.find((b) => b.type === 'bowl')!.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    expect(sim.pilot.current).not.toBeNull();
    sim.setMode('manage');
    expect(sim.pilot.current).toBeNull();
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
    expect(sim.autopilot).toBe(true);
  });

  it('otopilotun üstlendiği görev personele gitmez, personelin görevleri bozulmaz', () => {
    const sim = pilotOn(1308);
    const c = sim.candidates[0];
    c.role = 'caretaker';
    c.priorities = { feed: 4, water: 4, clean: 4, play: 0, groom: 0, train: 0, treat: 0 };
    expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
    const staff = sim.staff[0];
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    const mine = sim.tasks.tasks.find((t) => t.claimedBy === PILOT_ID)!;
    expect(mine).toBeTruthy();
    expect(sim.tasks.bestFor(staff)?.id).not.toBe(mine.id);
    sim.tasks.releaseAll(staff.id);
    expect(mine.claimedBy).toBe(PILOT_ID);
    runSeconds(sim, 30);
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
  });

  it('ulaşılamaz hedef bırakılır ve bir süre yeniden denenmez', () => {
    const sim = pilotOn(1309);
    const fake = { id: 9001, type: 'feed' as const, targetId: 999999, tile: { x: 1, y: 1 }, urgency: 1, claimedBy: null, createdAt: 0, key: 'feed:999999' };
    sim.tasks.tasks.push(fake);
    runSeconds(sim, 0.5);
    expect(fake.claimedBy).toBeNull();
    expect(sim.pilot.blockedFor(fake.key)).toBeGreaterThan(BALANCE.autopilot.failCooldownSec - 2);
    expect(sim.pilot.current).toBeNull();
    runSeconds(sim, 5);
    expect(fake.claimedBy).toBeNull();
  });

  it('kayıt gidiş-dönüşünde otopilot durumu korunur', () => {
    const sim = pilotOn(1310);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.autopilot).toBe(true);
    const off = Sim.create(1311);
    expect(Sim.fromJSON(SaveManager.parse(JSON.stringify(off.toJSON()))!).autopilot).toBe(false);
  });
});
