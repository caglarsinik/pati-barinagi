import { BALANCE } from '../config/balance';

export interface TapDog {
  id: number;
  x: number;
  y: number;
}

export interface TapPick<T extends TapDog> {
  dog: T;
  /** true: yanına gidip işini yap; false: dokunuş köpeğe değil çevresine sayılır (yürüyüş ya da karedeki nesne). */
  interact: boolean;
}

/**
 * Dokunuşa en yakın köpek ve ona kilitlenilip kilitlenilmeyeceği (Phaser'sız, test edilebilir).
 * - Köpeğin üstüne dokunuş (dogDirectTiles içinde) her zaman köpeğe gider.
 * - Çevresine dokunuş (dogSnapTiles içinde) yalnız oyuncu köpekten uzaksa köpeğe kilitlenir: uzaktan hedeflemek kolay
 *   kalır. Oyuncu zaten köpeğin dibindeyse (nav.reachDist) dokunuş yürüyüş sayılır; yoksa eğitilen/oturan köpeğin
 *   yanından hiçbir kareye yürünemiyor, her dokunuş aynı işi yineliyordu.
 */
export function pickTapDog<T extends TapDog>(dogs: readonly T[], player: { x: number; y: number }, wx: number, wy: number): TapPick<T> | null {
  const C = BALANCE.touch;
  let best: T | null = null;
  let bestD: number = C.dogSnapTiles;
  for (const dog of dogs) {
    const d = Math.hypot(dog.x - wx, dog.y - 0.2 - wy);
    if (d < bestD) {
      bestD = d;
      best = dog;
    }
  }
  if (!best) return null;
  if (bestD <= C.dogDirectTiles) return { dog: best, interact: true };
  const reach = Math.hypot(best.x - player.x, best.y - 0.3 - (player.y - 0.2));
  return { dog: best, interact: reach > BALANCE.nav.reachDist };
}
