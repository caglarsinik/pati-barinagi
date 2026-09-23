import { BALANCE } from '../../config/balance';
import { MINUTES_PER_DAY } from '../../core/Clock';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import { type Dog, clamp100 } from '../entities/Dog';
import { RARITY_NAMES_TR, type Rarity } from '../entities/DogGenome';
import { createEgg } from '../entities/Egg';
import type { PlayerExertion } from '../entities/Player';
import type { Sim } from '../Sim';
import { villageDoorTile } from '../world/Village';

/** Çanta dışı tüketimlikler (0.20.0): köpek panelinden verilir. */
export type SupplyKind = 'toy' | 'vitamin';
export type ShopItem = SupplyKind | 'bicycle';
export type MarketItem = SupplyKind | 'egg';

export interface Supplies {
  toy: number;
  vitamin: number;
}

export interface ShopResult {
  ok: boolean;
  message?: string;
}

export const SUPPLY_NAMES_TR: Record<SupplyKind, string> = { toy: 'Oyuncak paketi', vitamin: 'Vitamin' };

const fail = (message: string): ShopResult => ({ ok: false, message });

/** Pazar günü mü (köy meydanında tezgâh kurulur). */
export function isMarketDay(sim: Sim): boolean {
  return sim.clock.weekday === BALANCE.shop.marketWeekday;
}

/** Dükkân fiyatı; pazarda indirimli. */
export function shopPrice(item: ShopItem, market = false): number {
  const S = BALANCE.shop;
  const base = item === 'toy' ? S.toyPrice : item === 'vitamin' ? S.vitaminPrice : S.bicyclePrice;
  return market ? Math.round(base * S.marketMul) : base;
}

/** Bu haftanın tezgâh yumurtası: nadirlik haftaya bağlı ayrı RNG'den gelir (ana sıra değişmez). */
export function marketEggOffer(sim: Sim): { rarity: Rarity; price: number; sold: boolean } {
  const S = BALANCE.shop;
  const rng = new Rng(hash3(sim.seed, sim.clock.week, 0x3a4e));
  const rarity: Rarity = rng.next() < S.marketLegendaryChance ? 'legendary' : 'rare';
  return { rarity, price: S.marketEggPrice[rarity], sold: sim.marketEggWeek === sim.clock.week };
}

/** Oyuncu pazar tezgâhının önünde mi. */
export function nearMarket(sim: Sim): boolean {
  if (sim.interior) return false;
  const vb = sim.world.villageBuildings.find((b) => b.kind === 'market');
  if (!vb) return false;
  const d = villageDoorTile(vb);
  return Math.hypot(sim.player.x - (d.x + 0.5), sim.player.y - (d.y + 0.5)) <= BALANCE.shop.marketReach;
}

function addSupply(sim: Sim, item: SupplyKind, qty: number, unit: number): ShopResult {
  const max = BALANCE.shop.maxSupply;
  const name = t(SUPPLY_NAMES_TR[item]);
  const n = Math.min(Math.max(1, Math.floor(qty)), max - sim.supplies[item]);
  if (n <= 0) return fail(t('Çantada her türden en çok {n} tane taşınır', { n: max }));
  const cost = n * unit;
  if (sim.money < cost) return fail(t('Yeterli para yok ({cost} ₺)', { cost }));
  sim.addExpense('shop', cost, t('{n} × {item}', { n, item: name }));
  sim.supplies[item] += n;
  return { ok: true, message: t('{n} × {item} alındı', { n, item: name }) };
}

/** Oyuncak ve ilaç dükkânının tezgâhı (yalnız dükkânın içindeyken). */
export function buyShop(sim: Sim, item: ShopItem, qty: number): ShopResult {
  if (sim.interior?.kind !== 'toyShop') return fail(t('Dükkânın tezgâhına git'));
  if (item !== 'bicycle') return addSupply(sim, item, qty, shopPrice(item));
  if (sim.bicycle) return fail(t('Bisikletin zaten var'));
  const cost = shopPrice('bicycle');
  if (sim.money < cost) return fail(t('Yeterli para yok ({cost} ₺)', { cost }));
  sim.addExpense('shop', cost, t('Bisiklet'));
  sim.bicycle = true;
  return { ok: true, message: t('🚲 Bisiklet senin: koşarken daha hızlısın ve daha az yorulursun') };
}

/** Pazar tezgâhı (yalnız Pazar, tezgâhın önünde): indirimli tüketimlik ya da haftanın yumurtası. */
export function buyMarket(sim: Sim, item: MarketItem, qty: number): ShopResult {
  if (!isMarketDay(sim)) return fail(t('Pazar tezgâhı yalnız Pazar günleri kurulur'));
  if (!nearMarket(sim)) return fail(t('Pazar tezgâhına git'));
  if (item !== 'egg') return addSupply(sim, item, qty, shopPrice(item, true));
  const offer = marketEggOffer(sim);
  if (offer.sold) return fail(t('Bu haftanın yumurtası satıldı'));
  if (sim.backpack.length >= sim.backpackSlots()) return fail(t('Çanta dolu ({n}/{max}): kuluçkaya boşalt', { n: sim.backpack.length, max: sim.backpackSlots() }));
  if (sim.money < offer.price) return fail(t('Yeterli para yok ({cost} ₺)', { cost: offer.price }));
  const egg = createEgg(sim.nextId++, new Rng(hash3(sim.seed, sim.clock.week, 0x3a4f)), offer.rarity, sim.clock.day);
  sim.addExpense('shop', offer.price, t('Pazar yumurtası'));
  sim.backpack.push(egg);
  sim.marketEggWeek = sim.clock.week;
  return { ok: true, message: t('🥚 {rarity} yumurta çantada: kuluçkaya koy', { rarity: t(RARITY_NAMES_TR[offer.rarity]) }) };
}

/** Köpeğe tüketimlik verir (köpek panelinden). */
export function giveSupply(sim: Sim, dog: Dog, item: SupplyKind): ShopResult {
  if (sim.supplies[item] <= 0) return fail(item === 'toy' ? t('Oyuncak paketin yok: köydeki dükkândan al') : t('Vitaminin yok: köydeki dükkândan al'));
  if (dog.wild || !sim.shelterDogs().includes(dog)) return fail(t('{name} barınakta değil', { name: dog.name }));
  const S = BALANCE.shop;
  sim.supplies[item]--;
  sim.events.emit('emote', { kind: 'dog', id: dog.id, emote: 'heart', seconds: 2 });
  if (item === 'toy') {
    dog.needs.play = 100;
    dog.needs.loyalty = clamp100(dog.needs.loyalty + S.toyLoyalty);
    return { ok: true, message: t('{name} yeni oyuncağına bayıldı: oyun keyfi dolu, sadakat +{n}', { name: dog.name, n: S.toyLoyalty }) };
  }
  dog.needs.health = clamp100(dog.needs.health + S.vitaminHealth);
  dog.vitaminUntil = sim.clock.totalMinutes + S.vitaminDays * MINUTES_PER_DAY;
  return { ok: true, message: t('{name} vitaminini aldı: sağlık +{n}, bir gün daha az hastalanır', { name: dog.name, n: S.vitaminHealth }) };
}

/** Bisiklet: koşu daha hızlı ve daha az yorar. */
export function bicycleExertion(ex: PlayerExertion): PlayerExertion {
  const S = BALANCE.shop;
  return { ...ex, runDrainMul: ex.runDrainMul * S.bicycleDrainMul, runSpeedMul: (ex.runSpeedMul ?? 1) * S.bicycleRunMul };
}
