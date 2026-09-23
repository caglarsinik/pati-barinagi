import { BALANCE } from '../../config/balance';
import { DOG_NAMES } from '../../content/names';
import { MINUTES_PER_DAY } from '../../core/Clock';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import { adoptable } from '../entities/Adopter';
import { type Dog, type GrowthStage, STAGE_NAMES_TR, clamp100 } from '../entities/Dog';
import { COAT_COLORS, type DogGenome, TEMPERAMENT_NAMES_TR, type Temperament, isValidGenome, randomGenome } from '../entities/DogGenome';
import type { Facing } from '../entities/Player';
import type { Sim } from '../Sim';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { questBoardTile } from '../world/Village';
import { Obj } from '../world/tiles';
import type { AdoptionRecord } from './AdoptionSystem';
import { facingFor } from './VillagerSystem';
import { VILLAGER_ADOPTER_TYPE } from '../entities/AdopterType';

/** Köylü görevleri (0.20.4): kayıp köpek, köpek isteği, ödül maması. */
export type QuestKind = 'lost' | 'pup' | 'treats';
export const QUEST_KINDS: readonly QuestKind[] = ['lost', 'pup', 'treats'];
/** Panodaki ilan ya da kabul edilmiş görev. */
export type QuestState = 'offer' | 'active';

/** Köyden bakınca 8 yön (0 = doğu, saat yönünde; haritada aşağısı güney). */
export const DIRECTION_NAMES_TR: readonly string[] = ['doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı', 'kuzey', 'kuzeydoğu'];

const TEMPERAMENTS = Object.keys(TEMPERAMENT_NAMES_TR) as Temperament[];
const STAGES = Object.keys(STAGE_NAMES_TR) as GrowthStage[];
/** Sıradan yumurtadan da çıkan renkler: istenen renk bulunabilsin. */
const COMMON_COATS = COAT_COLORS.map((c, i) => (c.minRarity === 'common' ? i : -1)).filter((i) => i >= 0);

/** Kayıp köpek: görünümü, kaybolduğu kare, haritadaki arama alanı ve bulununca oyuncuyu izleyen konumu. */
export interface LostDog {
  name: string;
  genome: DogGenome;
  stage: GrowthStage;
  /** Köylünün barınaktan sahiplendiği köpek mi (kayıpken köyde sahibinin yanında görünmez). */
  own: boolean;
  spotX: number;
  spotY: number;
  /** Haritadaki arama alanının merkezi (gerçek yerden biraz kaymış). */
  areaX: number;
  areaY: number;
  /** Ayak noktası (kare birimi). */
  x: number;
  y: number;
  found: boolean;
}

export interface Quest {
  id: number;
  kind: QuestKind;
  /** İlanı asan köylü (köylü indeksi). */
  villager: number;
  state: QuestState;
  /** Asıldığı hafta. */
  week: number;
  /** Kabul edildiyse süresinin bittiği an (toplam oyun dakikası); ilanda 0. */
  until: number;
  reward: number;
  rep: number;
  /** Köpek isteği: istenen tüy rengi (COAT_COLORS dizini) ya da huy. */
  coat?: number;
  temperament?: Temperament;
  /** Ödül maması isteği: adet. */
  treats?: number;
  dog?: LostDog;
}

export interface QuestResult {
  ok: boolean;
  message?: string;
}

const fail = (message: string): QuestResult => ({ ok: false, message });

/** Kalan süre metni: bir günden fazlaysa gün, azsa saat. */
export function questTimeText(minutes: number): string {
  const h = Math.ceil(minutes / 60);
  return h >= 24 ? t('{n} gün kaldı', { n: Math.round(h / 24) }) : t('{n} saat kaldı', { n: Math.max(1, h) });
}

/**
 * Köylü görevleri (0.20.4). Köy bulununca her hafta köy panosuna en çok üç ilan asılır (her türden bir; ayrı RNG, ana sıra
 * değişmez): kayıp köpek (haritadaki alanda bul, E ile peşine tak, köye getir), köpek isteği (istenen renkte ya da huyda
 * bir köpeği tasmayla getir; köylü sahiplenir, köyde görünür) ve ödül maması. İlan panoda kabul edilir; süresi dolmadan
 * ilanı asan köylüyle konuşarak ya da panoda teslim edilir. Ödül para ve itibar; süre dolarsa ceza yok. Pazartesi
 * alınmamış ilanlar iner, kabul edilenler süreleri bitene dek kalır.
 */
export class QuestSystem {
  list: Quest[] = [];
  /** Panonun son yenilendiği hafta (0 = hiç). */
  week = 0;
  nextId = 1;
  /** Bulunan köpeğin izlediği oyuncu izi (kaydedilmez). */
  private trail: Array<{ x: number; y: number }> = [];
  /** Çizim için: bulunan köpek yürüyor mu ve yönü. */
  dogMoving = false;
  dogFacing: Facing = 0;

  constructor(private readonly sim: Sim) {}

  /** Oyun dakikasında bir: hafta dönünce pano yenilenir, süresi dolan görevler düşer. */
  update(): void {
    const sim = this.sim;
    if (!sim.villageFound || !sim.world.village) return;
    if (this.week !== sim.clock.week) this.roll();
    const now = sim.clock.totalMinutes;
    for (const q of [...this.list]) {
      if (q.state !== 'active' || now < q.until) continue;
      this.remove(q);
      sim.events.emit(
        'message',
        q.dog ? t('⌛ Görev süresi doldu: {dog} kendi yolunu bulup eve döndü.', { dog: q.dog.name }) : t('⌛ Görev süresi doldu: {title}', { title: this.title(q) }),
      );
    }
  }

  /** Haftanın ilanları: kabul edilmeyenler iner, boşluklar her türden en çok birer ilanla dolar. */
  private roll(): void {
    const sim = this.sim;
    this.week = sim.clock.week;
    this.list = this.list.filter((q) => q.state === 'active');
    if (!sim.villagers.ensure()) return;
    const rng = new Rng(hash3(sim.seed, this.week, 0x9e57));
    for (const kind of rng.shuffle([...QUEST_KINDS])) {
      if (this.list.length >= BALANCE.quests.maxBoard) break;
      if (this.list.some((q) => q.kind === kind)) continue;
      const q = this.make(kind, rng);
      if (q) this.list.push(q);
    }
  }

  private make(kind: QuestKind, rng: Rng): Quest | null {
    const sim = this.sim;
    const Q = BALANCE.quests;
    const used = new Set(this.list.map((q) => q.villager));
    const free = sim.villagers.list.filter((v) => !used.has(v.index));
    if (free.length === 0) return null;
    const base = { id: this.nextId, kind, state: 'offer' as const, week: this.week, until: 0 };
    let q: Quest;
    if (kind === 'treats') {
      const n = rng.int(Q.treats.min, Q.treats.max);
      q = { ...base, villager: rng.pick(free).index, treats: n, reward: Q.treats.base + Q.treats.per * n, rep: Q.treats.rep };
    } else if (kind === 'pup') {
      const cands = free.filter((v) => !sim.villagers.dogOf(v));
      if (cands.length === 0) return null;
      const v = rng.pick(cands);
      // Çoğu zaman barınaktaki bir köpeğin rengi ya da huyu istenir: görev yapılabilir olsun.
      const dogs = sim.shelterDogs();
      const ref = dogs.length > 0 && rng.chance(Q.pup.fromShelter) ? rng.pick(dogs) : null;
      q = { ...base, villager: v.index, reward: Q.pup.reward, rep: Q.pup.rep };
      if (rng.chance(0.5)) q.coat = ref ? ref.genome.coat : rng.pick(COMMON_COATS);
      else q.temperament = ref ? ref.genome.temperament : rng.pick(TEMPERAMENTS);
    } else {
      // Barınaktan köpek sahiplenmiş köylünün köpeği kaybolur; öyle köylü yoksa köylünün kendi köpeği.
      const owners = free.filter((v) => sim.villagers.dogOf(v));
      const v = rng.pick(owners.length > 0 ? owners : free);
      const spot = this.pickSpot(rng);
      if (!spot) return null;
      const vd = sim.villagers.dogOf(v);
      const L = Q.lost;
      const w = sim.world;
      const jitter = (c: number, max: number): number => Math.max(0, Math.min(max - 1, c + rng.int(-L.areaJitter, L.areaJitter)));
      const dog: LostDog = {
        name: vd ? vd.name : rng.pick(DOG_NAMES),
        genome: vd ? { ...vd.genome } : randomGenome(rng),
        stage: vd ? vd.stage : 'adult',
        own: vd !== null,
        spotX: spot.x,
        spotY: spot.y,
        areaX: jitter(spot.x, w.width),
        areaY: jitter(spot.y, w.height),
        x: spot.x + 0.5,
        y: spot.y + 0.6,
        found: false,
      };
      q = { ...base, villager: v.index, reward: L.reward, rep: L.rep, dog };
    }
    this.nextId++;
    return q;
  }

  /** Kayıp köpeğin yeri: köyden uzakta, arsanın en büyük hâlinin dışında bir yuva ya da in yanı; köyden yürüyerek varılır. */
  private pickSpot(rng: Rng): TilePos | null {
    const w = this.sim.world;
    const v = w.village;
    if (!v) return null;
    const L = BALANCE.quests.lost;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const p = w.plot;
    const x0 = p.x - 2;
    const y0 = p.y - 2;
    const x1 = p.x + BALANCE.world.plotMaxW + 2;
    const y1 = p.y + BALANCE.world.plotMaxH + 2;
    const anchors = [...w.dens, ...w.nests].filter((a) => {
      const d = Math.hypot(a.x - cx, a.y - cy);
      return d >= L.minDist && d <= L.maxDist && !(a.x >= x0 && a.x < x1 && a.y >= y0 && a.y < y1);
    });
    // Köyün yol bandından yürüyerek varılabilmeli.
    const start = { x: v.x + 12, y: v.y + 2 };
    const near: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
    ];
    for (let k = 0; k < L.tries && anchors.length > 0; k++) {
      const a = anchors.splice(rng.int(0, anchors.length - 1), 1)[0];
      const tile = near.map(([dx, dy]) => ({ x: a.x + dx, y: a.y + dy })).find((c) => w.inBounds(c.x, c.y) && !w.isSolid(c.x, c.y) && w.objectAt(c.x, c.y) === Obj.None);
      if (tile && findPath(w, start, tile, { maxNodes: L.pathNodes, throughGates: true })) return tile;
    }
    return null;
  }

  /** Oyuncu köy panosunun yanında mı. */
  nearBoard(): boolean {
    const b = questBoardTile(this.sim.world);
    if (!b || this.sim.interior) return false;
    const p = this.sim.player;
    return Math.hypot(p.x - (b.x + 0.5), p.y - (b.y + 0.5)) <= BALANCE.quests.boardReach;
  }

  accept(id: number): QuestResult {
    const q = this.list.find((x) => x.id === id);
    if (!q || q.state !== 'offer') return fail(t('Bu ilan artık panoda değil'));
    if (!this.nearBoard()) return fail(t('İlanı almak için köydeki görev panosuna git'));
    q.state = 'active';
    q.until = this.sim.clock.totalMinutes + BALANCE.quests.days[q.kind] * MINUTES_PER_DAY;
    return { ok: true, message: t('📋 Görev alındı: {title}', { title: this.title(q) }) };
  }

  /** Teslim: panoda ya da ilanı asan köylüyle konuşarak (byTalk). */
  deliver(id: number, byTalk = false): QuestResult {
    const sim = this.sim;
    const q = this.list.find((x) => x.id === id);
    if (!q || q.state !== 'active') return fail(t('Bu görev artık yok'));
    if (!byTalk && !this.nearBoard()) return fail(t('Teslim için köydeki panoya ya da ilanı asan köylüye git'));
    const why = this.issue(q);
    if (why) return fail(why);
    const name = this.ownerName(q);
    let extra = '';
    if (q.kind === 'treats') sim.treats -= q.treats ?? 0;
    else if (q.kind === 'pup') {
      // Köylü köpeği sahiplenir: kayıt köylüyle ve görünümüyle (0.20.2), köpek köyde sahibinin yanında görünür.
      const dog = this.walkedDog()!;
      const record: AdoptionRecord = {
        day: sim.clock.day,
        dogName: dog.name,
        adopterName: name,
        fee: q.reward,
        score: 100,
        villager: q.villager,
        genome: { ...dog.genome },
        stage: dog.stage,
        key: -q.id,
      };
      const owner = sim.villagers.list[q.villager];
      if (owner) {
        record.type = VILLAGER_ADOPTER_TYPE[owner.role];
        record.look = owner.look;
      }
      dog.walking = false;
      sim.removeDog(dog.id);
      sim.adoptions.push(record);
      sim.stats.adopted++;
      extra = ' · ' + t('onu köyde görebilirsin');
    }
    sim.addIncome(q.kind === 'pup' ? 'adoption' : 'quest', q.reward, this.title(q));
    sim.reputation = clamp100(sim.reputation + q.rep);
    sim.stats.quests++;
    this.remove(q);
    return { ok: true, message: t('✅ {name}: “Çok teşekkürler!” +{money} ₺ · itibar +{rep}', { name, money: q.reward, rep: q.rep }) + extra };
  }

  abandon(id: number): QuestResult {
    const q = this.list.find((x) => x.id === id && x.state === 'active');
    if (!q) return { ok: false };
    this.remove(q);
    return {
      ok: true,
      message: q.dog ? t('Görevden vazgeçtin; {dog} kendi yolunu bulur.', { dog: q.dog.name }) : t('Görevden vazgeçtin: {title}', { title: this.title(q) }),
    };
  }

  private remove(q: Quest): void {
    this.list = this.list.filter((x) => x !== q);
    if (q.dog) {
      this.trail = [];
      this.dogMoving = false;
    }
  }

  /** Teslime engel (yoksa null). */
  issue(q: Quest): string | null {
    const sim = this.sim;
    if (q.kind === 'treats') {
      const n = q.treats ?? 0;
      return sim.treats >= n ? null : t('Çantada {have}/{n} ödül maması', { have: sim.treats, n });
    }
    if (q.kind === 'lost') {
      const d = q.dog;
      if (!d) return t('Bu görev artık yok');
      if (!d.found) return t('{dog} henüz bulunmadı', { dog: d.name });
      const p = sim.player;
      return Math.hypot(d.x - p.x, d.y - p.y) <= BALANCE.quests.deliverReach ? null : t('{dog} yanında değil', { dog: d.name });
    }
    const what = this.wish(q);
    const dog = this.walkedDog();
    if (!dog) return t('Tasmada köpek yok: {what} bir köpeği gezdirerek getir', { what });
    if (!this.matches(q, dog)) return t('{name} istenen köpek değil ({what})', { name: dog.name, what });
    const why = adoptable(dog, true);
    return why ? t('{name} sahiplendirilemez: {why}', { name: dog.name, why }) : null;
  }

  /** Tasmada, oyuncunun yanındaki köpek. */
  private walkedDog(): Dog | null {
    const p = this.sim.player;
    return this.sim.dogs.find((d) => d.walking && !d.wild && Math.hypot(d.x - p.x, d.y - p.y) <= BALANCE.quests.deliverReach) ?? null;
  }

  private matches(q: Quest, d: Dog): boolean {
    return q.coat !== undefined ? d.genome.coat === q.coat : d.genome.temperament === q.temperament;
  }

  /** Köpek isteğinin tarifi: "bal renkli" ya da "sakin huylu". */
  wish(q: Quest): string {
    if (q.coat !== undefined) return t('{color} renkli', { color: t(COAT_COLORS[q.coat]?.name ?? '').toLowerCase() });
    return t('{temp} huylu', { temp: t(TEMPERAMENT_NAMES_TR[q.temperament ?? 'calm']).toLowerCase() });
  }

  title(q: Quest): string {
    if (q.kind === 'lost') return t('Kayıp köpek: {dog}', { dog: q.dog?.name ?? '' });
    if (q.kind === 'pup') return t('Köpek isteği: {what}', { what: this.wish(q) });
    return t('Ödül maması: {n} tane', { n: q.treats ?? 0 });
  }

  desc(q: Quest): string {
    const name = this.ownerName(q);
    if (q.kind === 'lost') {
      return t('{name}: “{dog} kayboldu!” En son köyün {dir} tarafında görüldü; haritada turuncu çerçeve. Bul, E ile peşine tak ve köye getir.', {
        name,
        dog: q.dog?.name ?? '',
        dir: this.direction(q),
      });
    }
    if (q.kind === 'pup') return t('{name}, {what} bir köpek sahiplenmek istiyor. Tasmayı bilen uygun bir köpeği gezdirerek köye getir.', { name, what: this.wish(q) });
    return t('{name}, köpeği için {n} ödül maması istiyor. Böğürtlen topla ya da mutfak fırınında pişir.', { name, n: q.treats ?? 0 });
  }

  /** Kayıp köpeğin köye göre yönü. */
  private direction(q: Quest): string {
    const v = this.sim.world.village;
    const d = q.dog;
    if (!v || !d) return '';
    const a = Math.atan2(d.spotY - (v.y + v.h / 2), d.spotX - (v.x + v.w / 2));
    return t(DIRECTION_NAMES_TR[(((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8)]);
  }

  ownerName(q: Quest): string {
    this.sim.villagers.ensure();
    return this.sim.villagers.list[q.villager]?.name ?? t('Bir köylü');
  }

  /** Kabul edilmiş görevin kalan süresi (oyun dakikası). */
  timeLeft(q: Quest): number {
    return q.state === 'active' ? Math.max(0, q.until - this.sim.clock.totalMinutes) : 0;
  }

  /** Kabul edilmiş kayıp köpek görevinin köpeği (dünyada görünür). */
  lostDog(): LostDog | null {
    return this.list.find((q) => q.kind === 'lost' && q.state === 'active')?.dog ?? null;
  }

  /** (x, y) noktasındaki, henüz bulunmamış kayıp köpek (gövde merkezine uzaklık). */
  lostDogAt(x: number, y: number, reach = 0.8): LostDog | null {
    const d = this.lostDog();
    return d && !d.found && Math.hypot(d.x - x, d.y - 0.3 - y) <= reach ? d : null;
  }

  /** Haritadaki arama alanı: bulunmamış kayıp köpek için. */
  searchArea(): { x: number; y: number; r: number; name: string } | null {
    const d = this.lostDog();
    return d && !d.found ? { x: d.areaX, y: d.areaY, r: BALANCE.quests.lost.areaRadius, name: d.name } : null;
  }

  /** E ile kayıp köpeği bul: peşine takılır. */
  findDog(): QuestResult {
    const q = this.list.find((x) => x.kind === 'lost' && x.state === 'active');
    const d = q?.dog;
    if (!q || !d || d.found) return { ok: false };
    d.found = true;
    this.trail = [];
    return { ok: true, message: t('🐾 {dog} seni görünce kuyruğunu salladı ve peşine takıldı. Onu köye götür; sahibi {owner} bekliyor.', { dog: d.name, owner: this.ownerName(q) }) };
  }

  /**
   * Bulunan köpek oyuncunun izinden gelir (gerçek zamanlı; iz oyuncunun yürüdüğü yerlerden geçtiği için duvara girmez).
   * Oyuncu uzağa atlarsa (seyahat, bayılma) yanına ışınlanır; oyuncu içerideyken bekler.
   */
  follow(dtSec: number): void {
    const d = this.lostDog();
    this.dogMoving = false;
    if (!d || !d.found || this.sim.interior) return;
    const p = this.sim.player;
    const L = BALANCE.quests.lost;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 0.5) this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 80) this.trail.splice(0, this.trail.length - 80);
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist > L.snapTiles) {
      this.snapToPlayer(d);
      return;
    }
    const start = Math.min(L.maxSpeed, Math.max(0, (dist - 1.1) * 6)) * dtSec;
    let budget = start;
    while (budget > 0 && this.trail.length > 0) {
      const n = this.trail[0];
      if (Math.hypot(p.x - n.x, p.y - n.y) < 1.1) break;
      const dx = n.x - d.x;
      const dy = n.y - d.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 0.001) this.dogFacing = facingFor(dx, dy);
      if (dd <= budget) {
        d.x = n.x;
        d.y = n.y;
        budget -= dd;
        this.trail.shift();
      } else {
        d.x += (dx / dd) * budget;
        d.y += (dy / dd) * budget;
        budget = 0;
      }
    }
    this.dogMoving = start - budget > 0.0005;
  }

  private snapToPlayer(d: LostDog): void {
    const p = this.sim.player;
    const w = this.sim.world;
    const ty = Math.floor(p.y - 0.2);
    const side = [0.9, -0.9].find((dx) => w.inBounds(Math.floor(p.x + dx), ty) && !w.isSolid(Math.floor(p.x + dx), ty)) ?? 0;
    d.x = p.x + side;
    d.y = p.y;
    this.trail = [];
  }

  /** Köylünün barınaktan sahiplendiği köpek kayıp mı (köyde sahibinin yanında çizilmez). */
  dogAway(villager: number): boolean {
    return this.list.some((q) => q.villager === villager && q.dog?.own === true);
  }

  /** Köylünün kabul edilmiş görevi. */
  activeFor(villager: number): Quest | null {
    return this.list.find((q) => q.state === 'active' && q.villager === villager) ?? null;
  }

  /** İlanı asan köylüyle konuşma: teslime hazırsa teslim, değilse hatırlatma; ilanı olmayan köylüde null. */
  talk(index: number): QuestResult | null {
    const v = this.sim.villagers.list[index];
    const q = this.list.find((x) => x.villager === index);
    if (!v || v.inside || !q) return null;
    const p = this.sim.player;
    v.facing = facingFor(p.x - v.x, p.y - v.y);
    if (q.state === 'active' && !this.issue(q)) return this.deliver(q.id, true);
    return { ok: true, message: t('{name}: “{line}”', { name: v.name, line: q.state === 'offer' ? t('Köy panosuna bir ilan astım; bir göz atar mısın?') : this.reminder(q) }) };
  }

  private reminder(q: Quest): string {
    if (q.kind === 'lost') {
      const dog = q.dog?.name ?? '';
      return q.dog?.found ? t('{dog} yanında mı? Getir lütfen, çok özledim!', { dog }) : t('{dog} hâlâ kayıp… En son köyün {dir} tarafında görülmüştü.', { dog, dir: this.direction(q) });
    }
    if (q.kind === 'pup') return t('Bana {what} bir köpek lazım; tasmayla getirirsen hemen sahiplenirim.', { what: this.wish(q) });
    return t('Köpeğim için {n} ödül maması getirebilir misin?', { n: q.treats ?? 0 });
  }

  /** Köylüye bakınca ipucu: görevi teslime hazırsa. */
  talkHint(index: number): string | null {
    const q = this.activeFor(index);
    return q && !this.issue(q) ? t('E: {name} · görevi teslim et', { name: this.ownerName(q) }) : null;
  }

  boardHint(): string {
    const n = this.list.length;
    return n > 0 ? t('E: görev panosu ({n} ilan)', { n }) : t('E: görev panosu · ilanlar Pazartesi asılır');
  }

  toJSON(): { v: number; week: number; next: number; list: Quest[] } {
    return {
      v: 1,
      week: this.week,
      next: this.nextId,
      list: this.list.map((q) => ({ ...q, dog: q.dog ? { ...q.dog, genome: { ...q.dog.genome } } : undefined })),
    };
  }

  /** Doğrulayarak yükler; eski kayıtta görev yok (köy bulunduysa ilk dakikada pano asılır). */
  load(raw: unknown): void {
    this.list = [];
    this.week = 0;
    this.nextId = 1;
    this.trail = [];
    if (!raw || typeof raw !== 'object') return;
    const r = raw as { week?: unknown; next?: unknown; list?: unknown };
    this.week = typeof r.week === 'number' && Number.isInteger(r.week) ? r.week : 0;
    this.nextId = typeof r.next === 'number' && Number.isInteger(r.next) && r.next > 0 ? r.next : 1;
    if (!Array.isArray(r.list)) return;
    for (const x of r.list) {
      const q = this.parse(x);
      if (!q || this.list.length >= BALANCE.quests.maxBoard || this.list.some((o) => o.id === q.id || o.kind === q.kind)) continue;
      this.list.push(q);
      this.nextId = Math.max(this.nextId, q.id + 1);
    }
  }

  private parse(raw: unknown): Quest | null {
    if (!raw || typeof raw !== 'object') return null;
    const q = raw as Partial<Quest>;
    const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
    if (!int(q.id) || !QUEST_KINDS.includes(q.kind as QuestKind) || !int(q.villager) || q.villager < 0 || q.villager > 15) return null;
    if (q.state !== 'offer' && q.state !== 'active') return null;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);
    const out: Quest = { id: q.id, kind: q.kind as QuestKind, villager: q.villager, state: q.state, week: Math.floor(num(q.week)), until: num(q.until), reward: Math.round(num(q.reward)), rep: Math.round(num(q.rep)) };
    if (out.kind === 'treats') {
      if (!int(q.treats) || q.treats < 1) return null;
      out.treats = Math.min(q.treats, BALANCE.eggs.treatsMax);
    } else if (out.kind === 'pup') {
      if (int(q.coat) && q.coat >= 0 && q.coat < COAT_COLORS.length) out.coat = q.coat;
      else if (TEMPERAMENTS.includes(q.temperament as Temperament)) out.temperament = q.temperament;
      else return null;
    } else {
      const d = q.dog as Partial<LostDog> | undefined;
      const w = this.sim.world;
      if (!d || typeof d !== 'object' || typeof d.name !== 'string' || !isValidGenome(d.genome) || !STAGES.includes(d.stage as GrowthStage)) return null;
      if (!int(d.spotX) || !int(d.spotY) || !w.inBounds(d.spotX, d.spotY)) return null;
      const fin = (v: unknown, f: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : f);
      const dog: LostDog = {
        name: d.name.slice(0, 16),
        genome: { ...d.genome },
        stage: d.stage as GrowthStage,
        own: d.own === true,
        spotX: d.spotX,
        spotY: d.spotY,
        areaX: Math.round(fin(d.areaX, d.spotX)),
        areaY: Math.round(fin(d.areaY, d.spotY)),
        x: fin(d.x, d.spotX + 0.5),
        y: fin(d.y, d.spotY + 0.6),
        found: d.found === true && out.state === 'active',
      };
      const tx = Math.floor(dog.x);
      const ty = Math.floor(dog.y - 0.2);
      if (!w.inBounds(tx, ty) || w.isSolid(tx, ty)) {
        dog.x = dog.spotX + 0.5;
        dog.y = dog.spotY + 0.6;
      }
      out.dog = dog;
    }
    return out;
  }
}
