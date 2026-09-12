import { GAME } from '../config/game';
import { Music, type MusicMode } from './Music';
import { type SfxName, type SfxOpts, playSfx } from './Sfx';
import { Synth } from './Synth';

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}

const DEFAULTS: AudioSettings = { master: 0.8, sfx: 0.9, music: 0.5, muted: false };

/**
 * Ses yolu: master → sfx / music kazançları. Ayarlar localStorage'da saklanır.
 * `SoundSource` mantığı: gerçek ses dosyalarına geçmek istersen playSfx'i dosya oynatanla değiştirmen yeter.
 */
class AudioEngine {
  settings: AudioSettings = { ...DEFAULTS };
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private music: Music | null = null;
  private lastPlayed = new Map<string, number>();
  private wantMusic: MusicMode | null = null;

  constructor() {
    this.load();
  }

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** İlk tıklama/tuşta çağrılır; AudioContext ancak o zaman açılabilir. */
  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.synth = new Synth(this.ctx);
        this.master = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.musicGain.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.music = new Music(this.synth, this.musicGain);
        this.applyVolumes();
      } catch (err) {
        console.warn('Ses açılamadı:', err);
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.wantMusic && this.music && !this.music.isRunning) this.music.start(this.wantMusic);
  }

  play(name: SfxName, opts: SfxOpts = {}, minGapMs = 40): void {
    if (!this.synth || !this.sfxGain || this.settings.muted) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.lastPlayed.set(name, now);
    try {
      playSfx(this.synth, this.sfxGain, name, opts);
    } catch {
      /* sessizce geç */
    }
  }

  startMusic(mode: MusicMode): void {
    this.wantMusic = mode;
    if (this.music) {
      this.music.setMode(mode);
      if (!this.music.isRunning) this.music.start(mode);
    }
  }

  setMusicMode(mode: MusicMode): void {
    this.wantMusic = mode;
    this.music?.setMode(mode);
  }

  stopMusic(): void {
    this.wantMusic = null;
    this.music?.stop();
  }

  update(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.applyVolumes();
    this.save();
  }

  private applyVolumes(): void {
    if (!this.master || !this.sfxGain || !this.musicGain) return;
    const s = this.settings;
    this.master.gain.value = s.muted ? 0 : s.master;
    this.sfxGain.gain.value = s.sfx;
    this.musicGain.gain.value = s.music;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(GAME.settingsKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<AudioSettings>;
      for (const k of ['master', 'sfx', 'music'] as const) {
        if (typeof d[k] === 'number' && Number.isFinite(d[k])) this.settings[k] = Math.max(0, Math.min(1, d[k] as number));
      }
      if (typeof d.muted === 'boolean') this.settings.muted = d.muted;
    } catch {
      /* varsayılanlar */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(GAME.settingsKey, JSON.stringify(this.settings));
    } catch {
      /* yoksay */
    }
  }
}

export const audio = new AudioEngine();
