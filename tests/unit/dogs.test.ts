import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { kennelRestTile } from '../../src/sim/entities/Building';
import { randomGenome, genomeKey } from '../../src/sim/entities/DogGenome';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { Rng } from '../../src/core/Rng';
import { looseMessCount, toiletMessCount } from '../../src/sim/systems/MessSystem';
import { Obj, Zone } from '../../src/sim/world/tiles';

/** Oyun dakikası cinsinden ilerletir (hız 4x, yarım saniyelik adımlar). */
function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  const steps = Math.ceil(minutes / perStep);
  for (let i = 0; i < steps; i++) sim.update(0.5);
}

function placePlayerFacing(sim: Sim, x: number, y: number, facing: 0 | 1 | 2 | 3): void {
  sim.player.x = x;
  sim.player.y = y;
  sim.player.facing = facing;
  sim.player.busy = 0;
}

describe('DogGenome', () => {
  it('rastgele genom geçerli ve deterministik', () => {
    const a = randomGenome(new Rng(5), 'rare');
    const b = randomGenome(new Rng(5), 'rare');
    expect(a).toEqual(b);
    expect(genomeKey(a)).toBe(genomeKey(b));
    const c = randomGenome(new Rng(6), 'common');
    expect(c.rarity).toBe('common');
    expect(c.intelligence).toBeGreaterThanOrEqual(1);
    expect(c.intelligence).toBeLessThanOrEqual(5);
  });
});

describe('Başlangıç barınağı', () => {
  const sim = Sim.create(11);

  it('bir köpek, kulübesi ve binalar var', () => {
    expect(sim.shelterDogs().length).toBe(1);
    const dog = sim.dogs[0];
    expect(dog.kennelId).not.toBeNull();
    expect(sim.buildings.some((b) => b.type === 'bowl')).toBe(true);
    expect(sim.buildings.some((b) => b.type === 'office')).toBe(true);
    expect(sim.foodStock).toBe(BALANCE.shelter.startFoodPortions);
    expect(sim.world.zoneTiles(Zone.Toilet).length).toBeGreaterThan(10);
  });

  it('çit geçilmez, kapı kapalıyken geçilmez açılınca geçilir, binalar geçilmez', () => {
    const p = sim.world.plot;
    expect(sim.world.isSolid(p.x, p.y + 5)).toBe(true);
    const gateX = Math.floor(p.x + p.w / 2);
    const gateY = p.y + p.h - 1;
    expect(sim.world.objectAt(gateX, gateY)).toBe(Obj.Gate);
    expect(sim.world.isGateOpen(gateX, gateY)).toBe(false);
    expect(sim.world.isSolid(gateX, gateY)).toBe(true);
    expect(sim.world.setGateOpen(gateX, gateY, true)).toBe(true);
    expect(sim.world.isSolid(gateX, gateY)).toBe(false);
    sim.world.setGateOpen(gateX, gateY, false);
    expect(sim.world.isSolid(gateX, gateY)).toBe(true);
    const office = sim.buildings.find((b) => b.type === 'office')!;
    expect(sim.world.isSolid(office.x + 1, office.y + 1)).toBe(true);
    const kennel = sim.buildings.find((b) => b.type === 'kennelSmall')!;
    expect(sim.world.isSolid(kennel.x, kennel.y)).toBe(true);
    expect(sim.world.isSolid(kennel.x, kennel.y + 1)).toBe(false);
  });
});

describe('Köpek davranışı', () => {
  it('aç köpek dolu kaba gidip yer', () => {
    const sim = Sim.create(21);
    const dog = sim.dogs[0];
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 4;
    dog.needs.hunger = 90;
    dog.needs.energy = 90;
    runMinutes(sim, 90);
    expect(dog.needs.hunger).toBeLessThan(60);
    expect(bowl.food).toBeLessThan(4);
    expect(sim.stats.fed).toBeGreaterThanOrEqual(1);
  });

  it('eğitimsiz köpek olduğu yere pislik bırakır, eğitimli tuvalet alanına yapar', () => {
    const sim = Sim.create(22);
    const dog = sim.dogs[0];
    dog.needs.hunger = 10;
    dog.needs.energy = 90;
    dog.needs.bladder = 95;
    runMinutes(sim, 30);
    expect(sim.messTiles.size).toBe(1);
    expect(dog.needs.bladder).toBeLessThan(50);
    const tile = [...sim.messTiles][0];
    expect(sim.world.object[tile]).toBe(Obj.Mess);

    const sim2 = Sim.create(22);
    const dog2 = sim2.dogs[0];
    dog2.skills.potty = 100;
    dog2.needs.hunger = 10;
    dog2.needs.energy = 90;
    dog2.needs.bladder = 95;
    runMinutes(sim2, 120);
    expect(sim2.messTiles.size).toBe(1);
    const tile2 = [...sim2.messTiles][0];
    expect(sim2.world.zone[tile2]).toBe(Zone.Toilet);
    expect(looseMessCount(sim2)).toBe(0);
    expect(toiletMessCount(sim2)).toBe(1);
    expect(dog2.needs.bladder).toBeLessThan(50);
  });

  it('gece kulübesinde uyur, sabah kalkar', () => {
    const sim = Sim.create(23);
    const dog = sim.dogs[0];
    dog.needs.hunger = 10;
    dog.needs.bladder = 10;
    dog.needs.energy = 40;
    sim.clock.totalMinutes = 22 * 60 + 30;
    runMinutes(sim, 120);
    expect(dog.state).toBe('sleep');
    const kennel = sim.buildingById(dog.kennelId!)!;
    const rest = kennelRestTile(kennel, 0);
    expect(dog.tileX).toBe(rest.x);
    expect(dog.tileY).toBe(rest.y);
    const e0 = dog.needs.energy;
    runMinutes(sim, 60 * 8);
    expect(dog.needs.energy).toBeGreaterThan(e0);
    expect(dog.state).not.toBe('sleep');
  });
});

describe('Etkileşim', () => {
  it('sevme, oynama ve eğitim köpeği etkiler', () => {
    const sim = Sim.create(31);
    const dog = sim.dogs[0];
    dog.genome.temperament = 'calm'; // çekingen çarpanı devre dışı
    dog.state = 'sit';
    dog.stateTimer = 999;
    placePlayerFacing(sim, dog.x, dog.y + 1.2, 3);
    expect(resolveAction(sim).kind).toBe('pet');
    const l0 = dog.needs.loyalty;
    expect(performAction(sim).ok).toBe(true);
    expect(dog.needs.loyalty).toBe(l0 + BALANCE.dogs.petLoyaltyGain);
    expect(sim.player.busy).toBeGreaterThan(0);
    expect(performAction(sim).ok).toBe(false); // meşgulken tekrar olmaz

    sim.player.busy = 0;
    sim.command({ type: 'setTool', tool: 'play' });
    dog.needs.play = 20;
    expect(resolveAction(sim).kind).toBe('play');
    expect(performAction(sim).ok).toBe(true);
    expect(dog.needs.play).toBe(20 + BALANCE.dogs.playGain);

    sim.player.busy = 0;
    sim.command({ type: 'setTool', tool: 'train' });
    expect(resolveAction(sim).kind).toBe('train');
    const potty0 = dog.skills.potty;
    expect(performAction(sim).ok).toBe(true);
    expect(dog.skills.potty).toBeGreaterThan(potty0);
  });

  it('yem kabı kilerden doldurulur, pislik temizlenir, yem sipariş edilir', () => {
    const sim = Sim.create(32);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    placePlayerFacing(sim, bowl.x + 0.5, bowl.y + 1.4, 3);
    expect(resolveAction(sim).kind).toBe('fillBowl');
    const stock0 = sim.foodStock;
    expect(performAction(sim).ok).toBe(true);
    expect(bowl.food).toBe(4);
    expect(sim.foodStock).toBe(stock0 - 4);

    const mx = bowl.x + 3;
    const my = bowl.y + 3;
    sim.world.setObject(mx, my, Obj.Mess);
    sim.messTiles.add(sim.world.idx(mx, my));
    placePlayerFacing(sim, mx + 0.5, my + 1.4, 3);
    expect(resolveAction(sim).kind).toBe('clean');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.messTiles.size).toBe(0);
    expect(sim.world.objectAt(mx, my)).toBe(Obj.None);

    const m0 = sim.money;
    expect(sim.command({ type: 'orderFood', bags: 2 }).ok).toBe(true);
    expect(sim.money).toBe(m0 - 2 * BALANCE.economy.foodBagPrice);
    expect(sim.foodStock).toBe(stock0 - 4 + 2 * BALANCE.economy.foodBagPortions);
    sim.money = 10;
    expect(sim.command({ type: 'orderFood', bags: 1 }).ok).toBe(false);
  });
});

describe('Kayıt', () => {
  it('köpekler, binalar, çitler, pislik ve bölgeler gidiş dönüş korunur', () => {
    const sim = Sim.create(41);
    const dog = sim.dogs[0];
    dog.needs.bladder = 95;
    dog.needs.hunger = 10;
    runMinutes(sim, 30);
    expect(sim.messTiles.size).toBe(1);
    dog.skills.sit = 55;
    sim.command({ type: 'renameDog', id: dog.id, name: 'Test' });
    const raw = JSON.stringify(sim.toJSON());
    const back = Sim.fromJSON(SaveManager.parse(raw)!);
    expect(back.shelterDogs().length).toBe(1);
    expect(back.dogs[0].name).toBe('Test');
    expect(back.dogs[0].skills.sit).toBe(55);
    expect(back.dogs[0].kennelId).toBe(dog.kennelId);
    expect(back.buildings.length).toBe(sim.buildings.length);
    expect(back.messTiles.size).toBe(1);
    expect(back.world.object).toEqual(sim.world.object);
    expect(back.world.zone).toEqual(sim.world.zone);
    expect(back.world.solid).toEqual(sim.world.solid);
    expect(back.nextId).toBe(sim.nextId);
  });
});

describe('Headless koşu', () => {
  it('3 gün bot bakımıyla köpek sağlıklı kalır, sayılar bozulmaz', () => {
    const sim = Sim.create(51);
    const dog = sim.dogs[0];
    const totalMinutes = 3 * 24 * 60;
    let elapsed = 0;
    while (elapsed < totalMinutes) {
      // Bot: kap boşsa doldur, kiler azsa sipariş, pislik varsa temizle, arada sev.
      const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
      if (bowl.food < 1 && sim.foodStock > 0) bowl.food = Math.min(4, bowl.food + sim.foodStock);
      if (sim.foodStock < 5) sim.command({ type: 'orderFood', bags: 1 });
      if (dog.needs.hygiene < 40) dog.needs.hygiene += BALANCE.dogs.groomGain; // fırçalama
      for (const t of [...sim.messTiles]) {
        const x = t % sim.world.width;
        const y = Math.floor(t / sim.world.width);
        sim.world.setObject(x, y, Obj.None);
        sim.messTiles.delete(t);
      }
      runMinutes(sim, 60);
      elapsed += 60;
      for (const v of Object.values(dog.needs)) expect(Number.isNaN(v)).toBe(false);
    }
    expect(dog.needs.health).toBeGreaterThan(50);
    expect(sim.money).toBeGreaterThan(0);
    expect(sim.stats.fed).toBeGreaterThan(3);
    expect(sim.clock.day).toBe(4);
  });
});
