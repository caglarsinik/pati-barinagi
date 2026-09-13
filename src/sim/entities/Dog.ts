import { BALANCE } from '../../config/balance';
import type { TilePos } from '../world/TileWorld';
import { type DogGenome, isValidGenome } from './DogGenome';
import type { Facing } from './Player';

export type GrowthStage = 'puppy' | 'young' | 'adult' | 'senior';
export const STAGE_NAMES_TR: Record<GrowthStage, string> = { puppy: 'Yavru', young: 'Genç', adult: 'Yetişkin', senior: 'Yaşlı' };

export function stageForAge(weeks: number): GrowthStage {
  const g = BALANCE.dogs.growth;
  if (weeks >= g.seniorAtWeek) return 'senior';
  return weeks < g.youngAtWeek ? 'puppy' : weeks < g.adultAtWeek ? 'young' : 'adult';
}

/** Hepsi 0-100. hunger ve bladder yüksekken kötü, diğerleri yüksekken iyi. */
export interface DogNeeds {
  hunger: number;
  /** Susuzluk: yüksekken kötü. */
  thirst: number;
  play: number;
  bladder: number;
  hygiene: number;
  health: number;
  loyalty: number;
  energy: number;
}

export const SKILL_KEYS = ['sit', 'stay', 'come', 'leash', 'potty', 'social'] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];
export const SKILL_NAMES_TR: Record<SkillKey, string> = {
  sit: 'Otur',
  stay: 'Bekle',
  come: 'Gel',
  leash: 'Tasma',
  potty: 'Tuvalet eğitimi',
  social: 'Sosyallik',
};

export type DogState =
  | 'idle'
  | 'wander'
  | 'sit'
  | 'lie'
  | 'sleep'
  | 'toBowl'
  | 'eat'
  | 'toTrough'
  | 'drink'
  | 'toToilet'
  | 'toilet'
  | 'toKennel'
  | 'toToy'
  | 'play'
  | 'interact'
  | 'toFriend'
  | 'waitFriend'
  | 'playTogether'
  | 'growl'
  | 'bark';

export type DogOrigin = 'egg' | 'stray';

export interface DogSave {
  id: number;
  name: string;
  genome: DogGenome;
  origin: DogOrigin;
  ageWeeks: number;
  x: number;
  y: number;
  facing: Facing;
  needs: DogNeeds;
  skills: Record<SkillKey, number>;
  kennelId: number | null;
  lastInteractionDay: number;
  trainingFocus: SkillKey | null;
  petsToday: number;
  wild?: boolean;
  trust?: number;
  den?: TilePos | null;
  following?: boolean;
  friends?: Record<string, number>;
}

export function defaultNeeds(origin: DogOrigin): DogNeeds {
  return {
    hunger: 30,
    thirst: 30,
    play: 70,
    bladder: 20,
    hygiene: origin === 'stray' ? 45 : 80,
    health: origin === 'stray' ? 70 : 90,
    loyalty: origin === 'stray' ? 5 : 20,
    energy: 80,
  };
}

export function emptySkills(): Record<SkillKey, number> {
  return { sit: 0, stay: 0, come: 0, leash: 0, potty: 0, social: 0 };
}

/** Bir köpek: genom (sabit), ihtiyaçlar (değişken), beceriler ve anlık davranış durumu. */
export class Dog {
  id: number;
  name: string;
  genome: DogGenome;
  origin: DogOrigin;
  ageWeeks: number;
  x: number;
  y: number;
  facing: Facing = 0;
  moving = false;
  needs: DogNeeds;
  skills: Record<SkillKey, number> = emptySkills();
  kennelId: number | null = null;
  lastInteractionDay = 1;
  trainingFocus: SkillKey | null = null;
  petsToday = 0;
  /** Dünyada serbest dolaşan sokak köpeği (henüz barınağa katılmadı). */
  wild = false;
  /** Verilen ödül sayısı; yeterince olunca oyuncuya güvenir. */
  trust = 0;
  den: TilePos | null = null;
  /** Evcilleşti, oyuncunun peşinden barınağa geliyor. */
  following = false;
  /** Diğer köpeklerle dostluk puanı (-100..100), köpek id → puan. */
  friends: Record<number, number> = {};
  /** Şu an birlikte oyun için buluştuğu köpek (kayda yazılmaz). */
  playmateId: number | null = null;

  // Davranış durumu (kayda yazılmaz; yüklemede boşta başlar)
  state: DogState = 'idle';
  /** Mevcut durumda kalan süre (oyun dakikası). */
  stateTimer = 0;
  path: TilePos[] = [];
  targetBuildingId: number | null = null;
  lastTileIdx = -1;
  animTime = 0;

  constructor(id: number, name: string, genome: DogGenome, origin: DogOrigin, ageWeeks: number, x: number, y: number) {
    this.id = id;
    this.name = name;
    this.genome = genome;
    this.origin = origin;
    this.ageWeeks = ageWeeks;
    this.x = x;
    this.y = y;
    this.needs = defaultNeeds(origin);
  }

  get stage(): GrowthStage {
    return stageForAge(this.ageWeeks);
  }

  get tileX(): number {
    return Math.floor(this.x);
  }

  get tileY(): number {
    return Math.floor(this.y);
  }

  get sick(): boolean {
    return this.needs.health < BALANCE.dogs.sickBelowHealth;
  }

  /** Bir öğünde yediği porsiyon. */
  portion(): number {
    const size = BALANCE.dogs.portionBySize[this.genome.size];
    const stage = BALANCE.dogs.portionByStage[this.stage];
    return size * stage;
  }

  /** Kare/dakika hızı (oyun zamanı). */
  speed(): number {
    const stage = this.stage === 'puppy' ? 0.7 : this.stage === 'young' ? 0.9 : this.stage === 'senior' ? BALANCE.dogs.senior.speedMul : 1;
    const energy = 0.85 + (this.genome.energy - 1) * 0.075;
    return BALANCE.dogs.baseSpeed * stage * energy;
  }

  isPottyTrained(): boolean {
    return this.skills.potty >= 100;
  }

  trainingLevel(): number {
    return SKILL_KEYS.filter((k) => this.skills[k] >= 100).length;
  }

  /** Genel keyif, 0-100. */
  mood(): number {
    const n = this.needs;
    return Math.round((100 - n.hunger) * 0.22 + (100 - n.thirst) * 0.08 + n.play * 0.2 + (100 - n.bladder) * 0.1 + n.hygiene * 0.15 + n.health * 0.15 + n.energy * 0.1);
  }

  isAsleep(): boolean {
    return this.state === 'sleep';
  }

  affinity(otherId: number): number {
    return this.friends[otherId] ?? 0;
  }

  addAffinity(otherId: number, delta: number): void {
    this.friends[otherId] = Math.max(-100, Math.min(100, this.affinity(otherId) + delta));
  }

  /** En yüksek (0 üstü) dostluk puanlı köpek; yoksa null. */
  bestFriend(): { id: number; score: number } | null {
    let best: { id: number; score: number } | null = null;
    for (const [k, v] of Object.entries(this.friends)) {
      if (v > 0 && (!best || v > best.score)) best = { id: Number(k), score: v };
    }
    return best;
  }

  toJSON(): DogSave {
    return {
      id: this.id,
      name: this.name,
      genome: this.genome,
      origin: this.origin,
      ageWeeks: this.ageWeeks,
      x: this.x,
      y: this.y,
      facing: this.facing,
      needs: { ...this.needs },
      skills: { ...this.skills },
      kennelId: this.kennelId,
      lastInteractionDay: this.lastInteractionDay,
      trainingFocus: this.trainingFocus,
      petsToday: this.petsToday,
      wild: this.wild,
      trust: this.trust,
      den: this.den,
      following: this.following,
      friends: { ...this.friends },
    };
  }

  static fromJSON(data: unknown): Dog | null {
    const d = data as Partial<DogSave> | null;
    if (!d || typeof d.id !== 'number' || typeof d.name !== 'string' || !isValidGenome(d.genome)) return null;
    if (typeof d.x !== 'number' || typeof d.y !== 'number') return null;
    const origin: DogOrigin = d.origin === 'stray' ? 'stray' : 'egg';
    const age = typeof d.ageWeeks === 'number' && Number.isFinite(d.ageWeeks) ? Math.max(0, d.ageWeeks) : 0;
    const dog = new Dog(d.id, d.name, d.genome, origin, age, d.x, d.y);
    if (d.facing === 0 || d.facing === 1 || d.facing === 2 || d.facing === 3) dog.facing = d.facing;
    const n = (d.needs ?? {}) as Partial<DogNeeds>;
    for (const k of Object.keys(dog.needs) as Array<keyof DogNeeds>) {
      const v = n[k];
      if (typeof v === 'number' && Number.isFinite(v)) dog.needs[k] = clamp100(v);
    }
    const s = (d.skills ?? {}) as Partial<Record<SkillKey, number>>;
    for (const k of SKILL_KEYS) {
      const v = s[k];
      if (typeof v === 'number' && Number.isFinite(v)) dog.skills[k] = clamp100(v);
    }
    dog.kennelId = typeof d.kennelId === 'number' ? d.kennelId : null;
    dog.lastInteractionDay = typeof d.lastInteractionDay === 'number' ? d.lastInteractionDay : 1;
    dog.trainingFocus = SKILL_KEYS.includes(d.trainingFocus as SkillKey) ? (d.trainingFocus as SkillKey) : null;
    dog.petsToday = typeof d.petsToday === 'number' ? d.petsToday : 0;
    dog.wild = d.wild === true;
    dog.trust = typeof d.trust === 'number' ? Math.max(0, Math.floor(d.trust)) : 0;
    dog.den = d.den && typeof d.den.x === 'number' && typeof d.den.y === 'number' ? { x: d.den.x, y: d.den.y } : null;
    dog.following = d.following === true;
    if (d.friends && typeof d.friends === 'object') {
      for (const [k, v] of Object.entries(d.friends)) {
        const id = Number(k);
        if (Number.isInteger(id) && typeof v === 'number' && Number.isFinite(v)) dog.friends[id] = Math.max(-100, Math.min(100, v));
      }
    }
    return dog;
  }
}

export function clamp100(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}
