import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import type { Dog } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';
import { Zone } from '../../src/sim/world/tiles';

function runMinutes(sim: Sim, minutes: number, each?: () => void): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) {
    sim.update(0.5);
    each?.();
  }
}

function content(dog: Dog): void {
  dog.needs = { hunger: 10, thirst: 10, play: 80, bladder: 10, hygiene: 90, health: 95, loyalty: 60, energy: 90 };
  dog.state = 'idle';
  dog.stateTimer = 0;
}

function lucky(sim: Sim, value: boolean): void {
  (sim.rng as unknown as { chance: (p: number) => boolean }).chance = () => value;
}

/** Arsanın sağ alt köşesine küçük bir karantina alanı boyar, sol üst bir kare döndürür. */
function paintQuarantine(sim: Sim): { x: number; y: number } {
  const p = sim.world.plotInterior();
  const x0 = p.x + p.w - 6;
  const y0 = p.y + p.h - 6;
  sim.command({ type: 'paintZone', zone: Zone.Quarantine, x0, y0, x1: x0 + 3, y1: y0 + 3 });
  return { x: x0, y: y0 };
}

describe('Hastalık', () => {
  it('kirli köpek pire kapar; hasta köpek sahiplendirilemez ve termometre gösterir', () => {
    const sim = Sim.create(701);
    const dog = sim.dogs[0];
    content(dog);
    dog.needs.hygiene = 10;
    lucky(sim, true);
    sim.illness.onDay();
    expect(dog.illness?.kind).toBe('flea');
    expect(dog.sick).toBe(true);
    expect(sim.stats.illnesses).toBe(1);
    lucky(sim, false);
    const d2 = Sim.create(702).dogs[0];
    content(d2);
    d2.needs.hygiene = 10;
    expect(d2.illness).toBeNull();
  });

  it('kulübesiz köpek soğukta üşütür, pislik çoksa mide bozulur', () => {
    const sim = Sim.create(703);
    const dog = sim.dogs[0];
    content(dog);
    sim.assignKennel(dog, null);
    sim.weatherSys.weather = 'snow';
    lucky(sim, true);
    sim.illness.onDay();
    expect(dog.illness?.kind).toBe('cold');
    dog.illness = null;
    sim.assignKennel(dog, sim.freeKennelFor(dog));
    sim.weatherSys.weather = 'clear';
    sim.clock.totalMinutes = 8 * 60; // ilkbahar
    for (let i = 0; i < BALANCE.dogs.illness.stomachMessAbove + 1; i++) sim.messTiles.add(sim.world.idx(sim.world.plot.x + 3 + i, sim.world.plot.y + 3));
    sim.illness.onDay();
    expect(dog.illness).toEqual({ kind: 'stomach', days: 0 });
  });

  it('bulaşma 2 kare içinde olur, karantina sınırını geçmez', () => {
    const sim = Sim.create(704);
    const a = sim.dogs[0];
    content(a);
    const b = sim.addDog(a.genome, 'egg', 20, a.x + 1, a.y);
    const c = sim.addDog(a.genome, 'egg', 20, a.x + 6, a.y);
    content(b);
    content(c);
    a.illness = { kind: 'flea', days: 0 };
    lucky(sim, true);
    sim.illness.onHour();
    expect(b.illness?.kind).toBe('flea');
    expect(c.illness).toBeNull();
    // Karantina: a bölgede, d dışarıda → bulaşmaz.
    const q = paintQuarantine(sim);
    const sim2 = Sim.create(705);
    const a2 = sim2.dogs[0];
    content(a2);
    const q2 = paintQuarantine(sim2);
    a2.x = q2.x + 0.5;
    a2.y = q2.y + 0.5;
    const d = sim2.addDog(a2.genome, 'egg', 20, q2.x - 1 + 0.5, q2.y + 0.5); // bölgenin hemen dışı
    content(d);
    a2.illness = { kind: 'cold', days: 0 };
    lucky(sim2, true);
    expect(sim2.illness.inQuarantine(a2)).toBe(true);
    expect(sim2.illness.inQuarantine(d)).toBe(false);
    sim2.illness.onHour();
    expect(d.illness).toBeNull();
    expect(q.x).toBeGreaterThan(0);
  });

  it('politika açıkken hasta köpek karantina alanına gider ve orada kalır; kapalıyken gitmez', () => {
    const sim = Sim.create(706);
    const dog = sim.dogs[0];
    content(dog);
    const q = paintQuarantine(sim);
    dog.illness = { kind: 'flea', days: 0 };
    lucky(sim, false); // yeni hastalık/bulaşma olmasın
    expect(sim.policies.quarantineSick).toBe(true);
    runMinutes(sim, 120, () => content_keep(dog));
    expect(sim.world.zoneAt(dog.tileX, dog.tileY)).toBe(Zone.Quarantine);
    expect(['sit', 'lie']).toContain(dog.state);
    runMinutes(sim, 120, () => content_keep(dog));
    expect(sim.world.zoneAt(dog.tileX, dog.tileY)).toBe(Zone.Quarantine);
    expect(dog.x).toBeGreaterThanOrEqual(q.x);

    const sim2 = Sim.create(706);
    const dog2 = sim2.dogs[0];
    content(dog2);
    paintQuarantine(sim2);
    dog2.illness = { kind: 'flea', days: 0 };
    lucky(sim2, false);
    sim2.command({ type: 'setPolicy', policy: { quarantineSick: false } });
    runMinutes(sim2, 120, () => content_keep(dog2));
    expect(sim2.world.zoneAt(dog2.tileX, dog2.tileY)).not.toBe(Zone.Quarantine);
  });

  it('karantina alanı yoksa uyarı çıkar', () => {
    const sim = Sim.create(707);
    const dog = sim.dogs[0];
    dog.illness = { kind: 'flea', days: 0 };
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((a) => a.id === 'quarantine')).toBe(true);
    expect(sim.alerts.alerts.some((a) => a.id === `ill-${dog.id}`)).toBe(true);
    paintQuarantine(sim);
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((a) => a.id === 'quarantine')).toBe(false);
  });

  it('veteriner personeli hastalığı tedavi eder (görev tahtası + ilaç bedeli)', () => {
    const sim = Sim.create(708);
    const dog = sim.dogs[0];
    content(dog);
    dog.illness = { kind: 'cold', days: 0 };
    lucky(sim, false);
    let c = sim.candidates.find((x) => x.role === 'vet') ?? sim.candidates[0];
    c.role = 'vet';
    c.priorities = { feed: 1, water: 1, clean: 1, play: 1, groom: 1, train: 0, treat: 5 };
    expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
    const s = sim.staff[0];
    s.schedule = new Array(24).fill(1) as typeof s.schedule;
    const m0 = sim.money;
    expect(sim.tasks.tasks.some((t) => t.type === 'treat')).toBe(false);
    runMinutes(sim, 240, () => content_keep(dog));
    expect(dog.illness).toBeNull();
    expect(sim.stats.cured).toBe(1);
    expect(sim.money).toBe(m0 - BALANCE.economy.treatmentPrice);
  });

  it('hastalıklar ihtiyaçları etkiler ve birkaç günde kendiliğinden geçer', () => {
    const sim = Sim.create(709);
    const a = sim.dogs[0];
    content(a);
    const b = sim.addDog(a.genome, 'egg', 20, a.x + 8, a.y + 3);
    content(b);
    a.state = 'sit';
    b.state = 'sit';
    a.stateTimer = 9999;
    b.stateTimer = 9999;
    lucky(sim, false);
    a.illness = { kind: 'flea', days: 0 };
    runMinutes(sim, 120);
    expect(a.needs.hygiene).toBeLessThan(b.needs.hygiene - 3);
    a.illness = { kind: 'stomach', days: 0 };
    const ab = a.needs.bladder;
    const bb = b.needs.bladder;
    runMinutes(sim, 60);
    expect(a.needs.bladder - ab).toBeGreaterThan(b.needs.bladder - bb + 3);
    a.illness = { kind: 'cold', days: BALANCE.dogs.illness.selfHealDays - 1 };
    sim.illness.onDay();
    expect(a.illness).toBeNull();
  });

  it('hastalık kayda yazılır', () => {
    const sim = Sim.create(710);
    sim.dogs[0].illness = { kind: 'stomach', days: 2 };
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.dogs[0].illness).toEqual({ kind: 'stomach', days: 2 });
    expect(back.policies.quarantineSick).toBe(true);
  });
});

/** Köpeğin acil ihtiyaçları oluşmasın ki karantina davranışı gözlemlenebilsin. */
function content_keep(dog: Dog): void {
  dog.needs.hunger = 10;
  dog.needs.thirst = 10;
  dog.needs.bladder = 10;
  dog.needs.energy = 90;
}
