import { BALANCE } from '../../config/balance';
import { isReady } from '../entities/Building';
import type { Staff, TaskType } from '../entities/Staff';
import type { TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import type { Sim } from '../Sim';

export interface Task {
  id: number;
  type: TaskType;
  /** Köpek ya da bina id'si; pislik için null. */
  targetId: number | null;
  tile: TilePos;
  urgency: number;
  claimedBy: number | null;
  /** Oluşturulduğu an (toplam dakika); darboğaz uyarısı için. */
  createdAt: number;
  key: string;
}

/**
 * Görev tahtası: barınağın ihtiyaçlarından görev listesi üretir, personel buradan iş seçer.
 * Aynı iş aynı anda iki kişiye gitmez; oyuncu işi yaparsa görev kendiliğinden düşer.
 */
export class TaskBoard {
  tasks: Task[] = [];
  private nextTaskId = 1;

  constructor(private readonly sim: Sim) {}

  /** Her sim dakikasında: geçerliliğini yitirenleri at, yenilerini ekle. */
  refresh(): void {
    const sim = this.sim;
    const now = sim.clock.totalMinutes;
    const wanted = new Map<string, Omit<Task, 'id' | 'claimedBy' | 'createdAt'>>();
    const B = BALANCE.staff;
    const dogs = sim.shelterDogs();
    const hungry = dogs.filter((d) => d.needs.hunger >= 55).length;
    const meal = sim.clock.isMealTime();

    for (const b of sim.buildings) {
      if (b.type !== 'bowl' || !isReady(b)) continue;
      const cap = sim.bowlCapacity(b);
      if (b.food >= cap * 0.5 || sim.foodStock <= 0) continue;
      const urgency = Math.min(1, 0.45 + (meal ? 0.35 : 0) + hungry * 0.06 + (b.food <= 0 ? 0.1 : 0));
      wanted.set(`feed:${b.id}`, { type: 'feed', targetId: b.id, tile: { x: b.x, y: b.y }, urgency, key: `feed:${b.id}` });
    }
    const thirsty = dogs.filter((d) => d.needs.thirst >= BALANCE.dogs.drinkAboveThirst).length;
    for (const b of sim.buildings) {
      if (b.type !== 'trough' || !isReady(b)) continue;
      const cap = sim.troughCapacity();
      if (b.water >= cap * 0.4) continue;
      const urgency = Math.min(1, 0.4 + thirsty * 0.06 + (b.water <= 0 ? 0.15 : 0));
      wanted.set(`water:${b.id}`, { type: 'water', targetId: b.id, tile: { x: b.x, y: b.y }, urgency, key: `water:${b.id}` });
    }
    const messCount = sim.messTiles.size;
    for (const i of sim.messTiles) {
      const x = i % sim.world.width;
      const y = Math.floor(i / sim.world.width);
      if (sim.world.objectAt(x, y) !== Obj.Mess) continue;
      wanted.set(`clean:${i}`, { type: 'clean', targetId: null, tile: { x, y }, urgency: Math.min(1, 0.4 + messCount * 0.1), key: `clean:${i}` });
    }
    for (const d of dogs) {
      const tile = { x: d.tileX, y: d.tileY };
      if (d.needs.play < B.playBelow && !d.isAsleep()) {
        wanted.set(`play:${d.id}`, { type: 'play', targetId: d.id, tile, urgency: ((B.playBelow - d.needs.play) / B.playBelow) * 0.8, key: `play:${d.id}` });
      }
      if (d.trainingLevel() < sim.policies.trainTarget && d.needs.energy >= BALANCE.dogs.trainMinEnergy && !d.isAsleep()) {
        wanted.set(`train:${d.id}`, { type: 'train', targetId: d.id, tile, urgency: 0.3, key: `train:${d.id}` });
      }
      if (d.needs.hygiene < B.groomBelow) {
        wanted.set(`groom:${d.id}`, { type: 'groom', targetId: d.id, tile, urgency: (B.groomBelow - d.needs.hygiene) / B.groomBelow, key: `groom:${d.id}` });
      }
      if (d.needs.health < B.treatBelow) {
        wanted.set(`treat:${d.id}`, { type: 'treat', targetId: d.id, tile, urgency: 0.7 + ((B.treatBelow - d.needs.health) / B.treatBelow) * 0.3, key: `treat:${d.id}` });
      }
    }

    // Var olanları güncelle, olmayanları at.
    const kept: Task[] = [];
    for (const t of this.tasks) {
      const w = wanted.get(t.key);
      if (!w) continue;
      t.urgency = w.urgency;
      if (t.claimedBy === null) t.tile = w.tile;
      kept.push(t);
      wanted.delete(t.key);
    }
    for (const w of wanted.values()) kept.push({ ...w, id: this.nextTaskId++, claimedBy: null, createdAt: now });
    this.tasks = kept;
  }

  byId(id: number): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  /** Personel için en iyi görev: aciliyet × verim × öncelik / mesafe. */
  bestFor(staff: Staff): Task | null {
    let best: Task | null = null;
    let bestScore = 0;
    for (const t of this.tasks) {
      if (t.claimedBy !== null) continue;
      const prio = staff.priorities[t.type];
      const eff = staff.efficiency(t.type);
      if (prio <= 0 || eff <= 0) continue;
      const dist = Math.hypot(t.tile.x + 0.5 - staff.x, t.tile.y + 0.5 - staff.y);
      const score = (t.urgency * eff * (prio / 3)) / (1 + dist / 20);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  claim(task: Task, staffId: number): void {
    task.claimedBy = staffId;
  }

  release(task: Task): void {
    task.claimedBy = null;
  }

  remove(task: Task): void {
    this.tasks = this.tasks.filter((t) => t.id !== task.id);
  }

  releaseAll(staffId: number): void {
    for (const t of this.tasks) if (t.claimedBy === staffId) t.claimedBy = null;
  }

  /** En uzun süredir bekleyen sahipsiz görev (dakika). */
  longestWait(): { task: Task; minutes: number } | null {
    const now = this.sim.clock.totalMinutes;
    let best: Task | null = null;
    for (const t of this.tasks) {
      if (t.claimedBy !== null) continue;
      if (!best || t.createdAt < best.createdAt) best = t;
    }
    return best ? { task: best, minutes: now - best.createdAt } : null;
  }
}
