import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { adoptable } from '../../src/sim/entities/Adopter';
import { Dog } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

function makeAdoptable(sim: Sim): void {
  for (const d of sim.shelterDogs()) {
    d.needs.health = 95;
    d.needs.hygiene = 90;
    d.needs.loyalty = 60;
    d.needs.hunger = 20;
    d.needs.thirst = 20;
  }
}

describe('Sahiplendirme anahtarı', () => {
  it('varsayılan açık; kapalıyken sahiplenici gelmez', () => {
    const sim = Sim.create(901);
    expect(sim.policies.adoptionsOpen).toBe(true);
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    let arrived = 0;
    sim.events.on('adopterArrived', () => arrived++);
    expect(sim.adoption.spawnAdopter()).toBeNull();
    runMinutes(sim, 12 * 60);
    expect(arrived).toBe(0);
    expect(sim.adopters.length).toBe(0);
  });

  it('kapatınca bekleyen ve yoldaki sahiplenici itibar kaybı olmadan uğurlanır', () => {
    const sim = Sim.create(902);
    sim.clock.totalMinutes = 10 * 60;
    const a = sim.adoption.spawnAdopter()!;
    a.state = 'waiting';
    a.path = [];
    const b = sim.adoption.spawnAdopter()!;
    expect(b.state).toBe('walking');
    const rep0 = sim.reputation;
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    expect(a.state).toBe('leaving');
    expect(b.state).toBe('leaving');
    expect(msgs.some((m) => m.includes('2'))).toBe(true);
    runMinutes(sim, 240);
    expect(sim.adopters.length).toBe(0);
    expect(sim.reputation).toBe(rep0);
  });

  it('kapalıyken adopt komutu reddedilir', () => {
    const sim = Sim.create(903);
    makeAdoptable(sim);
    sim.clock.totalMinutes = 10 * 60;
    const a = sim.adoption.spawnAdopter()!;
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    a.state = 'waiting';
    const r = sim.command({ type: 'adopt', adopterId: a.id, dogId: sim.dogs[0].id });
    expect(r.ok).toBe(false);
    expect(sim.shelterDogs().length).toBe(1);
  });

  it('yeniden açınca sahiplenici gelir', () => {
    const sim = Sim.create(904);
    sim.weatherSys.weather = 'clear'; // yağmur sahiplenici sayısını düşürmesin
    sim.reputation = 100;
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    runMinutes(sim, 60);
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: true } });
    expect(sim.adoption.spawnAdopter()).not.toBeNull();
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: true } });
    let arrived = 0;
    sim.events.on('adopterArrived', () => arrived++);
    runMinutes(sim, 12 * 60);
    expect(arrived).toBeGreaterThanOrEqual(1);
  });

  it('kapalıyken bilgi uyarısı var, açınca kaybolur', () => {
    const sim = Sim.create(905);
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((x) => x.id === 'adoptClosed')).toBe(true);
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: true } });
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((x) => x.id === 'adoptClosed')).toBe(false);
  });

  it('politika kayıtta korunur; eksikse açık kabul edilir', () => {
    const sim = Sim.create(906);
    sim.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.policies.adoptionsOpen).toBe(false);
    const raw = sim.toJSON() as unknown as { policies: Record<string, unknown> };
    delete raw.policies.adoptionsOpen;
    const back2 = Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!);
    expect(back2.policies.adoptionsOpen).toBe(true);
  });
});

describe('Köpeği tut', () => {
  it('tutulan köpek sahiplendirilemez, bırakınca yeniden uygun', () => {
    const sim = Sim.create(911);
    makeAdoptable(sim);
    const dog = sim.dogs[0];
    expect(adoptable(dog)).toBeNull();
    expect(sim.command({ type: 'setKeep', dogId: dog.id, keep: true }).ok).toBe(true);
    expect(dog.keep).toBe(true);
    expect(typeof adoptable(dog)).toBe('string');
    sim.clock.totalMinutes = 10 * 60;
    const a = sim.adoption.spawnAdopter()!;
    a.state = 'waiting';
    expect(sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id }).ok).toBe(false);
    expect(sim.shelterDogs().length).toBe(1);
    sim.command({ type: 'setKeep', dogId: dog.id, keep: false });
    expect(adoptable(dog)).toBeNull();
  });

  it('vahşi köpekte reddedilir; kayıtta korunur, eksikse false', () => {
    const sim = Sim.create(912);
    const wild = sim.dogs.find((d) => d.wild)!;
    expect(sim.command({ type: 'setKeep', dogId: wild.id, keep: true }).ok).toBe(false);
    const dog = sim.dogs[0];
    dog.keep = true;
    expect(Dog.fromJSON(dog.toJSON())!.keep).toBe(true);
    const raw = dog.toJSON() as unknown as Record<string, unknown>;
    delete raw.keep;
    expect(Dog.fromJSON(raw)!.keep).toBe(false);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.dogById(dog.id)!.keep).toBe(true);
  });
});
