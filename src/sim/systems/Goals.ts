import { BALANCE } from '../../config/balance';
import type { BuildingType } from '../../content/buildings';
import { t } from '../../i18n';
import { clamp100 } from '../entities/Dog';
import type { Sim } from '../Sim';
import { plotCoreRect } from '../world/PlotReserve';

/** "Göster" düğmesinin açabileceği paneller (arayüzdeki Panel türünün alt kümesi). */
export type GoalPanel = 'map' | 'staff' | 'adoption' | 'office';

/** Belediye hedefi: zincirde sırayla gelir, bir kez ödüllenir. */
export interface GoalDef {
  /** Kayda yazılır; değiştirilmemeli. */
  id: string;
  title: string;
  desc: string;
  /** Ödül (₺), `BALANCE.goals.rewardMul` ile çarpılır; 0 ise para verilmez. */
  reward: number;
  /** "Göster": inşa aracı (listede henüz kurulmamış ilk bina seçilir). */
  tools?: BuildingType[];
  /** "Göster": inşa çubuğunun Arsa sekmesi. */
  plot?: boolean;
  /** "Göster": açılacak panel. */
  panel?: GoalPanel;
  check: (sim: Sim) => boolean;
}

const has = (sim: Sim, ...types: BuildingType[]): boolean => sim.buildings.some((b) => types.includes(b.type));

/** Arsa başlangıçtakinden büyük mü (kuruluşta çekirdek, hazır barınakta üretimdeki arsa). */
function plotExpanded(sim: Sim): boolean {
  const base = sim.starter === 'guided' ? plotCoreRect() : BALANCE.world.plot;
  const p = sim.world.plot;
  return p.w > base.w || p.h > base.h;
}

/**
 * Hedef zinciri (0.19.0 kuruluş adımları, 0.19.1 tam zincir). Kart hep ilk tamamlanmamış hedefi gösterir ve ödül yalnız
 * sıradaki hedefe verilir; önceden yapılmış bir hedef sırası gelince hemen tamamlanır.
 */
export const GOALS: GoalDef[] = [
  {
    id: 'kennel',
    title: 'Köpeğine kulübe kur',
    desc: 'Yönetim modunda inşa çubuğundan küçük kulübe seç ve arsaya yerleştir.',
    reward: 200,
    tools: ['kennelSmall'],
    check: (s) => has(s, 'kennelSmall', 'kennelLarge'),
  },
  {
    id: 'bowlTrough',
    title: 'Yem kabı ve su yalağı koy',
    desc: 'Köpeğin yiyip içebilsin: inşa çubuğundan yem kabı ve su yalağı yerleştir.',
    reward: 100,
    tools: ['bowl', 'trough'],
    check: (s) => has(s, 'bowl') && has(s, 'trough'),
  },
  {
    id: 'incubator',
    title: 'Kuluçka makinesi kur',
    desc: 'Kapının dışındaki yuvadan yumurta getireceksin; kuluçka onu yavruya çevirir.',
    reward: 150,
    tools: ['incubator'],
    check: (s) => has(s, 'incubator'),
  },
  {
    id: 'eggFound',
    title: 'Yuvadan yumurta al',
    desc: 'Kapının dışındaki yuvaya git (haritada sarı nokta), E ile yumurtayı çantana al.',
    reward: 100,
    panel: 'map',
    check: (s) => s.stats.eggsFound >= 1,
  },
  {
    id: 'eggPlaced',
    title: 'Yumurtayı kuluçkaya koy',
    desc: 'Kuluçkanın önünde E ile çantadaki yumurtayı yerleştir; yavru üç günde çıkar.',
    reward: 100,
    check: (s) => s.stats.hatched >= 1 || s.buildings.some((b) => b.type === 'incubator' && b.eggs.length > 0),
  },
  {
    id: 'fillBowl',
    title: 'Yem kabını doldur',
    desc: 'Kabın önünde E ile kilerdeki yemden doldur; köpekler öğün saatlerinde yer.',
    reward: 100,
    check: (s) => s.stats.bowlsFilled >= 1,
  },
  {
    id: 'petClean',
    title: 'Köpeğini sev, pisliği temizle',
    desc: 'Sevme aracıyla (1) köpeğine, temizlik aracıyla (5) pisliğe E.',
    reward: 100,
    check: (s) => s.stats.petted >= 1 && s.stats.cleaned >= 1,
  },
  {
    id: 'shed',
    title: 'Kiler kur',
    desc: 'Kiler yem çuvallarını saklar; E ile kiler panelinden yem sipariş edebilirsin.',
    reward: 200,
    tools: ['shed'],
    check: (s) => has(s, 'shed'),
  },
  {
    id: 'sleep',
    title: 'Gece ofiste uyu',
    desc: "Saat 20'den sonra ofise gir, yatakta E ile uyu; sabah dinç uyanırsın.",
    reward: 100,
    check: (s) => s.stats.slept >= 1,
  },
  {
    id: 'stray',
    title: 'Bir sokak köpeğini barınağa getir',
    desc: 'Haritadaki inlerde sokak köpekleri yaşar. E ile ödül ver; güveni dolunca peşinden gelir, arsana getir.',
    reward: 300,
    panel: 'map',
    check: (s) => s.stats.strays >= 1,
  },
  {
    id: 'hire',
    title: 'Personel al',
    desc: 'Personel panelinden (P) bir aday işe al; bakım işlerini paylaşır.',
    reward: 300,
    panel: 'staff',
    check: (s) => s.stats.hired >= 1,
  },
  {
    id: 'hatch',
    title: 'İlk yavruyu çatlat',
    desc: 'Kuluçkadaki yumurta üç günde çatlar; ısı lambası hızlandırır.',
    reward: 200,
    check: (s) => s.stats.hatched >= 1,
  },
  {
    id: 'adopt1',
    title: 'İlk sahiplendirme',
    desc: 'Sahiplenici ofisin önünde bekler; isteğine uyan köpeği Sahiplendirme panelinden (O) eşleştir.',
    reward: 400,
    panel: 'adoption',
    check: (s) => s.stats.adopted >= 1,
  },
  {
    id: 'expand',
    title: 'Arsayı genişlet',
    desc: 'Yönetim modunda inşa çubuğunun Arsa sekmesinden doğuya ya da güneye 16 kare genişlet.',
    reward: 500,
    plot: true,
    check: plotExpanded,
  },
  {
    id: 'kitchen',
    title: 'Mutfak kur',
    desc: 'Mutfak kapların kapasitesini artırır, yalakları kendiliğinden doldurur; fırında ödül maması pişer.',
    reward: 300,
    tools: ['kitchen'],
    check: (s) => has(s, 'kitchen'),
  },
  {
    id: 'village',
    title: 'Köyü bul',
    desc: 'Güney yolunu harita kenarına kadar izle; köydeki toptancıda çuvallar ucuzdur.',
    reward: 400,
    panel: 'map',
    check: (s) => s.villageFound,
  },
  {
    id: 'dogs5',
    title: 'Aynı anda 5 köpeğe bak',
    desc: 'Yumurta çatlat, sokak köpeği getir; kulübe sayısını da artır.',
    reward: 300,
    panel: 'map',
    check: (s) => s.shelterDogs().length >= 5,
  },
  {
    id: 'vet',
    title: 'Veteriner odası kur',
    desc: 'Hasta köpekleri tedavi eder ve aşı yapar.',
    reward: 500,
    tools: ['vetClinic'],
    check: (s) => has(s, 'vetClinic'),
  },
  {
    id: 'adopt10',
    title: '10 köpek sahiplendir',
    desc: 'İyi eşleşmeler itibarını artırır.',
    reward: 800,
    panel: 'adoption',
    check: (s) => s.stats.adopted >= 10,
  },
  {
    id: 'license2',
    title: 'Lisansı 2. seviyeye çıkar',
    desc: 'Ofis panelinden lisansı yükselt; barınağın daha çok köpek alabilir.',
    reward: 800,
    panel: 'office',
    check: (s) => s.licenseLevel >= 2,
  },
  {
    id: 'nurseryPup',
    title: 'Yuva evinden ilk yavru',
    desc: 'Yuva evi kur, dost iki köpeği eşleştir; verdiği yumurtayı kuluçkada çatlat.',
    reward: 1000,
    tools: ['nursery'],
    check: (s) => s.stats.bredHatched >= 1,
  },
  {
    id: 'victory',
    title: 'Yılın Barınağı',
    desc: '50 sahiplendirme ve 90 itibara ulaş.',
    reward: 0,
    check: (s) => s.victory !== null,
  },
];

/** Kayıttaki zincir sürümü: daha eski kayıt yüklenince sağlanan hedefler sessizce tamam sayılır. */
export const GOAL_CHAIN_VERSION = 2;
/** 0.19.0 kayıtlarındaki `index` yalnız ilk üç kuruluş hedefini sayardı. */
const LEGACY_FOUNDING = 3;
const GOAL_IDS = new Set(GOALS.map((g) => g.id));

export function goalReward(g: GoalDef): number {
  return Math.round(g.reward * BALANCE.goals.rewardMul);
}

/** "Göster" için inşa aracı: listede henüz kurulmamış ilk bina (hepsi varsa ilki); bina hedefi değilse null. */
export function goalShowTool(sim: Sim, g: GoalDef): BuildingType | null {
  if (!g.tools || g.tools.length === 0) return null;
  return g.tools.find((type) => !has(sim, type)) ?? g.tools[0];
}

function satisfied(sim: Sim, g: GoalDef): boolean {
  try {
    return g.check(sim);
  } catch {
    return false;
  }
}

export class GoalSystem {
  /** Tamamlanan hedeflerin kimlikleri. */
  readonly done = new Set<string>();

  constructor(private readonly sim: Sim) {}

  /** Sıradaki (ilk tamamlanmamış) hedef; zincir bittiyse null. */
  get current(): GoalDef | null {
    return GOALS.find((g) => !this.done.has(g.id)) ?? null;
  }

  /** Sıradaki `n` hedef (ilki `current`). */
  upcoming(n: number): GoalDef[] {
    return GOALS.filter((g) => !this.done.has(g.id)).slice(0, n);
  }

  /** Her sim dakikasında: sıradaki hedef sağlandıysa ödül verilir ve zincir ilerler (dakikada en çok bir hedef). */
  check(): void {
    const g = this.current;
    if (!g || !satisfied(this.sim, g)) return;
    this.done.add(g.id);
    const money = goalReward(g);
    if (money > 0) this.sim.addIncome('aid', money, t('Belediye ödülü: {goal}', { goal: t(g.title) }));
    this.sim.reputation = clamp100(this.sim.reputation + BALANCE.goals.reputation);
    this.sim.events.emit('goal', g);
    const next = this.current;
    const goal = t(g.title);
    let text: string;
    if (money > 0) {
      text = next ? t('🎯 Hedef tamam: {goal} (+{money} ₺) · Sıradaki: {next}', { goal, money, next: t(next.title) }) : t('🎯 Hedef tamam: {goal} (+{money} ₺)', { goal, money });
    } else {
      text = next ? t('🎯 Hedef tamam: {goal} · Sıradaki: {next}', { goal, next: t(next.title) }) : t('🎯 Hedef tamam: {goal}', { goal });
    }
    this.sim.events.emit('message', text);
  }

  /** Sağlanan bütün hedefleri ödülsüz ve sessiz tamam sayar (hazır başlangıç, eski kayıt). Döndürür: yeni tamamlanan sayısı. */
  catchUp(): number {
    let n = 0;
    for (const g of GOALS) {
      if (this.done.has(g.id) || !satisfied(this.sim, g)) continue;
      this.done.add(g.id);
      n++;
    }
    return n;
  }

  toJSON(): { v: number; done: string[] } {
    return { v: GOAL_CHAIN_VERSION, done: GOALS.filter((g) => this.done.has(g.id)).map((g) => g.id) };
  }

  /** Kayıttan yükler. Döndürür: kayıt güncel zincirle mi yazılmış (değilse yüklemenin sonunda `catchUp` çağrılır). */
  load(raw: unknown): boolean {
    this.done.clear();
    if (!raw || typeof raw !== 'object') return false;
    const r = raw as { v?: unknown; done?: unknown; index?: unknown };
    if (Array.isArray(r.done)) {
      for (const id of r.done) {
        if (typeof id === 'string' && GOAL_IDS.has(id)) this.done.add(id);
      }
    } else if (typeof r.index === 'number' && Number.isInteger(r.index) && r.index > 0) {
      for (const g of GOALS.slice(0, Math.min(r.index, LEGACY_FOUNDING))) this.done.add(g.id);
    }
    return r.v === GOAL_CHAIN_VERSION;
  }
}
