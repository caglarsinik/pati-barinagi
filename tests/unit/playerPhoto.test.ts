import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, isDefaultLook } from '../../src/sim/entities/PlayerLook';
import { Sim } from '../../src/sim/Sim';

/** Bir sahiplendirme: ilk sahiplenici gelir, ilk köpeği ister ve alır; son kaydı döndürür. */
function adoptOne(sim: Sim) {
  const a = sim.adoption.spawnAdopter()!;
  expect(a).toBeTruthy();
  const dog = sim.shelterDogs()[0];
  dog.needs.health = 100;
  dog.needs.hygiene = 100;
  dog.needs.loyalty = 100;
  a.state = 'waiting';
  a.request = { temperament: dog.genome.temperament };
  const r = sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id });
  expect(r.ok).toBe(true);
  return sim.adoptions[sim.adoptions.length - 1];
}

describe('Fotoğrafta oyuncu (0.24.2)', () => {
  it('sahiplendirme kaydı o anki görünümü saklar; sonradan değişse de eski fotoğraf değişmez; kayıtta gider gelir', () => {
    const sim = Sim.create(2703);
    const look = { ...DEFAULT_LOOK, body: 1, hat: 2, hairStyle: 1 };
    sim.command({ type: 'setPlayer', look, name: 'Defne' });
    const rec = adoptOne(sim);
    expect(rec.playerLook).toEqual(look);
    sim.command({ type: 'setPlayer', look: { ...DEFAULT_LOOK, hat: 4 } });
    expect(rec.playerLook).toEqual(look);
    const data = JSON.parse(JSON.stringify(sim.toJSON()));
    const back = Sim.fromJSON(data);
    const i = data.adoptions.length - 1;
    expect(back.adoptions[i].playerLook).toEqual(look);
    // Eski kayıt: alan yok → yok kalır (fotoğrafta oyuncu çizilmez); bozuk alan varsayılana klemplenir.
    delete data.adoptions[i].playerLook;
    expect(Sim.fromJSON(data).adoptions[i].playerLook).toBeUndefined();
    data.adoptions[i].playerLook = { body: 9, hat: 'x' };
    const fixed = Sim.fromJSON(data).adoptions[i].playerLook;
    expect(fixed && isDefaultLook(fixed)).toBe(true);
  });

  it('varsayılan görünümle de kayıt alınır (bugünkü sprite fotoğrafta)', () => {
    const sim = Sim.create(2703);
    const rec = adoptOne(sim);
    expect(rec.playerLook && isDefaultLook(rec.playerLook)).toBe(true);
  });
});
