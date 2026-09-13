import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { matchScore } from '../../src/sim/entities/Adopter';
import { Sim } from '../../src/sim/Sim';
import { callableDogs, performAction, resolveAction } from '../../src/sim/systems/Interaction';

function runMinutes(sim: Sim, minutes: number, each?: () => void): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) {
    sim.update(0.5);
    each?.();
  }
}

function calmDog(sim: Sim) {
  const dog = sim.dogs[0];
  dog.needs = { hunger: 10, thirst: 10, play: 80, bladder: 10, hygiene: 90, health: 95, loyalty: 60, energy: 90 };
  dog.state = 'sit';
  dog.stateTimer = 999;
  return dog;
}

describe('Beceriler', () => {
  it('"Gel": çağır aracı yakındaki eğitimli köpekleri oyuncuya getirir', () => {
    const sim = Sim.create(601);
    const dog = calmDog(sim);
    dog.skills.come = 100;
    // Oyuncu arsanın içinde, köpekten 5 kare uzakta.
    sim.player.x = dog.x + 5;
    sim.player.y = dog.y;
    sim.player.facing = 1;
    sim.player.busy = 0;
    expect(callableDogs(sim).map((d) => d.id)).toEqual([dog.id]);
    sim.command({ type: 'setTool', tool: 'call' });
    expect(resolveAction(sim).kind).toBe('call');
    const l0 = dog.needs.loyalty;
    expect(performAction(sim).ok).toBe(true);
    expect(dog.state).toBe('wander');
    expect(dog.path.length).toBeGreaterThan(0);
    expect(dog.needs.loyalty).toBe(l0 + 1);
    runMinutes(sim, 15, () => {
      sim.player.x = dog.x > sim.player.x ? sim.player.x : sim.player.x; // oyuncu sabit
    });
    expect(Math.hypot(dog.x - sim.player.x, dog.y - sim.player.y)).toBeLessThan(2.5);
    dog.skills.come = 0;
    expect(resolveAction(sim).kind).toBe('none');
  });

  it('"Otur": oyuncu birkaç saniye bitişik durunca köpek oturur', () => {
    const sim = Sim.create(602);
    const dog = calmDog(sim);
    dog.skills.sit = 100;
    dog.state = 'idle';
    dog.stateTimer = 999;
    sim.player.x = dog.x + 1;
    sim.player.y = dog.y + 0.2;
    sim.setSpeed(1);
    for (let i = 0; i < 6; i++) sim.update(0.5); // 3 gerçek saniye
    expect(dog.state).toBe('sit');
    expect(dog.stateTimer).toBeGreaterThan(0);
  });

  it('eşleşme puanı: "otur" ve fazladan beceriler bonus verir', () => {
    const sim = Sim.create(603);
    const dog = calmDog(sim);
    const K = BALANCE.dogs.skills;
    const base = matchScore(dog, { minTraining: 1 });
    dog.skills.potty = 100;
    const one = matchScore(dog, { minTraining: 1 });
    expect(one).toBeGreaterThan(base); // tercih tutuyor
    dog.skills.come = 100;
    dog.skills.stay = 100;
    expect(matchScore(dog, { minTraining: 1 })).toBe(Math.min(100, one + 2 * K.extraSkillBonus));
    dog.skills.sit = 100;
    expect(matchScore(dog, { minTraining: 1 })).toBe(Math.min(100, one + 3 * K.extraSkillBonus + K.sitMatchBonus));
    // Boş istek: 85 + bonus, 100'ü aşmaz.
    dog.skills = { sit: 100, stay: 100, come: 100, leash: 100, potty: 100, social: 100 };
    expect(matchScore(dog, {})).toBeLessThanOrEqual(100);
    expect(matchScore(dog, {})).toBeGreaterThan(85);
  });

  it('"Tasma": gezinti arsadan çıkıp dönünce biter, keyif ve sadakat artar', () => {
    const sim = Sim.create(604);
    const dog = calmDog(sim);
    dog.needs.play = 30;
    expect(sim.command({ type: 'walkDog', dogId: dog.id }).ok).toBe(false); // tasma yok
    dog.skills.leash = 100;
    sim.player.x = dog.x + 1;
    sim.player.y = dog.y;
    expect(sim.command({ type: 'walkDog', dogId: dog.id }).ok).toBe(true);
    expect(dog.walking).toBe(true);
    expect(sim.dogs.find((d) => d.walking)?.id).toBe(dog.id);
    expect(sim.command({ type: 'walkDog', dogId: dog.id }).ok).toBe(false); // zaten gezintide
    // Oyuncu arsanın dışına çıkar (doğu kapısının ötesi).
    const p = sim.world.plot;
    sim.player.x = p.x + p.w + 4.5;
    sim.player.y = p.y + Math.floor(p.h / 2) + 0.5;
    runMinutes(sim, 30);
    expect(dog.walkLeftPlot).toBe(true);
    expect(sim.world.inPlotInterior(dog.tileX, dog.tileY)).toBe(false);
    // Kayıt gidiş dönüşünde gezinti korunur.
    const raw = JSON.stringify(sim.toJSON());
    const back = Sim.fromJSON(JSON.parse(raw));
    expect(back.dogById(dog.id)?.walking).toBe(true);
    expect(back.dogById(dog.id)?.walkLeftPlot).toBe(true);
    // Oyuncu geri girer: köpek arsaya girince gezinti biter.
    sim.player.x = p.x + p.w / 2 + 0.5;
    sim.player.y = p.y + p.h / 2 + 0.5;
    const play0 = dog.needs.play;
    const loy0 = dog.needs.loyalty;
    runMinutes(sim, 60);
    expect(dog.walking).toBe(false);
    expect(sim.stats.walks).toBe(1);
    expect(dog.needs.play).toBeGreaterThan(play0);
    expect(dog.needs.loyalty).toBe(loy0 + BALANCE.dogs.skills.walk.loyaltyGain);
    expect(sim.world.inPlotInterior(dog.tileX, dog.tileY)).toBe(true);
  });

  it('"Bırak": dışarıda bırakılan köpek kendi başına eve döner', () => {
    const sim = Sim.create(605);
    const dog = calmDog(sim);
    dog.skills.leash = 100;
    sim.player.x = dog.x + 1;
    sim.player.y = dog.y;
    expect(sim.command({ type: 'walkDog', dogId: dog.id }).ok).toBe(true);
    const p = sim.world.plot;
    sim.player.x = p.x + p.w + 4.5;
    sim.player.y = p.y + Math.floor(p.h / 2) + 0.5;
    runMinutes(sim, 30);
    expect(sim.world.inPlotInterior(dog.tileX, dog.tileY)).toBe(false);
    expect(sim.command({ type: 'endWalk' }).ok).toBe(true);
    expect(dog.walkReturning).toBe(true);
    runMinutes(sim, 90);
    expect(dog.walking).toBe(false);
    expect(sim.world.inPlotInterior(dog.tileX, dog.tileY)).toBe(true);
    expect(sim.stats.walks).toBe(1);
  });
});
