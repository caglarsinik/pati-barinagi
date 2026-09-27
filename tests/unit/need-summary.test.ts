import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/Rng';
import { randomGenome } from '../../src/sim/entities/DogGenome';
import { Sim } from '../../src/sim/Sim';
import type { Alert } from '../../src/sim/systems/AlertSystem';
import { needSummary, needSummaryFromAlerts, needSummaryText } from '../../src/sim/systems/NeedSummary';

/** Dört köpekli hazır barınak, öğlen (öğün saati değil), bütün ihtiyaçlar iyi. */
function calmSim(): Sim {
  const sim = Sim.create(4242, 'normal', 'ready');
  const rng = new Rng(7);
  const p = sim.world.plot;
  while (sim.shelterDogs().length < 4) sim.addDog(randomGenome(rng, 'common'), 'egg', 30, p.x + 6 + sim.shelterDogs().length * 2, p.y + 12);
  sim.clock.totalMinutes = 12 * 60;
  for (const d of sim.shelterDogs()) {
    Object.assign(d.needs, { hunger: 0, thirst: 0, hygiene: 100, play: 100, health: 100 });
    d.illness = null;
  }
  return sim;
}

const alert = (id: string, severity: Alert['severity'], dogId?: number): Alert => ({ id, text: '', severity, dogId });

describe('İhtiyaç özeti şeridi (0.22.0)', () => {
  it('köpek uyarılarını türüne göre sayar; eşikler AlertSystem ile aynı', () => {
    const sim = calmSim();
    const [a, b, c] = sim.shelterDogs();
    Object.assign(a.needs, { hunger: 90, thirst: 90 });
    Object.assign(b.needs, { hunger: 97, hygiene: 10 });
    c.illness = { kind: 'flea', days: 1 };
    c.needs.play = 10;
    sim.alerts.refresh();
    const s = needSummary(sim);
    const homeless = sim.shelterDogs().filter((d) => d.kennelId === null);
    expect(s).toMatchObject({ hungry: 2, thirsty: 1, sick: 1, dirty: 1, bored: 1, homeless: homeless.length, severity: 'danger' });
    expect(s.dogs).toBe(new Set([a.id, b.id, c.id, ...homeless.map((d) => d.id)]).size);
    const text = needSummaryText(s);
    expect(text.startsWith('2 köpek aç · 1 susuz · 1 hasta · 1 kirli')).toBe(true);
    expect(text.endsWith('1 sıkılmış')).toBe(true);
  });

  it('"yemek bekliyor" (öğün saati) aç sayılmaz; iyi köpek şerit üretmez', () => {
    const sim = calmSim();
    for (const d of sim.shelterDogs()) d.kennelId = d.kennelId ?? -1;
    sim.clock.totalMinutes = 8 * 60;
    sim.shelterDogs()[0].needs.hunger = 65;
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((x) => x.id.startsWith('meal-'))).toBe(true);
    const s = needSummary(sim);
    expect(s.hungry).toBe(0);
    expect(s.dogs).toBe(0);
    expect(needSummaryText(s)).toBe('');
  });

  it('metin: ilk parça "köpek" taşır, genel uyarılar sayılmaz, köpek bir kez sayılır, renk en ağır uyarıdan', () => {
    expect(needSummaryText(needSummaryFromAlerts([]))).toBe('');
    const bored = needSummaryFromAlerts([alert('bored-5', 'info', 5), alert('mess', 'warn'), alert('adopters', 'info')]);
    expect(needSummaryText(bored)).toBe('1 köpek sıkılmış');
    expect(bored.severity).toBe('info');
    expect(bored.dogs).toBe(1);
    const two = needSummaryFromAlerts([alert('nokennel-2', 'warn', 2), alert('dirty-2', 'warn', 2), alert('thirst-3', 'danger', 3)]);
    expect(needSummaryText(two)).toBe('1 köpek susuz · 1 kirli · 1 kulübesiz');
    expect(two.dogs).toBe(2);
    expect(two.severity).toBe('danger');
  });
});
