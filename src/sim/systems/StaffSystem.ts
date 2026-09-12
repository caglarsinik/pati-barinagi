import { BALANCE } from '../../config/balance';
import { PERSON_NAMES } from '../../content/names';
import { buildingDoorTile, isReady } from '../entities/Building';
import { type Dog, clamp100 } from '../entities/Dog';
import type { Facing } from '../entities/Player';
import { STAFF_ROLES, Staff, type StaffRole, type TaskType, randomCandidate } from '../entities/Staff';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { trainingZoneFactor } from './Interaction';
import { cleanMess } from './MessSystem';
import type { Task } from './TaskBoard';
import { t } from '../../i18n';

/** Personelin çalışma ritmi: vardiya, mola, görev seçimi, iş yapma. */
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
    if (sim.staff.length >= BALANCE.staff.maxStaff) return { ok: false, message: t('En fazla {n} personel', { n: BALANCE.staff.maxStaff }) };
    const s = sim.candidates.splice(idx, 1)[0];
    const gate = this.gateTile();
    s.x = gate.x + 0.5;
    s.y = gate.y + 0.5;
    s.state = 'offDuty';
    s.hiredDay = sim.clock.day;
    sim.staff.push(s);
    sim.stats.hired++;
    sim.events.emit('staffHired', s);
    return { ok: true, message: t('{name} işe alındı ({wage} ₺/hafta)', { name: s.name, wage: s.wage }) };
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
      if (sim.money < 0) {
        s.unpaidWeeks++;
        if (s.unpaidWeeks >= BALANCE.staff.quitAfterUnpaidWeeks) {
          this.removeStaff(s, t('{name} maaşını alamadığı için istifa etti', { name: s.name }));
        } else {
          sim.events.emit('message', t('{name} maaşını alamadı; bir hafta daha sabreder', { name: s.name }));
        }
      } else s.unpaidWeeks = 0;
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
    const shift = s.schedule[sim.clock.hour];
    s.moving = false;
    s.decisionTimer -= dtMin;

    // Vardiya dışı: işi bırak, kapıya yürü, kaybol.
    if (shift === 0) {
      if (s.state === 'offDuty') return;
      if (s.state !== 'leaving') this.startLeaving(s);
      this.followPath(s, dtMin);
      if (s.path.length === 0) s.state = 'offDuty';
      return;
    }

    // Vardiya başladı: kapıdan gir.
    if (s.state === 'offDuty') {
      const gate = this.gateTile();
      s.x = gate.x + 0.5;
      s.y = gate.y + 0.5;
      s.state = 'idle';
      s.energy = Math.max(s.energy, 60);
    }
    if (s.state === 'leaving') s.state = 'idle';

    // Enerji
    const night = sim.clock.isNight() && !s.has('nightOwl');
    const drain = (s.state === 'working' ? BALANCE.staff.energyDrainWorking : BALANCE.staff.energyDrainIdle) * (night ? 1.3 : 1) * (1.2 - s.attrs.stamina * 0.08);
    if (s.state === 'resting') s.energy = clamp100(s.energy + this.restRate(s) * (dtMin / 60));
    else s.energy = clamp100(s.energy - drain * (dtMin / 60));

    const breakBelow = s.has('lazy') ? BALANCE.staff.breakBelowLazy : BALANCE.staff.breakBelow;
    const needsRest = shift === 2 || s.energy < breakBelow;

    switch (s.state) {
      case 'idle':
        if (needsRest) {
          this.goRest(s);
          break;
        }
        if (s.decisionTimer <= 0) {
          s.decisionTimer = BALANCE.staff.decisionIntervalMin;
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
        if (shift === 1 && s.energy >= BALANCE.staff.restUntil) s.state = 'idle';
        break;
      default:
        s.state = 'idle';
    }
  }

  private restRate(s: Staff): number {
    const room = this.sim.buildings.find((b) => b.type === 'staffRoom' && isReady(b));
    if (!room) return BALANCE.staff.restRegenOutside;
    const door = buildingDoorTile(room);
    const near = Math.hypot(s.x - (door.x + 0.5), s.y - (door.y + 0.5)) < 3;
    return near ? BALANCE.staff.restRegenRoom : BALANCE.staff.restRegenOutside;
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
    return findPath(w, from, tile, { region: inside ? w.plot : undefined, maxNodes: 5000, adjacentOk: true });
  }

  private arriveAtTask(s: Staff, task: Task): void {
    const sim = this.sim;
    // Hedef köpek uzaklaştıysa peşine git (birkaç deneme).
    if (task.targetId !== null && task.type !== 'feed') {
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
      dog.stateTimer = this.duration(s, task.type) + 2;
      dog.path = [];
      dog.lastInteractionDay = sim.clock.day;
    }
    s.state = 'working';
    s.taskLeft = this.duration(s, task.type);
    const dx = task.tile.x + 0.5 - s.x;
    const dy = task.tile.y + 0.5 - s.y;
    s.facing = (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) as Facing;
  }

  private duration(s: Staff, type: TaskType): number {
    const base = BALANCE.staff.taskMinutes[type];
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
            sim.stats.treated++;
          } else sim.events.emit('message', t('{name}: ilaç için para yok', { name: s.name }));
        }
        break;
      default:
        break;
    }
    sim.stats.staffTasks++;
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
    const gate = this.gateTile();
    s.path = this.pathTo(s, gate) ?? [];
    s.state = 'leaving';
  }

  private gateTile(): TilePos {
    const w = this.sim.world;
    const p = w.plot;
    const bottom = p.y + p.h - 1;
    for (let x = p.x; x < p.x + p.w; x++) if (w.objectAt(x, bottom) === Obj.Gate) return { x, y: bottom };
    const right = p.x + p.w - 1;
    for (let y = p.y; y < p.y + p.h; y++) if (w.objectAt(right, y) === Obj.Gate) return { x: right, y };
    return { x: Math.floor(w.spawn.x), y: Math.floor(w.spawn.y) };
  }

  private followPath(s: Staff, dtMin: number): void {
    let budget = s.speed() * dtMin;
    while (budget > 0 && s.path.length > 0) {
      const next = s.path[0];
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
