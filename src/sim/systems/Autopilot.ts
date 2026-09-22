import { BALANCE } from '../../config/balance';
import { type Building, buildingDoorTile, isReady } from '../entities/Building';
import type { Dog } from '../entities/Dog';
import type { Sim } from '../Sim';
import type { TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import { incubatorSlots } from './IncubatorSystem';
import { type ActionOutcome, type Tool, nearestDogToBuilding, trainingSkill } from './Interaction';
import type { NavGoal } from './PlayerNav';
import type { Task } from './TaskBoard';
import { t } from '../../i18n';

/** Görev tahtasında otopilotun sahip kimliği (personel kimlikleri pozitif). */
export const PILOT_ID = -1;

/** Tahtadan üstlenilen görev türleri: bakım (0.13.0) + köpek işleri (0.13.1). Yumurta/böğürtlen/uyku tahtada değil (0.13.2). */
const PILOT_TASKS: ReadonlySet<Task['type']> = new Set<Task['type']>(['feed', 'water', 'clean', 'play', 'train', 'groom', 'treat']);

/** Bir işin yürütme planı: nereye gidilecek, hangi araçla (E'nin yapacağı iş araca bağlı). */
interface Plan {
  goal: NavGoal;
  tool?: Tool;
  /** Kare hedefi için varış eylemi (E yerine): true = başarı. Kuluçkaya yumurta koymak, ofiste uyumak. */
  onArrive?: () => boolean;
}

/** Üstlenilen iş: tahtadaki görev ya da tahta dışı iş (task null: sevme, yumurta, böğürtlen, uyku). */
interface Job {
  key: string;
  task: Task | null;
  plan: Plan;
  /** Durum satırı metni ("🤖 Yem kabını dolduruyor"). */
  text: string;
}

/**
 * Oyuncu otopilotu: avatar boştayken görev tahtasından iş seçer, dokun-git ile gider, varınca E yapar. Tahta boşsa
 * sırayla: gece ofiste uyku, çantadaki yumurtayı kuluçkaya koyma, keşfedilmiş yuvadan yumurta / çalıdan böğürtlen,
 * bugün sevilmemiş köpeği sevme. Uzak hedefe dayanıklılık yettiği sürece koşar. Personelle aynı tahtayı kullanır (görevi PILOT_ID ile üstlenir, bitince
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
  /** Koşu histerezisi: eşik üstünde başlar, alt eşikte biter. */
  private running = false;

  constructor(private readonly sim: Sim) {
    sim.events.on('interacted', (e) => {
      if (this.current) this.lastResult = e.result;
    });
  }

  /** İş anahtarı kara listedeyse kalan süre (sn), değilse 0. */
  blockedFor(key: string): number {
    return Math.max(0, (this.blocked.get(key) ?? 0) - this.timeSec);
  }

  /** Durum satırı: otopilot açıkken ne yaptığı; kapalıyken boş. */
  statusText(): string {
    if (!this.sim.autopilot) return '';
    return this.current?.text ?? t('🤖 Otopilot: iş bekliyor');
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
    this.running = false;
  }

  /** Bu karede koşulsun mu: iş var, yol uzun ve dayanıklılık yetiyor (Sim.update nav girdisiyle birleştirir). */
  run(): boolean {
    const A = BALANCE.autopilot;
    const p = this.sim.player;
    if (!this.current || !this.sim.nav.active) return (this.running = false);
    const left = this.sim.nav.path.length;
    if (this.running) this.running = p.stamina > A.runStopStamina && left > 1;
    else this.running = p.stamina > A.runAboveStamina && left > A.runMinTiles;
    return this.running;
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
    const job = this.pickJob() ?? this.sleepJob() ?? this.nurseryEggJob() ?? this.placeEggJob() ?? this.nestJob() ?? this.berryJob() ?? this.idlePet();
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
        best = { key: task.key, task, plan, text: this.textFor(task, plan) };
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
    return best ? { key: `pet:${best.id}`, task: null, plan: { goal: { kind: 'dog', id: best.id }, tool: 'pet' }, text: t("🤖 {name}'i seviyor", { name: best.name }) } : null;
  }

  private isNight(): boolean {
    const h = this.sim.clock.hour;
    return h >= BALANCE.time.sleepFromHour || h < BALANCE.time.nightEndHour;
  }

  /** Oyuncu kapının önünde mi (varış eylemleri yanlış yerde çalışmasın: yol kesilmiş olabilir). */
  private atDoor(door: TilePos): boolean {
    const p = this.sim.player;
    return Math.hypot(p.x - (door.x + 0.5), p.y - (door.y + 0.7)) <= 2;
  }

  private doorJob(key: string, b: Building, text: string, onArrive: () => boolean): Job {
    const door = buildingDoorTile(b);
    return { key, task: null, plan: { goal: { kind: 'tile', tile: door }, onArrive: () => this.atDoor(door) && onArrive() }, text };
  }

  /** Tahta görevinin durum metni. */
  private textFor(task: Task, plan: Plan): string {
    const name = this.taskDog(task)?.name ?? '';
    switch (task.type) {
      case 'feed':
        return t('🤖 Yem kabını dolduruyor');
      case 'water':
        return t('🤖 Yalağı dolduruyor');
      case 'clean':
        return t('🤖 Pisliği temizliyor');
      case 'play':
        return t('🤖 {name} ile oynuyor', { name });
      case 'train':
        return t("🤖 {name}'i eğitiyor", { name });
      case 'groom':
        return plan.goal.kind === 'building' ? t("🤖 {name}'i yıkıyor", { name }) : t("🤖 {name}'i fırçalıyor", { name });
      case 'treat':
        return t("🤖 {name}'i tedavi ediyor", { name });
      default:
        return t('🤖 Otopilot: iş bekliyor');
    }
  }

  /** Gece (sleepFromHour…nightEndHour) ve tahtada sahipsiz yem/su işi yoksa: ofis kapısına git, sabaha kadar uyu. */
  private sleepJob(): Job | null {
    if (!this.isNight() || this.blocked.has('sleep')) return null;
    if (this.sim.tasks.tasks.some((t) => t.claimedBy === null && (t.type === 'feed' || t.type === 'water'))) return null;
    const office = this.sim.buildings.find((b) => b.type === 'office' && isReady(b));
    if (!office) return null;
    return this.doorJob('sleep', office, t('🤖 Ofise uyumaya gidiyor'), () => {
      const r = this.sim.command({ type: 'sleep' });
      if (r.message) this.sim.events.emit('message', r.message);
      return r.ok;
    });
  }

  /** Yuva evinde hazır yumurta varsa ve çantada yer varsa: kapıya git, yumurtayı al (sonra kuluçkaya götürülür). */
  private nurseryEggJob(): Job | null {
    const sim = this.sim;
    if (sim.backpack.length >= sim.backpackSlots()) return null;
    const n = sim.buildings.find((b) => b.type === 'nursery' && isReady(b) && b.eggs.length > 0 && !this.blocked.has(`nursery:${b.id}`));
    if (!n) return null;
    return this.doorJob(`nursery:${n.id}`, n, t('🤖 Yuva evinden yumurta alıyor'), () => sim.command({ type: 'takeNurseryEgg', buildingId: n.id }).ok);
  }

  /** Çantada yumurta ve boş yuvalı hazır kuluçka varsa: kapısına git, sığan yumurtaları koy. */
  private placeEggJob(): Job | null {
    const sim = this.sim;
    if (sim.backpack.length === 0) return null;
    const inc = sim.buildings.find((b) => b.type === 'incubator' && isReady(b) && b.eggs.length < incubatorSlots(b) && !this.blocked.has(`egg:${b.id}`));
    if (!inc) return null;
    return this.doorJob(`egg:${inc.id}`, inc, t('🤖 Yumurtayı kuluçkaya götürüyor'), () => {
      let placed = 0;
      for (const egg of [...sim.backpack]) {
        if (inc.eggs.length >= incubatorSlots(inc)) break;
        if (sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id }).ok) placed++;
      }
      if (placed > 0) sim.events.emit('message', t('Yumurta kuluçkaya kondu'));
      return placed > 0;
    });
  }

  /** Çanta dolu değilse: keşfedilmiş, yumurtalı en yakın yuva (nestRadius içinde). */
  private nestJob(): Job | null {
    const sim = this.sim;
    if (sim.backpack.length >= sim.backpackSlots()) return null;
    const w = sim.world;
    const tile = this.nearestObject(sim.world.nests.filter((n) => w.objectAt(n.x, n.y) === Obj.NestEggs), BALANCE.autopilot.nestRadius, 'nest');
    return tile ? { key: `nest:${w.idx(tile.x, tile.y)}`, task: null, plan: { goal: { kind: 'object', tile } }, text: t('🤖 Yuvadan yumurta alıyor') } : null;
  }

  /** Ödül maması dolu değilse: keşfedilmiş en yakın böğürtlen çalısı (bushRadius içinde, oyuncunun çevresi taranır). */
  private berryJob(): Job | null {
    const sim = this.sim;
    if (sim.treats >= BALANCE.eggs.treatsMax) return null;
    const w = sim.world;
    const p = sim.player;
    const R = BALANCE.autopilot.bushRadius;
    const cands: TilePos[] = [];
    for (let y = p.tileY - R; y <= p.tileY + R; y++) {
      for (let x = p.tileX - R; x <= p.tileX + R; x++) {
        if (w.inBounds(x, y) && w.objectAt(x, y) === Obj.BerryBush) cands.push({ x, y });
      }
    }
    const tile = this.nearestObject(cands, R, 'bush');
    return tile ? { key: `bush:${w.idx(tile.x, tile.y)}`, task: null, plan: { goal: { kind: 'object', tile } }, text: t('🤖 Böğürtlen topluyor') } : null;
  }

  /** Keşfedilmiş, kara listede olmayan, yarıçap içindeki en yakın kare. */
  private nearestObject(tiles: TilePos[], radius: number, prefix: string): TilePos | null {
    const w = this.sim.world;
    const p = this.sim.player;
    let best: TilePos | null = null;
    let bestD = radius;
    for (const tile of tiles) {
      const i = w.idx(tile.x, tile.y);
      if (!w.explored[i] || this.blocked.has(`${prefix}:${i}`)) continue;
      const d = Math.hypot(tile.x + 0.5 - p.x, tile.y + 0.5 - p.y);
      if (d < bestD) {
        bestD = d;
        best = tile;
      }
    }
    return best;
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
    const ok = job.plan.onArrive ? job.plan.onArrive() : this.lastResult?.ok === true;
    this.current = null;
    this.lastResult = null;
    this.running = false;
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
