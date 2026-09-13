import { describe, expect, it } from 'vitest';
import { GAME } from '../../src/config/game';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';

type Loose = Record<string, any>;

/** Bugünkü kaydı M7 (v1) biçimine geri çevirir: M8 alanları silinir. */
function asV1(sim: Sim): Loose {
  const d = sim.toJSON() as unknown as Loose;
  d.version = 1;
  for (const dog of d.dogs) {
    delete dog.needs.thirst;
    delete dog.friends;
    delete dog.illness;
    delete dog.walking;
  }
  for (const b of d.buildings) delete b.water;
  delete d.stats.watered;
  delete d.stats.drinks;
  delete d.policies.quarantineSick;
  delete d.difficulty;
  return d;
}

describe('Kayıt migrasyonu', () => {
  it('v1 kaydı güncel sürüme yükseltilir, yeni alanlar varsayılan alır', () => {
    const sim = Sim.create(7);
    const raw = JSON.stringify(asV1(sim));
    const parsed = SaveManager.parse(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(GAME.saveVersion);
    const back = Sim.fromJSON(parsed!);
    expect(back.dogs[0].needs.thirst).toBe(30);
    const trough = back.buildings.find((b) => b.type === 'trough')!;
    expect(trough.water).toBe(100);
    expect(back.stats.watered).toBe(0);
    expect(back.stats.drinks).toBe(0);
    expect(back.policies.adoptionsOpen).toBe(true);
    expect(back.dogs[0].keep).toBe(false);
    expect(back.difficulty).toBe('normal');
    expect(back.loan).toBe(0);
    expect(back.gameOver).toBeNull();
    expect(back.buildings.length).toBe(sim.buildings.length);
    expect(back.dogs.length).toBe(sim.dogs.length);
    expect(back.toJSON().version).toBe(GAME.saveVersion);
  });

  it('migrasyonu olmayan sürüm reddedilir', () => {
    const d = Sim.create(8).toJSON() as unknown as Loose;
    d.version = 0;
    expect(SaveManager.parse(JSON.stringify(d))).toBeNull();
  });
});
