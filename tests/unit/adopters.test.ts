import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { PERSON_NAMES } from '../../src/content/names';
import { type AdoptionRequest, matchScore, randomRequest, requestFee, requestText } from '../../src/sim/entities/Adopter';
import { ADOPTER_TYPES, ADOPTER_TYPE_ORDER, VILLAGER_ADOPTER_TYPE, adopterIdentity, typedFee, withTypeLikes } from '../../src/sim/entities/AdopterType';
import { Sim } from '../../src/sim/Sim';

/** Sahiplendirilebilir (sağlıklı, temiz, güvenen) ilk barınak köpeği. */
function readyDog(sim: Sim) {
  const dog = sim.shelterDogs()[0];
  dog.needs.health = 100;
  dog.needs.hygiene = 100;
  dog.needs.loyalty = 100;
  return dog;
}

describe('Sahiplenici kimliği (0.21.0)', () => {
  it('ad soyad ve tip sahiplenici kimliğinden deterministik; altı tip de çıkar; ana RNG sırası değişmez', () => {
    expect(adopterIdentity(7, 101)).toEqual(adopterIdentity(7, 101));
    const types = new Set<string>();
    const names = new Set<string>();
    for (let id = 1; id <= 300; id++) {
      const k = adopterIdentity(7, id);
      types.add(k.type);
      names.add(k.name);
      expect(k.name.split(' ')).toHaveLength(2);
    }
    expect(types.size).toBe(ADOPTER_TYPE_ORDER.length);
    expect(names.size).toBeGreaterThan(200);

    // Sahiplenici üretimi ana RNG'den eskisi kadar çeker: istek, ad (sıra için), ücret, görünüm.
    const a = Sim.create(2501);
    const b = Sim.create(2501);
    a.clock.totalMinutes = b.clock.totalMinutes = 10 * 60;
    const ad = a.adoption.spawnAdopter()!;
    const rep = b.reputation;
    const request = randomRequest(b.rng, rep);
    b.rng.pick(PERSON_NAMES);
    const fee = requestFee(b.rng, request);
    const look = b.rng.int(0, 0xffff);
    expect(a.rng.next()).toBe(b.rng.next());
    expect(ad.look).toBe(look);
    expect({ ...ad.request, likes: undefined, seniorOk: undefined }).toEqual({ ...request, likes: undefined, seniorOk: undefined });
    expect(ad.fee).toBe(typedFee(fee, ad.type));
    expect(ad.name).toBe(adopterIdentity(2501, ad.id).name);
  });

  it('tip isteği ezmez; sevdiği özellik artı verir, eksikliği puan düşürmez; emeklide yaşlı cezası yok', () => {
    const sim = Sim.create(2502);
    const dog = readyDog(sim);
    const r: AdoptionRequest = { temperament: dog.genome.temperament === 'calm' ? 'bold' : 'calm' };
    const liked = withTypeLikes(r, 'student');
    expect(liked.temperament).toBe(r.temperament);
    expect(liked.likes).toEqual(['small']);
    dog.genome.size = 'S';
    expect(matchScore(dog, liked)).toBe(Math.min(100, matchScore(dog, r) + BALANCE.adoption.likeBonus));
    dog.genome.size = 'L';
    expect(matchScore(dog, liked)).toBe(matchScore(dog, r));
    expect(requestText(liked)).toContain('Sever');
    // Yaşlı köpek: tercihsiz istekte 10 puanlık ceza emeklide kalkar.
    dog.ageWeeks = BALANCE.dogs.growth.seniorAtWeek + 1;
    expect(dog.stage).toBe('senior');
    expect(matchScore(dog, { seniorOk: true })).toBe(matchScore(dog, {}) + 10);
    expect(withTypeLikes({}, 'retiree').seniorOk).toBe(true);
    expect(withTypeLikes({}, 'athlete').seniorOk).toBeUndefined();
  });

  it('ücret ve sabır tipe göre, sevdikleri isteğe eklenir; köylü sahiplenicinin tipi rolünden', () => {
    const sim = Sim.create(2503);
    sim.clock.totalMinutes = 10 * 60;
    const seen = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const a = sim.adoption.spawnAdopter()!;
      const T = ADOPTER_TYPES[a.type];
      seen.add(a.type);
      expect(a.patienceLeft).toBeCloseTo(BALANCE.adoption.patienceMinutes * T.patienceMul + sim.decorScore() * BALANCE.decor.patiencePerPoint);
      expect(a.fee % 10).toBe(0);
      expect(a.fee).toBeLessThanOrEqual(BALANCE.adoption.feeMax);
      expect(a.request.likes).toEqual([...T.likes]);
    }
    expect(seen.size).toBeGreaterThan(2);

    // Köy bulununca bazı sahipleniciler köylüdür: adı ve görünümü köylününki, tipi rolünden.
    sim.villageFound = true;
    sim.villagers.ensure();
    let villagerAdopter = null;
    for (let i = 0; i < 40 && !villagerAdopter; i++) {
      const a = sim.adoption.spawnAdopter()!;
      if (a.villager !== undefined) villagerAdopter = a;
    }
    expect(villagerAdopter).not.toBeNull();
    const v = sim.villagers.list[villagerAdopter!.villager!];
    expect(villagerAdopter!.name).toBe(v.name);
    expect(villagerAdopter!.type).toBe(VILLAGER_ADOPTER_TYPE[v.role]);
  });

  it('kayıtta anahtar, tip, görünüm ve köpeğin genomu; geri getirilen köpeğin kaydı işaretlenir; kayıt turu ve eski kayıt', () => {
    const sim = Sim.create(2504);
    sim.clock.totalMinutes = 10 * 60;
    const dog = readyDog(sim);
    const a = sim.adoption.spawnAdopter()!;
    a.state = 'waiting';
    a.request = { ...a.request, size: undefined, stage: undefined };
    expect(sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id }).ok).toBe(true);
    const rec = sim.adoptions[sim.adoptions.length - 1];
    expect(rec.key).toBe(a.id);
    expect(rec.type).toBe(a.type);
    expect(rec.look).toBe(a.look);
    expect(rec.genome).toEqual(dog.genome);
    expect(rec.stage).toBe(dog.stage);
    expect(rec.villager).toBeUndefined();
    // Geri getirme: köpek dönünce kayıt işaretlenir.
    sim.pendingReturns.push({ day: sim.clock.day, dog: dog.toJSON(), adopterName: a.name, key: a.id });
    sim.adoption.update(1);
    expect(rec.returned).toBe(true);
    expect(sim.shelterDogs().some((d) => d.name === dog.name)).toBe(true);

    // Kayıt turu: bekleyen sahiplenicinin tipi ve sevdikleri korunur.
    const b = sim.adoption.spawnAdopter()!;
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    const bb = back.adopters.find((x) => x.id === b.id)!;
    expect(bb.type).toBe(b.type);
    expect(bb.request.likes).toEqual(b.request.likes);
    expect(back.adoptions[back.adoptions.length - 1]).toEqual(sim.adoptions[sim.adoptions.length - 1]);
    // Eski kayıt (tip yok): kimlikten türetilir.
    const old = JSON.parse(JSON.stringify(sim.toJSON()));
    for (const x of old.adopters) delete x.type;
    const ob = Sim.fromJSON(old);
    expect(ob.adopters.find((x) => x.id === b.id)!.type).toBe(adopterIdentity(2504, b.id).type);
  });
});
