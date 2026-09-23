import { GAME } from '../config/game';

/** Kayıt dosyasının kökü. Alt alanların doğrulaması ilgili sınıfların fromJSON'unda yapılır. */
export interface SaveData {
  version: number;
  savedAt: number;
  seed: number;
  clock: unknown;
  player: unknown;
  speed: number;
  mode: string;
  money: number;
  difficulty?: string;
  loan?: number;
  negativeWeeks?: number;
  gameOver?: unknown;
  victory?: unknown;
  backpackLevel?: number;
  volunteerOffer?: unknown;
  tool?: string;
  autopilot?: boolean;
  coffeeDay?: number;
  bakeDay?: number;
  bakesToday?: number;
  markers?: unknown[];
  villageFound?: boolean;
  starter?: string;
  goals?: unknown;
  dayStart?: unknown;
  lastDay?: unknown;
  supplies?: unknown;
  bicycle?: boolean;
  marketEggWeek?: number;
  villageStage?: number;
  /** Köylü görevleri (0.20.4). */
  quests?: unknown;
  /** Sahiplendirme mektupları (0.21.1). */
  mail?: unknown;
  foodStock?: number;
  nextId?: number;
  stats?: unknown;
  plot?: { x: number; y: number; w: number; h: number };
  /** Arsa içindeki nesne/bölge/zemin katmanları, satır satır. */
  plotObjects?: number[];
  plotZones?: number[];
  plotGround?: number[];
  /** Arsa dışı nesne değişiklikleri: [kareIndeksi, nesne, ...] düz dizi. */
  objectChanges?: number[];
  buildings?: unknown[];
  dogs?: unknown[];
  treats?: number;
  backpack?: unknown[];
  nestTimers?: number[];
  nestHarvests?: number[];
  bushTimers?: number[];
  /** Keşfedilen kareler, bit paketli base64. */
  explored?: string;
  reputation?: number;
  licenseLevel?: number;
  adopters?: unknown[];
  ledger?: unknown[];
  weeks?: unknown[];
  adoptions?: unknown[];
  pendingReturns?: unknown[];
  lastInspection?: unknown;
  staff?: unknown[];
  candidates?: unknown[];
  candidatesDay?: number;
  policies?: unknown;
  weather?: unknown;
  eventLog?: unknown;
  flags?: unknown;
  achievements?: unknown;
}

export interface SaveSummary {
  slot: number;
  savedAt: number;
  day: number;
  money: number;
  difficulty: string | null;
  victory: boolean;
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Sürüm N'den N+1'e geçiren fonksiyonlar; yeni sürümde buraya eklenir. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2 (M8): susuzluk, yalak suyu, dostluk, hastalık, gezdirme ve karantina politikası eklendi.
  // Yeni alanlar yükleyicilerde varsayılanla dolduğu için veri olduğu gibi geçer.
  1: (d) => d,
};

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export const SaveManager = {
  key(slot: number): string {
    return `${GAME.saveKeyPrefix}${slot}`;
  },

  /** Son kullanılan yuvanın saklandığı anahtar. */
  lastSlotKey: 'pati-barinagi.lastSlot',

  lastSlot(): number {
    try {
      const v = Number(storage()?.getItem(this.lastSlotKey));
      return Number.isInteger(v) && v >= 0 && v < GAME.saveSlots ? v : 0;
    } catch {
      return 0;
    }
  },

  setLastSlot(slot: number): void {
    try {
      storage()?.setItem(this.lastSlotKey, String(slot));
    } catch {
      /* yoksay */
    }
  },

  /** Tüm yuvaların özeti (boş ya da bozuk yuva null). */
  listSlots(n: number = GAME.saveSlots): Array<SaveSummary | null> {
    return Array.from({ length: n }, (_, i) => this.summary(i));
  },

  has(slot: number): boolean {
    const s = storage();
    return !!s && s.getItem(this.key(slot)) !== null;
  },

  /** Asla fırlatmaz: yoksa ya da bozuksa null döner. */
  read(slot: number): SaveData | null {
    const s = storage();
    if (!s) return null;
    try {
      const raw = s.getItem(this.key(slot));
      if (!raw) return null;
      return this.parse(raw);
    } catch (err) {
      console.warn('Kayıt okunamadı:', err);
      return null;
    }
  },

  parse(raw: string): SaveData | null {
    let data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    let version = typeof data.version === 'number' ? data.version : 0;
    while (version < GAME.saveVersion) {
      const m = MIGRATIONS[version];
      if (!m) {
        console.warn(`Kayıt sürümü ${version} için migrasyon yok.`);
        return null;
      }
      data = m(data);
      version++;
      data.version = version;
    }
    if (typeof data.seed !== 'number') return null;
    return data as unknown as SaveData;
  },

  write(slot: number, data: SaveData): boolean {
    const s = storage();
    if (!s) return false;
    try {
      s.setItem(this.key(slot), JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn('Kayıt yazılamadı:', err);
      return false;
    }
  },

  remove(slot: number): void {
    storage()?.removeItem(this.key(slot));
  },

  summary(slot: number): SaveSummary | null {
    const d = this.read(slot);
    if (!d) return null;
    const clock = d.clock as { totalMinutes?: number } | null;
    const minutes = typeof clock?.totalMinutes === 'number' ? clock.totalMinutes : 0;
    return {
      slot,
      savedAt: d.savedAt,
      day: Math.floor(minutes / 1440) + 1,
      money: d.money,
      difficulty: typeof d.difficulty === 'string' ? d.difficulty : null,
      victory: !!d.victory,
    };
  },

  /** Kullanıcının indirmesi için JSON metni. */
  exportText(data: SaveData): string {
    return JSON.stringify(data, null, 2);
  },
};
