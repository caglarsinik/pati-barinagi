import { BALANCE } from '../../config/balance';
import { isReady } from '../entities/Building';
import type { Sim } from '../Sim';
import type { ActionOutcome } from './Interaction';
import type { NavGoal } from './PlayerNav';
import type { Task } from './TaskBoard';
import { t } from '../../i18n';

/** Görev tahtasında otopilotun sahip kimliği (personel kimlikleri pozitif). */
export const PILOT_ID = -1;

/** Bu sürümde üstlenilen görev türleri: bakım. Köpek işleri, yumurta ve uyku sonraki sürümlerde. */
const PILOT_TASKS: ReadonlySet<Task['type']> = new Set<Task['type']>(['feed', 'water', 'clean']);

/**
 * Oyuncu otopilotu: avatar boştayken görev tahtasından bakım işi seçer, dokun-git ile gider, varınca E yapar.
 * Personelle aynı tahtayı kullanır (görevi PILOT_ID ile üstlenir, bitince düşürür ya da bırakır); elle girdi otopilotu
 * kapatır (Sim.update ve UI komutları). Phaser'sız, test edilebilir.
 */
export class Autopilot {
  /** Üstlenilen görev; yürüyüş ve varış bitene kadar tutulur. */
  current: Task | null = null;
  private lastResult: ActionOutcome | null = null;
  /** Gerçek zaman sayacı (saniye); bekleme ve kara liste bununla ölçülür. */
  private timeSec = 0;
  private nextCheckAt = 0;
  /** Başarısız hedefler: görev anahtarı → yeniden denenebileceği an. */
  private readonly blocked = new Map<string, number>();

  constructor(private readonly sim: Sim) {
    sim.events.on('interacted', (e) => {
      if (this.current) this.lastResult = e.result;
    });
  }

  /** Görev anahtarı kara listedeyse kalan süre (sn), değilse 0. */
  blockedFor(key: string): number {
    return Math.max(0, (this.blocked.get(key) ?? 0) - this.timeSec);
  }

  /** Açılınca ilk kontrol hemen yapılır. */
  wake(): void {
    this.nextCheckAt = 0;
  }

  /** Üstlenilen görevi ceza vermeden bırakır (mod değişimi, kapatma). */
  abandon(): void {
    if (this.current) {
      const live = this.sim.tasks.byId(this.current.id);
      if (live) this.sim.tasks.release(live);
    }
    this.current = null;
    this.lastResult = null;
  }

  /** Kapatma: görevi bırak, yürüyüşü durdur. */
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
    const task = this.pickTask();
    if (task) this.startTask(task);
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

  /** En iyi sahipsiz bakım görevi: aciliyet / mesafe. */
  private pickTask(): Task | null {
    const p = this.sim.player;
    let best: Task | null = null;
    let bestScore = 0;
    for (const [key, until] of this.blocked) if (until <= this.timeSec) this.blocked.delete(key);
    for (const task of this.sim.tasks.tasks) {
      if (task.claimedBy !== null || !PILOT_TASKS.has(task.type) || this.blocked.has(task.key)) continue;
      const dist = Math.hypot(task.tile.x + 0.5 - p.x, task.tile.y + 0.5 - p.y);
      const score = task.urgency / (1 + dist / 20);
      if (score > bestScore) {
        bestScore = score;
        best = task;
      }
    }
    return best;
  }

  private goalFor(task: Task): NavGoal | null {
    if (task.type === 'clean') return { kind: 'object', tile: task.tile };
    return task.targetId === null ? null : { kind: 'building', id: task.targetId };
  }

  private startTask(task: Task): void {
    this.sim.tasks.claim(task, PILOT_ID);
    this.current = task;
    this.lastResult = null;
    const goal = this.goalFor(task);
    if (!goal || !this.sim.nav.goInteract(goal)) this.finish(); // yol yok: bırak ve bir süre deneme
  }

  /** Yürüyüş bitti: iş yapıldıysa görev düşer, yoksa bırakılıp kara listeye girer. */
  private finish(): void {
    const task = this.current;
    if (!task) return;
    const ok = this.lastResult?.ok === true;
    this.current = null;
    this.lastResult = null;
    const live = this.sim.tasks.byId(task.id);
    if (ok) {
      if (live) this.sim.tasks.remove(live);
      this.nextCheckAt = 0; // sıradaki işe hemen bak
      return;
    }
    if (live) this.sim.tasks.release(live);
    this.blocked.set(task.key, this.timeSec + BALANCE.autopilot.failCooldownSec);
  }
}
