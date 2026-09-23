import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { buildingDoorTile } from '../../src/sim/entities/Building';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { type SignId, landingTile, signKnown, signposts, travelMinutes } from '../../src/sim/world/Signposts';

const sign = (sim: Sim, id: SignId) => signposts(sim.world).find((s) => s.id === id)!;
const standAt = (sim: Sim, id: SignId): void => {
  const l = landingTile(sim.world, sign(sim, id));
  sim.player.x = l.x + 0.5;
  sim.player.y = l.y + 0.9;
  sim.player.facing = 3;
};
const reveal = (sim: Sim, id: SignId): void => {
  const s = sign(sim, id);
  sim.world.explored[sim.world.idx(s.x, s.y)] = 1;
};

describe('Yol tabelaları ve hızlı seyahat (0.20.3)', () => {
  it('tabelalar barınak kapısının dışında, doğu yolunun ucunda ve köy girişinde; yürünebilir; arsa büyüyünce barınak tabelası taşınır', () => {
    for (const seed of [2301, 7, 424242]) {
      for (const starter of ['ready', 'guided'] as const) {
        const sim = Sim.create(seed, 'normal', starter);
        const signs = signposts(sim.world);
        expect(signs.map((s) => s.id), `${seed} ${starter}`).toEqual(['shelter', 'east', 'village']);
        for (const s of signs) {
          expect(sim.world.isSolid(s.x, s.y), `${seed} ${starter} ${s.id}`).toBe(false);
          expect(sim.world.inPlot(s.x, s.y)).toBe(false);
          const l = landingTile(sim.world, s);
          expect(sim.world.isSolid(l.x, l.y)).toBe(false);
        }
        const p = sim.world.plot;
        const shelter = signs[0];
        expect(shelter.y).toBeGreaterThanOrEqual(p.y + p.h);
        expect(shelter.y).toBeLessThanOrEqual(p.y + p.h + 1);
        expect(signs[1].x).toBeGreaterThan(p.x + BALANCE.world.plotMaxW);
      }
    }
    const sim = Sim.create(2302);
    sim.money = 10000;
    const before = signposts(sim.world)[0];
    expect(sim.command({ type: 'expandPlot', dir: 'south' }).ok).toBe(true);
    const after = signposts(sim.world)[0];
    expect(after.y).toBeGreaterThanOrEqual(before.y + 16);
    expect(sim.world.inPlot(after.x, after.y)).toBe(false);
    const l = landingTile(sim.world, after);
    expect(sim.world.isSolid(l.x, l.y)).toBe(false);
  });

  it('keşif: başta yalnız barınak tabelası bilinir; köy tabelası görülünce bir kez duyurulur', () => {
    const sim = Sim.create(2303);
    expect(signKnown(sim.world, sign(sim, 'shelter'))).toBe(true);
    expect(signKnown(sim.world, sign(sim, 'village'))).toBe(false);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    const v = sign(sim, 'village');
    sim.player.x = v.x + 0.5;
    sim.player.y = v.y + 2.9;
    sim.update(1 / 30, IDLE_INPUT);
    expect(signKnown(sim.world, v)).toBe(true);
    expect(msgs.filter((m) => m.includes('Tabela buldun'))).toHaveLength(1);
    sim.player.x += 1;
    sim.update(1 / 30, IDLE_INPUT);
    expect(msgs.filter((m) => m.includes('Tabela buldun'))).toHaveLength(1);
  });

  it('hızlı seyahat: tabelanın yanında ve bilinen tabelaya; yol kadar zaman geçer, gezdirilen köpek gelir; bisikletle kısa', () => {
    const sim = Sim.create(2304);
    expect(sim.command({ type: 'travel', to: 'village' }).ok).toBe(false);
    standAt(sim, 'shelter');
    expect(resolveAction(sim).kind).toBe('travel');
    expect(performAction(sim).open).toBe('travel');
    expect(sim.command({ type: 'travel', to: 'village' }).ok).toBe(false);
    reveal(sim, 'village');
    const dog = sim.shelterDogs()[0];
    dog.walking = true;
    dog.x = sim.player.x + 1;
    dog.y = sim.player.y;
    const home = sign(sim, 'shelter');
    const v = sign(sim, 'village');
    const minutes = travelMinutes(home, v, false);
    const t0 = sim.clock.totalMinutes;
    const r = sim.command({ type: 'travel', to: 'village' });
    expect(r.ok).toBe(true);
    expect(sim.clock.totalMinutes - t0).toBe(minutes);
    const land = landingTile(sim.world, v);
    expect(sim.player.tileX).toBe(land.x);
    expect(sim.player.tileY).toBe(land.y);
    expect(Math.hypot(dog.x - sim.player.x, dog.y - sim.player.y)).toBeLessThan(1.5);
    expect(sim.villageFound).toBe(true);
    expect(travelMinutes(home, v, true)).toBeLessThan(minutes);
    // Aynı yere seyahat yok; geri dönüş.
    expect(sim.command({ type: 'travel', to: 'village' }).ok).toBe(false);
    expect(sim.command({ type: 'travel', to: 'shelter' }).ok).toBe(true);
    expect(sim.player.tileY).toBe(landingTile(sim.world, home).y);
  });

  it('gece yolda saat 2 geçerse oyuncu dışarıda bayılır, ofiste uyanır; varış olmaz', () => {
    const sim = Sim.create(2305);
    reveal(sim, 'village');
    standAt(sim, 'village');
    sim.clock.totalMinutes = MINUTES_PER_DAY + 1 * 60 + 55;
    const slept = sim.stats.slept;
    expect(sim.command({ type: 'travel', to: 'shelter' }).ok).toBe(true);
    expect(sim.stats.slept).toBe(slept + 1);
    const office = sim.buildings.find((b) => b.type === 'office')!;
    const door = buildingDoorTile(office);
    expect(sim.player.tileX).toBe(door.x);
    expect(sim.player.tileY).toBe(door.y);
  });
});
