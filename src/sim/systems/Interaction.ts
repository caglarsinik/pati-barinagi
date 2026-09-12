import { BALANCE } from '../../config/balance';
import { type Building, buildingDef } from '../entities/Building';
import { type Dog, SKILL_KEYS, SKILL_NAMES_TR, type SkillKey, clamp100 } from '../entities/Dog';
import { FACING_DELTA } from '../entities/Player';
import type { TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import type { Sim } from '../Sim';
import { cleanMess } from './MessSystem';

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

export type ActionKind = 'pet' | 'play' | 'train' | 'groom' | 'fillBowl' | 'clean' | 'shed' | 'kennel' | 'incubator' | 'none';

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
  if (w.objectAt(tile.x, tile.y) === Obj.Mess) return { kind: 'clean', hint: 'E: pisliği temizle', tile };

  // Bina.
  const bid = w.buildingIdAt(tile.x, tile.y);
  const building = bid >= 0 ? sim.buildingById(bid) : null;
  if (building) {
    const def = buildingDef(building);
    if (building.type === 'bowl') {
      if (building.food >= (def.foodCapacity ?? 4) - 0.01) return { kind: 'none', hint: 'Yem kabı dolu', building };
      if (sim.foodStock <= 0) return { kind: 'none', hint: 'Kiler boş: kilerden yem sipariş et', building };
      return { kind: 'fillBowl', hint: `E: yem kabını doldur (${Math.floor(building.food)}/${def.foodCapacity})`, building };
    }
    if (building.type === 'shed') return { kind: 'shed', hint: `E: kiler (${Math.floor(sim.foodStock)} porsiyon)`, building };
    if (building.type === 'kennelSmall' || building.type === 'kennelLarge') {
      const names = building.occupants.map((id) => sim.dogById(id)?.name ?? '?').join(', ');
      return { kind: 'kennel', hint: `E: ${def.name}${names ? ` (${names})` : ' (boş)'}`, building };
    }
    if (building.type === 'incubator') return { kind: 'incubator', hint: 'E: kuluçka', building };
  }

  // Köpek.
  const dog = nearestDog(sim, fp.x, fp.y, 1.25);
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
  open?: 'shed' | 'kennel' | 'incubator';
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
    case 'fillBowl': {
      const b = r.building!;
      const cap = buildingDef(b).foodCapacity ?? 4;
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
      const gain = (B.trainBaseGain + dog.genome.intelligence * B.trainIntelligenceGain + dog.needs.loyalty * B.trainLoyaltyGain) * temper;
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
