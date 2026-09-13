import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Dog } from '../../src/sim/entities/Dog';
import type { Temperament } from '../../src/sim/entities/DogGenome';
import { Sim } from '../../src/sim/Sim';

function runMinutes(sim: Sim, minutes: number, each?: () => void): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) {
    sim.update(0.5);
    each?.();
  }
}

/** Tok, dinç, tuvaleti gelmemiş ama oyunu düşük köpek. */
function ready(dog: Dog, play: number, temperament: Temperament): void {
  dog.genome.temperament = temperament;
  dog.needs.hunger = 10;
  dog.needs.thirst = 10;
  dog.needs.bladder = 10;
  dog.needs.energy = 90;
  dog.needs.play = play;
  dog.state = 'idle';
  dog.stateTimer = 0;
}

function addNear(sim: Sim, dog: Dog, dx: number, temperament: Temperament, play: number): Dog {
  const b = sim.addDog({ ...dog.genome, temperament }, 'egg', 20, dog.x + dx, dog.y);
  ready(b, play, temperament);
  return b;
}

function noToys(sim: Sim): void {
  for (const b of [...sim.buildings]) if (b.type === 'toyBall') sim.removeBuilding(b.id);
}

describe('Köpek dostluğu', () => {
  it('iki sıkılmış köpek buluşup birlikte oynar; dostluk ve sosyallik artar', () => {
    const sim = Sim.create(401);
    sim.clock.totalMinutes = 9 * 60;
    noToys(sim);
    const a = sim.dogs[0];
    ready(a, 40, 'playful');
    const b = addNear(sim, a, 2, 'playful', 40);
    const states = new Set<string>();
    runMinutes(sim, 120, () => {
      states.add(a.state);
      states.add(b.state);
    });
    expect(states.has('playTogether')).toBe(true);
    expect(sim.stats.playdates).toBeGreaterThanOrEqual(1);
    expect(a.friends[b.id]).toBeGreaterThanOrEqual(BALANCE.dogs.social.affinityGain);
    expect(b.friends[a.id]).toBeGreaterThanOrEqual(BALANCE.dogs.social.affinityGain);
    expect(a.skills.social).toBeGreaterThan(0);
    expect(a.bestFriend()?.id).toBe(b.id);
    expect(a.playmateId).toBeNull();
    expect(b.playmateId).toBeNull();
  });

  it('çekingen köpek dostluk eşiğinin altında oyun başlatmaz, üstünde başlatır', () => {
    const sim = Sim.create(402);
    sim.clock.totalMinutes = 9 * 60;
    noToys(sim);
    const a = sim.dogs[0];
    ready(a, 40, 'shy');
    // b oyun aramaz (55 >= 50) ama eş olabilir (55 < 60)
    const b = addNear(sim, a, 2, 'calm', 55);
    b.needs.play = 55;
    runMinutes(sim, 90, () => {
      // b'nin keyfi sabit kalsın ki kendisi başlatmasın
      b.needs.play = Math.max(b.needs.play, 55);
    });
    expect(sim.stats.playdates).toBe(0);
    a.friends[b.id] = BALANCE.dogs.social.shyMinAffinity + 5;
    ready(a, 40, 'shy');
    const together = (): void => {
      b.x = a.x + 2;
      b.y = a.y;
      b.path = [];
      ready(b, 55, 'calm');
    };
    together();
    runMinutes(sim, 120, () => {
      b.needs.play = Math.max(b.needs.play, 55);
      // Dolaşırken birbirinden uzaklaşırlarsa yeniden yan yana getir (yarıçap testi değil).
      if (sim.stats.playdates === 0 && a.playmateId === null && Math.hypot(a.x - b.x, a.y - b.y) > 6) together();
    });
    expect(sim.stats.playdates).toBeGreaterThanOrEqual(1);
  });

  it('cesur×cesur oyunun sonu zara göre hırlaşma ya da dostluk olur', () => {
    const sim = Sim.create(403);
    const a = sim.dogs[0];
    const b = addNear(sim, a, 1, 'bold', 40);
    a.genome.temperament = 'bold';
    const pair = (): void => {
      a.playmateId = b.id;
      b.playmateId = a.id;
      a.state = 'playTogether';
      b.state = 'playTogether';
      a.stateTimer = 0;
      b.stateTimer = 0;
    };
    const rng = sim.rng as unknown as { chance: (p: number) => boolean };
    const orig = rng.chance;
    rng.chance = () => true; // zar: hırlaşma
    pair();
    sim.brain.update(0.1);
    expect(a.state).toBe('growl');
    expect(a.friends[b.id]).toBe(BALANCE.dogs.social.growlAffinity);
    expect(sim.stats.growls).toBe(1);
    expect(sim.alerts.alerts.some((x) => x.id === 'growl') || sim.flags.growlUntil > sim.clock.totalMinutes).toBe(true);
    rng.chance = () => false; // zar: dost oyunu
    pair();
    sim.brain.update(0.1);
    expect(a.state).not.toBe('growl');
    expect(a.friends[b.id]).toBe(BALANCE.dogs.social.growlAffinity + BALANCE.dogs.social.affinityGain);
    // Sosyalliği tam köpekler hırlaşmaz.
    rng.chance = () => true;
    a.skills.social = 100;
    b.skills.social = 100;
    pair();
    sim.brain.update(0.1);
    expect(a.state).not.toBe('growl');
    rng.chance = orig;
  });

  it('sıkılan ve aç köpek arada havlar', () => {
    const sim = Sim.create(404);
    noToys(sim);
    const a = sim.dogs[0];
    ready(a, 10, 'calm');
    a.needs.hunger = 90;
    for (const bwl of sim.buildings) if (bwl.type === 'bowl') bwl.food = 0;
    let barked = false;
    runMinutes(sim, 180, () => {
      if (a.state === 'bark') barked = true;
      a.needs.play = 10;
    });
    expect(barked).toBe(true);
  });

  it('dostluk kayda yazılır, olmayan köpeklerin puanı temizlenir', () => {
    const sim = Sim.create(405);
    const a = sim.dogs[0];
    const b = addNear(sim, a, 2, 'calm', 70);
    a.friends[b.id] = 42;
    a.friends[9999] = 10;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    const a2 = back.dogById(a.id)!;
    expect(a2.friends[b.id]).toBe(42);
    expect(a2.friends[9999]).toBeUndefined();
  });

  it('kulübe ataması en iyi dostun kulübesini tercih eder', () => {
    const sim = Sim.create(406);
    sim.money = 50000;
    const p = sim.world.plotInterior();
    let large = null;
    for (let y = p.y + 2; y < p.y + p.h - 4 && !large; y++) for (let x = p.x + 2; x < p.x + p.w - 4 && !large; x++) if (canPlaceBuilding(sim.world, 'kennelLarge', x, y)) large = sim.placeBuilding('kennelLarge', x, y);
    expect(large).not.toBeNull();
    const a = sim.dogs[0];
    sim.assignKennel(a, large);
    const c = addNear(sim, a, 3, 'calm', 70);
    sim.assignKennel(c, null);
    expect(sim.freeKennelFor(c)?.type).toBe('kennelSmall'); // dost değilken ilk boş kulübe
    c.friends[a.id] = 60;
    expect(sim.freeKennelFor(c)?.id).toBe(large!.id);
  });
});
