import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { SaveManager } from '../../src/core/SaveManager';
import { drawVillageBuilding } from '../../src/render/BuildingArt';
import { Sim } from '../../src/sim/Sim';
import { illnessChanceMul } from '../../src/sim/systems/ClinicSystem';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { isMarketDay, marketEggOffer, shopPrice } from '../../src/sim/systems/ShopSystem';
import { type VillageKind, villageDoorTile } from '../../src/sim/world/Village';

const toSunday = (sim: Sim): void => {
  while (sim.clock.weekday !== BALANCE.shop.marketWeekday) sim.clock.totalMinutes += MINUTES_PER_DAY;
};

/** Oyuncuyu köy yapısının önüne, yüzü yapıya dönük koyar. */
const atFront = (sim: Sim, kind: VillageKind) => {
  const vb = sim.world.villageBuildings.find((b) => b.kind === kind)!;
  const d = villageDoorTile(vb);
  sim.player.x = d.x + 0.5;
  sim.player.y = d.y + 0.9;
  sim.player.facing = 3;
  return vb;
};

describe('Oyuncak ve ilaç dükkânı, pazar günü (0.20.0)', () => {
  it('dükkâna girilir; tezgâh paneli; alım yalnız içeride; para, taşıma sınırı, bisiklet bir kez', () => {
    const sim = Sim.create(2001);
    atFront(sim, 'toyShop');
    expect(resolveAction(sim).kind).toBe('enterVillage');
    expect(sim.command({ type: 'buyShop', item: 'toy', qty: 1 }).ok).toBe(false);
    expect(performAction(sim).ok).toBe(true);
    expect(sim.interior?.kind).toBe('toyShop');
    const counter = sim.interior!.items.find((i) => i.type === 'shopCounter')!;
    sim.player.x = counter.x + 1.5;
    sim.player.y = counter.y + 1.7;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('toyShop');
    expect(performAction(sim).open).toBe('toyShop');

    sim.money = 5000;
    expect(sim.command({ type: 'buyShop', item: 'toy', qty: 5 }).ok).toBe(true);
    expect(sim.supplies.toy).toBe(5);
    expect(sim.money).toBe(5000 - 5 * shopPrice('toy'));
    expect(sim.ledger.at(-1)?.category).toBe('shop');
    expect(sim.command({ type: 'buyShop', item: 'vitamin', qty: 1 }).ok).toBe(true);
    expect(sim.supplies.vitamin).toBe(1);
    // Taşıma sınırı: fazlası alınmaz.
    expect(sim.command({ type: 'buyShop', item: 'toy', qty: 100 }).ok).toBe(true);
    expect(sim.supplies.toy).toBe(BALANCE.shop.maxSupply);
    expect(sim.command({ type: 'buyShop', item: 'toy', qty: 1 }).ok).toBe(false);
    // Bisiklet bir kez.
    sim.money = 10000;
    expect(sim.command({ type: 'buyShop', item: 'bicycle', qty: 1 }).ok).toBe(true);
    expect(sim.bicycle).toBe(true);
    expect(sim.money).toBe(10000 - BALANCE.shop.bicyclePrice);
    expect(sim.command({ type: 'buyShop', item: 'bicycle', qty: 1 }).ok).toBe(false);
  });

  it('oyuncak oyun keyfini doldurur ve sadakati artırır; vitamin sağlık verir ve bir gün hastalığı azaltır; kayıt', () => {
    const sim = Sim.create(2002);
    const dog = sim.shelterDogs()[0];
    expect(sim.command({ type: 'giveSupply', dogId: dog.id, item: 'toy' }).ok).toBe(false);
    sim.supplies.toy = 1;
    sim.supplies.vitamin = 1;
    dog.needs.play = 10;
    const loyalty = dog.needs.loyalty;
    expect(sim.command({ type: 'giveSupply', dogId: dog.id, item: 'toy' }).ok).toBe(true);
    expect(dog.needs.play).toBe(100);
    expect(dog.needs.loyalty).toBe(Math.min(100, loyalty + BALANCE.shop.toyLoyalty));
    expect(sim.supplies.toy).toBe(0);

    dog.needs.health = 50;
    const base = illnessChanceMul(sim, dog);
    expect(sim.command({ type: 'giveSupply', dogId: dog.id, item: 'vitamin' }).ok).toBe(true);
    expect(dog.needs.health).toBe(50 + BALANCE.shop.vitaminHealth);
    expect(illnessChanceMul(sim, dog)).toBeCloseTo(base * BALANCE.shop.vitaminIllnessMul);
    sim.clock.totalMinutes += MINUTES_PER_DAY + 1;
    expect(illnessChanceMul(sim, dog)).toBeCloseTo(base);

    sim.supplies.toy = 3;
    sim.bicycle = true;
    sim.marketEggWeek = 4;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.supplies).toEqual({ toy: 3, vitamin: 0 });
    expect(back.bicycle).toBe(true);
    expect(back.marketEggWeek).toBe(4);
    expect(back.dogById(dog.id)!.vitaminUntil).toBe(dog.vitaminUntil);
    const old = sim.toJSON() as unknown as Record<string, unknown>;
    delete old.supplies;
    delete old.bicycle;
    delete old.marketEggWeek;
    const ob = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    expect(ob.supplies).toEqual({ toy: 0, vitamin: 0 });
    expect(ob.bicycle).toBe(false);
    expect(ob.marketEggWeek).toBe(0);
  });

  it('pazar tezgâhı yalnız Pazar ve önündeyken: indirimli tüketimlik, haftada bir yumurta, ayrı RNG', () => {
    const sim = Sim.create(2003);
    const twin = Sim.create(2003);
    const vb = atFront(sim, 'market');
    const front = villageDoorTile(vb);
    expect(sim.world.isSolid(front.x, front.y)).toBe(false);
    expect(isMarketDay(sim)).toBe(false);
    const closed = resolveAction(sim);
    expect(closed.kind).toBe('none');
    expect(closed.hint).toContain('Pazar');
    expect(sim.command({ type: 'buyMarket', item: 'toy', qty: 1 }).ok).toBe(false);

    toSunday(sim);
    toSunday(twin);
    expect(resolveAction(sim).kind).toBe('market');
    expect(performAction(sim).open).toBe('market');
    sim.money = 10000;
    expect(shopPrice('vitamin', true)).toBeLessThan(shopPrice('vitamin'));
    expect(sim.command({ type: 'buyMarket', item: 'vitamin', qty: 2 }).ok).toBe(true);
    expect(sim.money).toBe(10000 - 2 * shopPrice('vitamin', true));

    const offer = marketEggOffer(sim);
    expect(marketEggOffer(sim)).toEqual(offer);
    expect(offer.sold).toBe(false);
    sim.backpack = [];
    const m1 = sim.money;
    expect(sim.command({ type: 'buyMarket', item: 'egg', qty: 1 }).ok).toBe(true);
    expect(sim.backpack).toHaveLength(1);
    expect(sim.backpack[0].genome.rarity).toBe(offer.rarity);
    expect(sim.money).toBe(m1 - offer.price);
    expect(marketEggOffer(sim).sold).toBe(true);
    expect(sim.command({ type: 'buyMarket', item: 'egg', qty: 1 }).ok).toBe(false);
    // Ana RNG sırası değişmedi.
    expect(sim.rng.next()).toBe(twin.rng.next());
    // Uzaktan alışveriş yok.
    sim.player.y += 8;
    expect(sim.command({ type: 'buyMarket', item: 'toy', qty: 1 }).ok).toBe(false);
    // Tezgâh çizimi dolu.
    const px = drawVillageBuilding('market', vb.w, vb.h);
    let n = 0;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
    expect(n).toBeGreaterThan(200);
  });

  it('bisiklet koşuyu hızlandırır ve daha az yorar', () => {
    const run = (bike: boolean): { dist: number; drain: number } => {
      const sim = Sim.create(2004);
      sim.bicycle = bike;
      const y0 = sim.player.y;
      const s0 = sim.player.stamina;
      for (let i = 0; i < 15; i++) sim.update(1 / 30, { dx: 0, dy: -1, run: true });
      return { dist: y0 - sim.player.y, drain: s0 - sim.player.stamina };
    };
    const walk = run(false);
    const bike = run(true);
    expect(walk.dist).toBeGreaterThan(0);
    expect(bike.dist / walk.dist).toBeCloseTo(BALANCE.shop.bicycleRunMul, 1);
    expect(bike.drain / walk.drain).toBeCloseTo(BALANCE.shop.bicycleDrainMul, 1);
  });
});
