import Phaser from 'phaser';
import { GAME } from '../config/game';
import { SIZE_SCALE, STAGE_SCALE } from '../render/DogPainter';
import { EMOTE_TEX, emoteFrame } from '../render/EmoteArt';
import { HUMAN_H } from '../render/HumanPainter';
import type { Sim } from '../sim/Sim';
import { type Emote, adopterEmote, dogEmote, staffEmote } from '../sim/systems/Emotes';
import { store } from '../ui/store';

interface Entry {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface Transient {
  emote: Emote;
  /** Sahne zamanı (ms). */
  until: number;
}

export interface OverlaySceneData {
  sim: Sim;
}

/**
 * Dünya üstü göstergeler: emote balonları ve isim etiketleri.
 * World sahnesinin üstünde paralel çalışır, kamerasını birebir kopyalar; sim'e hiç yazmaz.
 * Sadece kamera görüş alanındaki varlıklar için nesne tutar (havuz).
 */
export class OverlayScene extends Phaser.Scene {
  /** Etiketlerin göründüğü en düşük yakınlaştırma (seçili köpek her zaman). */
  static readonly LABEL_ZOOM = 2;

  private sim!: Sim;
  private pool: Entry[] = [];
  private used = new Map<string, Entry>();
  private transient = new Map<string, Transient>();
  private unsub: Array<() => void> = [];
  private textRes = 1;

  constructor() {
    super('Overlay');
  }

  init(data: OverlaySceneData): void {
    this.sim = data.sim;
  }

  create(): void {
    this.cameras.main.roundPixels = true;
    this.transient.clear();
    this.unsub.push(
      this.sim.events.on('emote', (e) => {
        this.transient.set(`${e.kind[0]}${e.id}`, { emote: e.emote, until: this.time.now + e.seconds * 1000 });
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u();
      this.unsub = [];
      this.pool = [];
      this.used.clear();
      this.transient.clear();
    });
  }

  override update(): void {
    if (!this.scene.isActive('World')) return;
    const world = this.scene.get('World');
    const cam = world.cameras.main;
    const my = this.cameras.main;
    my.setZoom(cam.zoom);
    my.setScroll(cam.scrollX, cam.scrollY);
    const res = Math.min(4, Math.max(1, Math.ceil(cam.zoom)));
    if (res !== this.textRes) {
      this.textRes = res;
      for (const e of this.used.values()) e.label.setResolution(res);
      for (const e of this.pool) e.label.setResolution(res);
    }

    const T = GAME.tile;
    const v = cam.worldView;
    const margin = 2 * T;
    const inView = (x: number, y: number): boolean => x >= v.x - margin && x <= v.right + margin && y >= v.y - margin && y <= v.bottom + margin;
    const labelsOn = store.labels.value && cam.zoom >= OverlayScene.LABEL_ZOOM;
    const selected = store.selectedDogId.value;
    const now = this.time.now;
    const seen = new Set<string>();

    for (const d of this.sim.dogs) {
      const px = Math.round(d.x * T);
      const py = Math.round(d.y * T + 6);
      if (!inView(px, py)) continue;
      const key = `d${d.id}`;
      const emote = this.pick(key, now) ?? dogEmote(d);
      const name = !d.wild && (labelsOn || selected === d.id) ? d.name : '';
      if (!emote && !name) continue;
      const scale = SIZE_SCALE[d.genome.size] * STAGE_SCALE[d.stage];
      this.place(key, px, py, Math.round(20 * scale) + 4, emote, name, seen, now);
    }
    for (const s of this.sim.staff) {
      if (s.state === 'offDuty') continue;
      const px = Math.round(s.x * T);
      const py = Math.round(s.y * T + 6);
      if (!inView(px, py)) continue;
      const key = `s${s.id}`;
      const emote = this.pick(key, now) ?? staffEmote(s);
      const name = labelsOn ? s.name : '';
      if (!emote && !name) continue;
      this.place(key, px, py, HUMAN_H + 2, emote, name, seen, now);
    }
    for (const a of this.sim.adopters) {
      const px = Math.round(a.x * T);
      const py = Math.round(a.y * T + 6);
      if (!inView(px, py)) continue;
      const key = `a${a.id}`;
      const emote = this.pick(key, now) ?? adopterEmote(a);
      const name = labelsOn && a.state === 'waiting' ? a.name : '';
      if (!emote && !name) continue;
      this.place(key, px, py, HUMAN_H + 2, emote, name, seen, now);
    }

    for (const [key, e] of this.used) {
      if (seen.has(key)) continue;
      e.icon.setVisible(false);
      e.label.setVisible(false);
      this.pool.push(e);
      this.used.delete(key);
    }
    for (const [k, tr] of this.transient) if (tr.until <= now) this.transient.delete(k);
  }

  private pick(key: string, now: number): Emote | null {
    const tr = this.transient.get(key);
    if (!tr) return null;
    if (tr.until <= now) {
      this.transient.delete(key);
      return null;
    }
    return tr.emote;
  }

  private acquire(): Entry {
    const e = this.pool.pop();
    if (e) return e;
    const icon = this.add.image(0, 0, EMOTE_TEX, 0).setOrigin(0.5, 1).setDepth(10);
    const label = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', stroke: '#24203a', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setDepth(9)
      .setResolution(this.textRes);
    return { icon, label };
  }

  private place(key: string, px: number, py: number, headOffset: number, emote: Emote | null, name: string, seen: Set<string>, now: number): void {
    seen.add(key);
    let e = this.used.get(key);
    if (!e) {
      e = this.acquire();
      this.used.set(key, e);
    }
    const top = py - headOffset;
    if (name) {
      if (e.label.text !== name) e.label.setText(name);
      e.label.setPosition(px, top).setVisible(true);
    } else e.label.setVisible(false);
    if (emote) {
      const bob = Math.round(Math.sin(now / 260) + 1);
      e.icon.setFrame(emoteFrame(emote));
      e.icon.setPosition(px, top - (name ? 9 : 0) - bob).setVisible(true);
    } else e.icon.setVisible(false);
  }
}
