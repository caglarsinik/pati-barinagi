import { BALANCE } from '../../config/balance';
import { type Building, buildingDef, isReady } from '../entities/Building';
import { type Dog, SKILL_KEYS, SKILL_NAMES_TR, type SkillKey, clamp100 } from '../entities/Dog';
import { FACING_DELTA } from '../entities/Player';
import type { TilePos } from '../world/TileWorld';
import { Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { eggDescription } from '../entities/Egg';
import { cleanMess } from './MessSystem';
import { harvestBerries, harvestNest } from './NestSystem';

export type Tool = 'pet' | 'play' | 'train' | 'feed' | 'clean';

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
];

export type ActionKind =
  | 'pet'
  | 'play'
  | 'train'
  | 'groom'
  | 'fillBowl'
  | 'clean'
  | 'wash'
  | 'treat'
  | 'shed'
  | 'kennel'
  | 'incubator'
  | 'pickEgg'
  | 'berries'
  | 'treatWild'
  | 'sleep'
  | 'office'
  | 'none';

export interface ResolvedAction {
  kind: ActionKind;
  hint: string;
  dog?: Dog;
  building?: Building;
  tile?: TilePos;
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

/**
 * Aynı fonksiyon hem alt çubuktaki ipucunu hem E'nin yapacağı işi belirler; ikisi asla ayrışmaz.
 */
export function resolveAction(sim: Sim): ResolvedAction {
  if (sim.mode !== 'avatar') return { kind: 'none', hint: '' };
  const fp = facingPoint(sim);
  const tile = { x: Math.floor(fp.x), y: Math.floor(fp.y) };
  const w = sim.world;

  // Pislik her araçla temizlenir.
  const obj = w.objectAt(tile.x, tile.y);
  if (obj === Obj.Mess) return { kind: 'clean', hint: 'E: pisliği temizle', tile };
  if (obj === Obj.NestEggs) {
    if (sim.backpack.length >= sim.backpackSlots()) return { kind: 'none', hint: `Çanta dolu (${sim.backpack.length}/${sim.backpackSlots()}): kuluçkaya boşalt`, tile };
    return { kind: 'pickEgg', hint: 'E: yumurtayı al', tile };
  }
  if (obj === Obj.Nest) return { kind: 'none', hint: 'Boş yuva: birkaç güne yeniden dolar', tile };
  if (obj === Obj.BerryBush) {
    if (sim.treats >= BALANCE.eggs.treatsMax) return { kind: 'none', hint: 'Ödül maması çantası dolu', tile };
    return { kind: 'berries', hint: `E: böğürtlen topla (ödül maması +${BALANCE.eggs.treatsPerBush})`, tile };
  }
  if (obj === Obj.Den) return { kind: 'none', hint: 'Sokak köpeği ini', tile };

  // Bina.
  const bid = w.buildingIdAt(tile.x, tile.y);
  const building = bid >= 0 ? sim.buildingById(bid) : null;
  if (building) {
    const def = buildingDef(building);
    if (!isReady(building)) {
      const pct = Math.round(100 * (1 - building.buildLeft / Math.max(1, def.buildMinutes)));
      return { kind: 'none', hint: `${def.name} inşa ediliyor (%${pct})`, building };
    }
    if (building.type === 'bowl') {
      const cap = sim.bowlCapacity(building);
      if (building.food >= cap - 0.01) return { kind: 'none', hint: 'Yem kabı dolu', building };
      if (sim.foodStock <= 0) return { kind: 'none', hint: 'Kiler boş: kilerden yem sipariş et', building };
      return { kind: 'fillBowl', hint: `E: yem kabını doldur (${Math.floor(building.food)}/${cap})`, building };
    }
    if (building.type === 'groomStation') {
      const near = nearestDogToBuilding(sim, building, BALANCE.dogs.stationRadius);
      if (!near) return { kind: 'none', hint: 'Tımar: yakında köpek yok', building };
      if (near.needs.hygiene >= 99) return { kind: 'none', hint: `${near.name} zaten tertemiz`, building };
      return { kind: 'wash', hint: `E: ${near.name}'i yıka (temizlik ${Math.floor(near.needs.hygiene)}%)`, building, dog: near };
    }
    if (building.type === 'vetClinic') {
      const near = nearestDogToBuilding(sim, building, BALANCE.dogs.stationRadius);
      if (!near) return { kind: 'none', hint: 'Veteriner: yakında köpek yok', building };
      if (near.needs.health >= 90) return { kind: 'none', hint: `${near.name} sağlıklı`, building };
      return {
        kind: 'treat',
        hint: `E: ${near.name}'i tedavi et (${BALANCE.economy.treatmentPrice} ${BALANCE.economy.currency})`,
        building,
        dog: near,
      };
    }
    if (building.type === 'shed') return { kind: 'shed', hint: `E: kiler (${Math.floor(sim.foodStock)} porsiyon)`, building };
    if (building.type === 'office') {
      const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
      return { kind: 'office', hint: waiting > 0 ? `E: ofis (${waiting} sahiplenici bekliyor)` : 'E: ofis (lisans, uyku)', building };
    }
    if (building.type === 'kennelSmall' || building.type === 'kennelLarge') {
      const names = building.occupants.map((id) => sim.dogById(id)?.name ?? '?').join(', ');
      return { kind: 'kennel', hint: `E: ${def.name}${names ? ` (${names})` : ' (boş)'}`, building };
    }
    if (building.type === 'incubator') return { kind: 'incubator', hint: 'E: kuluçka', building };
  }

  // Köpek.
  const dog = nearestDog(sim, fp.x, fp.y, 1.25);
  if (dog && dog.wild) {
    if (dog.following) return { kind: 'none', hint: `${dog.name} peşinde: barınağa götür`, dog };
    if (sim.treats <= 0) return { kind: 'none', hint: `${dog.name} ürkek: ödül maması lazım (böğürtlen çalısı)`, dog };
    return { kind: 'treatWild', hint: `E: ${dog.name}'e ödül ver (güven ${dog.trust}/${BALANCE.eggs.tameTreats})`, dog };
  }
  if (dog) {
    const tool = sim.tool;
    if (tool === 'play') {
      if (dog.isAsleep()) return { kind: 'none', hint: `${dog.name} uyuyor`, dog };
      if (dog.needs.energy < BALANCE.dogs.playMinEnergy) return { kind: 'none', hint: `${dog.name} çok yorgun`, dog };
      return { kind: 'play', hint: `E: ${dog.name} ile oyna`, dog };
    }
    if (tool === 'train') {
      if (dog.isAsleep()) return { kind: 'none', hint: `${dog.name} uyuyor`, dog };
      if (dog.needs.energy < BALANCE.dogs.trainMinEnergy) return { kind: 'none', hint: `${dog.name} eğitim için çok yorgun`, dog };
      const skill = trainingSkill(dog);
      if (!skill) return { kind: 'none', hint: `${dog.name} her şeyi öğrendi`, dog };
      return { kind: 'train', hint: `E: ${dog.name} eğit (${SKILL_NAMES_TR[skill]} ${Math.floor(dog.skills[skill])}%)`, dog };
    }
    if (tool === 'clean') {
      if (dog.needs.hygiene >= 95) return { kind: 'none', hint: `${dog.name} zaten tertemiz`, dog };
      return { kind: 'groom', hint: `E: ${dog.name}'i fırçala (temizlik ${Math.floor(dog.needs.hygiene)}%)`, dog };
    }
    return { kind: 'pet', hint: `E: ${dog.name}'i sev`, dog };
  }

  return { kind: 'none', hint: '', tile };
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
  open?: 'shed' | 'kennel' | 'incubator' | 'office';
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
      return { ok: true, message: `${dog.name} yıkandı` };
    }
    case 'treat': {
      const dog = r.dog!;
      const price = BALANCE.economy.treatmentPrice;
      if (sim.money < price) return { ok: false, message: 'İlaç için para yok' };
      sim.addExpense('treatment', price, dog.name);
      dog.needs.health = clamp100(dog.needs.health + B.treatHealthGain);
      interactWith(sim, dog, B.treatDurationMin);
      sim.stats.treated++;
      p.setBusy(1.2, 'treat');
      return { ok: true, message: `${dog.name} tedavi edildi` };
    }
    case 'fillBowl': {
      const b = r.building!;
      const cap = sim.bowlCapacity(b);
      const take = Math.min(cap - b.food, sim.foodStock);
      if (take <= 0) return { ok: false };
      b.food += take;
      sim.foodStock -= take;
      p.setBusy(0.5, 'feed');
      return { ok: true, message: `Kap dolduruldu (${Math.floor(b.food)}/${cap})` };
    }
    case 'pet': {
      const dog = r.dog!;
      const gain = dog.petsToday < B.petsFullGainPerDay ? B.petLoyaltyGain : B.petLoyaltyGainDiminished;
      dog.needs.loyalty = clamp100(dog.needs.loyalty + gain);
      dog.needs.play = clamp100(dog.needs.play + 4);
      dog.petsToday++;
      interactWith(sim, dog, B.petDurationMin);
      sim.stats.petted++;
      p.setBusy(0.45, 'pet');
      return { ok: true };
    }
    case 'play': {
      const dog = r.dog!;
      dog.needs.play = clamp100(dog.needs.play + B.playGain);
      dog.needs.loyalty = clamp100(dog.needs.loyalty + B.playLoyaltyGain);
      dog.needs.energy = clamp100(dog.needs.energy - B.playEnergyCost);
      dog.needs.bladder = clamp100(dog.needs.bladder + 5);
      interactWith(sim, dog, B.playDurationMin);
      sim.stats.played++;
      p.setBusy(1.0, 'play');
      return { ok: true, message: `${dog.name} çok eğlendi` };
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
      return { ok: true, message: learned ? `${dog.name} "${SKILL_NAMES_TR[skill]}" öğrendi!` : `${SKILL_NAMES_TR[skill]}: ${Math.floor(dog.skills[skill])}%` };
    }
    case 'groom': {
      const dog = r.dog!;
      dog.needs.hygiene = clamp100(dog.needs.hygiene + B.groomGain);
      dog.needs.loyalty = clamp100(dog.needs.loyalty + 1);
      interactWith(sim, dog, B.groomDurationMin);
      sim.stats.groomed++;
      p.setBusy(0.9, 'groom');
      return { ok: true, message: `${dog.name} fırçalandı` };
    }
    case 'pickEgg': {
      const egg = r.tile ? harvestNest(sim, r.tile.x, r.tile.y) : null;
      if (!egg) return { ok: false };
      sim.backpack.push(egg);
      p.setBusy(0.7, 'pick');
      return { ok: true, message: `Yumurta bulundu: ${eggDescription(egg)}` };
    }
    case 'berries': {
      const got = r.tile ? harvestBerries(sim, r.tile.x, r.tile.y) : 0;
      if (got <= 0) return { ok: false };
      p.setBusy(0.6, 'pick');
      return { ok: true, message: `+${got} ödül maması (${sim.treats})` };
    }
    case 'treatWild': {
      const dog = r.dog!;
      sim.treats--;
      dog.trust++;
      dog.needs.loyalty = clamp100(dog.needs.loyalty + 5);
      interactWith(sim, dog, 3);
      p.setBusy(0.7, 'treat');
      if (dog.trust >= BALANCE.eggs.tameTreats) {
        sim.tameDog(dog);
        return { ok: true };
      }
      return { ok: true, message: `${dog.name} ödülü aldı (güven ${dog.trust}/${BALANCE.eggs.tameTreats})` };
    }
    case 'sleep':
      return sim.command({ type: 'sleep' });
    case 'office':
      return { ok: true, open: 'office', building: r.building };
    case 'shed':
      return { ok: true, open: 'shed', building: r.building };
    case 'kennel':
      return { ok: true, open: 'kennel', building: r.building };
    case 'incubator':
      return { ok: true, open: 'incubator', building: r.building };
    default:
      return { ok: false };
  }
}

function nearestDogToBuilding(sim: Sim, b: Building, radius: number): Dog | null {
  const def = buildingDef(b);
  const cx = b.x + def.w / 2;
  const cy = b.y + def.h / 2;
  let best: Dog | null = null;
  let bestD = radius + Math.max(def.w, def.h) / 2;
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
