import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim';
import { entryPoint } from '../../src/sim/world/gates';
import type { Adopter } from '../../src/sim/entities/Adopter';

describe('gate crossing regression', () => {
  it.each([1, 4] as const)('opens before an adopter enters at speed %s', speed => {
    const sim = Sim.create(1105);
    const a = sim.adoption.spawnAdopter()!;
    const gate = entryPoint(sim.world, 'east')!.gate;
    sim.setSpeed(speed);
    let opened = false;
    sim.events.on('gate', e => {
      if (e.open && e.x === gate.x) {
        expect(Math.floor(a.x)).not.toBe(gate.x);
        opened = true;
      }
    });
    for (let i = 0; i < 200; i++) sim.update(0.5);
    expect(opened).toBe(true);
  });
  it('does not cross a closed gate from outside its opening radius in one large move', () => {
    const sim = Sim.create(1105);
    const a = sim.adoption.spawnAdopter()!;
    const gate = entryPoint(sim.world, 'east')!.gate;
    a.x = gate.x + 4.5;
    a.path = [gate];
    const before = a.x;
    (sim.adoption as unknown as { followPath(a: Adopter, dt: number): void }).followPath(a, 100);
    expect(a.x).toBe(before);
    expect(a.path).toEqual([gate]);
  });
  it('opens gates during sleep simulation before the visitor crosses', () => {
    const sim = Sim.create(1105);
    const a = sim.adoption.spawnAdopter()!;
    const gate = entryPoint(sim.world, 'east')!.gate;
    let opened = false;
    sim.events.on('gate', e => { if(e.open && e.x === gate.x) { expect(Math.floor(a.x)).not.toBe(gate.x); opened = true; } });
    sim.sleepUntilMorning();
    expect(opened).toBe(true);
  });
  it('blocks a free dog but allows a leashed dog at a closed gate', () => {
    const sim = Sim.create(1105);
    const d = sim.shelterDogs()[0];
    const e = entryPoint(sim.world, 'east')!;
    d.x = e.inside.x + .5; d.y = e.inside.y + .5;
    d.path = [e.gate];
    const brain = sim.brain as unknown as { followPath(dog: typeof d, dt: number): void };
    brain.followPath(d, 10);
    expect(d.path).toHaveLength(1);
    d.walking = true;
    brain.followPath(d, 10);
    expect(sim.world.isGateOpen(e.gate.x,e.gate.y)).toBe(true);
    expect(d.path).toHaveLength(0);
  });
});
