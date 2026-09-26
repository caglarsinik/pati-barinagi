import { canRotate, type Rotation } from '../sim/entities/Building';
import { signal } from '@preact/signals';
import { BUILDING_DEFS, type BuildingType, TILE_TOOL_DEFS, type TileTool } from '../content/buildings';
import { type Mode, type Sim, type GameOverInfo, type VictoryInfo } from '../sim/Sim';
import { ZONE_NAMES_TR, Zone } from '../sim/world/tiles';
import type { Alert } from '../sim/systems/AlertSystem';
import type { WeekSummary } from '../sim/systems/EconomySystem';
import type { MorningReport } from '../sim/systems/DayReport';
import { SEASON_NAMES_TR, WEATHER_ICONS, WEATHER_NAMES_TR } from '../sim/systems/WeatherSystem';
import { t } from '../i18n';
import type { BeforeInstallPromptEvent } from '../pwa';
import { WEEKDAYS_TR } from '../core/Clock';
import { type Tool, resolveAction } from '../sim/systems/Interaction';

export type Screen = 'menu' | 'game';
/** Cihaz sınıfı: pencere boyutundan (app.ts) belirlenir. */
import type { Layout } from './layout';
import type { SaveSummary } from '../core/SaveManager';
export type { Layout };
export type TouchMode = 'auto' | 'on' | 'off';
export type Panel =
  | 'none'
  | 'dog'
  | 'dogs'
  | 'shed'
  | 'kennel'
  | 'incubator'
  | 'nursery'
  | 'egg'
  | 'office'
  | 'adoption'
  | 'finance'
  | 'staff'
  | 'deployment'
  | 'achievements'
  | 'help'
  | 'alerts'
  | 'backpack'
  | 'map'
  | 'computer'
  | 'furniture'
  | 'autoOrder'
  | 'clinic'
  | 'wholesale'
  | 'goals'
  | 'morning'
  | 'toyShop'
  | 'market'
  | 'travel'
  | 'quests'
  | 'mail'
  | 'album';

export type BuildTool =
  | { kind: 'none' }
  | { kind: 'building'; type: BuildingType; rot?: Rotation }
  | { kind: 'tile'; tool: TileTool }
  | { kind: 'demolish' }
  | { kind: 'zone'; zone: Zone };

/**
 * Sim'den arayüze akan salt okunur durum. Paneller bunu okur, değişiklik için app/sim metodlarını çağırır.
 * WorldScene 10 Hz'de syncStore ile günceller. Ayrıntılı veriler (köpek ihtiyaçları vb.) panellerde
 * `tick` sinyaline abone olunarak doğrudan app.sim'den okunur.
 */
export const store = {
  screen: signal<Screen>('menu'),
  booted: signal(false),
  hasSave: signal(false),
  /** Seçili kayıt yuvası (0-2) ve yuva özetleri (ana menü). */
  saveSlot: signal(0),
  slots: signal<Array<SaveSummary | null>>([null, null, null]),
  pauseMenu: signal(false),
  /** Bir metin kutusu odaktayken oyun tuşları devre dışı kalır. */
  inputFocused: signal(false),
  panel: signal<Panel>('none'),
  panelBuildingId: signal<number | null>(null),
  panelEggId: signal<number | null>(null),
  treats: signal(0),
  backpackCount: signal(0),
  reputation: signal(0),
  licenseLevel: signal(1),
  staffCount: signal(0),
  adoptersWaiting: signal(0),
  /** Hafta sonu raporu açık pencere. */
  report: signal<WeekSummary | null>(null),
  /** İflas ekranı (sim.gameOver yansıması). */
  gameOver: signal<GameOverInfo | null>(null),
  /** Zafer ekranı (sim.victory yansıması) ve görüldü mü (Devam et). */
  victory: signal<VictoryInfo | null>(null),
  victorySeen: signal(false),
  settingsOpen: signal(false),
  /** Tarayıcının "Ana ekrana ekle" istemi (Chrome/Edge); null ise düğme gösterilmez. */
  installPrompt: signal<BeforeInstallPromptEvent | null>(null),
  /** Yeni service worker indirildi; Ayarlar → Şimdi yenile. */
  updateReady: signal(false),
  guideHidden: signal(false),
  /** Sabah raporu (0.19.2): gösterilen rapor ve Ayarlar'daki kapatma. */
  morningReport: signal<MorningReport | null>(null),
  morningHidden: signal(false),
  /** Dünya üstü isim etiketleri (L). */
  labels: signal(true),
  /** Şu an gezdirilen köpeğin adı. */
  walkingDog: signal<string | null>(null),
  /** Alt menü çubuğunda açık olan kategori. */
  navMenu: signal<string | null>(null),
  /** Telefonda araç şeridi açık mı (ToolPopover). */
  toolMenu: signal(false),
  /** Sahiplendirme açık mı (politika). */
  adoptionsOpen: signal(true),
  /** Mini harita gizli (tercih tarayıcıda kalır). */
  minimapHidden: signal(false),
  /** Cihaz sınıfı ve dokunmatik kontroller (app.applyDevice). */
  layout: signal<Layout>('desktop'),
  touch: signal(false),
  orientationBlocked: signal(false),
  touchMode: signal<TouchMode>('auto'),
  /** Dokunmatik Koş anahtarı (readInput ile birleşir). */
  touchRun: signal(false),
  season: signal(''),
  weather: signal(''),
  weatherIcon: signal(''),
  /** Dil değişince arayüz yeniden çizilsin. */
  lang: signal<'tr' | 'en'>('tr'),
  buildBar: signal(false),
  /** İnşa çubuğunun açık sekmesi (0.19.1: hedef "Göster" sekmeyi seçer). */
  buildTab: signal<string>('altyapi'),
  build: signal<BuildTool>({ kind: 'none' }),
  selectedDogId: signal<number | null>(null),
  /** 10 Hz'de artar; panellerin sim'den taze veri çekmesi için. */
  tick: signal(0),
  money: signal(0),
  timeText: signal('06:00'),
  dayText: signal(''),
  weekText: signal(''),
  speed: signal<number>(1),
  mode: signal<Mode>('avatar'),
  autopilot: signal(false),
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
  /** Kısa bildirimler; en fazla 3 tanesi üst üste durur. */
  toasts: signal<Array<{ id: number; text: string }>>([]),
};

let toastSeq = 0;
const TOAST_MAX = 3;

export function showToast(message: string, ms = 2400): void {
  // Aynı bildirim ekrandayken yinelenmez (art arda dokunuşta "Şu an meşgul" yığılmasın).
  if (store.toasts.value.some((x) => x.text === message)) return;
  const id = ++toastSeq;
  const list = [...store.toasts.value, { id, text: message }];
  store.toasts.value = list.length > TOAST_MAX ? list.slice(list.length - TOAST_MAX) : list;
  setTimeout(() => {
    store.toasts.value = store.toasts.value.filter((x) => x.id !== id);
  }, ms);
}

export function syncStore(sim: Sim): void {
  store.tick.value++;
  store.money.value = sim.money;
  store.timeText.value = sim.clock.timeText();
  store.dayText.value = t('{day}. Gün · {weekday}', { day: sim.clock.day, weekday: t(WEEKDAYS_TR[sim.clock.weekday]) });
  store.weekText.value = t('{week}. Hafta', { week: sim.clock.week });
  store.speed.value = sim.speed;
  store.mode.value = sim.mode;
  store.autopilot.value = sim.autopilot;
  store.tool.value = sim.tool;
  store.stamina.value = Math.round(sim.player.stamina);
  store.exhausted.value = sim.player.exhausted;
  store.isNight.value = sim.clock.isNight();
  store.dogCount.value = sim.shelterDogs().length;
  store.treats.value = sim.treats;
  store.backpackCount.value = sim.backpack.length;
  store.reputation.value = Math.round(sim.reputation);
  store.staffCount.value = sim.staff.length;
  store.season.value = t(SEASON_NAMES_TR[sim.weatherSys.season]);
  store.weather.value = t(WEATHER_NAMES_TR[sim.weatherSys.weather]);
  store.weatherIcon.value = WEATHER_ICONS[sim.weatherSys.weather];
  store.licenseLevel.value = sim.licenseLevel;
  store.adoptersWaiting.value = sim.adopters.filter((a) => a.state === 'waiting').length;
  store.kennelCapacity.value = sim.kennelCapacity();
  store.foodStock.value = Math.floor(sim.foodStock);
  store.walkingDog.value = sim.dogs.find((d) => d.walking)?.name ?? null;
  store.adoptionsOpen.value = sim.policies.adoptionsOpen;
  if (store.alerts.value !== sim.alerts.alerts) store.alerts.value = sim.alerts.alerts;
  // Mini harita: iç odadayken bina kapısının önü.
  const po = sim.playerOutside;
  const tx = po.tileX;
  const ty = po.tileY;
  const cur = store.playerTile.value;
  if (cur.x !== tx || cur.y !== ty) store.playerTile.value = { x: tx, y: ty };
  store.hint.value = hintFor(sim);
}

/** Seçili inşa binasını 90° döndürür; kare binada uyarı verir. Döndüyse true. */
export function rotateBuildTool(): boolean {
  const tool = store.build.value;
  if (tool.kind !== 'building') return false;
  if (!canRotate(tool.type)) {
    showToast(t('Bu bina döndürülemez'));
    return false;
  }
  store.build.value = { kind: 'building', type: tool.type, rot: tool.rot === 1 ? 0 : 1 };
  return true;
}

/** İnşa aracının ipucu; dokunmatikte klavye/fare kısayolları yazılmaz (Döndür ve İptal ipucu satırında düğme). */
export function buildToolHint(tool: BuildTool, touch = store.touch.value): string {
  switch (tool.kind) {
    case 'building': {
      const d = BUILDING_DEFS[tool.type];
      if (touch) return t('{name} ({cost} ₺) · dokun: yerleştir', { name: t(d.name), cost: d.cost });
      if (canRotate(tool.type)) return t('{name} ({cost} ₺) · tıkla: yerleştir · R: döndür · sağ tık/Esc: iptal', { name: t(d.name), cost: d.cost });
      return t('{name} ({cost} ₺) · tıkla: yerleştir · sağ tık/Esc: iptal', { name: t(d.name), cost: d.cost });
    }
    case 'tile': {
      const d = TILE_TOOL_DEFS[tool.tool];
      if (touch) return t('{name} ({cost} ₺/kare) · sürükle: çizgi çek', { name: t(d.name), cost: d.cost });
      return t('{name} ({cost} ₺/kare) · sürükle: çizgi çek · Esc: iptal', { name: t(d.name), cost: d.cost });
    }
    case 'demolish':
      return touch ? t('Yık · dokun: kaldır (yarısı iade)') : t('Yık · tıkla: kaldır (yarısı iade) · Esc: iptal');
    case 'zone': {
      const zone = tool.zone === Zone.None ? t('Bölge sil') : t(ZONE_NAMES_TR[tool.zone]);
      return touch ? t('{zone} · sürükle: dikdörtgen boya', { zone }) : t('{zone} · sürükle: dikdörtgen boya · Esc: iptal', { zone });
    }
    default:
      return '';
  }
}

/**
 * E düğmesinin etiketi (dokunmatik): ipucundaki "E: …" işi, parantez içi ayrıntı (porsiyon, yüzde, fiyat) atılır; iş yoksa
 * null (düğme "Yakında iş yok"). Otopilot açıkken ipucu "🤖 … · E: …" olur.
 */
export function actionLabel(hint: string): string | null {
  const m = /(?:^|· )E: (.+)$/.exec(hint);
  if (!m) return null;
  return m[1].replace(/\s*\([^)]*\)/g, '').trim() || m[1];
}

function hintFor(sim: Sim): string {
  const touch = store.touch.value;
  if (sim.paused && store.build.value.kind === 'none') return touch ? t('Duraklatıldı · ▶ ile devam') : t('Duraklatıldı · Space: devam');
  if (sim.mode === 'manage') {
    const bt = buildToolHint(store.build.value, touch);
    if (bt) return bt;
    if (touch) return t('Yönetim modu · sürükle: kaydır · iki parmak: yakınlaştır');
    return t('Yönetim modu · B: inşa · sağ tık ya da WASD: kaydır · Tekerlek: yakınlaştır · Tab: avatara dön');
  }
  if (sim.player.exhausted) return t('Nefesin kesildi, biraz yürü');
  const action = resolveAction(sim);
  // Otopilot açıkken durum metni; önünde yapılacak iş varsa E etiketi de kalsın (TouchControls 'E:' arar).
  if (sim.autopilot) return action.hint.startsWith('E:') ? `${sim.autopilotText} · ${action.hint}` : sim.autopilotText;
  if (action.hint) return action.hint;
  // Dokunmatikte genel ipucunda "E:" yok: E düğmesi bunu iş sanıp etkin kalmasın (0.21.6).
  if (touch) return t('Dokun: yürü · köpeğe/binaya dokun: iş yap · uzun bas: seç');
  return t('WASD: yürü · Shift: koş · 1-5: araç · E: etkileşim · I: köpek listesi · Tab: yönetim');
}
