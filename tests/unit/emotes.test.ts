import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Sim } from '../../src/sim/Sim';
import { adopterEmote, dogEmote, staffEmote } from '../../src/sim/systems/Emotes';

function content(sim: Sim) {
  const dog = sim.dogs[0];
  dog.needs = { hunger: 20, thirst: 20, play: 80, bladder: 20, hygiene: 90, health: 95, loyalty: 60, energy: 90 };
  dog.state = 'idle';
  return dog;
}

describe('Emote', () => {
  it('rahat köpek balon göstermez; ihtiyaçlar öncelik sırasıyla balon verir', () => {
    const sim = Sim.create(301);
    const dog = content(sim);
    const E = BALANCE.emotes;
    expect(dogEmote(dog)).toBeNull();
    dog.state = 'sleep';
    expect(dogEmote(dog)).toBe('zzz');
    dog.needs.play = E.playBelow - 1;
    expect(dogEmote(dog)).toBe('note');
    dog.needs.bladder = E.bladderAbove;
    expect(dogEmote(dog)).toBe('poop');
    dog.needs.thirst = E.thirstAbove;
    expect(dogEmote(dog)).toBe('drop');
    dog.needs.hunger = E.hungerAbove;
    expect(dogEmote(dog)).toBe('bone');
    dog.needs.loyalty = BALANCE.events.escapeLoyaltyBelow - 1;
    expect(dogEmote(dog)).toBe('alert');
    dog.needs.health = BALANCE.dogs.sickBelowHealth - 1;
    expect(dogEmote(dog)).toBe('thermo');
  });

  it('sokak köpeği ancak peşe takılınca kalp gösterir', () => {
    const sim = Sim.create(302);
    const wild = sim.dogs.find((d) => d.wild)!;
    expect(dogEmote(wild)).toBeNull();
    wild.following = true;
    expect(dogEmote(wild)).toBe('heart');
  });

  it('personel çalışırken alet, dinlenirken zzz; sahiplenici beklerken soru', () => {
    const sim = Sim.create(303);
    const c = sim.candidates[0];
    sim.command({ type: 'hire', candidateId: c.id });
    const s = sim.staff[0];
    expect(staffEmote(s)).toBeNull();
    s.state = 'working';
    expect(staffEmote(s)).toBe('tool');
    s.state = 'resting';
    expect(staffEmote(s)).toBe('zzz');
    sim.clock.totalMinutes = 10 * 60;
    const a = sim.adoption.spawnAdopter()!;
    expect(adopterEmote(a)).toBeNull();
    a.state = 'waiting';
    expect(adopterEmote(a)).toBe('question');
  });

  it('sevme geçici kalp olayı yayar', () => {
    const sim = Sim.create(304);
    const dog = content(sim);
    dog.state = 'sit';
    dog.stateTimer = 999;
    sim.player.x = dog.x;
    sim.player.y = dog.y + 1.2;
    sim.player.facing = 3;
    sim.player.busy = 0;
    const got: string[] = [];
    sim.events.on('emote', (e) => got.push(`${e.kind}:${e.emote}`));
    expect(sim.command({ type: 'interact' }).ok).toBe(true);
    expect(got).toEqual(['dog:heart']);
  });
});
