import Phaser from 'phaser';
import type { Speed } from './config/balance';
import type { Tool } from './sim/systems/Interaction';
import type { BuildTool, Panel } from './ui/store';
import { parseSeed } from './core/Rng';
import { SaveManager } from './core/SaveManager';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { Sim } from './sim/Sim';
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

  init(parent: string): void {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#1b1a2a',
      pixelArt: true,
      roundPixels: true,
      disableContextMenu: true,
      // Pencere boyutunu kendimiz yönetiyoruz: ebeveyn ölçümüne güvenmek 0x0 tuval üretebiliyor.
      scale: { mode: Phaser.Scale.NONE, width: Math.max(320, viewport().w), height: Math.max(240, viewport().h) },
      render: { antialias: false, powerPreference: 'high-performance' },
      scene: [BootScene, WorldScene],
    });
    // Gömülü tarayıcılar ilk anda 0 boyut bildirebiliyor; hem resize olayında hem periyodik kontrol et.
    const syncSize = (): void => {
      const s = this.game?.scale;
      if (!s) return;
      const { w, h } = viewport();
      if (w < 64 || h < 64) return; // pencere gizli: son geçerli boyutu koru
      if (s.width !== w || s.height !== h) s.resize(w, h);
    };
    window.addEventListener('resize', syncSize);
    window.setInterval(syncSize, 500);
    this.game.events.on('ui:escape', () => this.togglePauseMenu());
    this.game.events.on('ui:build-toggle', () => this.toggleBuildBar());
    store.hasSave.value = SaveManager.has(SLOT);
    window.addEventListener('beforeunload', () => this.save(true));
  }

  newGame(seedInput: string): void {
    const seed = parseSeed(seedInput);
    this.start(Sim.create(seed));
    showToast(`Yeni dünya · tohum ${seed}`);
  }

  continueGame(): boolean {
    const data = SaveManager.read(SLOT);
    if (!data) {
      store.hasSave.value = false;
      showToast('Kayıt bulunamadı');
      return false;
    }
    this.start(Sim.fromJSON(data));
    showToast('Kayıt yüklendi');
    return true;
  }

  private start(sim: Sim): void {
    if (!this.game) throw new Error('Oyun başlatılmadı');
    this.detach();
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
    const sm = this.game.scene;
    if (sm.isActive('World') || sm.isPaused('World')) sm.stop('World');
    sm.start('World', { sim });
    store.pauseMenu.value = false;
    store.panel.value = 'none';
    store.selectedDogId.value = null;
    store.buildBar.value = false;
    store.build.value = { kind: 'none' };
    store.screen.value = 'game';
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
    if (!silent) showToast(ok ? 'Oyun kaydedildi' : 'Kayıt yazılamadı');
    return ok;
  }

  toMenu(): void {
    if (!this.game) return;
    this.save(true);
    this.game.scene.stop('World');
    this.detach();
    this.sim = null;
    store.pauseMenu.value = false;
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
}

export const app = new AppController();
