import Phaser from 'phaser';
import { GAME } from '../config/game';
import { SIZE_SCALE, STAGE_SCALE } from '../render/DogPainter';
import { EMOTE_SIZE, EMOTE_TEX, emoteFrame } from '../render/EmoteArt';
import { HUMAN_H } from '../render/HumanPainter';
import { DPR } from '../render/dpr';
import type { Sim } from '../sim/Sim';
import { type Emote, adopterEmote, dogEmote, staffEmote } from '../sim/systems/Emotes';
import { store } from '../ui/store';

interface Entry {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

/** Etiket ya da balonun ekrandaki kutusu (dünya pikseli). */
interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Bu karede yerleşecek gösterge: öncelik sırasıyla yerleştirilir. */
interface Candidate {
  key: string;
  px: number;
  py: number;
  head: number;
  emote: Emote | null;
  name: string;
  /** 2: seçili köpek (etiketi hep görünür), 1: balonlu, 0: yalnız isim. */
  rank: number;
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
 * Kümede isimler birbirinin ve balonların üstüne binmez (0.21.6): öncelik seçili köpek, balonlu varlık, oyuncuya yakınlık;
 * yer bulamayan isim o kare gizlenir, balon kalır.
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
  /** İsim genişlikleri (dünya pikseli, 8 px eş aralıklı yazı + kontur). */
  private widths = new Map<string, number>();
  private measure: CanvasRenderingContext2D | null = null;

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
    const res = Math.min(4 * DPR, Math.max(1, Math.ceil(cam.zoom)));
    if (res !== this.textRes) {
      this.textRes = res;
      for (const e of this.used.values()) e.label.setResolution(res);
      for (const e of this.pool) e.label.setResolution(res);
    }

    const T = GAME.tile;
    const v = cam.worldView;
    const margin = 2 * T;
    const inView = (x: number, y: number): boolean => x >= v.x - margin && x <= v.right + margin && y >= v.y - margin && y <= v.bottom + margin;
    const labelsOn = store.labels.value && cam.zoom >= OverlayScene.LABEL_ZOOM * DPR;
    const selected = store.selectedDogId.value;
    const now = this.time.now;
    const seen = new Set<string>();
    const cands: Candidate[] = [];

    for (const d of this.sim.dogs) {
      const px = Math.round(d.x * T);
      const py = Math.round(d.y * T + 6);
      if (!inView(px, py)) continue;
      const key = `d${d.id}`;
      const emote = this.pick(key, now) ?? dogEmote(d);
      const name = !d.wild && (labelsOn || selected === d.id) ? d.name : '';
      if (!emote && !name) continue;
      const scale = SIZE_SCALE[d.genome.size] * STAGE_SCALE[d.stage];
      cands.push({ key, px, py, head: Math.round(20 * scale) + 4, emote, name, rank: selected === d.id ? 2 : emote ? 1 : 0 });
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
      cands.push({ key, px, py, head: HUMAN_H + 2, emote, name, rank: emote ? 1 : 0 });
    }
    for (const a of this.sim.adopters) {
      const px = Math.round(a.x * T);
      const py = Math.round(a.y * T + 6);
      if (!inView(px, py)) continue;
      const key = `a${a.id}`;
      const emote = this.pick(key, now) ?? adopterEmote(a);
      const name = labelsOn && a.state === 'waiting' ? a.name : '';
      if (!emote && !name) continue;
      cands.push({ key, px, py, head: HUMAN_H + 2, emote, name, rank: emote ? 1 : 0 });
    }

    // Köylü görevleri (0.20.4): kayıp köpeğin üstünde pati (bulununca kalp), kabul edilmiş görevi olan köylünün üstünde soru.
    const lost = this.sim.quests.lostDog();
    if (lost) {
      const px = Math.round(lost.x * T);
      const py = Math.round(lost.y * T + 6);
      const scale = SIZE_SCALE[lost.genome.size] * STAGE_SCALE[lost.stage];
      if (inView(px, py)) cands.push({ key: 'q0', px, py, head: Math.round(20 * scale) + 4, emote: lost.found ? 'heart' : 'paw', name: labelsOn ? lost.name : '', rank: 1 });
    }
    for (const v of this.sim.villagers.list) {
      if (v.inside || !this.sim.quests.activeFor(v.index)) continue;
      const px = Math.round(v.x * T);
      const py = Math.round(v.y * T + 6);
      if (inView(px, py)) cands.push({ key: `v${v.index}`, px, py, head: HUMAN_H + 2, emote: 'question', name: '', rank: 1 });
    }

    // Öncelik sırasıyla yerleştir: isim kutusu önceki bir isim ya da balonla çakışırsa gizlenir (seçili köpek hariç).
    const ox = this.sim.player.x * T;
    const oy = this.sim.player.y * T;
    const dist = (c: Candidate): number => Math.abs(c.px - ox) + Math.abs(c.py - oy);
    cands.sort((a, b) => b.rank - a.rank || dist(a) - dist(b) || (a.key < b.key ? -1 : 1));
    const taken: Box[] = [];
    const hit = (q: Box): boolean => taken.some((o) => q.l < o.r && q.r > o.l && q.t < o.b && q.b > o.t);
    for (const c of cands) {
      const top = c.py - c.head;
      let name = c.name;
      if (name) {
        const w = this.nameWidth(name);
        const box = { l: c.px - w / 2, r: c.px + w / 2, t: top - 9, b: top };
        if (c.rank < 2 && hit(box)) name = '';
        else taken.push(box);
      }
      if (c.emote) {
        const b = top - (name ? 9 : 0);
        taken.push({ l: c.px - EMOTE_SIZE / 2, r: c.px + EMOTE_SIZE / 2, t: b - EMOTE_SIZE - 2, b });
      }
      this.place(c.key, c.px, c.py, c.head, c.emote, name, seen, now);
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

  /** İsim etiketinin genişliği (dünya pikseli; önbellekli). */
  private nameWidth(name: string): number {
    let w = this.widths.get(name);
    if (w !== undefined) return w;
    this.measure ??= document.createElement('canvas').getContext('2d');
    if (this.measure) this.measure.font = '8px monospace';
    w = (this.measure ? this.measure.measureText(name).width : name.length * 5) + 4;
    if (this.widths.size > 400) this.widths.clear();
    this.widths.set(name, w);
    return w;
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
