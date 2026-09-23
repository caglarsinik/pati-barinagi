import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { NO_EXERTION, type PlayerInput } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';

const S = BALANCE.strays as { refillChance: number; refillChanceWinter: number; maxWild: number };
const saved = { ...S };
const W = BALANCE.weather;

afterEach(() => Object.assign(S, saved));

const wildCount = (sim: Sim): number => sim.dogs.filter((d) => d.wild).length;

/** Her inde tam bir vahşi köpek var mı. */
function onePerDen(sim: Sim): boolean {
  return sim.world.dens.every((den) => sim.dogs.filter((d) => d.wild && d.den?.x === den.x && d.den?.y === den.y).length === 1);
}

describe('İnler mevsimlik dolar (0.18.0)', () => {
  it('mevsim dönümünde boş inler dolar, dolu in ikinci köpek almaz, mevsim ortasında dolmaz, sınır aşılmaz', () => {
    S.refillChance = 1;
    S.refillChanceWinter = 1;
    const sim = Sim.create(1801);
    const dens = sim.world.dens.length;
    expect(wildCount(sim)).toBe(dens);
    const wild = sim.dogs.filter((d) => d.wild);
    sim.removeDog(wild[0].id);
    sim.removeDog(wild[1].id);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.events.emit('week', 2); // ilkbaharın 2. haftası: dönüm değil
    expect(wildCount(sim)).toBe(dens - 2);
    sim.events.emit('week', BALANCE.seasons.weeksPerSeason + 1); // yaz başı
    expect(wildCount(sim)).toBe(dens);
    expect(onePerDen(sim)).toBe(true);
    expect(msgs.some((m) => m.includes('inlerine döndü (2)'))).toBe(true);
    for (const d of sim.dogs.filter((x) => x.wild).slice(0, 3)) sim.removeDog(d.id);
    S.maxWild = wildCount(sim) + 1;
    sim.events.emit('week', BALANCE.seasons.weeksPerSeason * 2 + 1);
    expect(wildCount(sim)).toBe(dens - 2);
  });

  it('dolum ana RNG sırasını ve mevcut köpekleri değiştirmez; aynı tohum aynı köpek', () => {
    S.refillChance = 1;
    const a = Sim.create(1802);
    const b = Sim.create(1802);
    const c = Sim.create(1802);
    for (const s of [a, b, c]) s.removeDog(s.dogs.find((d) => d.wild)!.id);
    a['refillDens'](BALANCE.seasons.weeksPerSeason + 1);
    c['refillDens'](BALANCE.seasons.weeksPerSeason + 1);
    expect(wildCount(a)).toBe(wildCount(b) + 1);
    expect(a.rng.next()).toBe(b.rng.next());
    const na = a.dogs[a.dogs.length - 1];
    const nc = c.dogs[c.dogs.length - 1];
    expect(na.name).toBe(nc.name);
    expect(na.genome).toEqual(nc.genome);
  });
});

describe('Dışarıda hava (0.18.0)', () => {
  it('fırtınada arsa dışında yürümek yorar, koşu 1,5 kat; karda koşu 1,25; arsa içinde etkisiz', () => {
    const sim = Sim.create(1803);
    sim.weatherSys.weather = 'storm';
    expect(sim.weatherSys.playerExertion(false)).toEqual(NO_EXERTION);
    const ex = sim.weatherSys.playerExertion(true);
    expect(ex).toEqual({ runDrainMul: W.stormRunMul, walkDrain: W.stormWalkDrain });
    const p = sim.player;
    p.stamina = 100;
    p.update(1, { dx: 1, dy: 0, run: false }, sim.world, ex);
    expect(p.stamina).toBeCloseTo(100 - W.stormWalkDrain, 5);
    p.stamina = 100;
    p.update(1, { dx: 1, dy: 0, run: true }, sim.world, ex);
    expect(p.stamina).toBeCloseTo(100 - BALANCE.player.staminaDrainPerSecond * W.stormRunMul, 5);
    sim.weatherSys.weather = 'snow';
    expect(sim.weatherSys.playerExertion(true)).toEqual({ runDrainMul: W.snowRunMul, walkDrain: 0 });
    sim.weatherSys.weather = 'rain';
    expect(sim.weatherSys.playerExertion(true)).toEqual(NO_EXERTION);
  });

  it('Sim.update: güney yolunda (arsa dışı) fırtınada yürürken dayanıklılık düşer, arsa içinde düşmez', () => {
    const sim = Sim.create(1804);
    sim.weatherSys.weather = 'storm';
    sim.weatherSys.nextChange = Number.MAX_SAFE_INTEGER;
    const plot = sim.world.plot;
    const down: PlayerInput = { dx: 0, dy: 1, run: false };
    sim.player.x = Math.floor(plot.x + plot.w / 2) + 0.5;
    sim.player.y = plot.y + plot.h + 3.7;
    expect(sim.world.inPlot(sim.player.tileX, sim.player.tileY)).toBe(false);
    sim.player.stamina = 100;
    for (let i = 0; i < 30; i++) sim.update(1 / 30, down);
    expect(sim.player.stamina).toBeLessThan(100 - W.stormWalkDrain * 0.8);
    const inside = sim.world.plotInterior();
    sim.player.x = inside.x + inside.w / 2 + 0.5;
    sim.player.y = inside.y + 3.7;
    sim.player.stamina = 50;
    for (let i = 0; i < 30; i++) sim.update(1 / 30, { dx: 1, dy: 0, run: false });
    expect(sim.player.stamina).toBeGreaterThan(50);
  });
});
