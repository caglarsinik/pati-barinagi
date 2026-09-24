import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import { type GrowthStage, STAGE_NAMES_TR, clamp100 } from '../entities/Dog';
import { type DogGenome, isValidGenome } from '../entities/DogGenome';
import { ADOPTER_TYPES, type AdopterType, isAdopterType } from '../entities/AdopterType';
import type { Sim } from '../Sim';
import type { AdoptionRecord } from './AdoptionSystem';

/** Mektup fotoğrafının sahnesi (0.21.1): sahiplenicinin tipine göre, köylüde köy meydanı. */
export type PhotoScene = 'garden' | 'park' | 'beach' | 'sofa' | 'farm' | 'studio' | 'village';
export const PHOTO_SCENES: readonly PhotoScene[] = ['garden', 'park', 'beach', 'sofa', 'farm', 'studio', 'village'];

export const TYPE_SCENE: Record<AdopterType, PhotoScene> = {
  family: 'garden',
  retiree: 'park',
  athlete: 'beach',
  student: 'sofa',
  farmer: 'farm',
  artist: 'studio',
};

/** Harika eşleşmede (puan ≥ 70) tipe göre mektuplar; {dog} köpeğin adı. */
export const GREAT_LETTERS: Record<AdopterType, readonly string[]> = {
  family: [
    '{dog} çocuklarla bahçede koşmaktan hiç yorulmuyor. Akşamları hepimiz onun etrafında toplanıyoruz!',
    'Küçük kızımız artık {dog} yanında olmadan uyumuyor. İyi ki sizden sahiplendik.',
    '{dog} doğum günü partisinin yıldızıydı! Bütün çocuklar onu sevmek için sıraya girdi.',
  ],
  retiree: [
    '{dog} ile her sabah parka yürüyoruz; bankta yan yana oturup kuşlara bakıyoruz.',
    'Ev artık sessiz değil. {dog} akşamları ayağımın dibinde uyuyor, çayımı onunla içiyorum.',
    '{dog} komşuların da gözdesi oldu; herkes kapımı çalıp onu soruyor.',
  ],
  athlete: [
    '{dog} ile her sabah beş kilometre koşuyoruz. Benden hızlı, inanın!',
    'Sahilde top kovalıyoruz; {dog} dalgalardan hiç korkmuyor.',
    'Hafta sonu {dog} ile dağa çıktık, zirvede birlikte fotoğraf çektirdik!',
  ],
  student: [
    'Odam küçük ama {dog} ile sığışıyoruz. Ders çalışırken dizimde uyuyor.',
    'Sınav haftası {dog} sayesinde hiç strese girmedim. En iyi çalışma arkadaşım o.',
    '{dog} kampüsün maskotu oldu; herkes onunla fotoğraf çektiriyor.',
  ],
  farmer: [
    '{dog} çiftliğin bekçisi oldu; kuzuları bir bir sayıyor sanki.',
    'Sabah traktöre ilk o biniyor. {dog} olmadan tarlaya çıkmıyoruz artık.',
    'Hasat şenliğinde {dog} ödül kazandı: en sadık çiftlik köpeği!',
  ],
  artist: [
    '{dog} atölyemin ilham perisi oldu; son resmimde o var.',
    'Sergimin açılışına {dog} ile gittik; herkes tablolardan çok onu konuştu.',
    '{dog} fırçalarımı saklıyor ama ona kızamıyorum. Ne güzel bir karmaşa!',
  ],
};

/** İdare eden eşleşme (50–69): alışma mektupları. */
export const OK_LETTERS: readonly string[] = [
  '{dog} yeni evine alışıyor. İlk günler biraz ürkekti ama artık kuyruğunu sallıyor.',
  '{dog} her gün biraz daha açılıyor; dün ilk kez kucağıma geldi.',
  'Evin kurallarını öğreniyoruz, {dog} de biz de. Her şey yolunda gidiyor.',
];

/** Zayıf eşleşme ama köpek geri gelmedi (< 50). */
export const HARD_LETTERS: readonly string[] = [
  '{dog} ile biraz zorlanıyoruz ama pes etmiyoruz. Her gün biraz daha iyi.',
  'Beklediğimizden farklı bir köpek {dog}, ama onu seviyoruz ve birbirimize alışıyoruz.',
];

/** Köylü sahiplenicinin mektupları (puan ≥ 50). */
export const VILLAGE_LETTERS: readonly string[] = [
  '{dog} meydanda çocuklarla koşuyor; köyün neşesi oldu.',
  '{dog} her sabah benimle çeşmeye yürüyor, sonra toptancının önünde güneşleniyor.',
  'Köyde artık herkes {dog} diye sesleniyor. Bir gün barınağa uğrayıp teşekkür edeceğim.',
];

/** İkili sahiplendirme (0.21.4): iki can dostundan söz eden mektuplar; {dog2} öbür köpek. */
export const PAIR_LETTERS: readonly string[] = [
  '{dog} ve {dog2} bahçede birlikte koşuyor; ikisini ayırmadığınız için teşekkürler!',
  '{dog} ve {dog2} aynı sepette uyuyor. Birini sevsek öbürü hemen kıskanıyor!',
  'İki kat neşe, iki kat tüy! {dog} ve {dog2} evimizi şenlendirdi.',
  '{dog} ve {dog2} yeni evlerine birlikte alışıyor; birbirlerinden hiç ayrılmıyorlar.',
];

const ALL_LINES = new Set<string>([...Object.values(GREAT_LETTERS).flat(), ...OK_LETTERS, ...HARD_LETTERS, ...VILLAGE_LETTERS, ...PAIR_LETTERS]);
const STAGES = Object.keys(STAGE_NAMES_TR) as GrowthStage[];

/** Sahiplendirilen köpeğin ailesinden gelen mektup (0.21.1). Satır Türkçe anahtar olarak saklanır, gösterirken çevrilir. */
export interface Letter {
  id: number;
  /** Geldiği gün. */
  day: number;
  /** Sahiplendirme kaydının anahtarı. */
  key: number;
  dogName: string;
  /** İkili sahiplendirmede öbür köpek (0.21.4). */
  dog2?: string;
  from: string;
  type?: AdopterType;
  line: string;
  scene: PhotoScene;
  genome?: DogGenome;
  stage?: GrowthStage;
  genome2?: DogGenome;
  stage2?: GrowthStage;
  donation: number;
  rep: number;
  read: boolean;
}

export interface MailResult {
  ok: boolean;
  message?: string;
}

/**
 * Sahiplendirme mektupları (0.21.1). Geri gelmeyecek her sahiplendirmede kayda 3–7 gün sonrası mektup günü yazılır (ayrı RNG,
 * kayıt anahtarından; ana sıra değişmez). O gün ya da sonra saat 11:00'de aile yazar: tipe ve eşleşmeye göre satır, tipe göre
 * fotoğraf sahnesi; harika eşleşmede küçük bağış (tipin cömertliğiyle) ve itibar +1 (günde en çok 2). Posta en çok 40 mektup
 * tutar (önce okunmuş eskiler düşer). 0.21.0 öncesi kayıtlara mektup gelmez.
 */
export class MailSystem {
  list: Letter[] = [];
  nextId = 1;

  constructor(private readonly sim: Sim) {}

  /** Sahiplendirmede (köpek geri gelmeyecekse): mektup günü. */
  schedule(r: AdoptionRecord): void {
    if (r.key === undefined) return;
    const S = BALANCE.stories;
    const rng = new Rng(hash3(this.sim.seed, r.key, 0x1e77));
    r.letterDay = r.day + rng.int(S.letterMinDays, S.letterMaxDays);
  }

  /** Saat başı: mektup saatinde vakti gelen mektuplar gelir. */
  onHour(h: number): void {
    if (h === BALANCE.stories.letterHour) this.deliverDue();
  }

  /** Vakti gelmiş, henüz yazılmamış kayıtlara mektup; döndürür: gelen mektuplar. */
  deliverDue(): Letter[] {
    const sim = this.sim;
    const out: Letter[] = [];
    for (const r of sim.adoptions) {
      if (r.letterDay === undefined || r.lettered || r.returned || r.letterDay > sim.clock.day) continue;
      r.lettered = true;
      const letter = this.compose(r);
      this.push(letter);
      out.push(letter);
      if (letter.donation > 0) sim.addIncome('donation', letter.donation, t('Mektupla bağış: {name}', { name: letter.from }));
      if (letter.rep > 0) sim.reputation = clamp100(sim.reputation + letter.rep);
      const dogs = letter.dog2 ? t('{a} ve {b}', { a: letter.dogName, b: letter.dog2 }) : letter.dogName;
      let msg = t('📬 Mektup geldi: {from}, {dog} için yazmış', { from: letter.from, dog: dogs });
      if (letter.donation > 0) msg += ' · ' + t('+{n} ₺ bağış', { n: letter.donation });
      if (letter.rep > 0) msg += ' · ' + t('itibar +{n}', { n: letter.rep });
      sim.events.emit('letter', letter);
      sim.events.emit('message', msg);
    }
    return out;
  }

  private compose(r: AdoptionRecord): Letter {
    const S = BALANCE.stories;
    const day = this.sim.clock.day;
    const rng = new Rng(hash3(this.sim.seed, r.key ?? 0, 0x1e78));
    const type: AdopterType = r.type ?? 'family';
    const village = r.villager !== undefined;
    const band = r.score >= 70 ? 'great' : r.score >= 50 ? 'ok' : 'hard';
    const mate = r.pair !== undefined ? this.sim.adoptions.find((x) => x !== r && x.key === r.key && x.dogName === r.pair) : undefined;
    const lines = band === 'hard' ? HARD_LETTERS : r.pair !== undefined ? PAIR_LETTERS : village ? VILLAGE_LETTERS : band === 'great' ? GREAT_LETTERS[type] : OK_LETTERS;
    const line = rng.pick(lines);
    let donation = 0;
    let rep = 0;
    if (band === 'great') {
      const raw = (S.donationBase + rng.int(0, S.donationSpread)) * ADOPTER_TYPES[type].generosity;
      donation = Math.max(S.donationMin, Math.min(S.donationMax, Math.round(raw / 10) * 10));
      rep = this.list.filter((x) => x.day === day && x.rep > 0).length < S.repPerDay ? 1 : 0;
    }
    return {
      id: this.nextId++,
      day,
      key: r.key ?? 0,
      dogName: r.dogName,
      ...(r.pair !== undefined ? { dog2: r.pair } : {}),
      from: r.adopterName,
      ...(r.type ? { type: r.type } : {}),
      line,
      scene: village ? 'village' : TYPE_SCENE[type],
      ...(r.genome ? { genome: { ...r.genome }, stage: r.stage ?? 'adult' } : {}),
      ...(mate?.genome ? { genome2: { ...mate.genome }, stage2: mate.stage ?? 'adult' } : {}),
      donation,
      rep,
      read: false,
    };
  }

  /** Posta sınırı: önce okunmuş en eski, yoksa en eski düşer. */
  private push(letter: Letter): void {
    this.list.push(letter);
    while (this.list.length > BALANCE.stories.maxLetters) {
      const i = this.list.findIndex((x) => x.read);
      this.list.splice(i >= 0 ? i : 0, 1);
    }
  }

  unread(): number {
    return this.list.filter((x) => !x.read).length;
  }

  /** Mektubu okundu say (id yoksa hepsini). */
  markRead(id?: number): MailResult {
    for (const x of this.list) if (id === undefined || x.id === id) x.read = true;
    return { ok: id === undefined || this.list.some((x) => x.id === id) };
  }

  /** Mektubun metni (dile göre). */
  text(letter: Letter): string {
    return t(letter.line, { dog: letter.dogName, dog2: letter.dog2 ?? '' });
  }

  toJSON(): { next: number; list: Letter[] } {
    return {
      next: this.nextId,
      list: this.list.map((x) => ({ ...x, ...(x.genome ? { genome: { ...x.genome } } : {}), ...(x.genome2 ? { genome2: { ...x.genome2 } } : {}) })),
    };
  }

  /** Doğrulayarak yükler; eski kayıtta posta boş. */
  load(raw: unknown): void {
    this.list = [];
    this.nextId = 1;
    if (!raw || typeof raw !== 'object') return;
    const r = raw as { next?: unknown; list?: unknown };
    if (typeof r.next === 'number' && Number.isInteger(r.next) && r.next > 0) this.nextId = r.next;
    if (!Array.isArray(r.list)) return;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
    for (const item of r.list) {
      const x = item as Partial<Letter> | null;
      if (!x || typeof x !== 'object' || typeof x.id !== 'number' || !Number.isInteger(x.id)) continue;
      if (typeof x.line !== 'string' || !ALL_LINES.has(x.line) || typeof x.dogName !== 'string' || typeof x.from !== 'string') continue;
      const letter: Letter = {
        id: x.id,
        day: num(x.day),
        key: typeof x.key === 'number' && Number.isFinite(x.key) ? x.key : 0,
        dogName: x.dogName.slice(0, 16),
        ...(typeof x.dog2 === 'string' ? { dog2: x.dog2.slice(0, 16) } : {}),
        from: x.from.slice(0, 40),
        ...(isAdopterType(x.type) ? { type: x.type } : {}),
        line: x.line,
        scene: PHOTO_SCENES.includes(x.scene as PhotoScene) ? (x.scene as PhotoScene) : 'garden',
        ...(isValidGenome(x.genome) ? { genome: { ...x.genome }, stage: STAGES.includes(x.stage as GrowthStage) ? (x.stage as GrowthStage) : 'adult' } : {}),
        ...(isValidGenome(x.genome2) ? { genome2: { ...x.genome2 }, stage2: STAGES.includes(x.stage2 as GrowthStage) ? (x.stage2 as GrowthStage) : 'adult' } : {}),
        donation: num(x.donation),
        rep: num(x.rep),
        read: x.read === true,
      };
      this.list.push(letter);
      this.nextId = Math.max(this.nextId, letter.id + 1);
    }
    while (this.list.length > BALANCE.stories.maxLetters) this.list.shift();
  }
}
