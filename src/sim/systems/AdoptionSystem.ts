import { BALANCE } from '../../config/balance';
import { PERSON_NAMES } from '../../content/names';
import { type Adopter, adoptable, matchScore, randomRequest, requestFee } from '../entities/Adopter';
import { buildingDoorTile } from '../entities/Building';
import { Dog, clamp100 } from '../entities/Dog';
import type { Facing } from '../entities/Player';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import type { Sim } from '../Sim';
import { t } from '../../i18n';

export interface AdoptionRecord {
  day: number;
  dogName: string;
  adopterName: string;
  fee: number;
  score: number;
}

export interface PendingReturn {
  day: number;
  dog: ReturnType<Dog['toJSON']>;
  adopterName: string;
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
    let expected = B.dailyBase + sim.reputation / 50 + (level - 1) * 0.5;
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
    const office = sim.buildings.find((b) => b.type === 'office');
    if (!office) return null;
    const gate = this.gateTile();
    if (!gate) return null;
    const rng = sim.rng;
    const request = randomRequest(rng, sim.reputation);
    const a: Adopter = {
      id: sim.nextId++,
      name: rng.pick(PERSON_NAMES),
      request,
      fee: requestFee(rng, request),
      patienceLeft: BALANCE.adoption.patienceMinutes,
      state: 'walking',
      x: gate.x + 0.5,
      y: gate.y + 0.5,
      facing: 1,
      moving: false,
      path: [],
      look: rng.int(0, 0xffff),
      queueSlot: this.freeQueueSlot(),
    };
    const target = this.queueTile(office, a.queueSlot);
    a.path = findPath(sim.world, gate, target, { maxNodes: 6000, adjacentOk: true }) ?? [];
    sim.adopters.push(a);
    sim.events.emit('adopterArrived', a);
    return a;
  }

  private gateTile(): TilePos | null {
    const w = this.sim.world;
    const p = w.plot;
    const right = p.x + p.w - 1;
    for (let y = p.y; y < p.y + p.h; y++) if (w.objectAt(right, y) === Obj.Gate) return { x: right, y };
    const bottom = p.y + p.h - 1;
    for (let x = p.x; x < p.x + p.w; x++) if (w.objectAt(x, bottom) === Obj.Gate) return { x, y: bottom };
    return null;
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
    const gate = this.gateTile();
    a.state = 'leaving';
    a.path = gate ? (findPath(this.sim.world, { x: Math.floor(a.x), y: Math.floor(a.y) }, gate, { maxNodes: 6000 }) ?? []) : [];
    if (a.path.length === 0) a.path = [];
  }

  /** Köpeği sahiplendir: ücret, itibar, kayıt, olası geri dönüş. */
  adopt(adopterId: number, dogId: number): { ok: boolean; message?: string } {
    const sim = this.sim;
    const a = sim.adopters.find((x) => x.id === adopterId);
    const dog = sim.dogById(dogId);
    if (!a || !dog || a.state !== 'waiting') return { ok: false, message: t('Sahiplenici artık burada değil') };
    const why = adoptable(dog);
    if (why) return { ok: false, message: t('{name} sahiplendirilemez: {why}', { name: dog.name, why }) };
    const score = matchScore(dog, a.request);
    if (score <= 0) return { ok: false, message: t('{name} bu köpeği istemiyor', { name: a.name }) };
    const B = BALANCE.adoption;
    let rep = score >= 70 ? B.repGood + Math.round((score - 70) / 10) : score >= 50 ? B.repOk : -B.repBad;
    sim.reputation = clamp100(sim.reputation + rep);
    sim.addIncome('adoption', a.fee, `${dog.name} → ${a.name}`);
    sim.adoptions.push({ day: sim.clock.day, dogName: dog.name, adopterName: a.name, fee: a.fee, score });
    sim.stats.adopted++;
    const saved = dog.toJSON();
    sim.removeDog(dog.id);
    if (score < 50 && sim.rng.chance(B.returnChanceBadMatch)) {
      sim.pendingReturns.push({ day: sim.clock.day + B.returnAfterDays, dog: saved, adopterName: a.name });
    }
    this.leave(a);
    const repText = rep >= 0 ? t('itibar +{n}', { n: rep }) : t('itibar {n}', { n: rep });
    return { ok: true, message: t('{dog}, {person} ile yeni evine gitti (+{fee} ₺, {rep})', { dog: dog.name, person: a.name, fee: a.fee, rep: repText }) };
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
      const gate = this.gateTile() ?? { x: Math.floor(sim.world.spawn.x), y: Math.floor(sim.world.spawn.y) };
      const back = sim.addDog(dog.genome, dog.origin, dog.ageWeeks, gate.x - 1 + 0.5, gate.y + 0.5, dog.name);
      back.skills = { ...dog.skills };
      back.needs.loyalty = Math.max(0, dog.needs.loyalty - 15);
      sim.reputation = clamp100(sim.reputation - BALANCE.adoption.repReturn);
      sim.events.emit('message', t("{person} {dog}'i geri getirdi: uyum sağlayamamış (itibar -{n})", { person: r.adopterName, dog: dog.name, n: BALANCE.adoption.repReturn }));
    }
  }
}
