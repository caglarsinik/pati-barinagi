import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { type Difficulty, Sim } from '../../src/sim/Sim';
import { runInspection } from '../../src/sim/systems/EconomySystem';

describe('Zorluk seviyesi', () => {
  it('başlangıç parası zorluğa göre', () => {
    expect(Sim.create(1301, 'easy').money).toBe(BALANCE.difficulty.easy.startMoney);
    expect(Sim.create(1301).money).toBe(BALANCE.difficulty.normal.startMoney);
    expect(Sim.create(1301, 'hard').money).toBe(BALANCE.difficulty.hard.startMoney);
    expect(Sim.create(1301, 'hard').difficulty).toBe('hard');
  });

  it('haftalık yardım zorluk çarpanıyla çarpılır', () => {
    const insp = (d: Difficulty) => runInspection(Sim.create(1302, d));
    const n = insp('normal');
    const e = insp('easy');
    const h = insp('hard');
    expect(e.multiplier).toBe(n.multiplier);
    expect(h.multiplier).toBe(n.multiplier);
    const base = n.dogsCounted * BALANCE.economy.aidPerDogPerWeek * n.multiplier;
    expect(n.aid).toBe(Math.round(base));
    expect(e.aid).toBe(Math.round(base * BALANCE.difficulty.easy.aidMul));
    expect(h.aid).toBe(Math.round(base * BALANCE.difficulty.hard.aidMul));
  });

  it('ihtiyaçlar zorluk çarpanıyla hızlanır ya da yavaşlar', () => {
    const grow = (d: Difficulty): number => {
      const sim = Sim.create(1303, d);
      const dog = sim.dogs[0];
      dog.needs.hunger = 20;
      dog.needs.thirst = 20;
      dog.needs.energy = 90;
      const h0 = dog.needs.hunger;
      sim.stepSim(60);
      return dog.needs.hunger - h0;
    };
    const n = grow('normal');
    expect(n).toBeGreaterThan(0);
    expect(grow('easy') / n).toBeCloseTo(BALANCE.difficulty.easy.needsMul, 1);
    expect(grow('hard') / n).toBeCloseTo(BALANCE.difficulty.hard.needsMul, 1);
  });

  it('kayıtta korunur; eski ya da bozuk kayıtta normal', () => {
    const sim = Sim.create(1304, 'hard');
    const raw = JSON.parse(JSON.stringify(sim.toJSON()));
    expect(Sim.fromJSON(raw).difficulty).toBe('hard');
    expect(Sim.fromJSON(raw).aidMul()).toBe(BALANCE.difficulty.hard.aidMul);
    delete raw.difficulty;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!);
    expect(back.difficulty).toBe('normal');
    expect(back.money).toBe(sim.money);
    raw.difficulty = 'bogus';
    expect(Sim.fromJSON(raw).difficulty).toBe('normal');
  });
});
