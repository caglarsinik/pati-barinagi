import Phaser from 'phaser';
import { bindUiKeyboard } from './ui/keyboard';
import { OrientationPause, portraitBlocked } from './ui/OrientationPause';
import { classifyLayout } from './ui/layout';
import { audio } from './audio/audio';
import { GAME } from './config/game';
import { type Lang, getLang, initLang, setLang, t } from './i18n';
import type { Speed } from './config/balance';
import type { Tool } from './sim/systems/Interaction';
import type { BuildTool, Layout, Panel, TouchMode } from './ui/store';
import { parseSeed } from './core/Rng';
import { DPR } from './render/dpr';
import { SaveManager } from './core/SaveManager';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { OverlayScene } from './scenes/OverlayScene';
import { Sim, DIFFICULTIES, type Difficulty } from './sim/Sim';
import { showToast, store, syncStore } from './ui/store';

const SLOT = 0;

/** Görünür pencere boyutu; gizli/henüz yerleşmemiş pencerede 0 döner. */
function viewport(): { w: number; h: number } {
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  const h = window.innerHeight || document.documentElement.clientHeight || 0;
  return { w, h };
}

/** Menü ile oyun arasındaki köprü: Phaser oyununu ve aktif Sim'i tutar. */
class AppController {
  game: Phaser.Game | null = null;
  sim: Sim | null = null;
  private unsub: Array<() => void> = [];
  private pausedBeforeMenu = false;
  /** Kullanıcı en az bir kez dokundu (karma cihazlarda otomatik dokunmatik). */
  private touchSeen = false;
  private readonly orientationPause = new OrientationPause();

  init(parent: string): void {
    initLang();
    store.lang.value = getLang();
    document.title = t(GAME.name);
    const ui = document.getElementById('ui');
    if (ui) bindUiKeyboard(ui, () => {
      for (const scene of this.game?.scene.getScenes(true) ?? []) scene.input.keyboard?.resetKeys();
      this.sim?.nav.cancel();
    });
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#1b1a2a',
      pixelArt: true,
      roundPixels: true,
      disableContextMenu: true,
      // Pencere boyutunu kendimiz yönetiyoruz: ebeveyn ölçümüne güvenmek 0x0 tuval üretebiliyor.
      // Arka tampon pencere × DPR, CSS boyutu pencere: yüksek DPR'da piksel sanatı net kalır (zoom 1/DPR).
      scale: { mode: Phaser.Scale.NONE, width: Math.max(320, viewport().w) * DPR, height: Math.max(240, viewport().h) * DPR, zoom: 1 / DPR },
      render: { antialias: false, powerPreference: 'high-performance' },
      // İki işaretçi: pinch yakınlaştırma ve iki parmakla kaydırma.
      input: { activePointers: 2 },
      // Telefon: pil için 30 kare/sn yeter (sim gerçek zamanı dt ile ölçekler).
      fps: viewport().w <= 767 || viewport().h <= 500 ? { limit: 30 } : undefined,
      scene: [BootScene, WorldScene, OverlayScene],
    });
    // Gömülü tarayıcılar ilk anda 0 boyut bildirebiliyor; hem resize olayında hem periyodik kontrol et.
    const syncSize = (): void => {
      const s = this.game?.scale;
      if (!s) return;
      const { w, h } = viewport();
      if (w < 64 || h < 64) return; // pencere gizli: son geçerli boyutu koru
      const bw = w * DPR;
      const bh = h * DPR;
      if (s.width !== bw || s.height !== bh) s.resize(bw, bh);
      this.applyDevice();
    };
    window.addEventListener(
      'touchstart',
      () => {
        this.touchSeen = true;
        this.applyDevice();
        // Telefonda yatay kilit dene (tam ekran/Android'de çalışır, diğerleri yok sayar).
        try {
          const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> };
          if (store.layout.value === 'phone' && typeof o?.lock === 'function') o.lock('landscape').catch(() => undefined);
        } catch {
          /* yoksay */
        }
      },
      { once: true, passive: true },
    );
    window.addEventListener('resize', syncSize);
    window.setInterval(syncSize, 500);
    this.game.events.on('ui:escape', () => this.togglePauseMenu());
    this.game.events.on('ui:build-toggle', () => this.toggleBuildBar());
    this.game.events.on('ui:labels-toggle', () => {
      this.setLabels(!store.labels.value);
      showToast(store.labels.value ? t('İsim etiketleri açık (L)') : t('İsim etiketleri kapalı (L)'));
    });
    store.hasSave.value = SaveManager.has(SLOT);
    window.addEventListener('beforeunload', () => this.save(true));
    // Ses: ilk kullanıcı hareketinde açılır; arayüz düğmeleri tık sesi verir.
    const unlock = (): void => audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.getElementById('ui')?.addEventListener('click', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('button')) audio.play('click', {}, 60);
    });
    try {
      store.guideHidden.value = localStorage.getItem(`${SaveManager.key(0)}.guideHidden`) === '1';
      store.labels.value = localStorage.getItem(`${SaveManager.key(0)}.labels`) !== '0';
      store.minimapHidden.value = localStorage.getItem(`${SaveManager.key(0)}.minimapHidden`) === '1';
      const tm = localStorage.getItem(`${SaveManager.key(0)}.touchMode`);
      if (tm === 'on' || tm === 'off') store.touchMode.value = tm;
    } catch {
      /* yoksay */
    }
  }

  /**
   * Cihaz sınıfı (pencere boyutu) ve dokunmatik kontroller: telefon = genişlik <= 767 ya da yükseklik <= 500,
   * tablet = genişlik <= 1023. Dokunmatik: ayar "açık/kapalı" değilse kaba işaretçi, ilk dokunuş ya da ?touch=1.
   * Sonuç html sınıflarına (layout-*, is-touch) ve store'a yazılır; CSS aynı eşikleri medya sorgusuyla kullanır.
   */
  applyDevice(): void {
    const { w, h } = viewport();
    if (w < 64 || h < 64) return;
    const layout: Layout = classifyLayout(w, h);
    const mode = store.touchMode.value;
    let touch: boolean;
    if (mode === 'on') touch = true;
    else if (mode === 'off') touch = false;
    else {
      const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      const query = /[?&]touch=1/.test(window.location.search);
      touch = coarse || this.touchSeen || query;
    }
    if (store.layout.value !== layout) store.layout.value = layout;
    if (store.touch.value !== touch) store.touch.value = touch;
    const cl = document.documentElement.classList;
    cl.toggle('is-touch', touch);
    const blocked = portraitBlocked(w, h);
    store.orientationBlocked.value = blocked;
    if (this.sim) this.orientationPause.update(this.sim, blocked, store.pauseMenu.value || !!store.report.value);
    for (const l of ['desktop', 'tablet', 'phone'] as Layout[]) cl.toggle(`layout-${l}`, l === layout);
  }

  /** Son seçilen zorluk (tarayıcıda kalır). */
  lastDifficulty(): Difficulty {
    try {
      const v = localStorage.getItem(`${SaveManager.key(0)}.difficulty`);
      if (v && (DIFFICULTIES as readonly string[]).includes(v)) return v as Difficulty;
    } catch {
      /* yoksay */
    }
    return 'normal';
  }

  setTouchMode(mode: TouchMode): void {
    store.touchMode.value = mode;
    try {
      localStorage.setItem(`${SaveManager.key(0)}.touchMode`, mode);
    } catch {
      /* yoksay */
    }
    this.applyDevice();
  }

  /** Mini haritayı gizle/göster; tercih tarayıcıda kalır. */
  setMinimap(hidden: boolean): void {
    store.minimapHidden.value = hidden;
    try {
      localStorage.setItem(`${SaveManager.key(0)}.minimapHidden`, hidden ? '1' : '0');
    } catch {
      /* yoksay */
    }
  }

  /** Dünya üstü isim etiketleri; tercih tarayıcıda kalır. */
  setLabels(on: boolean): void {
    store.labels.value = on;
    try {
      localStorage.setItem(`${SaveManager.key(0)}.labels`, on ? '1' : '0');
    } catch {
      /* yoksay */
    }
  }

  newGame(seedInput: string, difficulty: Difficulty = 'normal'): void {
    const seed = parseSeed(seedInput);
    try {
      localStorage.setItem(`${SaveManager.key(0)}.difficulty`, difficulty);
    } catch {
      /* yoksay */
    }
    this.start(Sim.create(seed, difficulty));
    showToast(t('Yeni dünya · tohum {seed}', { seed }));
  }

  continueGame(): boolean {
    const data = SaveManager.read(SLOT);
    if (!data) {
      store.hasSave.value = false;
      showToast(t('Kayıt bulunamadı'));
      return false;
    }
    this.start(Sim.fromJSON(data));
    showToast(t('Kayıt yüklendi'));
    return true;
  }

  private start(sim: Sim): void {
    if (!this.game) throw new Error('Oyun başlatılmadı');
    this.detach();
    this.orientationPause.reset();
    this.sim = sim;
    store.seed.value = sim.seed;
    store.version.value++;
    this.unsub.push(
      sim.events.on('hour', (h) => {
        if (h === 6) this.save(true);
      }),
      sim.events.on('speedChanged', (s) => {
        store.speed.value = s;
      }),
    );
    this.unsub.push(
      sim.events.on('hour', () => audio.setMusicMode(sim.clock.isNight() ? 'night' : 'day')),
      sim.events.on('dogHatched', () => audio.play('hatch')),
      sim.events.on('dogTamed', () => audio.play('tame')),
      sim.events.on('weekReport', () => audio.play('week')),
      sim.events.on('gameOver', (info) => {
        store.gameOver.value = info;
        // Sim durduğu için üst şerit kendiliğinden yenilenmez; son kasa değeri hemen yansısın.
        syncStore(sim);
        audio.play('error');
      }),
      sim.events.on('adopterArrived', () => audio.play('alert')),
      sim.events.on('slept', () => audio.play('sleep')),
      sim.events.on('buildingReady', () => audio.play('build')),
    );
    audio.startMusic(sim.clock.isNight() ? 'night' : 'day');
    const sm = this.game.scene;
    if (sm.isActive('World') || sm.isPaused('World')) sm.stop('World');
    sm.start('World', { sim });
    store.pauseMenu.value = false;
    store.panel.value = 'none';
    store.selectedDogId.value = null;
    store.buildBar.value = false;
    store.build.value = { kind: 'none' };
    store.screen.value = 'game';
    this.applyDevice();
    store.gameOver.value = sim.gameOver;
    syncStore(sim);
  }

  private detach(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  save(silent = false): boolean {
    if (!this.sim) return false;
    const ok = SaveManager.write(SLOT, this.sim.toJSON());
    if (ok) store.hasSave.value = true;
    if (!silent) showToast(ok ? t('Oyun kaydedildi') : t('Kayıt yazılamadı'));
    return ok;
  }

  toMenu(): void {
    if (!this.game) return;
    this.save(true);
    this.game.scene.stop('World');
    this.detach();
    this.sim = null;
    audio.stopMusic();
    store.settingsOpen.value = false;
    store.pauseMenu.value = false;
    store.gameOver.value = null;
    store.screen.value = 'menu';
  }

  openPauseMenu(): void {
    if (!this.sim || store.pauseMenu.value) return;
    this.pausedBeforeMenu = this.sim.paused;
    this.sim.setSpeed(0);
    store.pauseMenu.value = true;
  }

  closePauseMenu(): void {
    if (!store.pauseMenu.value) return;
    store.pauseMenu.value = false;
    if (this.sim && !this.pausedBeforeMenu) this.sim.togglePause();
  }

  /** Esc: önce inşa aracı, sonra açık panel kapanır; hiçbiri yoksa duraklatma menüsü açılır/kapanır. */
  togglePauseMenu(): void {
    if (store.screen.value !== 'game') return;
    if (!store.pauseMenu.value && store.navMenu.value !== null) {
      store.navMenu.value = null;
      return;
    }
    if (!store.pauseMenu.value && store.build.value.kind !== 'none') {
      store.build.value = { kind: 'none' };
      return;
    }
    if (!store.pauseMenu.value && store.buildBar.value) {
      store.buildBar.value = false;
      return;
    }
    if (!store.pauseMenu.value && store.panel.value !== 'none') {
      this.closePanel();
      return;
    }
    if (store.pauseMenu.value) this.closePauseMenu();
    else this.openPauseMenu();
  }

  togglePanel(panel: Panel): void {
    store.panel.value = store.panel.value === panel ? 'none' : panel;
  }

  /** İnşa çubuğunu açar (gerekirse yönetim moduna geçer). */
  toggleBuildBar(): void {
    if (!this.sim) return;
    if (store.buildBar.value) {
      store.buildBar.value = false;
      store.build.value = { kind: 'none' };
      return;
    }
    if (this.sim.mode !== 'manage') this.sim.setMode('manage');
    store.buildBar.value = true;
  }

  setBuildTool(tool: BuildTool): void {
    store.build.value = tool;
  }

  closePanel(): void {
    store.panel.value = 'none';
    if (store.selectedDogId.value !== null) store.selectedDogId.value = null;
  }

  setSpeed(s: Speed): void {
    this.sim?.setSpeed(s);
  }

  toggleMode(): void {
    this.sim?.toggleMode();
  }

  setTool(tool: Tool): void {
    this.sim?.command({ type: 'setTool', tool });
  }

  /** Kamerayı bir kareye götürür (yönetim moduna geçer). */
  focusTile(x: number, y: number): void {
    this.game?.events.emit('ui:focus-tile', { x, y });
  }

  setLang(l: Lang): void {
    setLang(l);
    store.lang.value = l;
    document.title = t(GAME.name);
    if (this.sim) {
      this.sim.alerts.refresh();
      syncStore(this.sim);
    }
  }

  setGuideHidden(hidden: boolean): void {
    store.guideHidden.value = hidden;
    try {
      localStorage.setItem(`${SaveManager.key(0)}.guideHidden`, hidden ? '1' : '0');
    } catch {
      /* yoksay */
    }
  }

  exportSave(): string {
    return this.sim ? SaveManager.exportText(this.sim.toJSON()) : '';
  }

  downloadSave(): void {
    if (!this.sim) return;
    try {
      const blob = new Blob([this.exportSave()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pati-barinagi-gun${this.sim.clock.day}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast(t('İndirme başlatılamadı; panoya kopyalamayı dene'));
    }
  }

  /** Yapıştırılan ya da dosyadan gelen kaydı doğrulayıp yükler. */
  importSave(text: string): boolean {
    let data;
    try {
      data = SaveManager.parse(text);
    } catch {
      data = null;
    }
    if (!data) {
      showToast(t('Kayıt okunamadı: geçerli bir JSON değil'));
      audio.play('error');
      return false;
    }
    try {
      const sim = Sim.fromJSON(data);
      SaveManager.write(SLOT, sim.toJSON());
      store.settingsOpen.value = false;
      this.start(sim);
      showToast(t('Kayıt içe aktarıldı'));
      return true;
    } catch (err) {
      console.warn(err);
      showToast(t('Kayıt yüklenemedi'));
      audio.play('error');
      return false;
    }
  }
}

export const app = new AppController();
