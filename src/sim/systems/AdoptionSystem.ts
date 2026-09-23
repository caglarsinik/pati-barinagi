import { BALANCE } from '../../config/balance';
import { PERSON_NAMES } from '../../content/names';
import { type Adopter, adoptable, matchScore, randomRequest, requestFee } from '../entities/Adopter';
import { ADOPTER_TYPES, type AdopterType, VILLAGER_ADOPTER_TYPE, adopterIdentity, typedFee, withTypeLikes } from '../entities/AdopterType';
import { familyLast, pickReturningFamily } from './Stories';
import type { GrowthStage } from '../entities/Dog';
import type { DogGenome } from '../entities/DogGenome';
import { buildingDoorTile } from '../entities/Building';
import { Dog, clamp100 } from '../entities/Dog';
import type { Facing } from '../entities/Player';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { entryPoint } from '../world/gates';
import type { Sim } from '../Sim';
import { t } from '../../i18n';

export interface AdoptionRecord {
  day: number;
  dogName: string;
  adopterName: string;
  fee: number;
  score: number;
  /** Köylü sahiplendiyse (0.20.2): köylü indeksi (köpek köyde sahibiyle çizilir). */
  villager?: number;
  /** Köpeğin görünümü: 0.20.2'de yalnız köylüde, 0.21.0'dan beri her sahiplendirmede (albüm, mektup fotoğrafı). */
  genome?: DogGenome;
  stage?: GrowthStage;
  /** Sahiplenici kimliği (0.21.0; köpek isteği görevinde -görev kimliği): mektup, albüm ve geri getirme bağı. */
  key?: number;
  /** Sahiplenicinin kişilik tipi ve görünümü (0.21.0). */
  type?: AdopterType;
  look?: number;
  /** Köpek geri getirildi (0.21.0). */
  returned?: boolean;
  /** Ailenin mektup yazacağı gün ve yazdı mı (0.21.1; geri gelecek köpekte yok). */
  letterDay?: number;
  lettered?: boolean;
  /** Aile (0.21.2): ailenin ilk sahiplendirme anahtarı; tekrar gelen ailede eski kayıtla aynı. */
  family?: number;
}

export interface PendingReturn {
  day: number;
  dog: ReturnType<Dog['toJSON']>;
  adopterName: string;
  /** Sahiplendirme kaydının anahtarı (0.21.0): köpek dönünce kayıt işaretlenir. */
  key?: number;
}

/**
 * Sahiplenici akışı: gün planı → kapıdan gelir → ofis önünde bekler → eşleşme ya da sabrı biter → gider.
 */
export class AdoptionSystem {
  /** Bugün gelecek sahiplenicilerin geliş dakikaları (gün içi). */
  private scheduled: number[] = [];
  private scheduledDay = -1;

  constructor(private readonly sim: Sim) {}

  /** Her gün 06:00'da (gün olayı) planlanır; yükleme sonrası da çağrılır. */
  planDay(): void {
    const sim = this.sim;
    if (this.scheduledDay === sim.clock.day) return;
    this.scheduledDay = sim.clock.day;
    this.scheduled = [];
    const B = BALANCE.adoption;
    const rng = sim.rng;
    const level = sim.licenseLevel;
    let expected = B.dailyBase + sim.reputation / 50 + (level - 1) * 0.5 + sim.decorScore() * BALANCE.decor.adoptersPerPoint;
    if (sim.clock.day <= 2) expected = Math.max(expected, 1);
    expected *= sim.weatherSys.modifiers().adopters;
    if (sim.flags.extraAdoptersDay === sim.clock.day) expected += 2;
    let n = Math.floor(expected);
    if (rng.chance(expected - n)) n++;
    n = Math.min(B.dailyMax, n);
    for (let i = 0; i < n; i++) this.scheduled.push(rng.int(B.arriveFromHour * 60, B.arriveToHour * 60));
    this.scheduled.sort((a, b) => a - b);
  }

  update(dtMin: number): void {
    const sim = this.sim;
    this.planDay();
    const m = sim.clock.minuteOfDay;
    while (this.scheduled.length > 0 && this.scheduled[0] <= m) {
      const at = this.scheduled.shift()!;
      // Saat atlatıldıysa (uyku, kayıt yükleme) kaçan sahiplenici gelmez.
      if (m - at <= 30) this.spawnAdopter();
    }
    for (const a of sim.adopters) this.updateAdopter(a, dtMin);
    sim.adopters = sim.adopters.filter((a) => !(a.state === 'leaving' && a.path.length === 0));
    this.processReturns();
  }

  /** Doğu kapısından gelir, ofisin önüne yürür. */
  spawnAdopter(): Adopter | null {
    const sim = this.sim;
    if (!sim.policies.adoptionsOpen) return null;
    const office = sim.buildings.find((b) => b.type === 'office');
    if (!office) return null;
    const entry = entryPoint(sim.world, 'east');
    if (!entry) return null;
    const gate = entry.outside;
    const rng = sim.rng;
    const request = randomRequest(rng, sim.reputation);
    const a: Adopter = {
      id: sim.nextId++,
      name: rng.pick(PERSON_NAMES),
      request,
      fee: requestFee(rng, request),
      patienceLeft: BALANCE.adoption.patienceMinutes + sim.decorScore() * BALANCE.decor.patiencePerPoint,
      state: 'walking',
      x: gate.x + 0.5,
      y: gate.y + 0.5,
      facing: 1,
      moving: false,
      path: [],
      look: rng.int(0, 0xffff),
      queueSlot: this.freeQueueSlot(),
      type: 'family',
    };
    // Kimlik (0.21.0; ayrı RNG, ana sıra değişmez): kişilik tipi ve ad soyad. Yukarıdaki ad çekilişi sıra için kalır.
    const id = adopterIdentity(sim.seed, a.id);
    a.type = id.type;
    a.name = id.name;
    // Köylü sahiplenici (0.20.2; karar ayrı RNG ile, ana sıra değişmez): adı ve görünümü köylününki olur.
    const villager = sim.villagers.adopterFor(a.id);
    if (villager) {
      a.villager = villager.index;
      a.name = villager.name;
      a.look = villager.look;
      a.type = VILLAGER_ADOPTER_TYPE[villager.role];
    } else {
      // Tekrar gelen aile (0.21.2; ayrı RNG): mutlu eski aile yeniden gelir; adı, görünümü ve tipi ailenin.
      const back = pickReturningFamily(sim, a.id);
      if (back) {
        a.family = back.family;
        a.name = back.last.adopterName;
        if (back.last.look !== undefined) a.look = back.last.look;
        if (back.last.type) a.type = back.last.type;
      }
    }
    // Tip: sevdikleri isteğe eklenir, ücret ve sabır çarpanı (dekor sabrı ayrıca eklenir).
    a.request = withTypeLikes(a.request, a.type);
    a.fee = typedFee(a.fee, a.type);
    a.patienceLeft = BALANCE.adoption.patienceMinutes * ADOPTER_TYPES[a.type].patienceMul + sim.decorScore() * BALANCE.decor.patiencePerPoint;
    if (a.family !== undefined) {
      const S = BALANCE.stories;
      a.fee = Math.min(BALANCE.adoption.feeMax, Math.round((a.fee * S.returnFeeMul) / 10) * 10);
      a.patienceLeft *= S.returnPatienceMul;
    }
    const target = this.queueTile(office, a.queueSlot);
    a.path = findPath(sim.world, gate, target, { maxNodes: 6000, adjacentOk: true, throughGates: true }) ?? [];
    sim.adopters.push(a);
    sim.events.emit('adopterArrived', a);
    return a;
  }

  private freeQueueSlot(): number {
    const used = new Set(this.sim.adopters.map((a) => a.queueSlot));
    let s = 0;
    while (used.has(s)) s++;
    return s;
  }

  /** Ofis kapısının önünde sıra konumu. */
  private queueTile(office: { x: number; y: number; type: string }, slot: number): TilePos {
    const door = buildingDoorTile(office as never);
    const offsets = [
      [0, 1],
      [1, 1],
      [-1, 1],
      [2, 2],
      [-2, 2],
      [0, 3],
    ];
    const o = offsets[Math.min(slot, offsets.length - 1)];
    return { x: door.x + o[0], y: door.y + o[1] };
  }

  private updateAdopter(a: Adopter, dtMin: number): void {
    const sim = this.sim;
    a.moving = false;
    if (a.state === 'walking' || a.state === 'leaving') {
      this.followPath(a, dtMin);
      if (a.path.length === 0 && a.state === 'walking') {
        a.state = 'waiting';
        a.facing = 3;
      }
      return;
    }
    a.patienceLeft -= dtMin;
    if (a.patienceLeft <= 0) {
      sim.reputation = clamp100(sim.reputation - BALANCE.adoption.repLeaveUnserved);
      sim.events.emit('message', t('{name} beklemekten sıkılıp gitti (itibar -{n})', { name: a.name, n: BALANCE.adoption.repLeaveUnserved }));
      this.leave(a);
    }
  }

  private followPath(a: Adopter, dtMin: number): void {
    let budget = BALANCE.adoption.walkSpeed * dtMin;
    while (budget > 0 && a.path.length > 0) {
      const next = a.path[0];
      if (!this.sim.gates.canEnter(next)) break;
      const tx = next.x + 0.5;
      const ty = next.y + 0.5;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        a.x = tx;
        a.y = ty;
        budget -= dist;
        a.path.shift();
      } else {
        a.x += (dx / dist) * budget;
        a.y += (dy / dist) * budget;
        budget = 0;
      }
      a.facing = (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) as Facing;
      a.moving = true;
    }
  }

  leave(a: Adopter): void {
    const gate = entryPoint(this.sim.world, 'east')?.outside ?? null;
    a.state = 'leaving';
    a.path = gate ? (findPath(this.sim.world, { x: Math.floor(a.x), y: Math.floor(a.y) }, gate, { maxNodes: 6000, throughGates: true }) ?? []) : [];
    if (a.path.length === 0) a.path = [];
  }

  /** Köpeği sahiplendir: ücret, itibar, kayıt, olası geri dönüş. */
  adopt(adopterId: number, dogId: number): { ok: boolean; message?: string } {
    const sim = this.sim;
    const a = sim.adopters.find((x) => x.id === adopterId);
    const dog = sim.dogById(dogId);
    if (!a || !dog || a.state !== 'waiting') return { ok: false, message: t('Sahiplenici artık burada değil') };
    if (!sim.policies.adoptionsOpen) return { ok: false, message: t('Sahiplendirme kapalı') };
    const why = adoptable(dog);
    if (why) return { ok: false, message: t('{name} sahiplendirilemez: {why}', { name: dog.name, why }) };
    const score = matchScore(dog, a.request);
    if (score <= 0) return { ok: false, message: t('{name} bu köpeği istemiyor', { name: a.name }) };
    const B = BALANCE.adoption;
    let rep = score >= 70 ? B.repGood + Math.round((score - 70) / 10) : score >= 50 ? B.repOk : -B.repBad;
    // Tekrar gelen aile (0.21.2): eski köpeği hatırlanır, iyi eşleşmede ek itibar.
    const old = a.family !== undefined ? familyLast(sim, a.family) : null;
    if (old && score >= 50) rep += BALANCE.stories.returnRep;
    sim.reputation = clamp100(sim.reputation + rep);
    sim.addIncome('adoption', a.fee, `${dog.name} → ${a.name}`);
    const record: AdoptionRecord = {
      day: sim.clock.day,
      dogName: dog.name,
      adopterName: a.name,
      fee: a.fee,
      score,
      key: a.id,
      type: a.type,
      look: a.look,
      genome: { ...dog.genome },
      stage: dog.stage,
      family: a.family ?? a.id,
    };
    sim.adoptions.push(record);
    sim.stats.adopted++;
    sim.events.emit('emote', { kind: 'adopter', id: a.id, emote: 'heart', seconds: 3 });
    const saved = dog.toJSON();
    sim.removeDog(dog.id);
    if (score < 50 && sim.rng.chance(B.returnChanceBadMatch)) {
      sim.pendingReturns.push({ day: sim.clock.day + B.returnAfterDays, dog: saved, adopterName: a.name, key: a.id });
    } else {
      // Köylü sahiplendi (geri dönmeyecek): köpek köyde sahibiyle görünür.
      if (a.villager !== undefined) record.villager = a.villager;
      // Geri dönmeyecek köpeğin ailesi birkaç gün sonra mektup yazar (0.21.1).
      sim.mail.schedule(record);
    }
    this.leave(a);
    const repText = rep >= 0 ? t('itibar +{n}', { n: rep }) : t('itibar {n}', { n: rep });
    let message = t('{dog}, {person} ile yeni evine gitti (+{fee} ₺, {rep})', { dog: dog.name, person: a.name, fee: a.fee, rep: repText });
    if (old) message += ' · ' + t('🔁 {dog}, {old} ile tanışacak', { dog: dog.name, old: old.dogName });
    return { ok: true, message: record.villager !== undefined ? message + ' · ' + t('onu köyde görebilirsin') : message };
  }

  /** Sahiplendirme kapatıldı: bekleyen ve yoldaki sahiplenicileri itibar kaybı olmadan uğurlar. */
  closeDesk(): void {
    let n = 0;
    for (const a of this.sim.adopters) {
      if (a.state !== 'walking' && a.state !== 'waiting') continue;
      this.leave(a);
      n++;
    }
    this.sim.events.emit('message', n > 0 ? t('Sahiplendirme kapatıldı: {n} sahiplenici uğurlandı', { n }) : t('Sahiplendirme kapatıldı: sahiplenici gelmeyecek'));
  }

  decline(adopterId: number): boolean {
    const a = this.sim.adopters.find((x) => x.id === adopterId);
    if (!a || a.state !== 'waiting') return false;
    this.leave(a);
    return true;
  }

  private processReturns(): void {
    const sim = this.sim;
    if (sim.pendingReturns.length === 0) return;
    const due = sim.pendingReturns.filter((r) => r.day <= sim.clock.day);
    if (due.length === 0) return;
    sim.pendingReturns = sim.pendingReturns.filter((r) => r.day > sim.clock.day);
    for (const r of due) {
      const dog = Dog.fromJSON(r.dog);
      if (!dog) continue;
      const at = entryPoint(sim.world, 'east')?.inside ?? { x: Math.floor(sim.world.spawn.x), y: Math.floor(sim.world.spawn.y) };
      const rec = r.key === undefined ? undefined : sim.adoptions.find((x) => x.key === r.key);
      if (rec) rec.returned = true;
      const back = sim.addDog(dog.genome, dog.origin, dog.ageWeeks, at.x + 0.5, at.y + 0.5, dog.name);
      back.skills = { ...dog.skills };
      back.parents = dog.parents;
      back.parentNames = dog.parentNames;
      back.needs.loyalty = Math.max(0, dog.needs.loyalty - 15);
      sim.reputation = clamp100(sim.reputation - BALANCE.adoption.repReturn);
      sim.events.emit('message', t("{person} {dog}'i geri getirdi: uyum sağlayamamış (itibar -{n})", { person: r.adopterName, dog: dog.name, n: BALANCE.adoption.repReturn }));
    }
  }
}
