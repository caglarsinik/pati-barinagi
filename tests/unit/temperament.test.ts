import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction, tameTreatsFor } from '../../src/sim/systems/Interaction';

const DAY = 24 * 60;

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

function faceDog(sim: Sim, dog: { x: number; y: number }): void {
  sim.player.x = dog.x;
  sim.player.y = dog.y + 1.2;
  sim.player.facing = 3;
  sim.player.busy = 0;
}

describe('Huy', () => {
  it('çekingen köpek güvenmeden az, güvenince çok bağlanır', () => {
    const sim = Sim.create(501);
    const dog = sim.dogs[0];
    dog.genome.temperament = 'shy';
    dog.state = 'sit';
    dog.stateTimer = 999;
    const T = BALANCE.dogs.temperament;
    dog.needs.loyalty = T.shyTrustAt - 10;
    faceDog(sim, dog);
    expect(resolveAction(sim).kind).toBe('pet');
    expect(performAction(sim).ok).toBe(true);
    expect(dog.needs.loyalty).toBeCloseTo(T.shyTrustAt - 10 + BALANCE.dogs.petLoyaltyGain * T.shyPetMulBelow);
    dog.needs.loyalty = T.shyTrustAt + 10;
    dog.petsToday = 0;
    sim.player.busy = 0;
    performAction(sim);
    expect(dog.needs.loyalty).toBeCloseTo(T.shyTrustAt + 10 + BALANCE.dogs.petLoyaltyGain * T.shyPetMulAbove);
  });

  it('güveni düşük çekingen köpek yaklaşan oyuncudan kaçar', () => {
    const sim = Sim.create(502);
    const dog = sim.dogs[0];
    dog.genome.temperament = 'shy';
    dog.needs.loyalty = 20;
    dog.needs.hunger = 10;
    dog.needs.thirst = 10;
    dog.needs.bladder = 10;
    dog.needs.play = 80;
    dog.needs.energy = 90;
    dog.state = 'sit';
    dog.stateTimer = 999;
    // Oyuncuyu köpeğin sağına, bitişiğe koy.
    sim.player.x = dog.x + 1;
    sim.player.y = dog.y;
    const x0 = dog.x;
    sim.setSpeed(1);
    sim.update(0.5);
    expect(dog.state).toBe('wander');
    runMinutes(sim, 6);
    expect(Math.abs(dog.x - x0)).toBeGreaterThan(1);
    // Güvenen çekingen kaçmaz.
    const sim2 = Sim.create(502);
    const d2 = sim2.dogs[0];
    d2.genome.temperament = 'shy';
    d2.needs.loyalty = 70;
    d2.state = 'sit';
    d2.stateTimer = 999;
    sim2.player.x = d2.x + 1;
    sim2.player.y = d2.y;
    sim2.setSpeed(1);
    sim2.update(0.5);
    expect(d2.state).toBe('sit');
  });

  it('cesur sokak köpeği iki ödülle evcilleşir', () => {
    const sim = Sim.create(503);
    const wild = sim.dogs.find((d) => d.wild)!;
    wild.genome.temperament = 'bold';
    expect(tameTreatsFor(wild)).toBe(BALANCE.dogs.temperament.boldTameTreats);
    sim.treats = 5;
    faceDog(sim, wild);
    expect(resolveAction(sim).kind).toBe('treatWild');
    expect(performAction(sim).ok).toBe(true);
    expect(wild.following).toBe(false);
    sim.player.busy = 0;
    expect(performAction(sim).ok).toBe(true);
    expect(wild.following).toBe(true);
  });

  it('"Bekle" bilen köpek kaçmaz, cesur köpek daha kolay kaçar', () => {
    const sim = Sim.create(504);
    const dog = sim.shelterDogs()[0];
    dog.needs.loyalty = 5;
    dog.state = 'idle';
    dog.skills.stay = 100;
    sim.clock.totalMinutes = 23 * 60;
    const seen: number[] = [];
    const rng = sim.rng as unknown as { chance: (p: number) => boolean };
    rng.chance = (p: number) => {
      seen.push(p);
      return true;
    };
    sim.eventSys.onHour(23);
    expect(dog.wild).toBe(false);
    dog.skills.stay = 0;
    dog.genome.temperament = 'bold';
    sim.eventSys.onHour(23);
    expect(dog.wild).toBe(true);
    expect(seen).toContain(BALANCE.events.escapeChancePerDog * BALANCE.dogs.temperament.boldEscapeMul);
    expect(dog.trust).toBe(tameTreatsFor(dog) - 1);
    expect(sim.clock.totalMinutes).toBeLessThan(DAY);
  });
});
