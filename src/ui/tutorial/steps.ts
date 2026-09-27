import { buildingFootprint } from '../../sim/entities/Building';
import type { Sim, StarterKind } from '../../sim/Sim';

/**
 * Açılış tanıtımı (0.22.5): belediyeden Nermin Hanım yeni oyunda gerçek düğmeleri göstererek yol gösterir. Adımlar saf veri:
 * metin (Türkçe; `t()` ile çevrilir, tablo metni olarak `en.ts`'te), spot ışığının çapası (arayüz seçicisi ya da dünyadaki
 * kare), tamamlanma koşulu. Sim'e dokunmaz; koşullar sim'i ve arayüz durumunu yalnız okur.
 */

/** Adım koşullarının okuduğu arayüz durumu (store'dan). */
export interface TutorialView {
  mode: 'avatar' | 'manage';
  buildBar: boolean;
  panel: string;
  /** Seçili inşa aracı bir binaysa türü. */
  buildType: string | null;
  touch: boolean;
}

/** Tanıtım başındaki oyuncu yeri ve sayaçlar: o andan sonra yapılan iş sayılır (öne geçen oyuncu adımı hemen geçer). */
export interface TutorialCtx {
  x: number;
  y: number;
  petted: number;
  bowlsFilled: number;
}

/** Adıma girince yapılabilen arayüz hazırlıkları. */
export interface TutorialUi {
  setBuildTab(tab: string): void;
}

export interface TutorialStep {
  id: string;
  /** Balon metni (masaüstü ya da ortak). */
  text: string;
  /** Dokunmatikte farklıysa. */
  touchText?: string;
  /** Spot ışığının arayüz çapası (CSS seçici); yoksa ya da görünmüyorsa halka çizilmez. */
  anchor?: (v: TutorialView) => string | null;
  /** Dünyadaki çapa (kare biriminde dikdörtgen): köpek, yem kabı. */
  world?: (sim: Sim) => { x: number; y: number; w: number; h: number } | null;
  /** Bilgi adımı: balondaki bu düğme adımı geçer (Başla, Anladım). */
  info?: string;
  /** Balonda ek düğme: paneli açar (son adımda hedefler; kart gizliyse de yol kalır). */
  cta?: { label: string; panel: 'goals' };
  /** Adım tamam mı; bilgi adımında yok. */
  done?: (sim: Sim, v: TutorialView, ctx: TutorialCtx) => boolean;
  /** Adıma girince (inşa sekmesini seç vb.). */
  enter?: (ui: TutorialUi) => void;
}

export function tutorialCtx(sim: Sim): TutorialCtx {
  return { x: sim.player.x, y: sim.player.y, petted: sim.stats.petted, bowlsFilled: sim.stats.bowlsFilled };
}

const firstDog = (sim: Sim) => sim.shelterDogs()[0];

const welcomeGuided: TutorialStep = {
  id: 'welcome',
  text: 'Merhaba, ben belediyeden Nermin! Bu arsa artık senin barınağın, ilk köpeğin de burada. Birkaç şeyi birlikte yapalım mı?',
  info: 'Başla',
};

const welcomeReady: TutorialStep = {
  id: 'welcome',
  text: 'Merhaba, ben belediyeden Nermin! Eski bakıcı emekli oldu, barınak artık sende. Kısa bir tur yapalım mı?',
  info: 'Başla',
};

const walk: TutorialStep = {
  id: 'walk',
  text: 'Önce köpeğinin yanına git: WASD ya da ok tuşlarıyla yürü.',
  touchText: 'Önce köpeğinin yanına git: haritada bir yere dokun, oraya yürürsün.',
  world: (sim) => {
    const d = firstDog(sim);
    return d ? { x: d.x - 0.8, y: d.y - 1.4, w: 1.6, h: 1.6 } : null;
  },
  done: (sim, _v, ctx) => {
    const p = sim.player;
    const d = firstDog(sim);
    if (!d) return true;
    return Math.hypot(d.x - p.x, d.y - p.y) <= 1.5 || Math.hypot(p.x - ctx.x, p.y - ctx.y) >= 3;
  },
};

const pet: TutorialStep = {
  id: 'pet',
  text: "Yanındayken E'ye bas: onu sev. Sevgi sadakat demek; sadık köpek daha kolay yuva bulur.",
  touchText: 'Köpeğe dokun ya da yanındayken E düğmesine bas: onu sev. Sevgi sadakat demek.',
  anchor: (v) => (v.mode !== 'avatar' ? null : v.touch ? '.touch-controls .action-btn' : '.hud-bottom.hint'),
  done: (sim, _v, ctx) => sim.stats.petted > ctx.petted,
};

const manage: TutorialStep = {
  id: 'manage',
  text: "Şimdi kuş bakışına geç: sağ üstteki Yönetim düğmesine tıkla ya da Tab'a bas.",
  touchText: 'Şimdi kuş bakışına geç: sağ üstteki 🛠 Yönet düğmesine dokun.',
  anchor: () => '[data-tut="mode"]',
  done: (_sim, v) => v.mode === 'manage',
};

const buildOpen: TutorialStep = {
  id: 'build-open',
  text: "Alttaki menüden 🏗️ İnşa'yı aç (klavyede B).",
  touchText: "Alttaki menüden 🏗️ İnşa'yı aç.",
  anchor: () => '[data-nav="build"]',
  done: (_sim, v) => v.buildBar,
};

const kennel: TutorialStep = {
  id: 'kennel',
  text: "Küçük kulübe'yi seç, sonra arsada boş bir yere tıkla: köpeğin gece orada uyur.",
  touchText: "Küçük kulübe'yi seç, sonra arsada boş bir yere dokun: köpeğin gece orada uyur.",
  // Kulübe seçilince halka kalkar: yerleştirirken harita açık görünsün.
  anchor: (v) => (v.buildType === 'kennelSmall' || !v.buildBar ? null : '.build-item[data-type="kennelSmall"]'),
  enter: (ui) => ui.setBuildTab('barinma'),
  done: (sim) => sim.buildings.some((b) => b.type === 'kennelSmall' || b.type === 'kennelLarge'),
};

const feed: TutorialStep = {
  id: 'feed',
  text: "Yem kabının önüne git ve E'ye bas: kilerden yem doldurursun. Aç köpek mutsuz olur.",
  touchText: 'Yem kabına dokun: yanına gider, kilerden yem doldurursun. Aç köpek mutsuz olur.',
  world: (sim) => {
    const b = sim.buildings.find((x) => x.type === 'bowl');
    if (!b) return null;
    const f = buildingFootprint(b);
    return { x: f.x - 0.25, y: f.y - 0.5, w: f.w + 0.5, h: f.h + 0.75 };
  },
  done: (sim, _v, ctx) => sim.stats.bowlsFilled > ctx.bowlsFilled || !sim.buildings.some((b) => b.type === 'bowl'),
};

const status: TutorialStep = {
  id: 'status',
  text: 'Üst şeritte kasa, köpek/kulübe sayısı ve yem stoğu yazar. Sol alttaki şerit hangi köpeğin neye ihtiyacı olduğunu sayar; dokununca liste açılır.',
  anchor: () => '.topbar .tb-left',
  info: 'Anladım',
};

const buildInfo: TutorialStep = {
  id: 'build-info',
  text: "Kulübe, kap, oyuncak, dekor: hepsi burada. İstersen bir şey kur, istersen Kapat'a bas.",
  anchor: (v) => (v.buildBar ? '[data-tut="build-close"]' : null),
  info: 'Anladım',
};

const goals: TutorialStep = {
  id: 'goals',
  text: 'Gerisini belediye hedefleri anlatır: 🎯 hedef kartını aç; sıradaki iş, ödülü ve Göster düğmesi orada. Kolay gelsin!',
  anchor: () => '[data-tut="guide"]',
  cta: { label: '🎯 Hedefleri aç', panel: 'goals' },
  done: (_sim, v) => v.panel === 'goals',
};

/** Kuruluş (0.19.0): arsada yalnız ofis ve ilk köpek; ilk belediye hedefi kulübe (6. adım). */
export const TUTORIAL_GUIDED: readonly TutorialStep[] = [welcomeGuided, walk, pet, manage, buildOpen, kennel, goals];

/** Hazır barınak: kulübeler, kap ve yalak kurulu. */
export const TUTORIAL_READY: readonly TutorialStep[] = [welcomeReady, feed, pet, status, manage, buildOpen, buildInfo, goals];

export function stepsFor(starter: StarterKind): readonly TutorialStep[] {
  return starter === 'guided' ? TUTORIAL_GUIDED : TUTORIAL_READY;
}

/** Balon metni: dokunmatikte ayrı metin varsa o. */
export function stepText(step: TutorialStep, touch: boolean): string {
  return touch && step.touchText ? step.touchText : step.text;
}
