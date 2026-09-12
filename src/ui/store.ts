import { signal } from '@preact/signals';
import type { Mode, Sim } from '../sim/Sim';

export type Screen = 'menu' | 'game';

/**
 * Sim'den arayüze akan salt okunur durum. Paneller bunu okur, değişiklik için app/sim metodlarını çağırır.
 * WorldScene 10 Hz'de syncStore ile günceller.
 */
export const store = {
  screen: signal<Screen>('menu'),
  booted: signal(false),
  hasSave: signal(false),
  pauseMenu: signal(false),
  /** Bir metin kutusu odaktayken oyun tuşları devre dışı kalır. */
  inputFocused: signal(false),
  money: signal(0),
  timeText: signal('06:00'),
  dayText: signal(''),
  weekText: signal(''),
  speed: signal<number>(1),
  mode: signal<Mode>('avatar'),
  hint: signal(''),
  stamina: signal(100),
  exhausted: signal(false),
  isNight: signal(false),
  playerTile: signal({ x: 0, y: 0 }),
  seed: signal(0),
  /** Yeni sim başladığında artar; mini harita gibi ağır çizimler bununla yenilenir. */
  version: signal(0),
  toast: signal<string | null>(null),
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, ms = 2400): void {
  store.toast.value = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    store.toast.value = null;
    toastTimer = null;
  }, ms);
}

export function syncStore(sim: Sim): void {
  store.money.value = sim.money;
  store.timeText.value = sim.clock.timeText();
  store.dayText.value = sim.clock.dayText();
  store.weekText.value = sim.clock.weekText();
  store.speed.value = sim.speed;
  store.mode.value = sim.mode;
  store.stamina.value = Math.round(sim.player.stamina);
  store.exhausted.value = sim.player.exhausted;
  store.isNight.value = sim.clock.isNight();
  const tx = sim.player.tileX;
  const ty = sim.player.tileY;
  const cur = store.playerTile.value;
  if (cur.x !== tx || cur.y !== ty) store.playerTile.value = { x: tx, y: ty };
  store.hint.value = hintFor(sim);
}

function hintFor(sim: Sim): string {
  if (sim.paused) return 'Duraklatıldı · Space: devam';
  if (sim.mode === 'manage') return 'Yönetim modu · WASD ya da sürükle: kaydır · Tekerlek: yakınlaştır · Tab: avatara dön';
  if (sim.player.exhausted) return 'Nefesin kesildi, biraz yürü · Tab: yönetim modu';
  return 'WASD: yürü · Shift: koş · Tab: yönetim modu · Space: duraklat · +/-: hız';
}
