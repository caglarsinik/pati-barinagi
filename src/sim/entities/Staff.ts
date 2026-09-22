import { BALANCE } from '../../config/balance';
import type { Rng } from '../../core/Rng';
import type { TilePos } from '../world/TileWorld';
import type { Facing } from './Player';

export type StaffRole = 'caretaker' | 'trainer' | 'vet';
export const STAFF_ROLES: StaffRole[] = ['caretaker', 'trainer', 'vet'];
export const ROLE_NAMES_TR: Record<StaffRole, string> = { caretaker: 'Bakıcı', trainer: 'Eğitmen', vet: 'Veteriner' };

export type TaskType = 'feed' | 'water' | 'clean' | 'play' | 'train' | 'groom' | 'treat';
export const TASK_TYPES: TaskType[] = ['feed', 'water', 'clean', 'play', 'train', 'groom', 'treat'];
export const TASK_NAMES_TR: Record<TaskType, string> = {
  feed: 'Yem',
  water: 'Su',
  clean: 'Temizlik',
  play: 'Oyun',
  train: 'Eğitim',
  groom: 'Tımar',
  treat: 'Tedavi',
};

/** Rolün görev türündeki verimi; 0 ise yapamaz. */
export const ROLE_EFFICIENCY: Record<StaffRole, Record<TaskType, number>> = {
  caretaker: { feed: 1, water: 1, clean: 1, play: 0.9, groom: 0.8, train: 0.3, treat: 0 },
  trainer: { feed: 0.6, water: 0.6, clean: 0.5, play: 1, groom: 0.5, train: 1, treat: 0 },
  vet: { feed: 0.5, water: 0.6, clean: 0.5, play: 0.5, groom: 1, train: 0.2, treat: 1 },
};

export const DEFAULT_PRIORITIES: Record<StaffRole, Record<TaskType, number>> = {
  caretaker: { feed: 4, water: 4, clean: 4, play: 3, groom: 2, train: 0, treat: 0 },
  trainer: { feed: 2, water: 2, clean: 1, play: 4, groom: 1, train: 5, treat: 0 },
  vet: { feed: 1, water: 1, clean: 1, play: 1, groom: 4, train: 0, treat: 5 },
};

export type StaffTrait = 'whisperer' | 'meticulous' | 'lazy' | 'nightOwl' | 'clumsy';
export const STAFF_TRAITS: StaffTrait[] = ['whisperer', 'meticulous', 'lazy', 'nightOwl', 'clumsy'];
export const TRAIT_INFO_TR: Record<StaffTrait, { name: string; desc: string }> = {
  whisperer: { name: 'Köpek fısıldayan', desc: 'Oyun ve eğitimde köpekler ona daha çok bağlanır.' },
  meticulous: { name: 'Titiz', desc: 'Temizlik ve tımar daha etkili.' },
  lazy: { name: 'Tembel', desc: 'Daha erken mola verir.' },
  nightOwl: { name: 'Gece kuşu', desc: 'Gece çalışmak onu yormaz.' },
  clumsy: { name: 'Sakar', desc: 'Yem doldururken ara sıra döker.' },
};

export interface StaffAttrs {
  speed: number;
  diligence: number;
  empathy: number;
  stamina: number;
  skill: number;
}

export const ATTR_NAMES_TR: Record<keyof StaffAttrs, string> = {
  speed: 'Hız',
  diligence: 'Çalışkanlık',
  empathy: 'Şefkat',
  stamina: 'Dayanıklılık',
  skill: 'Beceri',
};

/** Seviye atlayınca artan nitelikler (sırayla; 5'e ulaşan atlanır). */
export const ROLE_MAIN_ATTRS: Record<StaffRole, Array<keyof StaffAttrs>> = {
  caretaker: ['diligence', 'speed', 'stamina'],
  trainer: ['skill', 'empathy', 'diligence'],
  vet: ['skill', 'empathy', 'diligence'],
};

/** Bu seviyeden bir sonrakine gereken deneyim. */
export function xpForLevel(level: number): number {
  return BALANCE.staff.progress.xpPerLevel * level;
}

/** 0 izin, 1 çalış, 2 mola. */
export type ShiftKind = 0 | 1 | 2;

export type StaffState = 'offDuty' | 'idle' | 'toTask' | 'working' | 'toRest' | 'resting' | 'leaving';

export interface StaffSave {
  id: number;
  name: string;
  role: StaffRole;
  attrs: StaffAttrs;
  traits: StaffTrait[];
  wage: number;
  look: number;
  x: number;
  y: number;
  energy: number;
  schedule: number[];
  priorities: Record<TaskType, number>;
  unpaidWeeks: number;
  hiredDay: number;
  offDuty: boolean;
  xp?: number;
  level?: number;
  morale?: number;
  lowMoraleDays?: number;
}

export class Staff {
  id: number;
  name: string;
  role: StaffRole;
  attrs: StaffAttrs;
  traits: StaffTrait[];
  wage: number;
  look: number;
  x: number;
  y: number;
  facing: Facing = 0;
  moving = false;
  path: TilePos[] = [];
  state: StaffState = 'offDuty';
  energy = 100;
  schedule: ShiftKind[];
  priorities: Record<TaskType, number>;
  taskId: number | null = null;
  /** Mevcut işte kalan süre (oyun dakikası). */
  taskLeft = 0;
  retries = 0;
  decisionTimer = 0;
  unpaidWeeks = 0;
  hiredDay = 1;
  /** Deneyim (seviye içinde) ve seviye (1-5). */
  xp = 0;
  level = 1;
  /** Moral 0-100: düşükse verim düşer, uzun süre dipte kalırsa istifa. */
  morale: number = BALANCE.staff.morale.start;
  lowMoraleDays = 0;

  constructor(id: number, name: string, role: StaffRole, attrs: StaffAttrs, traits: StaffTrait[], wage: number, look: number, x: number, y: number) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.attrs = attrs;
    this.traits = traits;
    this.wage = wage;
    this.look = look;
    this.x = x;
    this.y = y;
    this.schedule = defaultSchedule('day');
    this.priorities = { ...DEFAULT_PRIORITIES[role] };
  }

  get tileX(): number {
    return Math.floor(this.x);
  }

  get tileY(): number {
    return Math.floor(this.y);
  }

  has(trait: StaffTrait): boolean {
    return this.traits.includes(trait);
  }

  /** Kare / oyun dakikası. */
  speed(): number {
    return BALANCE.staff.baseSpeed * (0.85 + this.attrs.speed * 0.06);
  }

  /** Görev türündeki verim: rol × çalışkanlık × beceri. */
  efficiency(type: TaskType): number {
    const role = ROLE_EFFICIENCY[this.role][type];
    if (role <= 0) return 0;
    const M = BALANCE.staff.morale;
    return role * (0.7 + this.attrs.diligence * 0.08) * (0.85 + this.attrs.skill * 0.05) * (this.morale < M.lowBelow ? M.lowEfficiencyMul : 1);
  }

  canDo(type: TaskType): boolean {
    return ROLE_EFFICIENCY[this.role][type] > 0 && this.priorities[type] > 0;
  }

  get onDuty(): boolean {
    return this.state !== 'offDuty' && this.state !== 'leaving';
  }

  toJSON(): StaffSave {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      attrs: { ...this.attrs },
      traits: [...this.traits],
      wage: this.wage,
      look: this.look,
      x: this.x,
      y: this.y,
      energy: this.energy,
      schedule: [...this.schedule],
      priorities: { ...this.priorities },
      unpaidWeeks: this.unpaidWeeks,
      hiredDay: this.hiredDay,
      offDuty: this.state === 'offDuty',
      xp: this.xp,
      level: this.level,
      morale: this.morale,
      lowMoraleDays: this.lowMoraleDays,
    };
  }

  static fromJSON(data: unknown): Staff | null {
    const d = data as Partial<StaffSave> | null;
    if (!d || typeof d.id !== 'number' || typeof d.name !== 'string' || !STAFF_ROLES.includes(d.role as StaffRole)) return null;
    if (typeof d.x !== 'number' || typeof d.y !== 'number') return null;
    const a = (d.attrs ?? {}) as Partial<StaffAttrs>;
    const attrs: StaffAttrs = {
      speed: clampAttr(a.speed),
      diligence: clampAttr(a.diligence),
      empathy: clampAttr(a.empathy),
      stamina: clampAttr(a.stamina),
      skill: clampAttr(a.skill),
    };
    const traits = Array.isArray(d.traits) ? d.traits.filter((t): t is StaffTrait => STAFF_TRAITS.includes(t as StaffTrait)) : [];
    const s = new Staff(d.id, d.name, d.role as StaffRole, attrs, traits, typeof d.wage === 'number' ? d.wage : 300, typeof d.look === 'number' ? d.look : 0, d.x, d.y);
    if (typeof d.energy === 'number' && Number.isFinite(d.energy)) s.energy = Math.max(0, Math.min(100, d.energy));
    if (Array.isArray(d.schedule) && d.schedule.length === 24) s.schedule = d.schedule.map((v) => (v === 1 || v === 2 ? v : 0)) as ShiftKind[];
    if (d.priorities && typeof d.priorities === 'object') {
      for (const t of TASK_TYPES) {
        const v = (d.priorities as Record<string, unknown>)[t];
        if (typeof v === 'number') s.priorities[t] = Math.max(0, Math.min(5, Math.round(v)));
      }
    }
    s.unpaidWeeks = typeof d.unpaidWeeks === 'number' ? d.unpaidWeeks : 0;
    s.hiredDay = typeof d.hiredDay === 'number' ? d.hiredDay : 1;
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    s.level = num(d.level) ? Math.max(1, Math.min(BALANCE.staff.progress.maxLevel, Math.floor(d.level))) : 1;
    s.xp = num(d.xp) ? Math.max(0, d.xp) : 0;
    s.morale = num(d.morale) ? Math.max(0, Math.min(100, d.morale)) : BALANCE.staff.morale.start;
    s.lowMoraleDays = num(d.lowMoraleDays) ? Math.max(0, Math.floor(d.lowMoraleDays)) : 0;
    s.state = d.offDuty === false ? 'idle' : 'offDuty';
    return s;
  }
}

function clampAttr(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(5, Math.round(v))) : 3;
}

export function defaultSchedule(kind: 'day' | 'night' | 'full'): ShiftKind[] {
  const s: ShiftKind[] = new Array(24).fill(0) as ShiftKind[];
  const set = (from: number, to: number): void => {
    for (let h = from; h !== to; h = (h + 1) % 24) s[h] = 1;
  };
  if (kind === 'day') {
    set(8, 18);
    s[13] = 2;
  } else if (kind === 'night') {
    set(20, 6);
    s[1] = 2;
  } else {
    set(6, 22);
    s[12] = 2;
    s[17] = 2;
  }
  return s;
}

const PERSON_LOOKS = 0xffff;

/** İşe alınabilecek aday: nitelikler çoğunlukla 2-4, nadiren 1 ya da 5. */
export function randomCandidate(rng: Rng, id: number, role: StaffRole, name: string, day: number): Staff {
  const roll = (): number => rng.weighted([1, 2, 3, 4, 5], [1, 4, 6, 4, 1]);
  const attrs: StaffAttrs = { speed: roll(), diligence: roll(), empathy: roll(), stamina: roll(), skill: roll() };
  const traits: StaffTrait[] = [];
  const n = rng.weighted([0, 1, 2], [4, 5, 2]);
  const pool = rng.shuffle([...STAFF_TRAITS]);
  for (let i = 0; i < n; i++) traits.push(pool[i]);
  const avg = (attrs.speed + attrs.diligence + attrs.empathy + attrs.stamina + attrs.skill) / 5;
  const base = BALANCE.staff.baseWage[role];
  const wage = Math.round((base * (0.7 + (avg / 5) * 0.6)) / 10) * 10;
  const s = new Staff(id, name, role, attrs, traits, wage, rng.int(0, PERSON_LOOKS), 0, 0);
  s.hiredDay = day;
  return s;
}
