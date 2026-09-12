export type BuildingType =
  | 'office'
  | 'kennelSmall'
  | 'kennelLarge'
  | 'shed'
  | 'bowl'
  | 'trough'
  | 'incubator'
  | 'toyBall'
  | 'bin';

export type BuildingCategory = 'yonetim' | 'barinma' | 'besleme' | 'buyume' | 'oyun' | 'altyapi';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  w: number;
  h: number;
  cost: number;
  category: BuildingCategory;
  /** Üstten kaç satır geçilmez ('all' hepsi, 0 hiçbiri). Kulübede ön satır köpeğin yattığı eşiktir. */
  solidRows: number | 'all';
  desc: string;
  /** Kulübe: kaç köpek barınır. */
  capacity?: number;
  /** Kap: kaç porsiyon alır. */
  foodCapacity?: number;
  /** Kuluçka: kaç yumurta. */
  eggSlots?: number;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  office: {
    type: 'office',
    name: 'Ofis',
    w: 3,
    h: 3,
    cost: 0,
    category: 'yonetim',
    solidRows: 'all',
    desc: 'Barınağın kalbi. Sahiplenici burada karşılanır, personel burada işe alınır.',
  },
  kennelSmall: {
    type: 'kennelSmall',
    name: 'Küçük kulübe',
    w: 2,
    h: 2,
    cost: 600,
    category: 'barinma',
    solidRows: 1,
    desc: '1 köpek barındırır (küçük ya da orta boy).',
    capacity: 1,
  },
  kennelLarge: {
    type: 'kennelLarge',
    name: 'Büyük kulübe',
    w: 3,
    h: 2,
    cost: 1100,
    category: 'barinma',
    solidRows: 1,
    desc: '2 köpek barındırır, büyük köpeklere uygun.',
    capacity: 2,
  },
  shed: {
    type: 'shed',
    name: 'Kiler',
    w: 2,
    h: 2,
    cost: 500,
    category: 'besleme',
    solidRows: 'all',
    desc: 'Yem çuvalları burada durur. Yanına gelip E ile sipariş verilir.',
  },
  bowl: {
    type: 'bowl',
    name: 'Yem kabı',
    w: 1,
    h: 1,
    cost: 40,
    category: 'besleme',
    solidRows: 0,
    desc: '4 porsiyon alır. Kilerden yem taşınarak doldurulur.',
    foodCapacity: 4,
  },
  trough: {
    type: 'trough',
    name: 'Su yalağı',
    w: 1,
    h: 1,
    cost: 120,
    category: 'besleme',
    solidRows: 0,
    desc: 'Köpekler susuz kalmasın.',
  },
  incubator: {
    type: 'incubator',
    name: 'Kuluçka',
    w: 2,
    h: 2,
    cost: 900,
    category: 'buyume',
    solidRows: 'all',
    desc: 'Yumurtalar 3 günde çıkar. 3 yuva.',
    eggSlots: 3,
  },
  toyBall: {
    type: 'toyBall',
    name: 'Top',
    w: 1,
    h: 1,
    cost: 90,
    category: 'oyun',
    solidRows: 0,
    desc: 'Köpekler kendi başlarına biraz oynar.',
  },
  bin: {
    type: 'bin',
    name: 'Çöp kutusu',
    w: 1,
    h: 1,
    cost: 120,
    category: 'altyapi',
    solidRows: 'all',
    desc: 'Toplanan pislikler buraya atılır.',
  },
};
