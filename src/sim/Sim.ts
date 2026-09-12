import { BALANCE, type Speed } from '../config/balance';
import { GAME } from '../config/game';
import { Clock } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import { Rng, hash2 } from '../core/Rng';
import type { SaveData } from '../core/SaveManager';
import { IDLE_INPUT, Player, type PlayerInput } from './entities/Player';
import type { TileWorld } from './world/TileWorld';
import { generateWorld } from './world/WorldGen';

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
}

/**
 * Oyunun tamamı: dünya, saat, oyuncu ve (ileride) tüm sistemler.
 * Phaser'dan bağımsızdır; testler bunu doğrudan kurup koşturur.
 */
export class Sim {
  readonly seed: number;
  readonly rng: Rng;
  readonly clock: Clock;
  readonly world: TileWorld;
  readonly player: Player;
  readonly events = new EventBus<SimEvents>();
  speed: Speed = 1;
  mode: Mode = 'avatar';
  money: number;
  private lastRunningSpeed: Speed = 1;

  private constructor(seed: number, world: TileWorld, clock: Clock, player: Player, money: number) {
    this.seed = seed;
    this.rng = new Rng(hash2(seed, 0xa11ce));
    this.world = world;
    this.clock = clock;
    this.player = player;
    this.money = money;
  }

  static create(seed: number): Sim {
    const world = generateWorld(seed);
    const player = new Player(world.spawn.x, world.spawn.y);
    return new Sim(seed, world, new Clock(), player, BALANCE.economy.startMoney);
  }

  get paused(): boolean {
    return this.speed === 0;
  }

  /** Gerçek zamanlı bir kare ilerletir. Oyuncu hareketi gerçek zamanlı, saat oyun hızıyla ölçekli. */
  update(dtSec: number, input: PlayerInput = IDLE_INPUT): void {
    if (this.paused || dtSec <= 0) return;
    const dtMin = dtSec * BALANCE.time.minutesPerRealSecond * this.speed;
    const crossed = this.clock.advance(dtMin);
    for (const h of crossed.hours) this.events.emit('hour', h);
    for (const d of crossed.days) this.events.emit('day', d);
    for (const w of crossed.weeks) this.events.emit('week', w);
    if (this.mode === 'avatar') this.player.update(dtSec, input, this.world);
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

  toJSON(): SaveData {
    return {
      version: GAME.saveVersion,
      savedAt: Date.now(),
      seed: this.seed,
      clock: this.clock.toJSON(),
      player: this.player.toJSON(),
      speed: this.speed,
      mode: this.mode,
      money: this.money,
    };
  }

  /** Doğrulayarak yükler: bozuk alanlar varsayılana döner, oyuncu duvar içindeyse doğuş noktasına alınır. */
  static fromJSON(data: SaveData): Sim {
    const world = generateWorld(data.seed >>> 0);
    const clock = Clock.fromJSON(data.clock);
    const player = Player.fromJSON(data.player, world.spawn);
    if (player.collides(world, player.x, player.y)) {
      player.x = world.spawn.x;
      player.y = world.spawn.y;
    }
    const money = typeof data.money === 'number' && Number.isFinite(data.money) ? data.money : BALANCE.economy.startMoney;
    const sim = new Sim(data.seed >>> 0, world, clock, player, money);
    const speeds = BALANCE.time.speeds as readonly number[];
    sim.speed = speeds.includes(data.speed) && data.speed !== 0 ? (data.speed as Speed) : 1;
    sim.lastRunningSpeed = sim.speed;
    sim.mode = data.mode === 'manage' ? 'manage' : 'avatar';
    return sim;
  }
}
