import { signal } from '@preact/signals';
import type { Mode, Sim } from '../sim/Sim';
import type { Alert } from '../sim/systems/AlertSystem';
import { type Tool, resolveAction } from '../sim/systems/Interaction';

export type Screen = 'menu' | 'game';
export type Panel = 'none' | 'dog' | 'dogs' | 'shed' | 'kennel';

/**
 * Sim'den arayüze akan salt okunur durum. Paneller bunu okur, değişiklik için app/sim metodlarını çağırır.
 * WorldScene 10 Hz'de syncStore ile günceller. Ayrıntılı veriler (köpek ihtiyaçları vb.) panellerde
 * `tick` sinyaline abone olunarak doğrudan app.sim'den okunur.
 */
export const store = {
  screen: signal<Screen>('menu'),
  booted: signal(false),
  hasSave: signal(false),
  pauseMenu: signal(false),
  /** Bir metin kutusu odaktayken oyun tuşları devre dışı kalır. */
  inputFocused: signal(false),
  panel: signal<Panel>('none'),
  panelBuildingId: signal<number | null>(null),
  selectedDogId: signal<number | null>(null),
  /** 10 Hz'de artar; panellerin sim'den taze veri çekmesi için. */
  tick: signal(0),
  money: signal(0),
  timeText: signal('06:00'),
  dayText: signal(''),
  weekText: signal(''),
  speed: signal<number>(1),
  mode: signal<Mode>('avatar'),
  tool: signal<Tool>('pet'),
  hint: signal(''),
  stamina: signal(100),
  exhausted: signal(false),
  isNight: signal(false),
  playerTile: signal({ x: 0, y: 0 }),
  dogCount: signal(0),
  kennelCapacity: signal(0),
  foodStock: signal(0),
  alerts: signal<Alert[]>([]),
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
  store.tick.value++;
  store.money.value = sim.money;
  store.timeText.value = sim.clock.timeText();
  store.dayText.value = sim.clock.dayText();
  store.weekText.value = sim.clock.weekText();
  store.speed.value = sim.speed;
  store.mode.value = sim.mode;
  store.tool.value = sim.tool;
  store.stamina.value = Math.round(sim.player.stamina);
  store.exhausted.value = sim.player.exhausted;
  store.isNight.value = sim.clock.isNight();
  store.dogCount.value = sim.dogs.length;
  store.kennelCapacity.value = sim.kennelCapacity();
  store.foodStock.value = Math.floor(sim.foodStock);
  if (store.alerts.value !== sim.alerts.alerts) store.alerts.value = sim.alerts.alerts;
  const tx = sim.player.tileX;
  const ty = sim.player.tileY;
  const cur = store.playerTile.value;
  if (cur.x !== tx || cur.y !== ty) store.playerTile.value = { x: tx, y: ty };
  store.hint.value = hintFor(sim);
}

function hintFor(sim: Sim): string {
  if (sim.paused) return 'Duraklatıldı · Space: devam';
  if (sim.mode === 'manage') return 'Yönetim modu · WASD ya da sürükle: kaydır · Tekerlek: yakınlaştır · Tab: avatara dön';
  if (sim.player.exhausted) return 'Nefesin kesildi, biraz yürü';
  const action = resolveAction(sim);
  if (action.hint) return action.hint;
  return 'WASD: yürü · Shift: koş · 1-5: araç · E: etkileşim · I: köpek listesi · Tab: yönetim';
}
