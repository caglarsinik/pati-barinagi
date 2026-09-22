import { BALANCE, type Speed } from '../config/balance';
import { BUILDING_DEFS, type BuildingType, type TileTool } from '../content/buildings';
import { DOG_NAMES } from '../content/names';
import { GAME } from '../config/game';
import { Clock, MINUTES_PER_DAY } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import { Rng, hash2 } from '../core/Rng';
import type { SaveData } from '../core/SaveManager';
import { type Building, type BuildingSave, buildingDef, buildingDoorTile, canPlaceBuilding, isReady, kennelRestTile, stampBuilding, unstampBuilding, normalizeRot, type Rotation } from './entities/Building';
import { type Adopter, adopterFromJSON } from './entities/Adopter';
import { Dog, type DogOrigin, SKILL_KEYS, STAGE_NAMES_TR, type SkillKey, clamp100, defaultNeeds } from './entities/Dog';
import { type DogGenome, randomGenome } from './entities/DogGenome';
import { type Egg, eggFromJSON } from './entities/Egg';
import { IDLE_INPUT, Player, type PlayerInput } from './entities/Player';
import { Staff, TASK_TYPES, type TaskType } from './entities/Staff';
import { type AdoptionRecord, AdoptionSystem, type PendingReturn } from './systems/AdoptionSystem';
import { AlertSystem } from './systems/AlertSystem';
import {
  type ExpandDir,
  paintZone,
  tickConstruction,
  tryDemolish,
  tryExpandPlot,
  tryPlaceBuilding,
  tryPlaceTiles,
} from './systems/BuildSystem';
import { DogBrain } from './systems/DogBrain';
import {
  type InspectionReport,
  type LedgerCategory,
  type LedgerEntry,
  type WeekSummary,
  closeWeek,
  licenseUpgradeCost,
} from './systems/EconomySystem';
import { packExplored, revealAround, unpackExplored } from './systems/Exploration';
import { incubatorHatchDays, incubatorSlots, placeEgg, takeEgg, tickIncubators } from './systems/IncubatorSystem';
import { Autopilot } from './systems/Autopilot';
import { IllnessSystem } from './systems/IllnessSystem';
import { type ActionKind, type ActionOutcome, TOOL_DEFS, type Tool, performAction } from './systems/Interaction';
import { type NavGoal, PlayerNav } from './systems/PlayerNav';
import { rebuildMessSet } from './systems/MessSystem';
import { NeedsSystem } from './systems/NeedsSystem';
import { tickNests } from './systems/NestSystem';
import { StaffSystem, maxStaff } from './systems/StaffSystem';
import { tickFeeders } from './systems/FeederSystem';
import { TaskBoard } from './systems/TaskBoard';
import { type AchievementDef, AchievementSystem } from './systems/Achievements';
import { EventSystem, type GameEvent } from './systems/EventSystem';
import { GateSystem } from './systems/GateSystem';
import type { EmoteEvent } from './systems/Emotes';
import { type Weather, WeatherSystem } from './systems/WeatherSystem';
import type { TilePos, TileWorld } from './world/TileWorld';
import { generateWorld } from './world/WorldGen';
import { Biome, Ground, Obj, Zone } from './world/tiles';
import { t } from '../i18n';

export type Mode = 'avatar' | 'manage';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const DIFFICULTY_NAMES_TR: Record<Difficulty, string> = { easy: 'Kolay', normal: 'Normal', hard: 'Zor' };

/** Zafer "Yılın Barınağı": kazanıldığı gün ve hafta. */
export interface VictoryInfo {
  day: number;
  week: number;
}

/** Oyun sonu: iflas. Kayda yazılır; yüklemede ekran yeniden açılır. */
export interface GameOverInfo {
  reason: 'bankrupt';
  week: number;
}

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
  dogHatched: Dog;
  dogTamed: Dog;
  buildingAdded: Building;
  buildingRemoved: number;
  buildingReady: Building;
  adopterArrived: Adopter;
  weekReport: WeekSummary;
  staffHired: Staff;
  staffRemoved: number;
  weatherChanged: Weather;
  gameEvent: GameEvent;
  achievement: AchievementDef;
  /** Uyku / bayılma gibi zaman atlamaları (arayüz karartma yapar). */
  slept: { minutes: number; passedOut: boolean };
  /** Oyuncuya kısa bildirim. */
  message: string;
  /** Dünya üstü geçici balon (sev → kalp gibi); render katmanı dinler. */
  emote: EmoteEvent;
  /** Dokun-git varışında yapılan E eylemi (ses ve panel açma için). */
  interacted: { kind: ActionKind; result: ActionOutcome };
  /** Çit kapısı açıldı/kapandı (ses ve çizim). */
  gate: { x: number; y: number; open: boolean };
  /** İflas: oyun durur, arayüz son ekranı açar. */
  gameOver: GameOverInfo;
  /** Zafer: bir kez; oyun sürer, arayüz zafer ekranını açar. */
  victory: VictoryInfo;
}

export type Command =
  | { type: 'interact' }
  | { type: 'setTool'; tool: Tool }
  | { type: 'renameDog'; id: number; name: string }
  | { type: 'orderFood'; bags: number }
  | { type: 'setTrainingFocus'; id: number; skill: SkillKey | null }
  | { type: 'assignKennel'; dogId: number; buildingId: number | null }
  | { type: 'placeBuilding'; building: BuildingType; x: number; y: number; rot?: Rotation }
  | { type: 'placeTiles'; tool: TileTool; tiles: TilePos[] }
  | { type: 'demolish'; x: number; y: number }
  | { type: 'paintZone'; zone: Zone; x0: number; y0: number; x1: number; y1: number }
  | { type: 'expandPlot'; dir: ExpandDir }
  | { type: 'placeEgg'; buildingId: number; eggId: number }
  | { type: 'takeEgg'; buildingId: number; eggId: number }
  | { type: 'sleep' }
  | { type: 'adopt'; adopterId: number; dogId: number }
  | { type: 'declineAdopter'; adopterId: number }
  | { type: 'upgradeLicense' }
  | { type: 'upgradeBuilding'; buildingId: number }
  | { type: 'sendToCourse'; staffId: number }
  | { type: 'acceptVolunteer' }
  | { type: 'buyBackpack' }
  | { type: 'takeLoan' }
  | { type: 'repayLoan' }
  | { type: 'hire'; candidateId: number }
  | { type: 'fire'; staffId: number }
  | { type: 'setShift'; staffId: number; hour: number; value: 0 | 1 | 2 }
  | { type: 'setSchedule'; staffId: number; schedule: number[] }
  | { type: 'setPriority'; staffId: number; task: TaskType; value: number }
  | { type: 'setPolicy'; policy: Partial<Policies> }
  | { type: 'walkDog'; dogId: number }
  | { type: 'endWalk' }
  | { type: 'setKeep'; dogId: number; keep: boolean }
  | { type: 'goTo'; x: number; y: number }
  | { type: 'goInteract'; goal: NavGoal }
  | { type: 'cancelNav' }
  | { type: 'setAutopilot'; on: boolean };

export interface Policies {
  autoOrderFood: boolean;
  foodThreshold: number;
  /** Personel köpekleri bu beceri seviyesine kadar eğitir (0 = eğitme). */
  trainTarget: number;
  /** Bulaşıcı hastalığı olan köpek karantina alanında kalsın. */
  quarantineSick: boolean;
  /** Sahiplendirme açık mı: kapalıyken sahiplenici gelmez, bekleyenler cezasız uğurlanır. */
  adoptionsOpen: boolean;
}

export function defaultPolicies(): Policies {
  return { autoOrderFood: false, foodThreshold: 10, trainTarget: 6, quarantineSick: true, adoptionsOpen: true };
}

export interface SimFlags {
  /** Bu gün yem yarı fiyat. */
  foodDiscountDay: number;
  /** Bu gün fazladan sahiplenici gelir. */
  extraAdoptersDay: number;
  /** Son hırlaşma uyarısının bittiği toplam dakika ve taraflar. */
  growlUntil: number;
  growlA: string;
  growlB: string;
}

export interface SimStats {
  cleaned: number;
  fed: number;
  played: number;
  petted: number;
  trained: number;
  groomed: number;
  treated: number;
  messes: number;
  built: number;
  eggsFound: number;
  hatched: number;
  strays: number;
  adopted: number;
  staffTasks: number;
  autoOrders: number;
  bowlsFilled: number;
  /** Yalak dolumu (oyuncu + personel). */
  watered: number;
  /** Köpek içimi. */
  drinks: number;
  /** Tamamlanan dost oyunları ve hırlaşmalar. */
  playdates: number;
  growls: number;
  /** Gezinti ve çağırma sayısı. */
  walks: number;
  calls: number;
  /** Başlayan ve tedaviyle geçen hastalıklar. */
  illnesses: number;
  cured: number;
  hired: number;
  slept: number;
}

function emptyStats(): SimStats {
  return {
    cleaned: 0,
    fed: 0,
    played: 0,
    petted: 0,
    trained: 0,
    groomed: 0,
    treated: 0,
    messes: 0,
    built: 0,
    eggsFound: 0,
    hatched: 0,
    strays: 0,
    adopted: 0,
    staffTasks: 0,
    autoOrders: 0,
    bowlsFilled: 0,
    watered: 0,
    drinks: 0,
    playdates: 0,
    growls: 0,
    walks: 0,
    calls: 0,
    illnesses: 0,
    cured: 0,
    hired: 0,
    slept: 0,
  };
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
  readonly adoption: AdoptionSystem;
  readonly tasks: TaskBoard;
  readonly staffSystem: StaffSystem;
  readonly weatherSys: WeatherSystem;
  readonly eventSys: EventSystem;
  readonly achievements: AchievementSystem;
  readonly illness: IllnessSystem;
  readonly nav: PlayerNav;
  readonly pilot: Autopilot;
  /** Oyuncu otopilotu açık mı (T / 🤖). Elle girdi kapatır. */
  autopilot = false;
  readonly gates: GateSystem;
  flags: SimFlags = { foodDiscountDay: 0, extraAdoptersDay: 0, growlUntil: 0, growlA: '', growlB: '' };
  speed: Speed = 1;
  mode: Mode = 'avatar';
  difficulty: Difficulty = 'normal';
  /** Kalan kredi anaparası. */
  loan = 0;
  /** Kasanın art arda kaç hafta iflas eşiğinin altında kaldığı. */
  negativeWeeks = 0;
  gameOver: GameOverInfo | null = null;
  /** Zafer "Yılın Barınağı" (bir kez). */
  victory: VictoryInfo | null = null;
  /** Çanta seviyesi (2: büyük çanta). */
  backpackLevel = 1;
  money: number;
  tool: Tool = 'pet';
  dogs: Dog[] = [];
  buildings: Building[] = [];
  foodStock = 0;
  treats = 0;
  backpack: Egg[] = [];
  messTiles = new Set<number>();
  nestTimers = new Map<number, number>();
  nestHarvests = new Map<number, number>();
  bushTimers = new Map<number, number>();
  exploredCount = 0;
  reputation: number = BALANCE.economy.startReputation;
  licenseLevel = 1;
  adopters: Adopter[] = [];
  ledger: LedgerEntry[] = [];
  weeks: WeekSummary[] = [];
  adoptions: AdoptionRecord[] = [];
  pendingReturns: PendingReturn[] = [];
  lastInspection: InspectionReport | null = null;
  staff: Staff[] = [];
  candidates: Staff[] = [];
  candidatesDay = 0;
  /** Cuma gelen gönüllü başvurusu (Pazartesi düşer). */
  volunteerOffer: Staff | null = null;
  policies: Policies = defaultPolicies();
  stats: SimStats = emptyStats();
  nextId = 1;
  private lastRunningSpeed: Speed = 1;
  private minuteAcc = 0;
  private lastRevealTile = -1;
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
    this.adoption = new AdoptionSystem(this);
    this.tasks = new TaskBoard(this);
    this.staffSystem = new StaffSystem(this);
    this.weatherSys = new WeatherSystem(this);
    this.eventSys = new EventSystem(this);
    this.achievements = new AchievementSystem(this);
    this.illness = new IllnessSystem(this);
    this.nav = new PlayerNav(this);
    this.pilot = new Autopilot(this);
    this.gates = new GateSystem(this);
    this.events.on('day', (d) => this.needs.onDay(d));
    this.events.on('day', () => this.illness.onDay());
    this.events.on('day', () => this.staffSystem.onDay());
    this.events.on('hour', () => this.staffSystem.onHour());
    this.events.on('hour', () => this.illness.onHour());
    this.events.on('hour', (h) => this.eventSys.onHour(h));
    this.events.on('week', (w) => this.onWeek(w));
    this.events.on('hour', (h) => this.onHour(h));
  }

  static create(seed: number, difficulty: Difficulty = 'normal'): Sim {
    const world = generateWorld(seed);
    const player = new Player(world.spawn.x, world.spawn.y);
    const sim = new Sim(seed, world, new Clock(), player, BALANCE.difficulty[difficulty].startMoney);
    sim.difficulty = difficulty;
    sim.setupStarterShelter();
    sim.spawnStrays();
    sim.revealPlayer(true);
    sim.staffSystem.refreshCandidates();
    sim.candidatesDay = 1;
    sim.weatherSys.roll();
    sim.alerts.refresh();
    return sim;
  }

  /** Her gün adaylar yenilenir (saat atlasa da gün numarasına bakılır). */
  private refreshCandidatesIfNewDay(): void {
    if (this.candidatesDay !== this.clock.day) {
      this.candidatesDay = this.clock.day;
      this.staffSystem.refreshCandidates();
    }
  }

  get paused(): boolean {
    return this.speed === 0;
  }

  /** Barınaktaki köpekler (dünyadaki vahşiler hariç). */
  shelterDogs(): Dog[] {
    return this.dogs.filter((d) => !d.wild);
  }

  backpackSlots(): number {
    return this.backpackLevel >= 2 ? BALANCE.upgrades.backpack.slots : BALANCE.player.backpackSlots;
  }

  // ---------------------------------------------------------------------------
  // Döngü
  // ---------------------------------------------------------------------------

  /** Gerçek zamanlı bir kare ilerletir. Oyuncu hareketi gerçek zamanlı, saat oyun hızıyla ölçekli. */
  update(dtSec: number, input: PlayerInput = IDLE_INPUT): void {
    if (this.paused || this.gameOver || dtSec <= 0) return;
    const dtMin = dtSec * BALANCE.time.minutesPerRealSecond * this.speed;
    this.stepSim(dtMin, dtSec);
    if (this.gameOver) return;
    // Kapılar gerçek zamanda: oyuncu için katılık, NPC'ler için yakınlık.
    this.gates.update(0);
    if (this.mode === 'avatar') {
      // Klavye girişi dokun-git yolunu iptal eder; girdi yoksa yol takibi girdiyi üretir.
      const manual = input.dx !== 0 || input.dy !== 0;
      if (manual && this.autopilot) this.setAutopilot(false);
      if (manual && this.nav.active) this.nav.cancel();
      this.pilot.tick(dtSec);
      const inp = !manual && this.nav.active ? this.nav.inputFor(dtSec, input.run || this.pilot.run()) : input;
      this.player.update(dtSec, inp, this.world);
      this.revealPlayer(false);
      this.brain.updateNearPlayer(dtSec);
    }
  }

  /** Oyun zamanını ilerletir (oyuncu hareketi hariç). Uyku gibi atlamalar bunu döngüde çağırır. */
  stepSim(dtMin: number, dtSec = dtMin / BALANCE.time.minutesPerRealSecond): void {
    if (this.gameOver) return;
    this.gates.update(dtSec);
    this.weatherSys.update();
    const crossed = this.clock.advance(dtMin);
    for (const h of crossed.hours) this.events.emit('hour', h);
    for (const d of crossed.days) this.events.emit('day', d);
    for (const w of crossed.weeks) this.events.emit('week', w);
    if (this.gameOver) return;
    this.needs.update(dtMin);
    this.brain.update(dtMin);
    tickConstruction(this, dtMin);
    tickNests(this, dtMin);
    tickIncubators(this, dtMin);
    this.adoption.update(dtMin);
    this.minuteAcc += dtMin;
    if (this.minuteAcc >= 1) {
      this.minuteAcc %= 1;
      this.refreshCandidatesIfNewDay();
      this.tasks.refresh();
      this.alerts.refresh();
      this.checkVictory();
      this.achievements.check();
    }
    this.staffSystem.update(dtMin);
    this.gates.update(0);
  }

  /** Zafer: sahiplendirme ve itibar eşikleri birlikte sağlanınca bir kez tetiklenir; oyun sürer. */
  private checkVictory(): void {
    if (this.victory) return;
    const V = BALANCE.victory;
    if (this.stats.adopted < V.adoptions || this.reputation < V.reputation) return;
    this.victory = { day: this.clock.day, week: this.clock.week };
    this.events.emit('victory', this.victory);
    this.events.emit('message', t('🏆 Yılın Barınağı seçildin!'));
  }

  private revealPlayer(force: boolean): void {
    const i = this.world.idx(this.player.tileX, this.player.tileY);
    if (!force && i === this.lastRevealTile) return;
    this.lastRevealTile = i;
    revealAround(this, this.player.tileX, this.player.tileY);
  }

  /** Sabah 06:00'ya kadar zamanı hızlıca geçirir; köpekler ve inşaatlar normal işler. */
  sleepUntilMorning(passedOut = false): void {
    this.nav.cancel();
    const c = this.clock;
    const morning = BALANCE.time.nightEndHour * 60;
    let target = c.dayIndex * MINUTES_PER_DAY + morning;
    if (c.minuteOfDay >= morning) target += MINUTES_PER_DAY;
    const total = target - c.totalMinutes;
    while (this.clock.totalMinutes < target && !this.gameOver) {
      this.stepSim(Math.min(5, target - this.clock.totalMinutes));
    }
    this.player.stamina = BALANCE.player.staminaMax;
    this.player.exhausted = false;
    this.stats.slept++;
    this.events.emit('slept', { minutes: total, passedOut });
  }

  private onHour(h: number): void {
    // Mutfak: yalaklar kendiliğinden dolar.
    if (this.hasReady('kitchen')) {
      const cap = BALANCE.shelter.troughCapacity;
      for (const b of this.buildings) if (b.type === 'trough' && isReady(b)) b.water = Math.min(cap, b.water + BALANCE.shelter.kitchenWaterPerHour);
    }
    // Otomatik yem makinesi: menzildeki kaplar kilerden dolar.
    tickFeeders(this);
    if (h === BALANCE.time.passOutHour && this.mode === 'avatar' && !this.world.inPlot(this.player.tileX, this.player.tileY)) {
      this.passOut();
    }
  }

  private passOut(): void {
    const office = this.buildings.find((b) => b.type === 'office');
    const door = office ? buildingDoorTile(office) : { x: Math.floor(this.world.spawn.x), y: Math.floor(this.world.spawn.y) };
    this.player.x = door.x + 0.5;
    this.player.y = door.y + 0.9;
    this.player.busy = 0;
    for (const dog of this.dogs) {
      if (dog.following || dog.walking) {
        dog.x = this.player.x + 1;
        dog.y = this.player.y;
        dog.path = [];
      }
    }
    this.sleepUntilMorning(true);
    this.events.emit('message', t('Gece dışarıda bayıldın; sabah ofiste uyandın.'));
  }

  /** Hafta tiki: köpekler bir hafta yaşlanır, denetim ve yardım işlenir, haftalık rapor çıkar. */
  private onWeek(newWeek: number): void {
    for (const dog of this.dogs) {
      const before = dog.stage;
      dog.ageWeeks++;
      if (dog.stage !== before && !dog.wild) {
        this.events.emit('message', t('{name} artık {stage}!', { name: dog.name, stage: t(STAGE_NAMES_TR[dog.stage]).toLowerCase() }));
      }
    }
    this.applyLoanInterest(newWeek - 1);
    const summary = closeWeek(this, newWeek);
    this.staffSystem.afterPayday();
    this.events.emit('weekReport', summary);
    this.checkBankruptcy(newWeek);
  }

  /** Kredi faizi: biten haftanın defterine gider olarak yazılır, anapara değişmez. */
  private applyLoanInterest(week: number): void {
    if (this.loan <= 0) return;
    const interest = Math.round(this.loan * BALANCE.economy.loan.weeklyInterest);
    if (interest > 0) this.addExpense('interest', interest, t('Kredi faizi'), week);
  }

  /** İflas sayacı: kasa −(maaş + tampon) altındaysa sayar, art arda eşiğe ulaşınca oyun biter. */
  private checkBankruptcy(week: number): void {
    const B = BALANCE.economy.bankruptcy;
    const threshold = -(this.weeklyWages() + B.buffer);
    if (this.money < threshold) this.negativeWeeks++;
    else this.negativeWeeks = 0;
    if (this.negativeWeeks >= B.weeks && !this.gameOver) {
      this.gameOver = { reason: 'bankrupt', week };
      this.setSpeed(0);
      this.events.emit('gameOver', this.gameOver);
    }
  }

  // ---------------------------------------------------------------------------
  // Para
  // ---------------------------------------------------------------------------

  addIncome(category: LedgerCategory, amount: number, note = '', week = this.clock.week): void {
    if (amount <= 0) return;
    this.money += amount;
    this.ledger.push({ week, day: this.clock.day, category, amount, note });
  }

  addExpense(category: LedgerCategory, amount: number, note = '', week = this.clock.week): void {
    if (amount <= 0) return;
    this.money -= amount;
    this.ledger.push({ week, day: this.clock.day, category, amount: -amount, note });
  }

  /** Haftalık personel maaşı toplamı. */
  /** Zorluğa göre haftalık yardım çarpanı. */
  aidMul(): number {
    return BALANCE.difficulty[this.difficulty].aidMul;
  }

  /** Zorluğa göre ihtiyaç artış çarpanı (açlık, susuzluk, oyun, mesane, hijyen). */
  needsMul(): number {
    return BALANCE.difficulty[this.difficulty].needsMul;
  }

  weeklyWages(): number {
    return this.staffSystem.totalWages();
  }

  licenseCap(): number {
    return BALANCE.economy.licenseCaps[this.licenseLevel - 1];
  }

  /** Çuval fiyatı; indirim gününde yarı. */
  foodBagPrice(): number {
    const base = BALANCE.economy.foodBagPrice;
    return this.flags.foodDiscountDay === this.clock.day ? Math.round(base / 2) : base;
  }

  /** Bu hafta biriken gelir/gider (defterden). */
  weekTotals(): { income: number; expense: number } {
    let income = 0;
    let expense = 0;
    for (const e of this.ledger) {
      if (e.week !== this.clock.week) continue;
      if (e.amount >= 0) income += e.amount;
      else expense -= e.amount;
    }
    return { income, expense };
  }

  // ---------------------------------------------------------------------------
  // Komutlar (UI ve sahne buradan konuşur)
  // ---------------------------------------------------------------------------

  command(cmd: Command): ActionOutcome {
    if (this.gameOver) return { ok: false, message: t('Oyun bitti') };
    switch (cmd.type) {
      case 'interact':
        this.setAutopilot(false);
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
        const cost = bags * this.foodBagPrice();
        if (this.money < cost) return { ok: false, message: t('Yeterli para yok') };
        this.addExpense('food', cost, t('{n} çuval', { n: bags }));
        this.foodStock += bags * BALANCE.economy.foodBagPortions;
        return { ok: true, message: t('{n} çuval yem geldi ({cost} ₺)', { n: bags, cost }) };
      }
      case 'setTrainingFocus': {
        const dog = this.dogById(cmd.id);
        if (!dog) return { ok: false };
        dog.trainingFocus = cmd.skill && SKILL_KEYS.includes(cmd.skill) ? cmd.skill : null;
        return { ok: true };
      }
      case 'assignKennel': {
        const dog = this.dogById(cmd.dogId);
        if (!dog || dog.wild) return { ok: false };
        if (cmd.buildingId === null) {
          this.assignKennel(dog, null);
          return { ok: true };
        }
        const kennel = this.buildingById(cmd.buildingId);
        if (!kennel || !this.kennelHasRoom(kennel, dog)) return { ok: false, message: t('Kulübede yer yok') };
        this.assignKennel(dog, kennel);
        return { ok: true };
      }
      case 'placeBuilding': {
        const r = tryPlaceBuilding(this, cmd.building, cmd.x, cmd.y, cmd.rot ?? 0);
        return { ok: r.ok, message: r.message, building: r.building };
      }
      case 'placeTiles': {
        const r = tryPlaceTiles(this, cmd.tool, cmd.tiles);
        return { ok: r.ok, message: r.message };
      }
      case 'demolish': {
        const r = tryDemolish(this, cmd.x, cmd.y);
        return { ok: r.ok, message: r.message };
      }
      case 'paintZone': {
        const r = paintZone(this, cmd.zone, cmd.x0, cmd.y0, cmd.x1, cmd.y1);
        return { ok: r.ok, message: r.message };
      }
      case 'expandPlot': {
        const r = tryExpandPlot(this, cmd.dir);
        return { ok: r.ok, message: r.message };
      }
      case 'placeEgg': {
        const b = this.buildingById(cmd.buildingId);
        if (!b) return { ok: false };
        return placeEgg(this, b, cmd.eggId);
      }
      case 'takeEgg': {
        const b = this.buildingById(cmd.buildingId);
        if (!b) return { ok: false };
        return takeEgg(this, b, cmd.eggId);
      }
      case 'sleep': {
        this.sleepUntilMorning(false);
        return { ok: true, message: t('Günaydın! Yeni bir gün.') };
      }
      case 'adopt':
        return this.adoption.adopt(cmd.adopterId, cmd.dogId);
      case 'declineAdopter':
        return { ok: this.adoption.decline(cmd.adopterId) };
      case 'hire':
        return this.staffSystem.hire(cmd.candidateId);
      case 'sendToCourse':
        return this.staffSystem.sendToCourse(cmd.staffId);
      case 'acceptVolunteer':
        return this.staffSystem.acceptVolunteer();
      case 'fire':
        return this.staffSystem.fire(cmd.staffId);
      case 'setShift': {
        const s = this.staffById(cmd.staffId);
        if (!s || cmd.hour < 0 || cmd.hour > 23) return { ok: false };
        s.schedule[cmd.hour] = cmd.value;
        return { ok: true };
      }
      case 'setSchedule': {
        const s = this.staffById(cmd.staffId);
        if (!s || cmd.schedule.length !== 24) return { ok: false };
        s.schedule = cmd.schedule.map((v) => (v === 1 || v === 2 ? v : 0)) as Staff['schedule'];
        return { ok: true };
      }
      case 'setPriority': {
        const s = this.staffById(cmd.staffId);
        if (!s || !TASK_TYPES.includes(cmd.task)) return { ok: false };
        s.priorities[cmd.task] = Math.max(0, Math.min(5, Math.round(cmd.value)));
        return { ok: true };
      }
      case 'setPolicy': {
        const p = cmd.policy;
        if (typeof p.autoOrderFood === 'boolean') this.policies.autoOrderFood = p.autoOrderFood;
        if (typeof p.foodThreshold === 'number' && Number.isFinite(p.foodThreshold)) this.policies.foodThreshold = Math.max(0, Math.min(200, Math.round(p.foodThreshold)));
        if (typeof p.trainTarget === 'number' && Number.isFinite(p.trainTarget)) this.policies.trainTarget = Math.max(0, Math.min(6, Math.round(p.trainTarget)));
        if (typeof p.quarantineSick === 'boolean') this.policies.quarantineSick = p.quarantineSick;
        if (typeof p.adoptionsOpen === 'boolean' && p.adoptionsOpen !== this.policies.adoptionsOpen) {
          this.policies.adoptionsOpen = p.adoptionsOpen;
          if (p.adoptionsOpen) this.events.emit('message', t('Sahiplendirme açıldı: sahiplenici gelmeye başlar'));
          else this.adoption.closeDesk();
        }
        return { ok: true };
      }
      case 'setKeep': {
        const dog = this.dogById(cmd.dogId);
        if (!dog || dog.wild) return { ok: false };
        dog.keep = cmd.keep;
        return {
          ok: true,
          message: cmd.keep ? t('{name} tutulacak: sahiplendirme listesine çıkmaz', { name: dog.name }) : t('{name} yeniden sahiplendirilebilir', { name: dog.name }),
        };
      }
      case 'walkDog': {
        const dog = this.dogById(cmd.dogId);
        if (!dog || dog.wild) return { ok: false };
        if (dog.walking) return { ok: false, message: t('{name} zaten gezintide', { name: dog.name }) };
        if (dog.skills.leash < 100) return { ok: false, message: t('{name} tasmayı henüz öğrenmedi', { name: dog.name }) };
        if (this.mode !== 'avatar') return { ok: false, message: t('Gezdirmek için avatar moduna geç (Tab)') };
        if (this.dogs.some((d) => d.walking)) return { ok: false, message: t('Zaten bir köpek gezdiriyorsun') };
        if (dog.isAsleep() || dog.sick) return { ok: false, message: t('{name} şu an gezemez', { name: dog.name }) };
        this.brain.startWalk(dog);
        return { ok: true, message: t('{name} tasmada: arsadan çıkıp dön, keyfi yerine gelir', { name: dog.name }) };
      }
      case 'endWalk': {
        const dog = this.dogs.find((d) => d.walking);
        if (!dog) return { ok: false };
        this.brain.endWalk(dog);
        return { ok: true };
      }
      case 'goTo': {
        if (this.mode !== 'avatar') return { ok: false, message: t('Yürümek için Avatar moduna geç') };
        this.setAutopilot(false);
        return { ok: this.nav.goTo({ x: Math.floor(cmd.x), y: Math.floor(cmd.y) }) };
      }
      case 'goInteract': {
        if (this.mode !== 'avatar') return { ok: false, message: t('Yürümek için Avatar moduna geç') };
        this.setAutopilot(false);
        return { ok: this.nav.goInteract(cmd.goal) };
      }
      case 'cancelNav':
        this.setAutopilot(false);
        this.nav.cancel();
        return { ok: true };
      case 'setAutopilot':
        this.setAutopilot(cmd.on);
        return { ok: true };
      case 'takeLoan': {
        const L = BALANCE.economy.loan;
        if (this.loan > 0) return { ok: false, message: t('Önce mevcut krediyi kapat') };
        this.loan = L.amount;
        this.addIncome('loan', L.amount, t('Ofis kredisi'));
        return { ok: true, message: t('{n} ₺ kredi alındı · haftalık faiz %{p}', { n: L.amount, p: Math.round(L.weeklyInterest * 100) }) };
      }
      case 'repayLoan': {
        if (this.loan <= 0) return { ok: false, message: t('Kredi borcu yok') };
        const n = Math.min(this.loan, Math.floor(this.money));
        if (n <= 0) return { ok: false, message: t('Kasada para yok') };
        this.loan -= n;
        this.addExpense('loan', n, t('Kredi ödemesi'));
        return { ok: true, message: this.loan > 0 ? t('{n} ₺ ödendi, kalan borç {rest} ₺', { n, rest: this.loan }) : t('Kredi kapatıldı') };
      }
      case 'upgradeBuilding': {
        const b = this.buildingById(cmd.buildingId);
        if (!b) return { ok: false };
        const def = buildingDef(b);
        const up = def.upgrade;
        if (!up) return { ok: false, message: t('Bu bina yükseltilemez') };
        if (!isReady(b)) return { ok: false, message: t('Bina henüz inşa ediliyor') };
        if (b.level >= 2) return { ok: false, message: t('Zaten en üst seviyede') };
        if (this.money < up.cost) return { ok: false, message: t('Yeterli para yok') };
        const oldDays = b.type === 'incubator' ? incubatorHatchDays(b) : 0;
        this.addExpense('building', up.cost, t('{name} yükseltmesi', { name: t(def.name) }));
        b.level = 2;
        // Kuluçka hızlandı: içerideki yumurtaların kalan süresi aynı oranda kısalır.
        if (b.type === 'incubator') for (const egg of b.eggs) egg.hatchLeft = Math.ceil((egg.hatchLeft * incubatorHatchDays(b)) / oldDays);
        return { ok: true, message: t('{name} yükseltildi', { name: t(def.name) }) };
      }
      case 'buyBackpack': {
        const C = BALANCE.upgrades.backpack;
        if (this.backpackLevel >= 2) return { ok: false, message: t('Çanta zaten büyük') };
        if (this.money < C.cost) return { ok: false, message: t('Yeterli para yok') };
        this.addExpense('building', C.cost, t('Büyük çanta'));
        this.backpackLevel = 2;
        return { ok: true, message: t('Çanta büyüdü: {n} yumurta sığar', { n: C.slots }) };
      }
      case 'upgradeLicense': {
        const cost = licenseUpgradeCost(this.licenseLevel);
        if (cost === null) return { ok: false, message: t('Lisans en üst seviyede') };
        if (this.money < cost) return { ok: false, message: t('Yeterli para yok ({cost} ₺)', { cost }) };
        this.addExpense('license', cost, t('Seviye {lvl}', { lvl: this.licenseLevel + 1 }));
        this.licenseLevel++;
        return { ok: true, message: t('Lisans seviye {lvl}: en fazla {cap} köpek', { lvl: this.licenseLevel, cap: this.licenseCap() }) };
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
    if (mode === 'manage') {
      this.pilot.abandon();
      this.nav.cancel();
    }
    this.events.emit('modeChanged', mode);
  }

  /** Durum satırı için otopilotun o anki işi; kapalıyken boş. */
  get autopilotText(): string {
    return this.pilot.statusText();
  }

  /** Otopilotu açar/kapatır; açılınca avatar moduna geçer, kapanınca üstlenilen iş bırakılır ve yürüyüş durur. */
  setAutopilot(on: boolean): void {
    if (on === this.autopilot) return;
    this.autopilot = on;
    if (on) {
      this.setMode('avatar');
      this.pilot.wake();
      this.events.emit('message', t('🤖 Otopilot açık: bakım ve köpek işlerini kendisi yapar'));
    } else {
      this.pilot.stop();
      this.events.emit('message', t('Otopilot kapalı'));
    }
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

  staffById(id: number): Staff | undefined {
    return this.staff.find((s) => s.id === id);
  }

  addDog(genome: DogGenome, origin: DogOrigin, ageWeeks: number, x: number, y: number, name?: string): Dog {
    const dog = new Dog(this.nextId++, name ?? this.pickName(), genome, origin, ageWeeks, x, y);
    this.registerDog(dog);
    const kennel = this.freeKennelFor(dog);
    if (kennel) this.assignKennel(dog, kennel);
    this.events.emit('dogAdded', dog);
    return dog;
  }

  /** Dünyada bir inin yanında yaşayan sokak köpeği. */
  addWildDog(genome: DogGenome, ageWeeks: number, den: TilePos, name?: string): Dog {
    const dog = new Dog(this.nextId++, name ?? this.pickName(), genome, 'stray', ageWeeks, den.x + 0.5, den.y + 1.5);
    dog.wild = true;
    dog.den = { ...den };
    dog.needs.loyalty = 0;
    this.registerDog(dog);
    this.events.emit('dogAdded', dog);
    return dog;
  }

  private spawnStrays(): void {
    const rng = this.rng.fork(77);
    for (const den of this.world.dens) {
      const rarity = rng.weighted(['common', 'uncommon', 'rare'] as const, [40, 45, 15]);
      const genome = randomGenome(rng, rarity);
      this.addWildDog(genome, rng.int(24, 90), den);
    }
  }

  /** Ödül vererek güvenini kazanınca çağrılır: köpek oyuncunun peşine takılır. */
  tameDog(dog: Dog): void {
    dog.following = true;
    dog.path = [];
    dog.state = 'idle';
    dog.stateTimer = 0;
    this.events.emit('dogTamed', dog);
    this.events.emit('message', t('{name} sana güvendi, peşinden geliyor! Barınağa götür.', { name: dog.name }));
  }

  /** Gezinti bitti: keyif ve sadakat artar, biraz kirlenir ve yorulur. */
  finishWalk(dog: Dog): void {
    const W = BALANCE.dogs.skills.walk;
    dog.walking = false;
    dog.walkLeftPlot = false;
    dog.walkReturning = false;
    dog.path = [];
    dog.state = 'idle';
    dog.stateTimer = 2;
    dog.needs.play = clamp100(dog.needs.play + W.playGain);
    dog.needs.loyalty = clamp100(dog.needs.loyalty + W.loyaltyGain);
    dog.needs.hygiene = clamp100(dog.needs.hygiene - W.hygieneLoss);
    dog.needs.energy = clamp100(dog.needs.energy - W.energyCost);
    dog.lastInteractionDay = this.clock.day;
    this.stats.walks++;
    this.events.emit('emote', { kind: 'dog', id: dog.id, emote: 'heart', seconds: 2 });
    this.events.emit('message', t('{name} gezintiden döndü: keyfi ve sadakati arttı', { name: dog.name }));
  }

  /** Peşinden gelen köpek barınağa girince kayda alınır. */
  joinShelter(dog: Dog): void {
    dog.wild = false;
    dog.following = false;
    dog.den = null;
    dog.needs = { ...defaultNeeds('stray'), loyalty: 10 };
    dog.lastInteractionDay = this.clock.day;
    const kennel = this.freeKennelFor(dog);
    if (kennel) this.assignKennel(dog, kennel);
    if (this.eventSys.escapes.some((e) => e.dogId === dog.id)) this.eventSys.onDogJoined(dog);
    else this.stats.strays++;
    this.events.emit('message', t('{name} barınağa katıldı!', { name: dog.name }));
  }

  private registerDog(dog: Dog): void {
    this.dogs.push(dog);
    this.dogMap.set(dog.id, dog);
  }

  removeDog(id: number): boolean {
    const dog = this.dogMap.get(id);
    if (!dog) return false;
    this.assignKennel(dog, null);
    for (const d of this.dogs) if (d.playmateId === id) d.playmateId = null;
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
    if (def.capacity === undefined || !isReady(kennel)) return false;
    if (kennel.occupants.includes(dog.id)) return true;
    if (kennel.occupants.length >= def.capacity) return false;
    if (dog.genome.size === 'L' && kennel.type === 'kennelSmall') return false;
    return true;
  }

  /** Boş kulübe; en iyi dostunun kulübesinde yer varsa orası. */
  freeKennelFor(dog: Dog): Building | null {
    const bf = dog.bestFriend();
    if (bf) {
      const friend = this.dogById(bf.id);
      const k = friend && friend.kennelId !== null ? this.buildingMap.get(friend.kennelId) : undefined;
      if (k && this.kennelHasRoom(k, dog)) return k;
    }
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

  /** Hazır kulübe kapasitesi toplamı. */
  kennelCapacity(): number {
    let n = 0;
    for (const b of this.buildings) if (isReady(b)) n += buildingDef(b).capacity ?? 0;
    return n;
  }

  hasReady(type: BuildingType): boolean {
    return this.buildings.some((b) => b.type === type && isReady(b));
  }

  troughCapacity(): number {
    return BALANCE.shelter.troughCapacity;
  }

  /** Dekor puanı 0-max: hazır çiçek/bank/tabela/lamba. Sahiplenici sabrı, geliş sıklığı ve denetim "Çevre" kalemi bundan okur. */
  decorScore(): number {
    const D = BALANCE.decor;
    let score = 0;
    let signs = 0;
    for (const b of this.buildings) {
      if (!isReady(b)) continue;
      const pts = (D.points as Record<string, number>)[b.type];
      if (pts === undefined) continue;
      if (b.type === 'sign') {
        if (signs >= D.maxSigns) continue;
        signs++;
      }
      score += pts;
    }
    return Math.min(D.max, score);
  }

  /** Kap kapasitesi: mutfak varsa iki kat. */
  bowlCapacity(b: Building): number {
    const base = buildingDef(b).foodCapacity ?? 4;
    return this.hasReady('kitchen') ? base * 2 : base;
  }

  // ---------------------------------------------------------------------------
  // Binalar
  // ---------------------------------------------------------------------------

  buildingById(id: number): Building | undefined {
    return this.buildingMap.get(id);
  }

  placeBuilding(type: BuildingType, x: number, y: number, buildMinutes = 0, rotIn: Rotation = 0): Building | null {
    const rot = normalizeRot(type, rotIn);
    if (!canPlaceBuilding(this.world, type, x, y, rot)) return null;
    const b: Building = {
      id: this.nextId++,
      type,
      x,
      y,
      rot,
      food: 0,
      water: type === 'trough' ? BALANCE.shelter.troughCapacity : 0,
      occupants: [],
      buildLeft: Math.max(0, buildMinutes),
      eggs: [],
      level: 1,
    };
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
    // Kuluçkadaki yumurtalar kaybolmasın: çantaya döner (kalan kuluçka süresi korunur).
    for (const egg of b.eggs) this.backpack.push(egg);
    b.eggs = [];
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
    place('bin', 34, 19); // tuvalet alanının hemen üstü: kapasite +4
    bowl.food = BALANCE.shelter.startBowlFood;
    this.foodStock = BALANCE.shelter.startFoodPortions;

    for (let y = y0 + 20; y < y0 + 25; y++) for (let x = x0 + 30; x < x0 + 36; x++) w.setZone(x, y, Zone.Toilet);

    const genome = randomGenome(this.rng.fork(1), 'common');
    genome.size = genome.size === 'L' ? 'M' : genome.size;
    this.addDog(genome, 'egg', 20, x0 + 10.5, y0 + 11.5);

    // Öğretici: kapının hemen dışında bir yumurta yuvası.
    const nestX = gateX + 4;
    const nestY = y1 + 4;
    if (w.objectAt(nestX, nestY) === Obj.None && !w.isSolid(nestX, nestY) && w.biomeAt(nestX, nestY) !== Biome.Road) {
      w.setObject(nestX, nestY, Obj.NestEggs);
      w.nests.push({ x: nestX, y: nestY });
    }
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
    const objectChanges: number[] = [];
    for (const [i, o] of this.world.objectChanges) {
      const x = i % this.world.width;
      const y = Math.floor(i / this.world.width);
      if (this.world.inPlot(x, y)) continue;
      objectChanges.push(i, o);
    }
    const flat = (m: Map<number, number>): number[] => {
      const out: number[] = [];
      for (const [k, v] of m) out.push(k, v);
      return out;
    };
    const eggSave = (e: Egg): Egg => ({ ...e, genome: { ...e.genome } });
    return {
      version: GAME.saveVersion,
      savedAt: Date.now(),
      seed: this.seed,
      objectChanges,
      clock: this.clock.toJSON(),
      player: this.player.toJSON(),
      speed: this.speed,
      mode: this.mode,
      money: this.money,
      difficulty: this.difficulty,
      autopilot: this.autopilot,
      loan: this.loan,
      negativeWeeks: this.negativeWeeks,
      gameOver: this.gameOver,
      victory: this.victory,
      backpackLevel: this.backpackLevel,
      tool: this.tool,
      foodStock: this.foodStock,
      treats: this.treats,
      nextId: this.nextId,
      stats: { ...this.stats },
      plot: { ...p },
      plotObjects,
      plotZones,
      plotGround,
      buildings: this.buildings.map((b) => ({
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        rot: b.rot,
        food: b.food,
        water: b.water,
        occupants: [...b.occupants],
        buildLeft: b.buildLeft,
        eggs: b.eggs.map(eggSave),
        level: b.level,
      })),
      dogs: this.dogs.map((d) => d.toJSON()),
      backpack: this.backpack.map(eggSave),
      nestTimers: flat(this.nestTimers),
      nestHarvests: flat(this.nestHarvests),
      bushTimers: flat(this.bushTimers),
      explored: packExplored(this.world.explored),
      reputation: this.reputation,
      licenseLevel: this.licenseLevel,
      adopters: this.adopters.map((a) => ({
        id: a.id,
        name: a.name,
        request: { ...a.request },
        fee: a.fee,
        patienceLeft: a.patienceLeft,
        state: a.state,
        x: a.x,
        y: a.y,
        look: a.look,
        queueSlot: a.queueSlot,
      })),
      ledger: this.ledger.map((e) => ({ ...e })),
      weeks: this.weeks.map((w) => ({ ...w })),
      adoptions: this.adoptions.map((a) => ({ ...a })),
      pendingReturns: this.pendingReturns.map((r) => ({ ...r })),
      lastInspection: this.lastInspection,
      staff: this.staff.map((s) => s.toJSON()),
      candidates: this.candidates.map((s) => s.toJSON()),
      candidatesDay: this.candidatesDay,
      volunteerOffer: this.volunteerOffer ? this.volunteerOffer.toJSON() : null,
      policies: { ...this.policies },
      weather: this.weatherSys.toJSON(),
      eventLog: this.eventSys.toJSON(),
      flags: { ...this.flags },
      achievements: this.achievements.toJSON(),
    };
  }

  /** Doğrulayarak yükler: bozuk alanlar varsayılana döner, imkânsız konumlar düzeltilir. */
  static fromJSON(data: SaveData): Sim {
    const world = generateWorld(data.seed >>> 0);
    const clock = Clock.fromJSON(data.clock);
    const player = Player.fromJSON(data.player, world.spawn);
    const difficulty: Difficulty = DIFFICULTIES.includes(data.difficulty as Difficulty) ? (data.difficulty as Difficulty) : 'normal';
    const money = typeof data.money === 'number' && Number.isFinite(data.money) ? data.money : BALANCE.difficulty[difficulty].startMoney;
    const sim = new Sim(data.seed >>> 0, world, clock, player, money);
    sim.difficulty = difficulty;
    sim.autopilot = data.autopilot === true;
    // Çanta yumurtalarından önce: büyük çantadaki 4–6. yumurta yüklemede kaybolmasın.
    sim.backpackLevel = data.backpackLevel === 2 ? 2 : 1;
    sim.loan = numOr(data.loan, 0, 0);
    sim.negativeWeeks = Math.floor(numOr(data.negativeWeeks, 0, 0));
    const go = data.gameOver as Partial<GameOverInfo> | null | undefined;
    sim.gameOver = go && go.reason === 'bankrupt' && typeof go.week === 'number' ? { reason: 'bankrupt', week: go.week } : null;
    const vi = data.victory as Partial<VictoryInfo> | null | undefined;
    sim.victory = vi && typeof vi.day === 'number' && typeof vi.week === 'number' ? { day: vi.day, week: vi.week } : null;
    const speeds = BALANCE.time.speeds as readonly number[];
    sim.speed = speeds.includes(data.speed) && data.speed !== 0 ? (data.speed as Speed) : 1;
    sim.lastRunningSpeed = sim.speed;
    sim.mode = data.mode === 'manage' ? 'manage' : 'avatar';
    sim.tool = TOOL_DEFS.some((t) => t.id === data.tool) ? (data.tool as Tool) : 'pet';
    sim.foodStock = numOr(data.foodStock, 0, 0);
    sim.treats = Math.floor(numOr(data.treats, 0, 0));
    if (data.stats && typeof data.stats === 'object') {
      for (const k of Object.keys(sim.stats) as Array<keyof SimStats>) {
        const v = (data.stats as Record<string, unknown>)[k];
        if (typeof v === 'number' && Number.isFinite(v)) sim.stats[k] = v;
      }
    }

    // Arsa (genişletilmiş olabilir): önce sınırı kaydedilen boyuta getir.
    if (data.plot && typeof data.plot.w === 'number' && typeof data.plot.h === 'number') {
      const sp = data.plot;
      const okSize = sp.w <= BALANCE.world.plotMaxW && sp.h <= BALANCE.world.plotMaxH;
      if (sp.x === world.plot.x && sp.y === world.plot.y && sp.w >= world.plot.w && sp.h >= world.plot.h && okSize) {
        for (let y = sp.y; y < sp.y + sp.h; y++) {
          for (let x = sp.x; x < sp.x + sp.w; x++) {
            if (!world.inBounds(x, y)) continue;
            const o = world.objectAt(x, y);
            if (o === Obj.TreeTrunk || o === Obj.PineTrunk) world.setObject(x, y - 1, Obj.None);
            world.setObject(x, y, Obj.None);
            world.setBiome(x, y, Biome.Plot);
          }
        }
        world.nests = world.nests.filter((nn) => !(nn.x >= sp.x && nn.y >= sp.y && nn.x < sp.x + sp.w && nn.y < sp.y + sp.h));
        world.plot = { x: sp.x, y: sp.y, w: sp.w, h: sp.h };
      }
    }
    if (Array.isArray(data.objectChanges)) {
      const oc = data.objectChanges;
      for (let k = 0; k + 1 < oc.length; k += 2) {
        const i = oc[k];
        const o = oc[k + 1];
        if (typeof i !== 'number' || typeof o !== 'number' || i < 0 || i >= world.object.length || o < 0 || o >= Obj.COUNT) continue;
        const x = i % world.width;
        const y = Math.floor(i / world.width);
        world.setObject(x, y, o as Obj);
        if ((o === Obj.NestEggs || o === Obj.Nest) && !world.nests.some((nn) => nn.x === x && nn.y === y)) world.nests.push({ x, y });
      }
    }
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
    const readMap = (arr: unknown): Map<number, number> => {
      const m = new Map<number, number>();
      if (!Array.isArray(arr)) return m;
      for (let k = 0; k + 1 < arr.length; k += 2) {
        const a = arr[k];
        const b = arr[k + 1];
        if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) m.set(a, b);
      }
      return m;
    };
    sim.nestTimers = readMap(data.nestTimers);
    sim.nestHarvests = readMap(data.nestHarvests);
    sim.bushTimers = readMap(data.bushTimers);
    if (typeof data.explored === 'string') sim.exploredCount = unpackExplored(data.explored, world.explored);
    sim.reputation = Math.min(100, numOr(data.reputation, BALANCE.economy.startReputation, 0));
    const lvl = Math.floor(numOr(data.licenseLevel, 1, 1));
    sim.licenseLevel = Math.min(BALANCE.economy.licenseCaps.length, Math.max(1, lvl));
    if (Array.isArray(data.ledger)) {
      for (const e of data.ledger as Partial<LedgerEntry>[]) {
        if (e && typeof e.week === 'number' && typeof e.amount === 'number' && typeof e.category === 'string') {
          sim.ledger.push({ week: e.week, day: typeof e.day === 'number' ? e.day : 1, category: e.category, amount: e.amount, note: typeof e.note === 'string' ? e.note : '' });
        }
      }
    }
    if (Array.isArray(data.weeks)) sim.weeks = (data.weeks as WeekSummary[]).filter((w) => w && typeof w.week === 'number');
    if (Array.isArray(data.adoptions)) sim.adoptions = (data.adoptions as AdoptionRecord[]).filter((a) => a && typeof a.day === 'number');
    if (Array.isArray(data.pendingReturns)) sim.pendingReturns = (data.pendingReturns as PendingReturn[]).filter((r) => r && typeof r.day === 'number' && r.dog);
    if (data.lastInspection && typeof data.lastInspection === 'object') sim.lastInspection = data.lastInspection as InspectionReport;

    // Binalar
    let maxId = 0;
    if (Array.isArray(data.buildings)) {
      for (const raw of data.buildings as Partial<BuildingSave>[]) {
        if (!raw || typeof raw.id !== 'number' || typeof raw.type !== 'string' || !(raw.type in BUILDING_DEFS)) continue;
        if (typeof raw.x !== 'number' || typeof raw.y !== 'number') continue;
        const rot = normalizeRot(raw.type, raw.rot);
        if (!canPlaceBuilding(world, raw.type, raw.x, raw.y, rot)) continue;
        const eggs: Egg[] = [];
        if (Array.isArray(raw.eggs)) {
          for (const e of raw.eggs) {
            const egg = eggFromJSON(e);
            if (egg) eggs.push(egg);
          }
        }
        const b: Building = {
          id: raw.id,
          type: raw.type,
          x: raw.x,
          y: raw.y,
          rot,
          food: numOr(raw.food, 0, 0),
          water: Math.min(BALANCE.shelter.troughCapacity, numOr(raw.water, raw.type === 'trough' ? BALANCE.shelter.troughCapacity : 0, 0)),
          occupants: [],
          buildLeft: numOr(raw.buildLeft, 0, 0),
          eggs,
          level: Math.min(2, Math.max(1, Math.floor(numOr(raw.level, 1, 1)))),
        };
        b.eggs = b.eggs.slice(0, incubatorSlots(b));
        sim.buildings.push(b);
        sim.buildingMap.set(b.id, b);
        stampBuilding(world, b);
        maxId = Math.max(maxId, b.id);
        for (const e of b.eggs) maxId = Math.max(maxId, e.id);
      }
    }
    if (Array.isArray(data.backpack)) {
      for (const e of data.backpack) {
        const egg = eggFromJSON(e);
        if (egg && sim.backpack.length < sim.backpackSlots()) {
          sim.backpack.push(egg);
          maxId = Math.max(maxId, egg.id);
        }
      }
    }

    // Köpekler
    if (Array.isArray(data.dogs)) {
      for (const raw of data.dogs) {
        const dog = Dog.fromJSON(raw);
        if (!dog || sim.dogMap.has(dog.id)) continue;
        sim.registerDog(dog);
        maxId = Math.max(maxId, dog.id);
        if (dog.wild) {
          dog.kennelId = null;
          if (world.isSolid(dog.tileX, dog.tileY)) {
            const den = dog.den ?? { x: Math.floor(world.spawn.x), y: Math.floor(world.spawn.y) };
            dog.x = den.x + 0.5;
            dog.y = den.y + 1.5;
          }
          continue;
        }
        const kennel = dog.kennelId !== null ? sim.buildingMap.get(dog.kennelId) : undefined;
        dog.kennelId = null;
        if (kennel && sim.kennelHasRoom(kennel, dog)) sim.assignKennel(dog, kennel);
        else {
          const free = sim.freeKennelFor(dog);
          if (free) sim.assignKennel(dog, free);
        }
        if (dog.walking) dog.walkLeftPlot = !world.inPlotInterior(dog.tileX, dog.tileY);
        if (!dog.walking && (!world.inPlotInterior(dog.tileX, dog.tileY) || world.isSolid(dog.tileX, dog.tileY))) {
          const k = dog.kennelId !== null ? sim.buildingMap.get(dog.kennelId) : undefined;
          const t = k ? kennelRestTile(k, k.occupants.indexOf(dog.id)) : { x: Math.floor(world.spawn.x), y: Math.floor(world.spawn.y) };
          dog.x = t.x + 0.5;
          dog.y = t.y + 0.5;
        }
      }
    }
    // Dostluk puanları: kayıtta olmayan köpeklere ait girişleri at.
    for (const d of sim.dogs) for (const k of Object.keys(d.friends)) if (!sim.dogMap.has(Number(k))) delete d.friends[Number(k)];
    if (Array.isArray(data.staff)) {
      for (const raw of data.staff) {
        const s = Staff.fromJSON(raw);
        if (!s || sim.staff.length >= maxStaff(sim)) continue;
        if (s.state !== 'offDuty' && world.isSolid(s.tileX, s.tileY)) {
          s.x = world.spawn.x;
          s.y = world.spawn.y;
        }
        sim.staff.push(s);
        maxId = Math.max(maxId, s.id);
      }
    }
    if (Array.isArray(data.candidates)) {
      for (const raw of data.candidates) {
        const s = Staff.fromJSON(raw);
        if (s) {
          sim.candidates.push(s);
          maxId = Math.max(maxId, s.id);
        }
      }
    }
    sim.candidatesDay = typeof data.candidatesDay === 'number' ? data.candidatesDay : 0;
    const vo = data.volunteerOffer ? Staff.fromJSON(data.volunteerOffer) : null;
    sim.volunteerOffer = vo && vo.volunteer ? vo : null;
    if (sim.volunteerOffer) maxId = Math.max(maxId, sim.volunteerOffer.id);
    if (data.policies && typeof data.policies === 'object') {
      const p = data.policies as Partial<Policies>;
      if (typeof p.autoOrderFood === 'boolean') sim.policies.autoOrderFood = p.autoOrderFood;
      if (typeof p.foodThreshold === 'number') sim.policies.foodThreshold = p.foodThreshold;
      if (typeof p.trainTarget === 'number') sim.policies.trainTarget = p.trainTarget;
      if (typeof p.quarantineSick === 'boolean') sim.policies.quarantineSick = p.quarantineSick;
      if (typeof p.adoptionsOpen === 'boolean') sim.policies.adoptionsOpen = p.adoptionsOpen;
    }
    sim.weatherSys.load(data.weather);
    sim.eventSys.load(data.eventLog);
    sim.achievements.load(data.achievements);
    if (data.flags && typeof data.flags === 'object') {
      const f = data.flags as Partial<SimFlags>;
      if (typeof f.foodDiscountDay === 'number') sim.flags.foodDiscountDay = f.foodDiscountDay;
      if (typeof f.extraAdoptersDay === 'number') sim.flags.extraAdoptersDay = f.extraAdoptersDay;
      if (typeof f.growlUntil === 'number') sim.flags.growlUntil = f.growlUntil;
      if (typeof f.growlA === 'string') sim.flags.growlA = f.growlA;
      if (typeof f.growlB === 'string') sim.flags.growlB = f.growlB;
    }
    if (Array.isArray(data.adopters)) {
      for (const raw of data.adopters) {
        const a = adopterFromJSON(raw);
        if (!a) continue;
        const ax = Math.floor(a.x);
        const ay = Math.floor(a.y);
        if (world.isSolid(ax, ay) && world.objectAt(ax, ay) !== Obj.Gate) continue;
        sim.adopters.push(a);
        maxId = Math.max(maxId, a.id);
      }
      // Yükleme sonrası yürüyenler/ayrılanlar yollarını yeniden bulur.
      for (const a of sim.adopters) {
        if (a.state === 'walking') a.state = 'waiting';
        else if (a.state === 'leaving') sim.adoption.leave(a);
      }
    }
    sim.nextId = Math.max(typeof data.nextId === 'number' ? data.nextId : 1, maxId + 1);

    // Kapı karesinde kaydedilmiş oyuncu için kapı önce açılır.
    sim.gates.update(0);
    if (player.collides(world, player.x, player.y)) {
      player.x = world.spawn.x;
      player.y = world.spawn.y;
    }
    world.dirty = [];
    sim.revealPlayer(true);
    if (sim.candidates.length === 0) {
      sim.staffSystem.refreshCandidates();
      sim.candidatesDay = sim.clock.day;
    }
    sim.alerts.refresh();
    return sim;
  }
}

function numOr(v: unknown, fallback: number, min: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback;
}
