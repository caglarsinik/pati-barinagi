import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { canPlaceBuilding } from '../../src/sim/entities/Building';
import { Sim } from '../../src/sim/Sim';
import { runInspection } from '../../src/sim/systems/EconomySystem';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';

const DAY = 24 * 60;
const WEEK = 7 * DAY;

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

function placePlayerFacing(sim: Sim, x: number, y: number, facing: 0 | 1 | 2 | 3): void {
  sim.player.x = x;
  sim.player.y = y;
  sim.player.facing = facing;
  sim.player.busy = 0;
}

function trough(sim: Sim) {
  return sim.buildings.find((b) => b.type === 'trough')!;
}

/** Köpeği sakin tut: tok, dinç, tuvaleti yok, oyunu var. */
function calm(sim: Sim) {
  const dog = sim.dogs[0];
  dog.needs.hunger = 10;
  dog.needs.energy = 90;
  dog.needs.bladder = 10;
  dog.needs.play = 80;
  return dog;
}

function hireCaretaker(sim: Sim) {
  let c = sim.candidates.find((x) => x.role === 'caretaker') ?? sim.candidates[0];
  c.role = 'caretaker';
  c.priorities = { feed: 4, water: 5, clean: 4, play: 3, groom: 2, train: 0, treat: 0 };
  expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
  const s = sim.staff[sim.staff.length - 1];
  s.schedule = new Array(24).fill(1) as typeof s.schedule;
  return s;
}

describe('Su yalağı', () => {
  it('başlangıç yalağı dolu gelir, susuzluk zamanla artar', () => {
    const sim = Sim.create(101);
    expect(trough(sim).water).toBe(BALANCE.shelter.troughCapacity);
    const dog = calm(sim);
    dog.needs.thirst = 0;
    trough(sim).water = 0; // içemesin
    dog.state = 'sit';
    dog.stateTimer = 9999;
    runMinutes(sim, 60);
    expect(dog.needs.thirst).toBeGreaterThan(7);
    expect(dog.needs.thirst).toBeLessThan(10);
  });

  it('yazın susuzluk çarpanı yükselir', () => {
    const sim = Sim.create(102);
    sim.clock.totalMinutes = BALANCE.seasons.weeksPerSeason * WEEK + 8 * 60; // yaz, 08:00
    sim.weatherSys.weather = 'clear';
    expect(sim.weatherSys.season).toBe('summer');
    expect(sim.weatherSys.modifiers().thirst).toBeCloseTo(BALANCE.weather.summerThirstMul);
    sim.clock.totalMinutes = 8 * 60;
    expect(sim.weatherSys.modifiers().thirst).toBe(1);
  });

  it('susuz köpek yalağa gidip içer, yalak azalır', () => {
    const sim = Sim.create(103);
    const dog = calm(sim);
    dog.needs.thirst = 80;
    const tr = trough(sim);
    runMinutes(sim, 90);
    expect(dog.needs.thirst).toBeLessThan(40);
    expect(tr.water).toBeLessThan(BALANCE.shelter.troughCapacity);
    expect(sim.stats.drinks).toBeGreaterThanOrEqual(1);
  });

  it('oyuncu boş yalağı E ile ücretsiz doldurur', () => {
    const sim = Sim.create(104);
    const tr = trough(sim);
    tr.water = 0;
    const m0 = sim.money;
    placePlayerFacing(sim, tr.x + 0.5, tr.y + 1.4, 3);
    expect(resolveAction(sim).kind).toBe('fillTrough');
    expect(performAction(sim).ok).toBe(true);
    expect(tr.water).toBe(BALANCE.shelter.troughCapacity);
    expect(sim.money).toBe(m0);
    expect(sim.stats.watered).toBe(1);
    sim.player.busy = 0;
    expect(resolveAction(sim).kind).toBe('none');
  });

  it('bakıcı boş yalağı su göreviyle doldurur', () => {
    const sim = Sim.create(105);
    const dog = calm(sim);
    dog.needs.thirst = 10;
    dog.needs.hygiene = 90;
    hireCaretaker(sim);
    const tr = trough(sim);
    tr.water = 0;
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = sim.bowlCapacity(bowl);
    runMinutes(sim, 180);
    expect(tr.water).toBeGreaterThan(0);
    expect(sim.stats.watered).toBeGreaterThanOrEqual(1);
    expect(sim.tasks.tasks.some((t) => t.type === 'water')).toBe(false);
  });

  it('mutfak varsa yalak saatte kendiliğinden dolar', () => {
    const sim = Sim.create(106);
    const dog = calm(sim);
    dog.needs.thirst = 0;
    const p = sim.world.plotInterior();
    let placed = null;
    for (let y = p.y + 2; y < p.y + p.h - 3 && !placed; y++) {
      for (let x = p.x + 2; x < p.x + p.w - 4 && !placed; x++) {
        if (canPlaceBuilding(sim.world, 'kitchen', x, y)) placed = sim.placeBuilding('kitchen', x, y);
      }
    }
    expect(placed).not.toBeNull();
    const tr = trough(sim);
    tr.water = 0;
    sim.stepSim(60); // 06:00 → 07:00: bir saat geçişi
    expect(tr.water).toBe(BALANCE.shelter.kitchenWaterPerHour);
  });

  it('denetimde Su kalemi yalak durumuna göre değişir', () => {
    const sim = Sim.create(107);
    const item = () => runInspection(sim).items.find((i) => i.name === 'Su')!;
    expect(item().effect).toBeGreaterThan(0);
    trough(sim).water = 0;
    expect(item().effect).toBeLessThan(0);
    sim.removeBuilding(trough(sim).id);
    expect(item().value).toBe('Yalak yok');
    expect(item().effect).toBeLessThan(0);
  });

  it('aşırı susuzluk sağlığı düşürür', () => {
    const sim = Sim.create(108);
    const dog = calm(sim);
    dog.needs.thirst = 95;
    dog.needs.health = 90;
    trough(sim).water = 0;
    runMinutes(sim, 120);
    expect(dog.needs.health).toBeLessThan(90);
  });

  it('kayıt gidiş dönüşünde susuzluk ve yalak suyu korunur', () => {
    const sim = Sim.create(109);
    sim.dogs[0].needs.thirst = 61;
    trough(sim).water = 37;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.dogs[0].needs.thirst).toBe(61);
    expect(trough(back).water).toBe(37);
  });
});
