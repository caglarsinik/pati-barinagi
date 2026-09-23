import { BALANCE } from '../../config/balance';
import { type Building, buildingDef, isReady, buildingFootprint } from '../entities/Building';
import { type Dog, SKILL_KEYS, SKILL_NAMES_TR, type SkillKey, clamp100 } from '../entities/Dog';
import { FACING_DELTA } from '../entities/Player';
import type { TilePos } from '../world/TileWorld';
import { Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { eggDescription } from '../entities/Egg';
import { cleanMess } from './MessSystem';
import { harvestBerries, harvestNest } from './NestSystem';
import { t } from '../../i18n';
import { interiorItemAt } from '../interior/Interiors';
import { WEATHER_NAMES_TR } from './WeatherSystem';
import { bake, bakeIssue, bakesLeft, kitchenWaterPerHour } from './KitchenSystem';
import { treatmentCost } from './ClinicSystem';
import { incubatorSlots, incubatorTimeMul } from './IncubatorSystem';
import { RARITY_NAMES_TR } from '../entities/DogGenome';
import { VILLAGE_NAMES_TR, villageInteriorKind, wholesaleBagPrice } from '../world/Village';
import { isMarketDay } from './ShopSystem';
import { VILLAGER_ROLE_NAMES_TR } from '../entities/Villager';

export type Tool = 'pet' | 'play' | 'train' | 'feed' | 'clean' | 'call';

export interface ToolDef {
  id: Tool;
  name: string;
  icon: string;
  key: string;
  desc: string;
}

export const TOOL_DEFS: readonly ToolDef[] = [
  { id: 'pet', name: 'Sev', icon: '🤚', key: '1', desc: 'Köpeğe yaklaş, E ile sev: sadakat artar.' },
  { id: 'play', name: 'Oyna', icon: '🎾', key: '2', desc: 'Köpekle oyun seansı: keyif ve sadakat artar, enerji düşer.' },
  { id: 'train', name: 'Eğit', icon: '🎓', key: '3', desc: 'Seçili beceriyi çalıştır. Zekâ ve sadakat başarıyı artırır.' },
  { id: 'feed', name: 'Yem', icon: '🥣', key: '4', desc: 'Yem kabının önünde E: kilerden yem taşıyıp kabı doldur.' },
  { id: 'clean', name: 'Temizle', icon: '🧹', key: '5', desc: 'Pisliğin önünde E: temizle. Köpeğin önünde E: fırçala (hijyen artar).' },
  { id: 'call', name: 'Çağır', icon: '📣', key: '6', desc: '"Gel" bilen köpekler E ile yanına gelir (12 kare içinde).' },
];

export type ActionKind =
  | 'pet'
  | 'play'
  | 'train'
  | 'groom'
  | 'fillBowl'
  | 'fillTrough'
  | 'clean'
  | 'wash'
  | 'treat'
  | 'shed'
  | 'kennel'
  | 'incubator'
  | 'nursery'
  | 'pickEgg'
  | 'berries'
  | 'treatWild'
  | 'call'
  | 'office'
  | 'enter'
  | 'computer'
  | 'sleep'
  | 'coffee'
  | 'order'
  | 'books'
  | 'restShop'
  | 'autoOrder'
  | 'bake'
  | 'clinic'
  | 'enterVillage'
  | 'wholesale'
  | 'toyShop'
  | 'market'
  | 'talk'
  | 'none';

export interface ResolvedAction {
  kind: ActionKind;
  hint: string;
  dog?: Dog;
  building?: Building;
  tile?: TilePos;
  /** Köy binası sırası (0.18.2). */
  village?: number;
  /** Konuşulacak köylü (0.20.1). */
  villager?: number;
}

/** Oyuncunun önündeki nokta (kare biriminde). */
function facingPoint(sim: Sim): { x: number; y: number } {
  const p = sim.player;
  const d = FACING_DELTA[p.facing];
  return { x: p.x + d.x * 0.9, y: p.y - 0.2 + d.y * 0.9 };
}

function nearestDog(sim: Sim, x: number, y: number, radius: number): Dog | null {
  let best: Dog | null = null;
  let bestD = radius;
  for (const dog of sim.dogs) {
    const d = Math.hypot(dog.x - x, dog.y - 0.3 - y);
    if (d < bestD) {
      bestD = d;
      best = dog;
    }
  }
  return best;
}

/** Uyku saatinde mi (20:00–06:00)? Ofisteki yatak bu kuralla uyutur. */
export function canSleepAt(hour: number): boolean {
  return hour >= BALANCE.time.sleepFromHour || hour < BALANCE.time.nightEndHour;
}

/** İç mekânda E: baktığı eşyanın eylemi (ofis eşyaları 0.16.1); boşta çıkış ipucu. */
function resolveInterior(sim: Sim, tile: TilePos): ResolvedAction {
  const it = sim.interior!;
  const item = interiorItemAt(it, tile.x, tile.y);
  switch (item?.type) {
    case 'desk': {
      const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
      return {
        kind: 'computer',
        hint: waiting > 0 ? t('E: bilgisayar ({n} sahiplenici bekliyor)', { n: waiting }) : t('E: bilgisayar (sahiplendirme, finans, personel)'),
        tile,
      };
    }
    case 'board':
      return { kind: 'office', hint: t('E: lisans panosu (lisans, kredi, hedef)'), building: sim.buildingById(it.buildingId), tile };
    case 'bed':
      return {
        kind: 'sleep',
        hint: canSleepAt(sim.clock.hour) ? t('E: sabaha kadar uyu') : t("Yatak: {h}:00'den sonra uyunabilir", { h: BALANCE.time.sleepFromHour }),
        tile,
      };
    case 'coffee':
      if (sim.coffeeDay === sim.clock.day) return { kind: 'none', hint: t('Bugünkü kahveni içtin'), tile };
      return { kind: 'coffee', hint: t('E: kahve iç (dayanıklılık dolar, günde bir)'), tile };
    case 'phone':
      return { kind: 'order', hint: t('E: telefon · yem siparişi (kilerde {n} porsiyon)', { n: Math.floor(sim.foodStock) }), tile };
    case 'bookshelf':
      return { kind: 'books', hint: t('E: kitaplık (kontroller ve ipuçları)'), tile };
    case 'window':
      return { kind: 'none', hint: t('Pencere: dışarıda hava {w}', { w: t(WEATHER_NAMES_TR[sim.weatherSys.weather]).toLocaleLowerCase('tr') }), tile };
    case 'plant':
      return { kind: 'none', hint: t('Saksı çiçeği ofise renk katıyor'), tile };
    case 'restBoard':
      return { kind: 'restShop', hint: t('E: pano · eşya al (kanepe, kahve, TV, buzdolabı)'), building: sim.buildingById(it.buildingId), tile };
    case 'sofa':
      return { kind: 'none', hint: t('Kanepe: molada iki kişi oturur, dinlenme +%25'), tile };
    case 'tv':
      return { kind: 'none', hint: t('TV: molada moral saatte +1'), tile };
    case 'fridge':
      return { kind: 'none', hint: t('Buzdolabı: personel moladan enerjisi tam dolunca döner'), tile };
    case 'bulkSacks':
      return { kind: 'none', hint: t('Toptan çuvallar: tezgâhtan satın al'), tile };
    case 'crates':
      return { kind: 'none', hint: t('Mama kasaları'), tile };
    case 'shopCounter':
      if (it.kind === 'toyShop') return { kind: 'toyShop', hint: t('E: tezgâh · oyuncak, vitamin, bisiklet'), tile };
      return { kind: 'wholesale', hint: t('E: tezgâh · toptan çuval ({p} ₺/çuval)', { p: wholesaleBagPrice() }), tile };
    case 'toyShelf':
      return { kind: 'none', hint: t('Oyuncak paketleri: tezgâhtan satın al'), tile };
    case 'vitaminShelf':
      return { kind: 'none', hint: t('Vitaminler: tezgâhtan satın al'), tile };
    case 'tray': {
      const b = sim.buildingById(it.buildingId);
      const first = (item.slot ?? 0) * 3;
      const eggs = b ? b.eggs.slice(first, first + 3) : [];
      if (!b || eggs.length === 0) return { kind: 'none', hint: t('Boş tepsi · yumurtayı kontrol panelinden koy'), tile };
      const mul = incubatorTimeMul(b);
      const list = eggs.map((e) => t('{rarity} {days} g', { rarity: t(RARITY_NAMES_TR[e.genome.rarity]), days: ((e.hatchLeft * mul) / (24 * 60)).toFixed(1) })).join(' · ');
      return { kind: 'none', hint: t('Tepsi: {list}', { list }), tile };
    }
    case 'controlPanel': {
      const b = sim.buildingById(it.buildingId);
      return {
        kind: 'incubator',
        hint: t('E: kontrol paneli · yumurta koy/al ({n}/{max})', { n: b?.eggs.length ?? 0, max: b ? incubatorSlots(b) : 0 }),
        building: b,
        tile,
      };
    }
    case 'heatLamp':
      return { kind: 'none', hint: t('Isı lambası: yumurtalar %15 daha çabuk çatlar'), tile };
    case 'supplies':
      return { kind: 'restShop', hint: t('E: malzeme rafı · eşya al (ısı lambası)'), building: sim.buildingById(it.buildingId), tile };
    case 'examTable':
      return { kind: 'clinic', hint: t('E: muayene masası · sağlık listesi ve aşı'), tile };
    case 'medCabinet':
      return { kind: 'none', hint: t('İlaç dolabı: tedavi {n} ₺', { n: treatmentCost(sim) }), tile };
    case 'reception':
      return { kind: 'restShop', hint: t('E: resepsiyon · eşya al (ilaç dolabı)'), building: sim.buildingById(it.buildingId), tile };
    case 'waitChairs':
      return { kind: 'none', hint: t('Bekleme sandalyeleri'), tile };
    case 'xray':
      return { kind: 'none', hint: t('Röntgen panosu'), tile };
    case 'counter':
      return { kind: 'restShop', hint: t('E: tezgâh · eşya al (su deposu, ikinci fırın)'), building: sim.buildingById(it.buildingId), tile };
    case 'oven': {
      const why = bakeIssue(sim);
      return {
        kind: 'bake',
        hint: why ?? t('E: ödül maması pişir ({n} porsiyon → 1 · bugün {left} hak)', { n: BALANCE.kitchen.foodPerTreat, left: bakesLeft(sim) }),
        tile,
      };
    }
    case 'waterTank':
      return { kind: 'none', hint: t('Su deposu: yalaklar saatte {n} dolar', { n: kitchenWaterPerHour(sim) }), tile };
    case 'spiceRack':
      return { kind: 'none', hint: t('Baharat rafı: mutfağa koku katıyor'), tile };
    case 'foodShelf':
      return { kind: 'none', hint: t('Mama rafı · kilerde {n} porsiyon', { n: Math.floor(sim.foodStock) }), tile };
    case 'sacks':
      return {
        kind: 'none',
        hint: t('Çuval rafı · kilerde {n} porsiyon (~{b} çuval)', { n: Math.floor(sim.foodStock), b: Math.ceil(Math.max(0, sim.foodStock) / BALANCE.economy.foodBagPortions) }),
        tile,
      };
    case 'ledger':
      return { kind: 'order', hint: t('E: sipariş defteri · yem sipariş et'), tile };
    case 'orderBoard':
      return {
        kind: 'autoOrder',
        hint: sim.policies.autoOrderFood ? t('E: otomatik sipariş (açık, eşik {n})', { n: sim.policies.foodThreshold }) : t('E: otomatik sipariş (kapalı)'),
        tile,
      };
    default:
      if (it.kind === 'toyShop') return { kind: 'none', hint: t('Oyuncak ve ilaç dükkânı · tezgâha bakıp E · çıkmak için kapıya yürü'), tile };
      if (it.kind === 'wholesaler') return { kind: 'none', hint: t('Yem toptancısı · tezgâha bakıp E: toptan çuval · çıkmak için kapıya yürü'), tile };
      if (it.kind === 'hatchery') return { kind: 'none', hint: t('Kuluçka · kontrol paneline bakıp E: yumurta koy/al · raf: eşya al · çıkmak için kapıya yürü'), tile };
      if (it.kind === 'clinic') return { kind: 'none', hint: t('Veteriner odası · muayene masasına bakıp E: aşı · resepsiyon: eşya al · çıkmak için kapıya yürü'), tile };
      if (it.kind === 'kitchen') return { kind: 'none', hint: t('Mutfak · fırına bakıp E: ödül maması · tezgâh: eşya al · çıkmak için kapıya yürü'), tile };
      if (it.kind === 'pantry') return { kind: 'none', hint: t('Kiler · deftere bakıp E: sipariş · çıkmak için kapıya yürü'), tile };
      if (it.kind === 'restRoom') return { kind: 'none', hint: t('Dinlenme odası · panoya bakıp E: eşya al · çıkmak için kapıya yürü'), tile };
      return { kind: 'none', hint: t('Ofis içi · eşyaya bakıp E · çıkmak için kapıya yürü'), tile };
  }
}

/**
 * Aynı fonksiyon hem alt çubuktaki ipucunu hem E'nin yapacağı işi belirler; ikisi asla ayrışmaz.
 */
export function resolveAction(sim: Sim): ResolvedAction {
  if (sim.mode !== 'avatar') return { kind: 'none', hint: '' };
  const fp = facingPoint(sim);
  const tile = { x: Math.floor(fp.x), y: Math.floor(fp.y) };
  if (sim.interior) return resolveInterior(sim, tile);
  const w = sim.world;

  // Pislik her araçla temizlenir.
  const obj = w.objectAt(tile.x, tile.y);
  if (obj === Obj.Mess) return { kind: 'clean', hint: t('E: pisliği temizle'), tile };
  if (obj === Obj.NestEggs) {
    if (sim.backpack.length >= sim.backpackSlots()) return { kind: 'none', hint: t('Çanta dolu ({n}/{max}): kuluçkaya boşalt', { n: sim.backpack.length, max: sim.backpackSlots() }), tile };
    return { kind: 'pickEgg', hint: t('E: yumurtayı al'), tile };
  }
  if (obj === Obj.Nest) return { kind: 'none', hint: t('Boş yuva: birkaç güne yeniden dolar'), tile };
  if (obj === Obj.BerryBush) {
    if (sim.treats >= BALANCE.eggs.treatsMax) return { kind: 'none', hint: t('Ödül maması çantası dolu'), tile };
    return { kind: 'berries', hint: t('E: böğürtlen topla (ödül maması +{n})', { n: BALANCE.eggs.treatsPerBush + sim.weatherSys.modifiers().berryBonus }), tile };
  }
  if (obj === Obj.Den) return { kind: 'none', hint: t('Sokak köpeği ini'), tile };

  // Köylü (0.20.1): baktığın yerde duran köylüyle konuş.
  const villager = sim.villagers.at(fp.x, fp.y);
  if (villager) {
    return {
      kind: 'talk',
      hint: t('E: {name} ile konuş ({role})', { name: villager.name, role: t(VILLAGER_ROLE_NAMES_TR[villager.role]) }),
      villager: villager.index,
      tile,
    };
  }

  // Köy binası (0.18.2).
  const vb = w.villageAt(tile.x, tile.y);
  if (vb) {
    const name = t(VILLAGE_NAMES_TR[vb.kind]);
    if (villageInteriorKind(vb.kind)) return { kind: 'enterVillage', hint: t('E: {name} · içeri gir', { name }), village: vb.index, tile };
    if (vb.kind === 'market') {
      if (isMarketDay(sim)) return { kind: 'market', hint: t('E: pazar tezgâhı · indirimli oyuncak, vitamin, haftanın yumurtası'), tile };
      return { kind: 'none', hint: t('Pazar tezgâhı · Pazar günleri kurulur'), tile };
    }
    return { kind: 'none', hint: name, tile };
  }

  // Bina.
  const bid = w.buildingIdAt(tile.x, tile.y);
  const building = bid >= 0 ? sim.buildingById(bid) : null;
  if (building) {
    const def = buildingDef(building);
    if (!isReady(building)) {
      const pct = Math.round(100 * (1 - building.buildLeft / Math.max(1, def.buildMinutes)));
      return { kind: 'none', hint: t('{name} inşa ediliyor (%{pct})', { name: t(def.name), pct }), building };
    }
    if (building.type === 'bowl') {
      const cap = sim.bowlCapacity(building);
      if (building.food >= cap - 0.01) return { kind: 'none', hint: t('Yem kabı dolu'), building };
      if (sim.foodStock <= 0) return { kind: 'none', hint: t('Kiler boş: kilerden yem sipariş et'), building };
      return { kind: 'fillBowl', hint: t('E: yem kabını doldur ({food}/{cap})', { food: Math.floor(building.food), cap }), building };
    }
    if (building.type === 'trough') {
      const cap = sim.troughCapacity();
      if (building.water >= cap - 0.01) return { kind: 'none', hint: t('Yalak dolu'), building };
      return { kind: 'fillTrough', hint: t('E: yalağı doldur (%{w})', { w: Math.floor((100 * building.water) / cap) }), building };
    }
    if (building.type === 'groomStation') {
      const near = nearestDogToBuilding(sim, building, BALANCE.dogs.stationRadius);
      if (!near) return { kind: 'none', hint: t('Tımar: yakında köpek yok'), building };
      if (near.needs.hygiene >= 99) return { kind: 'none', hint: t('{name} zaten tertemiz', { name: near.name }), building };
      return { kind: 'wash', hint: t("E: {name}'i yıka (temizlik {h}%)", { name: near.name, h: Math.floor(near.needs.hygiene) }), building, dog: near };
    }
    if (building.type === 'vetClinic') {
      const near = nearestDogToBuilding(sim, building, BALANCE.dogs.stationRadius);
      const inside = t(' · ↑ içeri');
      if (!near) return { kind: 'none', hint: t('Veteriner: yakında köpek yok') + inside, building };
      if (near.needs.health >= 90 && !near.illness) return { kind: 'none', hint: t('{name} sağlıklı', { name: near.name }) + inside, building };
      return { kind: 'treat', hint: t("E: {name}'i tedavi et ({price} ₺)", { name: near.name, price: treatmentCost(sim) }) + inside, building, dog: near };
    }
    if (building.type === 'shed') return { kind: 'shed', hint: t('E: kiler ({n} porsiyon)', { n: Math.floor(sim.foodStock) }) + t(' · ↑ içeri'), building };
    if (building.type === 'office') {
      const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
      return { kind: 'enter', hint: waiting > 0 ? t('E: ofise gir ({n} sahiplenici bekliyor)', { n: waiting }) : t('E: ofise gir'), building };
    }
    if (building.type === 'kennelSmall' || building.type === 'kennelLarge') {
      const names = building.occupants.map((id) => sim.dogById(id)?.name ?? '?').join(', ');
      return { kind: 'kennel', hint: t('E: {name}{who}', { name: t(def.name), who: names ? ` (${names})` : t(' (boş)') }), building };
    }
    if (building.type === 'incubator') return { kind: 'incubator', hint: t('E: kuluçka') + t(' · ↑ içeri'), building };
    if (building.type === 'kitchen') return { kind: 'enter', hint: t('E: mutfağa gir'), building };
    if (building.type === 'staffRoom') return { kind: 'enter', hint: t('E: dinlenme odasına gir'), building };
    if (building.type === 'nursery') return { kind: 'nursery', hint: building.eggs.length > 0 ? t('E: yuva evi (yumurta hazır)') : t('E: yuva evi'), building };
  }

  // Çağır aracı: yakındaki "Gel" bilen köpekler.
  if (sim.tool === 'call') {
    const n = callableDogs(sim).length;
    if (n === 0) return { kind: 'none', hint: t('Çağır: yakında "Gel" bilen köpek yok'), tile };
    return { kind: 'call', hint: t('E: çağır ({n} köpek gelir)', { n }), tile };
  }

  // Köpek.
  const dog = nearestDog(sim, fp.x, fp.y, 1.25);
  if (dog && dog.wild) {
    if (dog.following) return { kind: 'none', hint: t('{name} peşinde: barınağa götür', { name: dog.name }), dog };
    if (sim.treats <= 0) return { kind: 'none', hint: t('{name} ürkek: ödül maması lazım (böğürtlen çalısı)', { name: dog.name }), dog };
    return { kind: 'treatWild', hint: t("E: {name}'e ödül ver (güven {trust}/{max})", { name: dog.name, trust: dog.trust, max: tameTreatsFor(dog) }), dog };
  }
  if (dog) {
    const tool = sim.tool;
    if (tool === 'play') {
      if (dog.isAsleep()) return { kind: 'none', hint: t('{name} uyuyor', { name: dog.name }), dog };
      if (dog.needs.energy < BALANCE.dogs.playMinEnergy) return { kind: 'none', hint: t('{name} çok yorgun', { name: dog.name }), dog };
      return { kind: 'play', hint: t('E: {name} ile oyna', { name: dog.name }), dog };
    }
    if (tool === 'train') {
      if (dog.isAsleep()) return { kind: 'none', hint: t('{name} uyuyor', { name: dog.name }), dog };
      if (dog.needs.energy < BALANCE.dogs.trainMinEnergy) return { kind: 'none', hint: t('{name} eğitim için çok yorgun', { name: dog.name }), dog };
      const skill = trainingSkill(dog);
      if (!skill) return { kind: 'none', hint: t('{name} her şeyi öğrendi', { name: dog.name }), dog };
      return { kind: 'train', hint: t('E: {name} eğit ({skill} {pct}%)', { name: dog.name, skill: t(SKILL_NAMES_TR[skill]), pct: Math.floor(dog.skills[skill]) }), dog };
    }
    if (tool === 'clean') {
      if (dog.needs.hygiene >= 95) return { kind: 'none', hint: t('{name} zaten tertemiz', { name: dog.name }), dog };
      return { kind: 'groom', hint: t("E: {name}'i fırçala (temizlik {h}%)", { name: dog.name, h: Math.floor(dog.needs.hygiene) }), dog };
    }
    return { kind: 'pet', hint: t("E: {name}'i sev", { name: dog.name }), dog };
  }

  return { kind: 'none', hint: '', tile };
}

/** Evcilleştirmek için gereken ödül: cesur köpek daha çabuk güvenir. */
export function tameTreatsFor(dog: Dog): number {
  return dog.genome.temperament === 'bold' ? BALANCE.dogs.temperament.boldTameTreats : BALANCE.eggs.tameTreats;
}

/** Çağır aracının ulaşacağı köpekler: barınakta, "Gel" bilen, meşgul olmayan, yarıçap içinde. */
export function callableDogs(sim: Sim): Dog[] {
  const p = sim.player;
  const R = BALANCE.dogs.skills.callRadius;
  return sim.shelterDogs().filter((d) => {
    if (d.skills.come < 100 || d.walking) return false;
    if (d.state === 'sleep' || d.state === 'eat' || d.state === 'drink' || d.state === 'interact' || d.state === 'toilet') return false;
    return Math.hypot(d.x - p.x, d.y - p.y) <= R;
  });
}

export function trainingSkill(dog: Dog): SkillKey | null {
  if (dog.trainingFocus && dog.skills[dog.trainingFocus] < 100) return dog.trainingFocus;
  // Odak yoksa: önce tuvalet eğitimi, sonra en düşük beceri.
  if (dog.skills.potty < 100) return 'potty';
  let best: SkillKey | null = null;
  let bestV = 100;
  for (const k of SKILL_KEYS) {
    if (dog.skills[k] < bestV) {
      bestV = dog.skills[k];
      best = k;
    }
  }
  return best;
}

export interface ActionOutcome {
  ok: boolean;
  message?: string;
  /** UI'nın açması gereken panel. */
  open?: 'shed' | 'kennel' | 'incubator' | 'office' | 'nursery' | 'computer' | 'order' | 'help' | 'furniture' | 'autoOrder' | 'clinic' | 'wholesale' | 'toyShop' | 'market';
  building?: Building;
  dog?: Dog;
}

/** E tuşu. Etki anında uygulanır, oyuncu kısa süre meşgul olur. */
export function performAction(sim: Sim): ActionOutcome {
  const r = resolveAction(sim);
  const B = BALANCE.dogs;
  const p = sim.player;
  if (p.busy > 0) return { ok: false };
  switch (r.kind) {
    case 'clean': {
      if (!r.tile || !cleanMess(sim, r.tile.x, r.tile.y)) return { ok: false };
      p.setBusy(0.6, 'clean');
      return { ok: true };
    }
    case 'wash': {
      const dog = r.dog!;
      dog.needs.hygiene = 100;
      dog.needs.loyalty = clamp100(dog.needs.loyalty + 1);
      interactWith(sim, dog, B.washDurationMin);
      sim.stats.groomed++;
      p.setBusy(1.2, 'wash');
      return { ok: true, message: t('{name} yıkandı', { name: dog.name }) };
    }
    case 'treat': {
      const dog = r.dog!;
      const price = treatmentCost(sim);
      if (sim.money < price) return { ok: false, message: t('İlaç için para yok') };
      sim.addExpense('treatment', price, dog.name);
      dog.needs.health = clamp100(dog.needs.health + B.treatHealthGain);
      sim.illness.cure(dog);
      interactWith(sim, dog, B.treatDurationMin);
      sim.stats.treated++;
      p.setBusy(1.2, 'treat');
      return { ok: true, message: t('{name} tedavi edildi', { name: dog.name }) };
    }
    case 'fillBowl': {
      const b = r.building!;
      const cap = sim.bowlCapacity(b);
      const take = Math.min(cap - b.food, sim.foodStock);
      if (take <= 0) return { ok: false };
      b.food += take;
      sim.foodStock -= take;
      sim.stats.bowlsFilled++;
      p.setBusy(0.5, 'feed');
      return { ok: true, message: t('Kap dolduruldu ({food}/{cap})', { food: Math.floor(b.food), cap }) };
    }
    case 'fillTrough': {
      const b = r.building!;
      b.water = sim.troughCapacity();
      sim.stats.watered++;
      p.setBusy(0.5, 'feed');
      return { ok: true, message: t('Yalak dolduruldu') };
    }
    case 'pet': {
      const dog = r.dog!;
      let gain = dog.petsToday < B.petsFullGainPerDay ? B.petLoyaltyGain : B.petLoyaltyGainDiminished;
      // Çekingen köpek güvenmesi zor ama bir kez güvenince daha çok bağlanır.
      if (dog.genome.temperament === 'shy') gain *= dog.needs.loyalty < B.temperament.shyTrustAt ? B.temperament.shyPetMulBelow : B.temperament.shyPetMulAbove;
      dog.needs.loyalty = clamp100(dog.needs.loyalty + gain);
      dog.needs.play = clamp100(dog.needs.play + 4);
      dog.petsToday++;
      interactWith(sim, dog, B.petDurationMin);
      sim.stats.petted++;
      sim.events.emit('emote', { kind: 'dog', id: dog.id, emote: 'heart', seconds: 1.5 });
      p.setBusy(0.45, 'pet');
      return { ok: true };
    }
    case 'play': {
      const dog = r.dog!;
      dog.needs.play = clamp100(dog.needs.play + B.playGain);
      dog.needs.loyalty = clamp100(dog.needs.loyalty + B.playLoyaltyGain);
      dog.needs.energy = clamp100(dog.needs.energy - B.playEnergyCost);
      dog.needs.bladder = clamp100(dog.needs.bladder + 5);
      dog.needs.thirst = clamp100(dog.needs.thirst + B.needs.thirstAfterPlay);
      interactWith(sim, dog, B.playDurationMin);
      sim.stats.played++;
      sim.events.emit('emote', { kind: 'dog', id: dog.id, emote: 'heart', seconds: 2 });
      p.setBusy(1.0, 'play');
      return { ok: true, message: t('{name} çok eğlendi', { name: dog.name }) };
    }
    case 'train': {
      const dog = r.dog!;
      const skill = trainingSkill(dog);
      if (!skill) return { ok: false };
      const temper = dog.genome.temperament === 'calm' ? 1.1 : dog.genome.temperament === 'shy' ? 0.85 : dog.genome.temperament === 'bold' ? 0.95 : 1;
      const zone = trainingZoneFactor(sim, dog);
      const gain = (B.trainBaseGain + dog.genome.intelligence * B.trainIntelligenceGain + dog.needs.loyalty * B.trainLoyaltyGain) * temper * zone;
      const before = dog.skills[skill];
      dog.skills[skill] = clamp100(before + gain);
      dog.needs.energy = clamp100(dog.needs.energy - B.trainEnergyCost);
      dog.needs.loyalty = clamp100(dog.needs.loyalty + 1);
      interactWith(sim, dog, B.trainDurationMin);
      sim.stats.trained++;
      p.setBusy(1.2, 'train');
      const learned = before < 100 && dog.skills[skill] >= 100;
      return {
        ok: true,
        message: learned
          ? t('{name} "{skill}" öğrendi!', { name: dog.name, skill: t(SKILL_NAMES_TR[skill]) })
          : t('{skill}: {pct}%', { skill: t(SKILL_NAMES_TR[skill]), pct: Math.floor(dog.skills[skill]) }),
      };
    }
    case 'groom': {
      const dog = r.dog!;
      dog.needs.hygiene = clamp100(dog.needs.hygiene + B.groomGain);
      dog.needs.loyalty = clamp100(dog.needs.loyalty + 1);
      interactWith(sim, dog, B.groomDurationMin);
      sim.stats.groomed++;
      p.setBusy(0.9, 'groom');
      return { ok: true, message: t('{name} fırçalandı', { name: dog.name }) };
    }
    case 'pickEgg': {
      const egg = r.tile ? harvestNest(sim, r.tile.x, r.tile.y) : null;
      if (!egg) return { ok: false };
      sim.backpack.push(egg);
      p.setBusy(0.7, 'pick');
      return { ok: true, message: t('Yumurta bulundu: {desc}', { desc: eggDescription(egg) }) };
    }
    case 'berries': {
      const got = r.tile ? harvestBerries(sim, r.tile.x, r.tile.y) : 0;
      if (got <= 0) return { ok: false };
      p.setBusy(0.6, 'pick');
      return { ok: true, message: t('+{n} ödül maması ({total})', { n: got, total: sim.treats }) };
    }
    case 'treatWild': {
      const dog = r.dog!;
      sim.treats--;
      dog.trust++;
      dog.needs.loyalty = clamp100(dog.needs.loyalty + 5);
      interactWith(sim, dog, 3);
      p.setBusy(0.7, 'treat');
      if (dog.trust >= tameTreatsFor(dog)) {
        sim.tameDog(dog);
        return { ok: true };
      }
      return { ok: true, message: t('{name} ödülü aldı (güven {trust}/{max})', { name: dog.name, trust: dog.trust, max: tameTreatsFor(dog) }) };
    }
    case 'call': {
      const dogs = callableDogs(sim);
      let n = 0;
      for (const d of dogs) {
        if (!sim.brain.summon(d, { x: p.tileX, y: p.tileY })) continue;
        n++;
        d.needs.loyalty = clamp100(d.needs.loyalty + 1);
        d.lastInteractionDay = sim.clock.day;
      }
      if (n === 0) return { ok: false, message: t('Kimse gelemedi (yol yok)') };
      sim.stats.calls++;
      p.setBusy(0.5, 'call');
      return { ok: true, message: t('{n} köpek geliyor', { n }) };
    }
    case 'enter':
      return r.building ? sim.enterBuilding(r.building.id) : { ok: false };
    case 'computer':
      return { ok: true, open: 'computer' };
    case 'order':
      return { ok: true, open: 'order' };
    case 'books':
      return { ok: true, open: 'help' };
    case 'restShop':
      return { ok: true, open: 'furniture', building: r.building };
    case 'autoOrder':
      return { ok: true, open: 'autoOrder' };
    case 'bake': {
      const baked = bake(sim);
      if (baked.ok) p.setBusy(BALANCE.kitchen.busySec, 'bake');
      return baked;
    }
    case 'clinic':
      return { ok: true, open: 'clinic' };
    case 'enterVillage':
      return r.village !== undefined ? sim.enterVillage(r.village) : { ok: false };
    case 'wholesale':
      return { ok: true, open: 'wholesale' };
    case 'toyShop':
      return { ok: true, open: 'toyShop' };
    case 'market':
      return { ok: true, open: 'market' };
    case 'talk':
      return r.villager !== undefined ? sim.villagers.talk(r.villager) : { ok: false };
    case 'sleep':
      if (!canSleepAt(sim.clock.hour)) return { ok: false, message: t("Henüz erken: {h}:00'den sonra uyunabilir", { h: BALANCE.time.sleepFromHour }) };
      return sim.command({ type: 'sleep' });
    case 'coffee': {
      if (sim.coffeeDay === sim.clock.day) return { ok: false, message: t('Bugünkü kahveni içtin') };
      sim.coffeeDay = sim.clock.day;
      p.stamina = BALANCE.player.staminaMax;
      p.exhausted = false;
      p.setBusy(1, 'coffee');
      return { ok: true, message: t('☕ Kahve içtin: dayanıklılık doldu') };
    }
    case 'office':
      return { ok: true, open: 'office', building: r.building };
    case 'shed':
      return { ok: true, open: 'shed', building: r.building };
    case 'kennel':
      return { ok: true, open: 'kennel', building: r.building };
    case 'incubator':
      return { ok: true, open: 'incubator', building: r.building };
    case 'nursery':
      return { ok: true, open: 'nursery', building: r.building };
    default:
      return { ok: false };
  }
}

export function nearestDogToBuilding(sim: Sim, b: Building, radius: number): Dog | null {
  const fp = buildingFootprint(b);
  const cx = b.x + fp.w / 2;
  const cy = b.y + fp.h / 2;
  let best: Dog | null = null;
  let bestD = radius + Math.max(fp.w, fp.h) / 2;
  for (const dog of sim.dogs) {
    const d = Math.hypot(dog.x - cx, dog.y - cy);
    if (d < bestD) {
      bestD = d;
      best = dog;
    }
  }
  return best;
}

/** Eğitim alanında çalışınca bonus; alandaki engeller (en fazla 3) küçük ek bonus verir. */
export function trainingZoneFactor(sim: Sim, dog: Dog): number {
  if (sim.world.zoneAt(dog.tileX, dog.tileY) !== Zone.Training) return 1;
  let obstacles = 0;
  for (const b of sim.buildings) {
    if (b.type === 'obstacle' && isReady(b) && sim.world.zoneAt(b.x, b.y) === Zone.Training) obstacles++;
  }
  return BALANCE.dogs.trainingZoneBonus + Math.min(3, obstacles) * BALANCE.dogs.obstacleBonus;
}

function interactWith(sim: Sim, dog: Dog, minutes: number): void {
  dog.state = 'interact';
  dog.stateTimer = minutes;
  dog.path = [];
  dog.targetBuildingId = null;
  dog.lastInteractionDay = sim.clock.day;
  // Oyuncuya dön.
  const dx = sim.player.x - dog.x;
  const dy = sim.player.y - dog.y;
  if (Math.abs(dx) >= Math.abs(dy)) dog.facing = dx < 0 ? 1 : 2;
  else dog.facing = dy < 0 ? 3 : 0;
}
