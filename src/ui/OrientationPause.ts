import type { Speed } from '../config/balance';
interface ClockControl { speed: Speed; gameOver: unknown; setSpeed(speed: Speed): void }
/** Dar (≤ 767 px) ve dikey ya da kare pencere: CSS `orientation: portrait` gibi h ≥ w (0.23.5). */
export function portraitBlocked(width: number, height: number): boolean { return width <= 767 && height >= width; }
/** Keeps orientation suspension independent from a manually paused game. */
export class OrientationPause {
  private saved: Speed | null = null;
  reset(): void { this.saved = null; }
  update(sim: ClockControl, blocked: boolean, otherPause: boolean): void {
    if (blocked) {
      if (this.saved === null) this.saved = sim.speed;
      sim.setSpeed(0);
    } else if (this.saved !== null) {
      const speed = this.saved;
      this.saved = null;
      if (!otherPause && !sim.gameOver) sim.setSpeed(speed);
    }
  }
}
