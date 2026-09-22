import { BALANCE } from '../../config/balance';
import { type Building, isReady } from '../entities/Building';
import type { Dog } from '../entities/Dog';
import type { Sim } from '../Sim';
import { type ActionOutcome, type Tool, nearestDogToBuilding, trainingSkill } from './Interaction';
import type { NavGoal } from './PlayerNav';
import type { Task } from './TaskBoard';
import { t } from '../../i18n';

/** Görev tahtasında otopilotun sahip kimliği (personel kimlikleri pozitif). */
export const PILOT_ID = -1;

/** Üstlenilen görev türleri: bakım (0.13.0) + köpek işleri (0.13.1). Yumurta ve uyku sonraki sürümde. */
const PILOT_TASKS: ReadonlySet<Task['type']> = new Set<Task['type']>(['feed', 'water', 'clean', 'play', 'train', 'groom', 'treat']);

/** Bir işin yürütme planı: nereye gidilecek, hangi araçla (E'nin yapacağı iş araca bağlı). */
interface Plan {
  goal: NavGoal;
  tool?: Tool;
}

/** Üstlenilen iş: tahtadaki görev ya da boşta sevme (task null). */
interface Job {
  key: string;
  task: Task | null;
  plan: Plan;
}

/**
 * Oyuncu otopilotu: avatar boştayken görev tahtasından iş seçer, dokun-git ile gider, varınca E yapar; iş yoksa bugün
 * sevilmemiş en düşük sadakatli köpeği sever. Personelle aynı tahtayı kullanır (görevi PILOT_ID ile üstlenir, bitince
 * düşürür ya da bırakır); elle girdi otopilotu kapatır (Sim.update ve UI komutları). Phaser'sız, test edilebilir.
 */
export class Autopilot {
  /** Üstlenilen iş; yürüyüş ve varış bitene kadar tutulur. */
  current: Job | null = null;
  private lastResult: ActionOutcome | null = null;
  /** Gerçek zaman sayacı (saniye); bekleme ve kara liste bununla ölçülür. */
  private timeSec = 0;
  private nextCheckAt = 0;
  /** Başarısız hedefler: iş anahtarı → yeniden denenebileceği an. */
  private readonly blocked = new Map<string, number>();

  constructor(private readonly sim: Sim) {
    sim.events.on('interacted', (e) => {
      if (this.current) this.lastResult = e.result;
    });
  }

  /** İş anahtarı kara listedeyse kalan süre (sn), değilse 0. */
  blockedFor(key: string): number {
    return Math.max(0, (this.blocked.get(key) ?? 0) - this.timeSec);
  }

  /** Açılınca ilk kontrol hemen yapılır. */
  wake(): void {
    this.nextCheckAt = 0;
  }

  /** Üstlenilen işi ceza vermeden bırakır (mod değişimi, kapatma). */
  abandon(): void {
    if (this.current?.task) {
      const live = this.sim.tasks.byId(this.current.task.id);
      if (live) this.sim.tasks.release(live);
    }
    this.current = null;
    this.lastResult = null;
  }

  /** Kapatma: işi bırak, yürüyüşü durdur. */
  stop(): void {
    this.abandon();
    this.sim.nav.cancel();
  }

  /** Her karede (Sim.update, avatar dalı). */
  tick(dtSec: number): void {
    this.timeSec += dtSec;
    const sim = this.sim;
    if (!sim.autopilot || sim.mode !== 'avatar') return;
    if (this.current) {
      if (sim.nav.active) return; // yürüyor
      this.finish(); // vardı (interacted geldi) ya da yol kesildi
      return;
    }
    if (sim.player.busy > 0 || sim.nav.active) return;
    if (this.timeSec < this.nextCheckAt) return;
    this.nextCheckAt = this.timeSec + BALANCE.autopilot.idleRecheckSec;
    if (this.tryOrderFood()) return;
    const job = this.pickJob() ?? this.idlePet();
    if (job) this.start(job);
  }

  /** Kiler boş, kaplar yarıdan az ve para varsa bir çuval sipariş eder. */
  private tryOrderFood(): boolean {
    const sim = this.sim;
    if (sim.foodStock > 0) return false;
    const needy = sim.buildings.some((b) => b.type === 'bowl' && isReady(b) && b.food < sim.bowlCapacity(b) * 0.5);
    if (!needy || sim.money < sim.foodBagPrice()) return false;
    if (!sim.command({ type: 'orderFood', bags: 1 }).ok) return false;
    sim.events.emit('message', t('🤖 Yem bitti: 1 çuval sipariş edildi'));
    this.nextCheckAt = this.timeSec + BALANCE.autopilot.orderWaitSec;
    return true;
  }

  /** En iyi sahipsiz, yapılabilir görev: aciliyet / mesafe. Uygun olmayan (uyuyan köpek, klinik yok) atlanır, ceza yok. */
  private pickJob(): Job | null {
    const p = this.sim.player;
    let best: Job | null = null;
    let bestScore = 0;
    for (const [key, until] of this.blocked) if (until <= this.timeSec) this.blocked.delete(key);
    for (const task of this.sim.tasks.tasks) {
      if (task.claimedBy !== null || !PILOT_TASKS.has(task.type) || this.blocked.has(task.key)) continue;
      const plan = this.planFor(task);
      if (!plan) continue;
      const dist = Math.hypot(task.tile.x + 0.5 - p.x, task.tile.y + 0.5 - p.y);
      const score = task.urgency / (1 + dist / 20);
      if (score > bestScore) {
        bestScore = score;
        best = { key: task.key, task, plan };
      }
    }
    return best;
  }

  /** İş yoksa: bugün sevilmemiş, uyanık, en düşük sadakatli barınak köpeği. */
  private idlePet(): Job | null {
    let best: Dog | null = null;
    for (const d of this.sim.shelterDogs()) {
      if (d.petsToday > 0 || d.isAsleep() || d.walking || this.blocked.has(`pet:${d.id}`)) continue;
      if (!best || d.needs.loyalty < best.needs.loyalty) best = d;
    }
    return best ? { key: `pet:${best.id}`, task: null, plan: { goal: { kind: 'dog', id: best.id }, tool: 'pet' } } : null;
  }

  private taskDog(task: Task): Dog | null {
    const d = task.targetId === null ? undefined : this.sim.dogById(task.targetId);
    return d && !d.wild && !d.walking ? d : null;
  }

  /** Köpeğin yanındaki hazır istasyon (tımar/klinik): E orada bu köpeğe uygulanır. */
  private stationFor(dog: Dog, type: Building['type']): Building | null {
    const R = BALANCE.dogs.stationRadius;
    return this.sim.buildings.find((b) => b.type === type && isReady(b) && nearestDogToBuilding(this.sim, b, R)?.id === dog.id) ?? null;
  }

  private planFor(task: Task): Plan | null {
    const D = BALANCE.dogs;
    switch (task.type) {
      case 'feed':
      case 'water':
        return task.targetId === null ? null : { goal: { kind: 'building', id: task.targetId } };
      case 'clean':
        return { goal: { kind: 'object', tile: task.tile } };
      case 'play': {
        const d = this.taskDog(task);
        if (!d || d.isAsleep() || d.needs.energy < D.playMinEnergy) return null;
        return { goal: { kind: 'dog', id: d.id }, tool: 'play' };
      }
      case 'train': {
        const d = this.taskDog(task);
        if (!d || d.isAsleep() || d.needs.energy < D.trainMinEnergy || !trainingSkill(d)) return null;
        return { goal: { kind: 'dog', id: d.id }, tool: 'train' };
      }
      case 'groom': {
        const d = this.taskDog(task);
        if (!d) return null;
        const station = this.stationFor(d, 'groomStation');
        if (station) return { goal: { kind: 'building', id: station.id } }; // yıkama: tam temizlik
        return d.needs.hygiene >= 95 ? null : { goal: { kind: 'dog', id: d.id }, tool: 'clean' }; // fırçalama
      }
      case 'treat': {
        const d = this.taskDog(task);
        if (!d || this.sim.money < BALANCE.economy.treatmentPrice) return null;
        const clinic = this.stationFor(d, 'vetClinic');
        return clinic ? { goal: { kind: 'building', id: clinic.id } } : null;
      }
      default:
        return null;
    }
  }

  private start(job: Job): void {
    const sim = this.sim;
    if (job.task) sim.tasks.claim(job.task, PILOT_ID);
    if (job.plan.tool && sim.tool !== job.plan.tool) sim.command({ type: 'setTool', tool: job.plan.tool });
    this.current = job;
    this.lastResult = null;
    if (!sim.nav.goInteract(job.plan.goal)) this.finish(); // yol yok: bırak ve bir süre deneme
  }

  /** Yürüyüş bitti: iş yapıldıysa görev düşer, yoksa bırakılıp kara listeye girer. */
  private finish(): void {
    const job = this.current;
    if (!job) return;
    const ok = this.lastResult?.ok === true;
    this.current = null;
    this.lastResult = null;
    const live = job.task ? this.sim.tasks.byId(job.task.id) : undefined;
    if (ok) {
      if (live) this.sim.tasks.remove(live);
      this.nextCheckAt = 0; // sıradaki işe hemen bak
      return;
    }
    if (live) this.sim.tasks.release(live);
    this.blocked.set(job.key, this.timeSec + BALANCE.autopilot.failCooldownSec);
  }
}
