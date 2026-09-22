import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(1);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

describe('Zafer: Yılın Barınağı', () => {
  it('eşiklerden biri eksikken tetiklenmez', () => {
    const sim = Sim.create(1501);
    sim.stats.adopted = BALANCE.victory.adoptions;
    sim.reputation = BALANCE.victory.reputation - 5;
    runMinutes(sim, 10);
    expect(sim.victory).toBeNull();
    sim.stats.adopted = BALANCE.victory.adoptions - 1;
    sim.reputation = 100;
    runMinutes(sim, 10);
    expect(sim.victory).toBeNull();
  });

  it('iki eşik birlikte sağlanınca bir kez tetiklenir, oyun sürer', () => {
    const sim = Sim.create(1502);
    const events: unknown[] = [];
    const msgs: string[] = [];
    sim.events.on('victory', (v) => events.push(v));
    sim.events.on('message', (m) => msgs.push(m));
    sim.stats.adopted = BALANCE.victory.adoptions;
    sim.reputation = BALANCE.victory.reputation;
    runMinutes(sim, 5);
    expect(sim.victory).toEqual({ day: sim.clock.day, week: sim.clock.week });
    expect(events.length).toBe(1);
    expect(msgs.some((m) => m.includes('Yılın Barınağı'))).toBe(true);
    const t0 = sim.clock.totalMinutes;
    runMinutes(sim, 120);
    expect(sim.clock.totalMinutes).toBeGreaterThan(t0);
    expect(events.length).toBe(1);
    expect(sim.gameOver).toBeNull();
    expect(sim.achievements.unlocked.has('year-shelter')).toBe(true);
  });

  it('kayıt gidiş-dönüşünde zafer korunur; eski kayıtta yok', () => {
    const sim = Sim.create(1503);
    sim.stats.adopted = BALANCE.victory.adoptions;
    sim.reputation = 95;
    runMinutes(sim, 5);
    const won = sim.victory;
    expect(won).not.toBeNull();
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.victory).toEqual(won);
    const raw = JSON.parse(JSON.stringify(Sim.create(1504).toJSON()));
    delete raw.victory;
    expect(Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!).victory).toBeNull();
    raw.victory = { day: 'x' };
    expect(Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!).victory).toBeNull();
  });
});
