export type BuildingType =
  | 'office'
  | 'kennelSmall'
  | 'kennelLarge'
  | 'shed'
  | 'kitchen'
  | 'bowl'
  | 'trough'
  | 'groomStation'
  | 'vetClinic'
  | 'incubator'
  | 'toyBall'
  | 'toyRope'
  | 'toyTunnel'
  | 'obstacle'
  | 'staffRoom'
  | 'lamp'
  | 'bin'
  | 'flower'
  | 'bench'
  | 'sign';

export type BuildingCategory = 'altyapi' | 'barinma' | 'besleme' | 'bakim' | 'buyume' | 'oyun' | 'personel' | 'yonetim' | 'dekor';

export const CATEGORY_NAMES_TR: Record<BuildingCategory, string> = {
  altyapi: 'Altyapı',
  barinma: 'Barınma',
  besleme: 'Besleme',
  bakim: 'Bakım',
  buyume: 'Büyüme',
  oyun: 'Oyun ve eğitim',
  personel: 'Personel',
  yonetim: 'Yönetim',
  dekor: 'Dekor',
};

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
  /** İnşaat süresi (oyun dakikası); 0 anında biter. */
  buildMinutes: number;
  /** Menüde görünür mü (ofis sadece başlangıçta gelir). */
  buildable: boolean;
  /** Kulübe: kaç köpek barınır. */
  capacity?: number;
  /** Kap: kaç porsiyon alır. */
  foodCapacity?: number;
  /** Kuluçka: kaç yumurta. */
  eggSlots?: number;
  /** Oyuncak: kendi kendine oyunda keyif kazancı. */
  playGain?: number;
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
    buildMinutes: 0,
    buildable: false,
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
    buildMinutes: 90,
    buildable: true,
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
    buildMinutes: 150,
    buildable: true,
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
    buildMinutes: 60,
    buildable: true,
  },
  kitchen: {
    type: 'kitchen',
    name: 'Mutfak',
    w: 3,
    h: 2,
    cost: 1500,
    category: 'besleme',
    solidRows: 'all',
    desc: 'Yem kapları iki kat porsiyon alır, yalaklar kendiliğinden dolar, personel yem/su işini %40 hızlı yapar.',
    buildMinutes: 180,
    buildable: true,
  },
  bowl: {
    type: 'bowl',
    name: 'Yem kabı',
    w: 1,
    h: 1,
    cost: 40,
    category: 'besleme',
    solidRows: 0,
    desc: '4 porsiyon alır (mutfak varsa 8). Kilerden yem taşınarak doldurulur.',
    buildMinutes: 0,
    buildable: true,
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
    desc: 'Köpekler susayınca buradan içer. Önünde E ile doldur (ücretsiz); mutfak varsa kendiliğinden dolar.',
    buildMinutes: 0,
    buildable: true,
  },
  groomStation: {
    type: 'groomStation',
    name: 'Tımar istasyonu',
    w: 2,
    h: 2,
    cost: 1200,
    category: 'bakim',
    solidRows: 'all',
    desc: 'Yakındaki köpeği yıkar: temizlik 100. Önünde E.',
    buildMinutes: 120,
    buildable: true,
  },
  vetClinic: {
    type: 'vetClinic',
    name: 'Veteriner odası',
    w: 3,
    h: 3,
    cost: 3000,
    category: 'bakim',
    solidRows: 'all',
    desc: 'Yakındaki hasta köpeği tedavi eder (ilaç masrafı). Önünde E.',
    buildMinutes: 240,
    buildable: true,
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
    buildMinutes: 120,
    buildable: true,
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
    buildMinutes: 0,
    buildable: true,
    playGain: 20,
  },
  toyRope: {
    type: 'toyRope',
    name: 'Halat',
    w: 1,
    h: 1,
    cost: 140,
    category: 'oyun',
    solidRows: 0,
    desc: 'Çekiştirme halatı: daha doyurucu oyun.',
    buildMinutes: 0,
    buildable: true,
    playGain: 26,
  },
  toyTunnel: {
    type: 'toyTunnel',
    name: 'Tünel',
    w: 2,
    h: 1,
    cost: 250,
    category: 'oyun',
    solidRows: 0,
    desc: 'Koşup geçilen tünel: en eğlenceli oyuncak.',
    buildMinutes: 30,
    buildable: true,
    playGain: 32,
  },
  obstacle: {
    type: 'obstacle',
    name: 'Eğitim engeli',
    w: 1,
    h: 1,
    cost: 180,
    category: 'oyun',
    solidRows: 0,
    desc: 'Eğitim alanına konursa eğitim daha hızlı ilerler (en fazla 3 engel sayılır).',
    buildMinutes: 0,
    buildable: true,
  },
  staffRoom: {
    type: 'staffRoom',
    name: 'Personel odası',
    w: 3,
    h: 2,
    cost: 900,
    category: 'personel',
    solidRows: 'all',
    desc: 'Personel burada mola verir, dayanıklılığını toplar.',
    buildMinutes: 150,
    buildable: true,
  },
  lamp: {
    type: 'lamp',
    name: 'Lamba',
    w: 1,
    h: 1,
    cost: 70,
    category: 'altyapi',
    solidRows: 'all',
    desc: 'Gece çevresini aydınlatır. Dekor +0,5.',
    buildMinutes: 0,
    buildable: true,
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
    buildMinutes: 0,
    buildable: true,
  },
  flower: {
    type: 'flower',
    name: 'Çiçek saksısı',
    w: 1,
    h: 1,
    cost: 30,
    category: 'dekor',
    solidRows: 0,
    desc: 'Dekor +1: sahiplenici sabrı ve denetimdeki "Çevre" kalemi artar.',
    buildMinutes: 0,
    buildable: true,
  },
  bench: {
    type: 'bench',
    name: 'Bank',
    w: 2,
    h: 1,
    cost: 160,
    category: 'dekor',
    solidRows: 'all',
    desc: 'Dekor +3: sahiplenici daha uzun bekler, denetimde "Çevre" artar.',
    buildMinutes: 0,
    buildable: true,
  },
  sign: {
    type: 'sign',
    name: 'Tabela',
    w: 1,
    h: 1,
    cost: 200,
    category: 'dekor',
    solidRows: 'all',
    desc: 'Dekor +5 (bir tabela sayılır): daha çok sahiplenici gelir, denetimde "Çevre" artar.',
    buildMinutes: 0,
    buildable: true,
  },
};

export type TileTool = 'fence' | 'gate' | 'path';

export interface TileToolDef {
  id: TileTool;
  name: string;
  cost: number;
  desc: string;
}

export const TILE_TOOL_DEFS: Record<TileTool, TileToolDef> = {
  fence: { id: 'fence', name: 'Çit', cost: 15, desc: 'Sürükleyerek düz çizgi çek. Köpekler geçemez.' },
  gate: { id: 'gate', name: 'Kapı', cost: 60, desc: 'Çit üzerinde geçiş; sen, personel, sahiplenici ve tasmalı köpek yaklaşınca kendiliğinden açılır. Serbest köpekler geçemez.' },
  path: { id: 'path', name: 'Yol', cost: 8, desc: 'Üstünde biraz daha hızlı yürünür.' },
};

export const BUILD_ORDER: BuildingCategory[] = ['altyapi', 'barinma', 'besleme', 'bakim', 'buyume', 'oyun', 'personel', 'dekor'];

/** Yıkımda geri ödenen oran. */
export const REFUND_RATE = 0.5;
export const PLOT_EXPANSION_COST = 2500;
export const PLOT_EXPANSION_STEP = 16;
