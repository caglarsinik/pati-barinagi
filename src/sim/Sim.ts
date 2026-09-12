import { BALANCE, type Speed } from '../config/balance';
import { BUILDING_DEFS, type BuildingType } from '../content/buildings';
import { DOG_NAMES } from '../content/names';
import { GAME } from '../config/game';
import { Clock } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import { Rng, hash2 } from '../core/Rng';
import type { SaveData } from '../core/SaveManager';
import {
  type Building,
  type BuildingSave,
  buildingDef,
  canPlaceBuilding,
  kennelRestTile,
  stampBuilding,
  unstampBuilding,
} from './entities/Building';
import { Dog, type DogOrigin, type SkillKey, SKILL_KEYS } from './entities/Dog';
import { type DogGenome, randomGenome } from './entities/DogGenome';
import { IDLE_INPUT, Player, type PlayerInput } from './entities/Player';
import { AlertSystem } from './systems/AlertSystem';
import { DogBrain } from './systems/DogBrain';
import { type ActionOutcome, TOOL_DEFS, type Tool, performAction } from './systems/Interaction';
import { rebuildMessSet } from './systems/MessSystem';
import { NeedsSystem } from './systems/NeedsSystem';
import type { TileWorld } from './world/TileWorld';
import { generateWorld } from './world/WorldGen';
import { Ground, Obj, Zone } from './world/tiles';

export type Mode = 'avatar' | 'manage';

export interface SimEvents extends Record<string, unknown> {
  /** Saat başı geçildi (0-23). */
  hour: number;
  /** Yeni gün başladı (1 tabanlı). */
  day: number;
  /** Hafta tiki (Pazartesi 06:00), 1 tabanlı hafta numarası. */
  week: number;
  modeChanged: Mode;
  speedChanged: Speed;
  toolChanged: Tool;
  dogAdded: Dog;
  dogRemoved: number;
  buildingAdded: Building;
  buildingRemoved: number;
  /** Oyuncuya kısa bildirim. */
  message: string;
}

export type Command =
  | { type: 'interact' }
  | { type: 'setTool'; tool: Tool }
  | { type: 'renameDog'; id: number; name: string }
  | { type: 'orderFood'; bags: number }
  | { type: 'setTrainingFocus'; id: number; skill: SkillKey | null }
  | { type: 'assignKennel'; dogId: number; buildingId: number | null };

export interface SimStats {
  cleaned: number;
  fed: number;
  played: number;
  petted: number;
  trained: number;
  groomed: number;
  messes: number;
}

/**
 * Oyunun tamamı: dünya, saat, oyuncu, köpekler, binalar ve sistemler.
 * Phaser'dan bağımsızdır; testler bunu doğrudan kurup koşturur.
 */
export class Sim {
  readonly seed: number;
  readonly rng: Rng;
  readonly clock: Clock;
  readonly world: TileWorld;
  readonly player: Player;
  readonly events = new EventBus<SimEvents>();
  readonly needs: NeedsSystem;
  readonly brain: DogBrain;
  readonly alerts: AlertSystem;
  speed: Speed = 1;
  mode: Mode = 'avatar';
  money: number;
  tool: Tool = 'pet';
  dogs: Dog[] = [];
  buildings: Building[] = [];
  foodStock = 0;
  messTiles = new Set<number>();
  stats: SimStats = { cleaned: 0, fed: 0, played: 0, petted: 0, trained: 0, groomed: 0, messes: 0 };
  nextId = 1;
  private lastRunningSpeed: Speed = 1;
  private minuteAcc = 0;
  private dogMap = new Map<number, Dog>();
  private buildingMap = new Map<number, Building>();

  private constructor(seed: number, world: TileWorld, clock: Clock, player: Player, money: number) {
    this.seed = seed;
    this.rng = new Rng(hash2(seed, 0xa11ce));
    this.world = world;
    this.clock = clock;
    this.player = player;
    this.money = money;
    this.needs = new NeedsSystem(this);
    this.brain = new DogBrain(this);
    this.alerts = new AlertSystem(this);
    this.events.on('day', (d) => this.needs.onDay(d));
    this.events.on('week', () => this.onWeek());
  }

  static create(seed: number): Sim {
    const world = generateWorld(seed);
    const player = new Player(world.spawn.x, world.spawn.y);
    const sim = new Sim(seed, world, new Clock(), player, BALANCE.economy.startMoney);
    sim.setupStarterShelter();
    sim.alerts.refresh();
    return sim;
  }

  get paused(): boolean {
    return this.speed === 0;
  }

  // ---------------------------------------------------------------------------
  // Döngü
  // ---------------------------------------------------------------------------

  /** Gerçek zamanlı bir kare ilerletir. Oyuncu hareketi gerçek zamanlı, saat oyun hızıyla ölçekli. */
  update(dtSec: number, input: PlayerInput = IDLE_INPUT): void {
    if (this.paused || dtSec <= 0) return;
    const dtMin = dtSec * BALANCE.time.minutesPerRealSecond * this.speed;
    const crossed = this.clock.advance(dtMin);
    for (const h of crossed.hours) this.events.emit('hour', h);
    for (const d of crossed.days) this.events.emit('day', d);
    for (const w of crossed.weeks) this.events.emit('week', w);
    this.needs.update(dtMin);
    this.brain.update(dtMin);
    if (this.mode === 'avatar') this.player.update(dtSec, input, this.world);
    this.minuteAcc += dtMin;
    if (this.minuteAcc >= 1) {
      this.minuteAcc %= 1;
      this.alerts.refresh();
    }
  }

  /** Hafta tiki: köpekler bir hafta yaşlanır (aşama atlayabilir). */
  private onWeek(): void {
    for (const dog of this.dogs) dog.ageWeeks++;
  }

  // ---------------------------------------------------------------------------
  // Komutlar (UI ve sahne buradan konuşur)
  // ---------------------------------------------------------------------------

  command(cmd: Command): ActionOutcome {
    switch (cmd.type) {
      case 'interact':
        return performAction(this);
      case 'setTool':
        if (TOOL_DEFS.some((t) => t.id === cmd.tool) && cmd.tool !== this.tool) {
          this.tool = cmd.tool;
          this.events.emit('toolChanged', cmd.tool);
        }
        return { ok: true };
      case 'renameDog': {
        const dog = this.dogById(cmd.id);
        const name = cmd.name.trim().slice(0, 16);
        if (!dog || !name) return { ok: false };
        dog.name = name;
        return { ok: true };
      }
      case 'orderFood': {
        const bags = Math.max(1, Math.floor(cmd.bags));
        const cost = bags * BALANCE.economy.foodBagPrice;
        if (this.money < cost) return { ok: false, message: 'Yeterli para yok' };
        this.money -= cost;
        this.foodStock += bags * BALANCE.economy.foodBagPortions;
        return { ok: true, message: `${bags} çuval yem geldi (${cost} ${BALANCE.economy.currency})` };
      }
      case 'setTrainingFocus': {
        const dog = this.dogById(cmd.id);
        if (!dog) return { ok: false };
        dog.trainingFocus = cmd.skill && SKILL_KEYS.includes(cmd.skill) ? cmd.skill : null;
        return { ok: true };
      }
      case 'assignKennel': {
        const dog = this.dogById(cmd.dogId);
        if (!dog) return { ok: false };
        if (cmd.buildingId === null) {
          this.assignKennel(dog, null);
          return { ok: true };
        }
        const kennel = this.buildingById(cmd.buildingId);
        if (!kennel || !this.kennelHasRoom(kennel, dog)) return { ok: false, message: 'Kulübede yer yok' };
        this.assignKennel(dog, kennel);
        return { ok: true };
      }
      default:
        return { ok: false };
    }
  }

  setSpeed(s: Speed): void {
    if (s === this.speed) return;
    if (s !== 0) this.lastRunningSpeed = s;
    this.speed = s;
    this.events.emit('speedChanged', s);
  }

  togglePause(): void {
    this.setSpeed(this.paused ? this.lastRunningSpeed : 0);
  }

  /** +1 hızlandır, -1 yavaşlat (1x'ten aşağısı duraklatır). */
  changeSpeed(dir: 1 | -1): void {
    const speeds = BALANCE.time.speeds;
    const idx = speeds.indexOf(this.speed);
    const next = Math.min(speeds.length - 1, Math.max(0, idx + dir));
    this.setSpeed(speeds[next]);
  }

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.events.emit('modeChanged', mode);
  }

  toggleMode(): void {
    this.setMode(this.mode === 'avatar' ? 'manage' : 'avatar');
  }

  // ---------------------------------------------------------------------------
  // Köpekler
  // ---------------------------------------------------------------------------

  dogById(id: number): Dog | undefined {
    return this.dogMap.get(id);
  }

  addDog(genome: DogGenome, origin: DogOrigin, ageWeeks: number, x: number, y: number, name?: string): Dog {
    const dog = new Dog(this.nextId++, name ?? this.pickName(), genome, origin, ageWeeks, x, y);
    this.registerDog(dog);
    const kennel = this.freeKennelFor(dog);
    if (kennel) this.assignKennel(dog, kennel);
    this.events.emit('dogAdded', dog);
    return dog;
  }

  private registerDog(dog: Dog): void {
    this.dogs.push(dog);
    this.dogMap.set(dog.id, dog);
  }

  removeDog(id: number): boolean {
    const dog = this.dogMap.get(id);
    if (!dog) return false;
    this.assignKennel(dog, null);
    this.dogs = this.dogs.filter((d) => d.id !== id);
    this.dogMap.delete(id);
    this.events.emit('dogRemoved', id);
    return true;
  }

  pickName(): string {
    const used = new Set(this.dogs.map((d) => d.name));
    const free = DOG_NAMES.filter((n) => !used.has(n));
    if (free.length > 0) return this.rng.pick(free);
    return `${this.rng.pick(DOG_NAMES)} ${this.dogs.length + 1}`;
  }

  kennelHasRoom(kennel: Building, dog: Dog): boolean {
    const def = buildingDef(kennel);
    if (def.capacity === undefined) return false;
    if (kennel.occupants.includes(dog.id)) return true;
    if (kennel.occupants.length >= def.capacity) return false;
    if (dog.genome.size === 'L' && kennel.type === 'kennelSmall') return false;
    return true;
  }

  freeKennelFor(dog: Dog): Building | null {
    for (const b of this.buildings) {
      if (b.type !== 'kennelSmall' && b.type !== 'kennelLarge') continue;
      if (this.kennelHasRoom(b, dog)) return b;
    }
    return null;
  }

  assignKennel(dog: Dog, kennel: Building | null): void {
    if (dog.kennelId !== null) {
      const old = this.buildingMap.get(dog.kennelId);
      if (old) old.occupants = old.occupants.filter((id) => id !== dog.id);
      dog.kennelId = null;
    }
    if (kennel) {
      if (!kennel.occupants.includes(dog.id)) kennel.occupants.push(dog.id);
      dog.kennelId = kennel.id;
    }
  }

  /** Kulübe kapasitesi toplamı. */
  kennelCapacity(): number {
    let n = 0;
    for (const b of this.buildings) n += buildingDef(b).capacity ?? 0;
    return n;
  }

  // ---------------------------------------------------------------------------
  // Binalar
  // ---------------------------------------------------------------------------

  buildingById(id: number): Building | undefined {
    return this.buildingMap.get(id);
  }

  placeBuilding(type: BuildingType, x: number, y: number): Building | null {
    if (!canPlaceBuilding(this.world, type, x, y)) return null;
    const b: Building = { id: this.nextId++, type, x, y, food: 0, occupants: [] };
    this.buildings.push(b);
    this.buildingMap.set(b.id, b);
    stampBuilding(this.world, b);
    this.events.emit('buildingAdded', b);
    return b;
  }

  removeBuilding(id: number): boolean {
    const b = this.buildingMap.get(id);
    if (!b) return false;
    for (const dogId of [...b.occupants]) {
      const dog = this.dogMap.get(dogId);
      if (dog) this.assignKennel(dog, null);
    }
    unstampBuilding(this.world, b);
    this.buildings = this.buildings.filter((x) => x.id !== id);
    this.buildingMap.delete(id);
    this.events.emit('buildingRemoved', id);
    return true;
  }

  /** Yeni oyunda hazır gelen küçük barınak. */
  private setupStarterShelter(): void {
    const w = this.world;
    const p = w.plot;
    const x0 = p.x;
    const y0 = p.y;
    const x1 = p.x + p.w - 1;
    const y1 = p.y + p.h - 1;
    for (let x = x0; x <= x1; x++) {
      w.setObject(x, y0, Obj.Fence);
      w.setObject(x, y1, Obj.Fence);
    }
    for (let y = y0; y <= y1; y++) {
      w.setObject(x0, y, Obj.Fence);
      w.setObject(x1, y, Obj.Fence);
    }
    const gateX = Math.floor(p.x + p.w / 2);
    const gateY = Math.floor(p.y + p.h / 2);
    for (const [gx, gy] of [
      [gateX, y1],
      [gateX + 1, y1],
      [x1, gateY],
      [x1, gateY + 1],
    ]) {
      w.setObject(gx, gy, Obj.Gate);
      w.setGround(gx, gy, Ground.Path);
    }
    // Kapıdan ofise kısa yol
    for (let y = y1 - 1; y > y0 + 6; y--) {
      w.setGround(gateX, y, Ground.Path);
      w.setGround(gateX + 1, y, Ground.Path);
    }

    const place = (type: BuildingType, dx: number, dy: number): Building => {
      const b = this.placeBuilding(type, x0 + dx, y0 + dy);
      if (!b) throw new Error(`Başlangıç binası yerleşmedi: ${type} @ ${dx},${dy}`);
      return b;
    };
    place('office', 19, 2);
    place('kennelSmall', 4, 5);
    place('kennelSmall', 8, 5);
    place('shed', 30, 3);
    const bowl = place('bowl', 6, 9);
    place('trough', 8, 9);
    place('incubator', 14, 4);
    place('toyBall', 23, 12);
    place('bin', 33, 6);
    bowl.food = BALANCE.shelter.startBowlFood;
    this.foodStock = BALANCE.shelter.startFoodPortions;

    for (let y = y0 + 20; y < y0 + 25; y++) for (let x = x0 + 30; x < x0 + 36; x++) w.setZone(x, y, Zone.Toilet);

    const genome = randomGenome(this.rng.fork(1), 'common');
    genome.size = genome.size === 'L' ? 'M' : genome.size;
    this.addDog(genome, 'egg', 20, x0 + 10.5, y0 + 11.5);
    w.dirty = [];
  }

  // ---------------------------------------------------------------------------
  // Kayıt
  // ---------------------------------------------------------------------------

  toJSON(): SaveData {
    const p = this.world.plot;
    const plotObjects: number[] = [];
    const plotZones: number[] = [];
    const plotGround: number[] = [];
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        const i = this.world.idx(x, y);
        plotObjects.push(this.world.object[i]);
        plotZones.push(this.world.zone[i]);
        plotGround.push(this.world.ground[i]);
      }
    }
    return {
      version: GAME.saveVersion,
      savedAt: Date.now(),
      seed: this.seed,
      clock: this.clock.toJSON(),
      player: this.player.toJSON(),
      speed: this.speed,
      mode: this.mode,
      money: this.money,
      tool: this.tool,
      foodStock: this.foodStock,
      nextId: this.nextId,
      stats: { ...this.stats },
      plot: { ...p },
      plotObjects,
      plotZones,
      plotGround,
      buildings: this.buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y, food: b.food, occupants: [...b.occupants] })),
      dogs: this.dogs.map((d) => d.toJSON()),
    };
  }

  /** Doğrulayarak yükler: bozuk alanlar varsayılana döner, imkânsız konumlar düzeltilir. */
  static fromJSON(data: SaveData): Sim {
    const world = generateWorld(data.seed >>> 0);
    const clock = Clock.fromJSON(data.clock);
    const player = Player.fromJSON(data.player, world.spawn);
    const money = typeof data.money === 'number' && Number.isFinite(data.money) ? data.money : BALANCE.economy.startMoney;
    const sim = new Sim(data.seed >>> 0, world, clock, player, money);
    const speeds = BALANCE.time.speeds as readonly number[];
    sim.speed = speeds.includes(data.speed) && data.speed !== 0 ? (data.speed as Speed) : 1;
    sim.lastRunningSpeed = sim.speed;
    sim.mode = data.mode === 'manage' ? 'manage' : 'avatar';
    sim.tool = TOOL_DEFS.some((t) => t.id === data.tool) ? (data.tool as Tool) : 'pet';
    sim.foodStock = typeof data.foodStock === 'number' && Number.isFinite(data.foodStock) ? Math.max(0, data.foodStock) : 0;
    if (data.stats && typeof data.stats === 'object') {
      for (const k of Object.keys(sim.stats) as Array<keyof SimStats>) {
        const v = (data.stats as Record<string, unknown>)[k];
        if (typeof v === 'number' && Number.isFinite(v)) sim.stats[k] = v;
      }
    }

    // Arsa katmanları
    const p = world.plot;
    const n = p.w * p.h;
    const objs = Array.isArray(data.plotObjects) && data.plotObjects.length === n ? data.plotObjects : null;
    const zones = Array.isArray(data.plotZones) && data.plotZones.length === n ? data.plotZones : null;
    const ground = Array.isArray(data.plotGround) && data.plotGround.length === n ? data.plotGround : null;
    if (objs || zones || ground) {
      let k = 0;
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++, k++) {
          if (objs) {
            const o = objs[k];
            if (typeof o === 'number' && o >= 0 && o < Obj.COUNT) world.setObject(x, y, o as Obj);
          }
          if (zones) {
            const z = zones[k];
            if (typeof z === 'number' && z >= 0 && z < Zone.COUNT) world.setZone(x, y, z as Zone);
          }
          if (ground) {
            const g = ground[k];
            if (typeof g === 'number' && g >= 0 && g < Ground.COUNT) world.setGround(x, y, g as Ground);
          }
        }
      }
    }
    rebuildMessSet(sim);

    // Binalar
    let maxId = 0;
    if (Array.isArray(data.buildings)) {
      for (const raw of data.buildings as Partial<BuildingSave>[]) {
        if (!raw || typeof raw.id !== 'number' || typeof raw.type !== 'string' || !(raw.type in BUILDING_DEFS)) continue;
        if (typeof raw.x !== 'number' || typeof raw.y !== 'number') continue;
        if (!canPlaceBuilding(world, raw.type, raw.x, raw.y)) continue;
        const b: Building = {
          id: raw.id,
          type: raw.type,
          x: raw.x,
          y: raw.y,
          food: typeof raw.food === 'number' && Number.isFinite(raw.food) ? Math.max(0, raw.food) : 0,
          occupants: [],
        };
        sim.buildings.push(b);
        sim.buildingMap.set(b.id, b);
        stampBuilding(world, b);
        maxId = Math.max(maxId, b.id);
      }
    }

    // Köpekler
    if (Array.isArray(data.dogs)) {
      for (const raw of data.dogs) {
        const dog = Dog.fromJSON(raw);
        if (!dog || sim.dogMap.has(dog.id)) continue;
        sim.registerDog(dog);
        maxId = Math.max(maxId, dog.id);
        const kennel = dog.kennelId !== null ? sim.buildingMap.get(dog.kennelId) : undefined;
        dog.kennelId = null;
        if (kennel && sim.kennelHasRoom(kennel, dog)) sim.assignKennel(dog, kennel);
        else {
          const free = sim.freeKennelFor(dog);
          if (free) sim.assignKennel(dog, free);
        }
        if (!world.inPlotInterior(dog.tileX, dog.tileY) || world.isSolid(dog.tileX, dog.tileY)) {
          const k = dog.kennelId !== null ? sim.buildingMap.get(dog.kennelId) : undefined;
          const t = k ? kennelRestTile(k, k.occupants.indexOf(dog.id)) : { x: Math.floor(world.spawn.x), y: Math.floor(world.spawn.y) };
          dog.x = t.x + 0.5;
          dog.y = t.y + 0.5;
        }
      }
    }
    sim.nextId = Math.max(typeof data.nextId === 'number' ? data.nextId : 1, maxId + 1);

    if (player.collides(world, player.x, player.y)) {
      player.x = world.spawn.x;
      player.y = world.spawn.y;
    }
    world.dirty = [];
    sim.alerts.refresh();
    return sim;
  }
}
