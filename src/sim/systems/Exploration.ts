import { BALANCE } from '../../config/balance';
import type { Sim } from '../Sim';

/** Oyuncunun çevresini keşfedilmiş işaretler (sis kalkar). Sadece kare değişince çağrılır. */
export function revealAround(sim: Sim, cx: number, cy: number): void {
  const w = sim.world;
  const r = BALANCE.exploration.revealRadius;
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 0 || y >= w.height) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= w.width) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = w.idx(x, y);
      if (w.explored[i] === 0) {
        w.explored[i] = 1;
        sim.exploredCount++;
      }
    }
  }
}

/** Keşfedilen kareleri base64 bit paketine çevirir (kayıt). */
export function packExplored(explored: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(explored.length / 8));
  for (let i = 0; i < explored.length; i++) if (explored[i]) bytes[i >> 3] |= 1 << (i & 7);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function unpackExplored(packed: string, explored: Uint8Array): number {
  let bin: string;
  try {
    bin = atob(packed);
  } catch {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < explored.length; i++) {
    const byte = bin.charCodeAt(i >> 3);
    if (Number.isNaN(byte)) break;
    const bit = (byte >> (i & 7)) & 1;
    explored[i] = bit;
    if (bit) count++;
  }
  return count;
}
