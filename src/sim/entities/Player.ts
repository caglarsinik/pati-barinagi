import { BALANCE } from '../../config/balance';
import type { TileWorld } from '../world/TileWorld';
import { Ground } from '../world/tiles';

/** 0 aşağı, 1 sol, 2 sağ, 3 yukarı. */
export type Facing = 0 | 1 | 2 | 3;

export interface PlayerInput {
  /** -1, 0, 1 */
  dx: number;
  dy: number;
  run: boolean;
}

export const IDLE_INPUT: PlayerInput = { dx: 0, dy: 0, run: false };

/**
 * Oyuncu avatarı. Konum kare biriminde, ayak merkezine göre (x: 12.5 = 12. karenin ortası).
 * Hareket gerçek zamanlıdır (oyun hızından bağımsız), çarpışma kare ızgarasına karşı.
 */
export class Player {
  x: number;
  y: number;
  facing: Facing = 0;
  moving = false;
  running = false;
  stamina: number = BALANCE.player.staminaMax;
  exhausted = false;
  /** Yürüme animasyonu için biriken süre (saniye). */
  animTime = 0;
  /** Bir eylem yaparken kalan süre (gerçek saniye); bu sürede hareket edemez. */
  busy = 0;
  busyTotal = 0;
  busyAction: string | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get tileX(): number {
    return Math.floor(this.x);
  }

  get tileY(): number {
    return Math.floor(this.y - 0.2);
  }

  /** Baktığı kare. */
  facingTile(): { x: number; y: number } {
    const d = FACING_DELTA[this.facing];
    return { x: Math.floor(this.x + d.x * 0.8), y: Math.floor(this.y - 0.2 + d.y * 0.8) };
  }

  setBusy(seconds: number, action: string): void {
    this.busy = seconds;
    this.busyTotal = seconds;
    this.busyAction = action;
    this.moving = false;
  }

  update(dtSec: number, input: PlayerInput, world: TileWorld): void {
    const p = BALANCE.player;
    let dx = input.dx;
    let dy = input.dy;
    if (this.busy > 0) {
      this.busy -= dtSec;
      if (this.busy <= 0) {
        this.busy = 0;
        this.busyAction = null;
      }
      dx = 0;
      dy = 0;
    }
    this.moving = dx !== 0 || dy !== 0;

    if (this.exhausted && this.stamina > 25) this.exhausted = false;
    if (this.stamina <= 0) this.exhausted = true;
    this.running = input.run && this.moving && !this.exhausted;

    if (this.moving) {
      if (dx !== 0 && dy !== 0) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }
      // Yön: yatay baskınsa sol/sağ, değilse yukarı/aşağı.
      if (Math.abs(input.dx) >= Math.abs(input.dy)) this.facing = input.dx < 0 ? 1 : 2;
      else this.facing = input.dy < 0 ? 3 : 0;
      const onPath = world.groundAt(this.tileX, this.tileY) === Ground.Path;
      const speed = (this.running ? p.runSpeed : p.walkSpeed) * (onPath ? 1.15 : 1);
      this.moveAxis(world, dx * speed * dtSec, 0);
      this.moveAxis(world, 0, dy * speed * dtSec);
      this.animTime += dtSec * (this.running ? 1.6 : 1);
    } else {
      this.animTime = 0;
    }

    if (this.running) this.stamina = Math.max(0, this.stamina - p.staminaDrainPerSecond * dtSec);
    else this.stamina = Math.min(p.staminaMax, this.stamina + p.staminaRegenPerSecond * dtSec);
  }

  private moveAxis(world: TileWorld, dx: number, dy: number): void {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!this.collides(world, nx, ny)) {
      this.x = nx;
      this.y = ny;
      return;
    }
    // Duvara yapışma yerine küçük adımlarla mümkün olduğunca yaklaş.
    const steps = 4;
    for (let s = steps - 1; s >= 1; s--) {
      const px = this.x + (dx * s) / steps;
      const py = this.y + (dy * s) / steps;
      if (!this.collides(world, px, py)) {
        this.x = px;
        this.y = py;
        return;
      }
    }
  }

  /** Ayak kutusu: x ± w/2, y-h .. y. */
  collides(world: TileWorld, x: number, y: number): boolean {
    const { w, h } = BALANCE.player.hitbox;
    const x0 = x - w / 2;
    const x1 = x + w / 2 - 0.001;
    const y0 = y - h;
    const y1 = y - 0.001;
    return (
      world.isSolid(Math.floor(x0), Math.floor(y0)) ||
      world.isSolid(Math.floor(x1), Math.floor(y0)) ||
      world.isSolid(Math.floor(x0), Math.floor(y1)) ||
      world.isSolid(Math.floor(x1), Math.floor(y1))
    );
  }

  toJSON(): PlayerSave {
    return { x: this.x, y: this.y, facing: this.facing, stamina: this.stamina };
  }

  static fromJSON(data: unknown, fallback: { x: number; y: number }): Player {
    const d = (data ?? {}) as Partial<PlayerSave>;
    const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : fallback.x;
    const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : fallback.y;
    const p = new Player(x, y);
    if (d.facing === 0 || d.facing === 1 || d.facing === 2 || d.facing === 3) p.facing = d.facing;
    if (typeof d.stamina === 'number' && Number.isFinite(d.stamina)) {
      p.stamina = Math.min(BALANCE.player.staminaMax, Math.max(0, d.stamina));
    }
    return p;
  }
}

export interface PlayerSave {
  x: number;
  y: number;
  facing: Facing;
  stamina: number;
}

export const FACING_DELTA: Record<Facing, { x: number; y: number }> = {
  0: { x: 0, y: 1 },
  1: { x: -1, y: 0 },
  2: { x: 1, y: 0 },
  3: { x: 0, y: -1 },
};
