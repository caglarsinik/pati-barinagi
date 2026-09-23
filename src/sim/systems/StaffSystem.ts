import { BALANCE } from '../../config/balance';
import { PERSON_NAMES } from '../../content/names';
import { type Building, buildingDoorTile, isReady } from '../entities/Building';
import { type Dog, clamp100 } from '../entities/Dog';
import type { Facing } from '../entities/Player';
import { ROLE_MAIN_ATTRS, STAFF_ROLES, Staff, type StaffRole, randomCandidate, xpForLevel } from '../entities/Staff';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { entryPoint } from '../world/gates';
import { Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { trainingZoneFactor } from './Interaction';
import { cleanMess, cleanMinutesMul } from './MessSystem';
import type { Task } from './TaskBoard';
import { t } from '../../i18n';
import { Rng, hash3 } from '../../core/Rng';

/** Personelin çalışma ritmi: vardiya, mola, görev seçimi, iş yapma. */
/** Personel sınırı: ofis Sv3 (lisans 3) daha kalabalık kadro alır. */
export function maxStaff(sim: Sim): number {
  return sim.licenseLevel >= 3 ? BALANCE.staff.maxStaffTop : BALANCE.staff.maxStaff;
}

export class StaffSystem {
  constructor(private readonly sim: Sim) {}

  // ---------------------------------------------------------------------------
  // Adaylar ve işe alma
  // ---------------------------------------------------------------------------

  /** Her sabah 3 aday: rollerden en az biri farklı. */
  refreshCandidates(): void {
    const sim = this.sim;
    const rng = sim.rng;
    sim.candidates = [];
    const roles = rng.shuffle([...STAFF_ROLES]);
    for (let i = 0; i < BALANCE.staff.candidatesPerDay; i++) {
      const role = i < roles.length ? roles[i] : rng.pick(STAFF_ROLES);
      const name = rng.pick(PERSON_NAMES);
      sim.candidates.push(randomCandidate(rng, sim.nextId++, role, name, sim.clock.day));
    }
  }

  hire(candidateId: number): { ok: boolean; message?: string } {
    const sim = this.sim;
    const idx = sim.candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) return { ok: false, message: t('Aday artık yok') };
    if (sim.staff.length >= maxStaff(sim)) return { ok: false, message: t('En fazla {n} personel', { n: maxStaff(sim) }) };
    const s = sim.candidates.splice(idx, 1)[0];
    this.admit(s);
    return { ok: true, message: t('{name} işe alındı ({wage} ₺/hafta)', { name: s.name, wage: s.wage }) };
  }

  /** Gönüllü başvurusunu kabul et (maaşsız, yalnız hafta sonu, birkaç hafta). */
  acceptVolunteer(): { ok: boolean; message?: string } {
    const sim = this.sim;
    const s = sim.volunteerOffer;
    if (!s) return { ok: false, message: t('Gönüllü başvurusu yok') };
    if (sim.staff.length >= maxStaff(sim)) return { ok: false, message: t('En fazla {n} personel', { n: maxStaff(sim) }) };
    sim.volunteerOffer = null;
    this.admit(s);
    return { ok: true, message: t('{name} gönüllü olarak katıldı: {n} hafta, hafta sonları çalışır', { name: s.name, n: s.volunteerWeeksLeft }) };
  }

  /** Kadroya ekle: kapının dışında başlar, vardiyasında içeri girer. */
  private admit(s: Staff): void {
    const sim = this.sim;
    const at = this.entryOutside();
    s.x = at.x + 0.5;
    s.y = at.y + 0.5;
    s.state = 'offDuty';
    s.hiredDay = sim.clock.day;
    sim.staff.push(s);
    sim.stats.hired++;
    sim.events.emit('staffHired', s);
  }

  /** Eğitim kursu: ücret, bir gün yokluk; dönüşte en az bir seviye. */
  sendToCourse(staffId: number): { ok: boolean; message?: string } {
    const sim = this.sim;
    const C = BALANCE.staff.course;
    const s = sim.staff.find((x) => x.id === staffId);
    if (!s) return { ok: false };
    if (s.volunteer) return { ok: false, message: t('Gönüllüler kursa gönderilmez') };
    if (s.level >= BALANCE.staff.progress.maxLevel) return { ok: false, message: t('{name} zaten en üst seviyede', { name: s.name }) };
    if (s.courseUntil !== null) return { ok: false, message: t('{name} zaten kursta', { name: s.name }) };
    if (sim.money < C.cost) return { ok: false, message: t('Yeterli para yok') };
    sim.addExpense('wages', C.cost, t('Kurs: {name}', { name: s.name }));
    s.courseUntil = sim.clock.totalMinutes + C.days * 24 * 60;
    return { ok: true, message: t('{name} kursa gitti; {n} gün sonra döner', { name: s.name, n: C.days }) };
  }

  private finishCourse(s: Staff): void {
    s.courseUntil = null;
    this.sim.events.emit('message', t('{name} kurstan döndü', { name: s.name }));
    this.gainXp(s, Math.max(1, xpForLevel(s.level) - s.xp));
  }

  /** Cuma gelen gönüllü adayı (ayrı RNG: ana rastgele sıra değişmez). */
  private makeVolunteer(): Staff {
    const sim = this.sim;
    const rng = new Rng(hash3(sim.seed, sim.clock.week, 0x5601));
    const role = rng.pick(STAFF_ROLES);
    const s = randomCandidate(rng, sim.nextId++, role, rng.pick(PERSON_NAMES), sim.clock.day);
    s.wage = 0;
    s.volunteer = true;
    s.volunteerWeeksLeft = BALANCE.staff.volunteer.weeks;
    return s;
  }

  fire(staffId: number): { ok: boolean; message?: string } {
    const sim = this.sim;
    const s = sim.staff.find((x) => x.id === staffId);
    if (!s) return { ok: false };
    const severance = s.wage;
    sim.addExpense('wages', severance, t('{name} tazminat', { name: s.name }));
    this.removeStaff(s, t('{name} işten çıkarıldı ({n} ₺ tazminat)', { name: s.name, n: severance }));
    return { ok: true };
  }

  private removeStaff(s: Staff, message: string): void {
    const sim = this.sim;
    sim.tasks.releaseAll(s.id);
    sim.staff = sim.staff.filter((x) => x.id !== s.id);
    sim.events.emit('staffRemoved', s.id);
    sim.events.emit('message', message);
  }

  /** Haftalık maaş toplamı. */
  totalWages(): number {
    return this.sim.staff.reduce((sum, s) => sum + s.wage, 0);
  }

  /** Hafta kapanışından sonra: kasa eksideyse maaş ödenmemiş sayılır, ikinci haftada istifa. */
  afterPayday(): void {
    const sim = this.sim;
    for (const s of [...sim.staff]) {
      if (s.volunteer) {
        s.volunteerWeeksLeft--;
        if (s.volunteerWeeksLeft <= 0) {
          sim.reputation = Math.min(100, sim.reputation + BALANCE.staff.volunteer.reputationGain);
          this.removeStaff(s, t('{name} gönüllülüğünü tamamladı, teşekkürler! (itibar +{n})', { name: s.name, n: BALANCE.staff.volunteer.reputationGain }));
        }
        continue;
      }
      if (sim.money < 0) {
        s.unpaidWeeks++;
        s.morale = Math.max(0, s.morale - BALANCE.staff.morale.unpaidLoss);
        if (s.unpaidWeeks >= BALANCE.staff.quitAfterUnpaidWeeks) {
          this.removeStaff(s, t('{name} maaşını alamadığı için istifa etti', { name: s.name }));
        } else {
          sim.events.emit('message', t('{name} maaşını alamadı; bir hafta daha sabreder', { name: s.name }));
        }
      } else s.unpaidWeeks = 0;
    }
  }

  /** Görev deneyimi: eşikte seviye atlar (en çok 5), rolün ana niteliği +1, moral artar. */
  gainXp(s: Staff, amount: number): void {
    const P = BALANCE.staff.progress;
    if (s.level >= P.maxLevel) return;
    s.xp += amount;
    while (s.level < P.maxLevel && s.xp >= xpForLevel(s.level)) {
      s.xp -= xpForLevel(s.level);
      s.level++;
      const attr = ROLE_MAIN_ATTRS[s.role].find((k) => s.attrs[k] < 5);
      if (attr) s.attrs[attr]++;
      s.morale = Math.min(100, s.morale + P.levelUpMorale);
      this.sim.events.emit('message', t('{name} seviye atladı: Sv{lvl}', { name: s.name, lvl: s.level }));
    }
    if (s.level >= P.maxLevel) s.xp = 0;
  }

  /** Saat başı moral: yorgunluk ve iş yükü düşürür, mola (özellikle mola odası) ve izin toparlar. */
  onHour(): void {
    const sim = this.sim;
    const M = BALANCE.staff.morale;
    const onDuty = sim.staff.filter((s) => s.onDuty).length;
    const open = sim.tasks.tasks.filter((x) => x.claimedBy === null).length;
    const overloaded = onDuty > 0 && open / onDuty > M.overloadPerStaff;
    for (const s of sim.staff) {
      let d = 0;
      if (!s.onDuty) d = M.offDutyGain;
      else if (s.state === 'resting') {
        const room = this.restRoomOf(s);
        d = room ? M.restRoomGain + this.roomMoraleBonus(room) : M.restGain;
      }
      else {
        d = s.energy < M.tiredBelowEnergy ? -M.tiredLoss : M.workGain;
        if (overloaded) d -= M.overloadLoss;
      }
      // Sıkışmış personel (WC yok ya da ulaşılamıyor) saatte moral kaybeder.
      // Taban: yalnız sıkışma yüzünden moral moraleFloor altına inmez (istifa etmez).
      if (s.onDuty && s.bladder >= BALANCE.staff.toilet.penaltyAbove) {
        const W = BALANCE.staff.toilet;
        d -= Math.min(W.moraleLossPerHour, Math.max(0, s.morale + d - W.moraleFloor));
      }
      s.morale = Math.max(0, Math.min(100, s.morale + d));
    }
  }

  /** Gün başı: gönüllü başvurusu (Cuma gelir, Pazartesi düşer); moral uzun süre dipte kalan istifa eder. */
  onDay(): void {
    const M = BALANCE.staff.morale;
    const wd = this.sim.clock.weekday;
    if (wd === 0) this.sim.volunteerOffer = null;
    if (wd === BALANCE.staff.volunteer.offerWeekday && !this.sim.volunteerOffer) this.sim.volunteerOffer = this.makeVolunteer();
    for (const s of [...this.sim.staff]) {
      s.lowMoraleDays = s.morale < M.quitBelow ? s.lowMoraleDays + 1 : 0;
      if (s.lowMoraleDays >= M.quitAfterDays) this.removeStaff(s, t('{name} morali çöktüğü için istifa etti', { name: s.name }));
    }
  }

  // ---------------------------------------------------------------------------
  // Döngü
  // ---------------------------------------------------------------------------

  update(dtMin: number): void {
    const sim = this.sim;
    this.applyPolicies();
    for (const s of sim.staff) this.updateStaff(s, dtMin);
  }

  /** Politikalar: yem stoğu eşiğin altına inince otomatik sipariş. */
  private applyPolicies(): void {
    const sim = this.sim;
    const p = sim.policies;
    if (p.autoOrderFood && sim.foodStock < p.foodThreshold) {
      const price = BALANCE.economy.foodBagPrice + BALANCE.economy.deliveryFee;
      if (sim.money >= price) {
        sim.addExpense('food', price, t('Otomatik sipariş'));
        sim.foodStock += BALANCE.economy.foodBagPortions;
        sim.stats.autoOrders++;
      }
    }
  }

  private updateStaff(s: Staff, dtMin: number): void {
    const sim = this.sim;
    // Kurs bitti mi; kurstaki ya da hafta içindeki gönüllü vardiya dışı sayılır.
    if (s.courseUntil !== null && sim.clock.totalMinutes >= s.courseUntil) this.finishCourse(s);
    const away = s.courseUntil !== null || (s.volunteer && sim.clock.weekday < 5);
    const shift = away ? 0 : s.schedule[sim.clock.hour];
    s.moving = false;
    s.decisionTimer -= dtMin;

    // Vardiya dışı: işi bırak, kapıya yürü, kaybol.
    if (shift === 0) {
      s.insideId = null;
      if (s.state === 'offDuty') return;
      if (s.state !== 'leaving') this.startLeaving(s);
      this.followPath(s, dtMin);
      if (s.path.length === 0) s.state = 'offDuty';
      return;
    }

    // Vardiya başladı: kapıdan gir.
    if (s.state === 'offDuty') {
      const e = entryPoint(sim.world, 'south');
      const at = e?.outside ?? this.spawnTile();
      s.x = at.x + 0.5;
      s.y = at.y + 0.5;
      s.state = 'idle';
      s.energy = Math.max(s.energy, 60);
      s.bladder = 0;
      // Kapının dışında belirir, içeri yürür (yolu olan boştaki personel yürüyordur).
      s.path = e ? (this.pathTo(s, e.inside) ?? []) : [];
    }
    if (s.state === 'leaving') {
      s.state = 'idle';
      s.path = [];
    }

    // Enerji
    const night = sim.clock.isNight() && !s.has('nightOwl');
    const drain = (s.state === 'working' ? BALANCE.staff.energyDrainWorking : BALANCE.staff.energyDrainIdle) * (night ? 1.3 : 1) * (1.2 - s.attrs.stamina * 0.08);
    if (s.state === 'resting') s.energy = clamp100(s.energy + this.restRate(s) * (dtMin / 60));
    else s.energy = clamp100(s.energy - drain * (dtMin / 60));
    // Tuvalet ihtiyacı vardiyada artar (tuvaletteyken değil).
    if (s.state !== 'toilet') s.bladder = Math.min(100, s.bladder + BALANCE.staff.toilet.perHour * (dtMin / 60));

    const breakBelow = s.has('lazy') ? BALANCE.staff.breakBelowLazy : BALANCE.staff.breakBelow;
    const needsRest = shift === 2 || s.energy < breakBelow;

    switch (s.state) {
      case 'idle':
        if (s.path.length > 0) {
          this.followPath(s, dtMin);
          break;
        }
        if (needsRest) {
          this.goRest(s);
          break;
        }
        if (s.decisionTimer <= 0) {
          s.decisionTimer = BALANCE.staff.decisionIntervalMin;
          if (s.bladder >= BALANCE.staff.toilet.goAbove && this.goToilet(s)) break;
          this.pickTask(s);
        }
        break;
      case 'toTask': {
        const task = s.taskId !== null ? sim.tasks.byId(s.taskId) : undefined;
        if (!task) {
          this.dropTask(s);
          break;
        }
        this.followPath(s, dtMin);
        if (s.path.length === 0) this.arriveAtTask(s, task);
        break;
      }
      case 'working': {
        const task = s.taskId !== null ? sim.tasks.byId(s.taskId) : undefined;
        if (!task) {
          this.dropTask(s);
          break;
        }
        s.taskLeft -= dtMin;
        if (s.taskLeft <= 0) this.completeTask(s, task);
        break;
      }
      case 'toRest':
        this.followPath(s, dtMin);
        if (s.path.length === 0) s.state = 'resting';
        break;
      case 'resting':
        if (s.bladder >= BALANCE.staff.toilet.goAbove && s.decisionTimer <= 0) {
          s.decisionTimer = BALANCE.staff.decisionIntervalMin;
          if (this.goToilet(s)) break;
        }
        if (shift === 1 && s.energy >= this.restUntilFor(s)) s.state = 'idle';
        break;
      case 'toToilet':
        this.followPath(s, dtMin);
        if (s.path.length === 0) {
          s.state = 'toilet';
          s.taskLeft = BALANCE.staff.toilet.minutes;
        }
        break;
      case 'toilet':
        s.taskLeft -= dtMin;
        if (s.taskLeft <= 0) {
          s.bladder = 0;
          s.taskLeft = 0;
          s.state = 'idle';
          s.decisionTimer = 0;
        }
        break;
      default:
        s.state = 'idle';
    }
    // Molada dinlenme odasının kapısındaysa içeride sayılır: dışarıda görünmez, oyuncu odadaysa kanepede görünür.
    s.insideId = s.state === 'resting' ? (this.restRoomOf(s)?.id ?? null) : null;
  }

  /** Molada olduğu dinlenme odası: hazır odanın kapısına 3 kareden yakın. */
  restRoomOf(s: Staff): Building | undefined {
    for (const room of this.sim.buildings) {
      if (room.type !== 'staffRoom' || !isReady(room)) continue;
      const door = buildingDoorTile(room);
      if (Math.hypot(s.x - (door.x + 0.5), s.y - (door.y + 0.5)) < 3) return room;
    }
    return undefined;
  }

  /** Odadaki moladakiler (personel listesi sırasıyla); ilk `seatsIn` kadarı kanepede oturur. */
  restingIn(room: Building): Staff[] {
    return this.sim.staff.filter((x) => x.state === 'resting' && x.insideId === room.id);
  }

  seatsIn(room: Building): number {
    return room.furniture.filter((f) => f === 'sofa').length * BALANCE.staff.rest.seatsPerSofa;
  }

  /** Mola yenilenmesi (enerji/saat): oda + kanepede yer varsa +%25; oda yoksa dışarıda yavaş. */
  restRate(s: Staff): number {
    const room = this.restRoomOf(s);
    if (!room) return BALANCE.staff.restRegenOutside;
    const i = this.restingIn(room).indexOf(s);
    const seated = i >= 0 && i < this.seatsIn(room);
    return BALANCE.staff.restRegenRoom * (seated ? 1 + BALANCE.staff.rest.sofaRegenBonus : 1);
  }

  /** Kahve köşesi ve TV'nin molada saatlik moral eki. */
  private roomMoraleBonus(room: Building): number {
    const R = BALANCE.staff.rest;
    return (room.furniture.includes('coffee') ? R.coffeeMoralePerHour : 0) + (room.furniture.includes('tv') ? R.tvMoralePerHour : 0);
  }

  /** Moladan dönüş eşiği: buzdolabı olan odada enerji tam dolar. */
  private restUntilFor(s: Staff): number {
    const room = this.restRoomOf(s);
    return room?.furniture.includes('fridge') ? BALANCE.staff.rest.fridgeRestUntil : BALANCE.staff.restUntil;
  }

  // ---------------------------------------------------------------------------
  // Görev seçimi ve yürütme
  // ---------------------------------------------------------------------------

  private pickTask(s: Staff): void {
    const sim = this.sim;
    const task = sim.tasks.bestFor(s);
    if (!task) return;
    const path = this.pathTo(s, task.tile);
    if (!path) return;
    sim.tasks.claim(task, s.id);
    s.taskId = task.id;
    s.path = path;
    s.retries = 0;
    s.state = 'toTask';
  }

  /** Arsa sınırları içinde (çit satırındaki kapı dahil) yol bulur. */
  private pathTo(s: Staff, tile: TilePos): TilePos[] | null {
    const w = this.sim.world;
    const from = { x: s.tileX, y: s.tileY };
    const inside = w.inPlot(tile.x, tile.y) && w.inPlot(from.x, from.y);
    return findPath(w, from, tile, { region: inside ? w.plot : undefined, maxNodes: 5000, adjacentOk: true, throughGates: true });
  }

  private arriveAtTask(s: Staff, task: Task): void {
    const sim = this.sim;
    // Hedef köpek uzaklaştıysa peşine git (birkaç deneme).
    if (task.targetId !== null && task.type !== 'feed' && task.type !== 'water') {
      const dog = sim.dogById(task.targetId);
      if (!dog) {
        this.dropTask(s);
        return;
      }
      const dist = Math.hypot(dog.x - s.x, dog.y - s.y);
      if (dist > 2.2) {
        if (s.retries++ >= 3) {
          this.dropTask(s);
          return;
        }
        const path = this.pathTo(s, { x: dog.tileX, y: dog.tileY });
        if (!path) {
          this.dropTask(s);
          return;
        }
        s.path = path;
        return;
      }
      // Köpek dursun.
      dog.state = 'interact';
      dog.stateTimer = this.duration(s, task) + 2;
      dog.path = [];
      dog.lastInteractionDay = sim.clock.day;
    }
    s.state = 'working';
    s.taskLeft = this.duration(s, task);
    const dx = task.tile.x + 0.5 - s.x;
    const dy = task.tile.y + 0.5 - s.y;
    s.facing = (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) as Facing;
  }

  private duration(s: Staff, task: Task): number {
    const type = task.type;
    let base: number = BALANCE.staff.taskMinutes[type];
    // Çöp kutusuna yakın pislik daha çabuk temizlenir.
    if (type === 'clean') base *= cleanMinutesMul(this.sim, task.tile);
    if ((type === 'feed' || type === 'water') && this.sim.hasReady('kitchen')) base *= BALANCE.staff.kitchenPrepMul;
    return Math.max(3, Math.round(base / Math.max(0.2, s.efficiency(type))));
  }

  private completeTask(s: Staff, task: Task): void {
    const sim = this.sim;
    const dog = task.targetId !== null ? sim.dogById(task.targetId) : undefined;
    const empathy = 0.8 + s.attrs.empathy * 0.08;
    switch (task.type) {
      case 'feed': {
        const bowl = task.targetId !== null ? sim.buildingById(task.targetId) : undefined;
        if (bowl && bowl.type === 'bowl') {
          const cap = sim.bowlCapacity(bowl);
          let take = Math.min(cap - bowl.food, sim.foodStock);
          if (take > 0 && s.has('clumsy') && sim.rng.chance(0.15)) {
            sim.foodStock -= 1;
            take = Math.min(take, sim.foodStock);
            sim.events.emit('message', t('{name} bir porsiyon yem döktü', { name: s.name }));
          }
          if (take > 0) {
            bowl.food += take;
            sim.foodStock -= take;
          }
        }
        break;
      }
      case 'water': {
        const trough = task.targetId !== null ? sim.buildingById(task.targetId) : undefined;
        if (trough && trough.type === 'trough') {
          trough.water = sim.troughCapacity();
          sim.stats.watered++;
        }
        break;
      }
      case 'clean':
        if (cleanMess(sim, task.tile.x, task.tile.y) && s.has('meticulous')) {
          // Titiz: yakındaki köpeklerin hijyeni de biraz düzelir.
          for (const d of sim.shelterDogs()) if (Math.hypot(d.x - task.tile.x, d.y - task.tile.y) < 3) d.needs.hygiene = clamp100(d.needs.hygiene + 3);
        }
        break;
      case 'play':
        if (dog) {
          dog.needs.play = clamp100(dog.needs.play + BALANCE.dogs.playGain * empathy);
          dog.needs.loyalty = clamp100(dog.needs.loyalty + (s.has('whisperer') ? 2 : 1));
          dog.needs.energy = clamp100(dog.needs.energy - BALANCE.dogs.playEnergyCost);
          dog.needs.thirst = clamp100(dog.needs.thirst + BALANCE.dogs.needs.thirstAfterPlay);
        }
        break;
      case 'train':
        if (dog) this.trainDog(s, dog);
        break;
      case 'groom':
        if (dog) {
          const station = sim.buildings.some((b) => b.type === 'groomStation' && isReady(b));
          const gain = (station ? 60 : BALANCE.dogs.groomGain) * (0.8 + s.attrs.skill * 0.05) + (s.has('meticulous') ? 10 : 0);
          dog.needs.hygiene = clamp100(dog.needs.hygiene + gain);
        }
        break;
      case 'treat':
        if (dog) {
          const price = BALANCE.economy.treatmentPrice;
          if (sim.money >= price) {
            sim.addExpense('treatment', price, t('{dog} ({staff})', { dog: dog.name, staff: s.name }));
            dog.needs.health = clamp100(dog.needs.health + BALANCE.dogs.treatHealthGain);
            sim.illness.cure(dog);
            sim.stats.treated++;
          } else sim.events.emit('message', t('{name}: ilaç için para yok', { name: s.name }));
        }
        break;
      default:
        break;
    }
    sim.stats.staffTasks++;
    this.gainXp(s, BALANCE.staff.progress.xpPerTask);
    sim.tasks.remove(task);
    s.taskId = null;
    s.state = 'idle';
    s.decisionTimer = 0.5;
  }

  private trainDog(s: Staff, dog: Dog): void {
    const sim = this.sim;
    const skill = pickSkill(dog);
    if (!skill) return;
    const temper = dog.genome.temperament === 'calm' ? 1.1 : dog.genome.temperament === 'shy' ? 0.85 : dog.genome.temperament === 'bold' ? 0.95 : 1;
    const zone = trainingZoneFactor(sim, dog);
    const gain = (5 + s.attrs.skill * 2.5 + s.attrs.empathy * 1.2 + dog.genome.intelligence * 2 + dog.needs.loyalty * 0.05) * temper * zone;
    const before = dog.skills[skill];
    dog.skills[skill] = clamp100(before + gain);
    dog.needs.energy = clamp100(dog.needs.energy - BALANCE.dogs.trainEnergyCost);
    dog.needs.loyalty = clamp100(dog.needs.loyalty + (s.has('whisperer') ? 2 : 1));
    sim.stats.trained++;
    if (before < 100 && dog.skills[skill] >= 100) sim.events.emit('message', t('{dog} {staff} ile yeni bir beceri öğrendi', { dog: dog.name, staff: s.name }));
  }

  private dropTask(s: Staff): void {
    const task = s.taskId !== null ? this.sim.tasks.byId(s.taskId) : undefined;
    if (task) this.sim.tasks.release(task);
    s.taskId = null;
    s.path = [];
    s.state = 'idle';
    s.decisionTimer = 1;
  }

  /** En yakın hazır Personel WC'nin kapısına yürür; WC ya da yol yoksa false (ceza onHour ve verimde). */
  private goToilet(s: Staff): boolean {
    let best: TilePos | null = null;
    let bestD = Infinity;
    for (const b of this.sim.buildings) {
      if (b.type !== 'staffToilet' || !isReady(b)) continue;
      const door = buildingDoorTile(b);
      const d = Math.hypot(door.x + 0.5 - s.x, door.y + 0.5 - s.y);
      if (d < bestD) {
        bestD = d;
        best = door;
      }
    }
    if (!best) return false;
    const path = this.pathTo(s, best);
    if (!path) return false;
    this.dropTask(s);
    s.path = path;
    s.state = 'toToilet';
    return true;
  }

  private goRest(s: Staff): void {
    const sim = this.sim;
    this.dropTask(s);
    const room = sim.buildings.find((b) => b.type === 'staffRoom' && isReady(b));
    const target = room ? buildingDoorTile(room) : this.restSpot();
    const path = this.pathTo(s, target);
    s.path = path ?? [];
    s.state = 'toRest';
  }

  /** Personel odası yoksa personel bölgesi ya da ofis önü. */
  private restSpot(): TilePos {
    const sim = this.sim;
    const zoneTiles = sim.world.zoneTiles(Zone.Staff).filter((t) => !sim.world.isSolid(t.x, t.y));
    if (zoneTiles.length > 0) return zoneTiles[0];
    const office = sim.buildings.find((b) => b.type === 'office');
    return office ? buildingDoorTile(office) : { x: Math.floor(sim.world.spawn.x), y: Math.floor(sim.world.spawn.y) };
  }

  private startLeaving(s: Staff): void {
    this.dropTask(s);
    s.path = this.pathTo(s, this.entryOutside()) ?? [];
    s.state = 'leaving';
  }

  /** Personelin kullandığı kapının dış karesi (güney kapı tercih); kapı yoksa doğuş noktası. */
  private entryOutside(): TilePos {
    return entryPoint(this.sim.world, 'south')?.outside ?? this.spawnTile();
  }

  private spawnTile(): TilePos {
    const w = this.sim.world;
    return { x: Math.floor(w.spawn.x), y: Math.floor(w.spawn.y) };
  }

  private followPath(s: Staff, dtMin: number): void {
    let budget = s.speed() * dtMin;
    while (budget > 0 && s.path.length > 0) {
      const next = s.path[0];
      if (!this.sim.gates.canEnter(next)) break;
      const tx = next.x + 0.5;
      const ty = next.y + 0.5;
      const dx = tx - s.x;
      const dy = ty - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        s.x = tx;
        s.y = ty;
        budget -= dist;
        s.path.shift();
      } else {
        s.x += (dx / dist) * budget;
        s.y += (dy / dist) * budget;
        budget = 0;
      }
      s.facing = (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) as Facing;
      s.moving = true;
    }
  }
}

function pickSkill(dog: Dog): keyof Dog['skills'] | null {
  if (dog.trainingFocus && dog.skills[dog.trainingFocus] < 100) return dog.trainingFocus;
  if (dog.skills.potty < 100) return 'potty';
  let best: keyof Dog['skills'] | null = null;
  let bestV = 100;
  for (const k of Object.keys(dog.skills) as Array<keyof Dog['skills']>) {
    if (dog.skills[k] < bestV) {
      bestV = dog.skills[k];
      best = k;
    }
  }
  return best;
}

export type { StaffRole };
