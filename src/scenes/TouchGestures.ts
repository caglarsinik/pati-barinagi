/**
 * Dokunma ve fare jestleri (Phaser'sız, test edilebilir). Sahne her işaretçi olayını `GesturePointer`'a çevirip buraya
 * verir; dönen jest olaylarını uygular (kamera, dokun-git, köpek seçimi, inşa). Telefonda yaşanan kalıcı takılmalara karşı
 * kurallar burada toplanır:
 * - #ui üstünde başlayan işaretçi dünya jesti üretmez; basılı değilken gelen hareketi kaydını siler (kaçan bırakma).
 * - Pinch yalnız iki basılı, UI olmayan, **taze** (son `staleMs` içinde olay üretmiş) dokunma işaretçisiyle olur; bırakma
 *   olayı kaçmış bayat bir parmak sonraki dokunuşları pinch'e çevirmez, `update()` bayat pinch'i bitirir.
 * - İkinci parmak inince tek parmak jesti iptal edilir (iki parmakla dokunuş yürüme sayılmaz); pinch biterken kalan parmağın
 *   bırakması dokunuş üretmez.
 * - Hareket eşiği basış noktasından toplam uzaklıkla ölçülür; eşik aşılınca uzun basış iptal olur.
 */

export interface GesturePointer {
  id: number;
  /** Ekran (tuval) koordinatı, piksel. */
  x: number;
  y: number;
  /** Dünya koordinatı, kare. */
  wx: number;
  wy: number;
  button: number;
  touch: boolean;
  /** Olay hedefi arayüz katmanında mı (#ui). */
  ui: boolean;
  isDown: boolean;
  /** Olay zamanı (ms). */
  now: number;
  /** Bu basışta uzun basış açık mı (sahne: dokunma + avatar modu). */
  longPress?: boolean;
}

export type GestureEvent =
  | { type: 'press'; x: number; y: number; wx: number; wy: number; button: number; touch: boolean }
  | { type: 'drag'; x: number; y: number; dx: number; dy: number; button: number }
  | { type: 'longPress'; wx: number; wy: number }
  | { type: 'release'; x: number; y: number; wx: number; wy: number; button: number; touch: boolean; moved: boolean; longPressed: boolean }
  | { type: 'pinchStart' }
  | { type: 'pinch'; scale: number; dx: number; dy: number }
  | { type: 'pinchEnd' }
  | { type: 'cancel' };

export interface GestureConfig {
  /** Dokunmada tap sayılmak için en çok kayma (piksel, DPR dahil). */
  touchSlop: number;
  mouseSlop: number;
  longPressMs: number;
  /** Bu süredir olay üretmeyen basılı işaretçi bayat sayılır. */
  staleMs: number;
}

interface Track {
  x: number;
  y: number;
  down: boolean;
  seen: number;
  ui: boolean;
  touch: boolean;
}

interface Drag {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  downWx: number;
  downWy: number;
  button: number;
  touch: boolean;
  moved: boolean;
  longPressOn: boolean;
  longPressed: boolean;
  downAt: number;
}

interface Pinch {
  a: number;
  b: number;
  startDist: number;
  mid: { x: number; y: number };
}

export class TouchGestures {
  private readonly ptrs = new Map<number, Track>();
  private drag: Drag | null = null;
  private pinchState: Pinch | null = null;

  constructor(private readonly cfg: GestureConfig) {}

  get pinching(): boolean {
    return this.pinchState !== null;
  }

  /** Süren tek parmak/fare jesti var mı. */
  get dragging(): boolean {
    return this.drag !== null;
  }

  down(p: GesturePointer): GestureEvent[] {
    const out: GestureEvent[] = [];
    this.ptrs.set(p.id, { x: p.x, y: p.y, down: true, seen: p.now, ui: p.ui, touch: p.touch });
    if (p.ui) return out;
    if (this.pinchState) {
      if (this.fresh(p.now).length >= 2) return out; // pinch sürüyor: üçüncü parmak yok sayılır
      this.pinchState = null;
      out.push({ type: 'pinchEnd' });
    }
    if (p.touch && this.fresh(p.now).length >= 2) {
      this.startPinch(p.now, out);
      return out;
    }
    if (this.drag) out.push({ type: 'cancel' }); // bırakması kaçmış eski jest
    this.drag = {
      id: p.id,
      startX: p.x,
      startY: p.y,
      x: p.x,
      y: p.y,
      downWx: p.wx,
      downWy: p.wy,
      button: p.button,
      touch: p.touch,
      moved: false,
      longPressOn: p.longPress === true,
      longPressed: false,
      downAt: p.now,
    };
    out.push({ type: 'press', x: p.x, y: p.y, wx: p.wx, wy: p.wy, button: p.button, touch: p.touch });
    return out;
  }

  move(p: GesturePointer): GestureEvent[] {
    const out: GestureEvent[] = [];
    const tr = this.ptrs.get(p.id);
    if (tr?.ui) {
      if (p.isDown) return out;
      this.ptrs.delete(p.id); // bırakma olayı kaçmış: bayat kaydı temizle
      return out;
    }
    if (!tr || !tr.down || !p.isDown) return out; // fare gezinmesi ya da izlenmeyen işaretçi
    tr.x = p.x;
    tr.y = p.y;
    tr.seen = p.now;
    if (this.pinchState) {
      this.pinchMove(p.now, out);
      return out;
    }
    if (p.touch && this.fresh(p.now).length >= 2) {
      this.startPinch(p.now, out);
      return out;
    }
    const d = this.drag;
    if (!d || d.id !== p.id) return out;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const slop = d.touch ? this.cfg.touchSlop : this.cfg.mouseSlop;
    if (Math.abs(p.x - d.startX) + Math.abs(p.y - d.startY) > slop) d.moved = true;
    d.x = p.x;
    d.y = p.y;
    out.push({ type: 'drag', x: p.x, y: p.y, dx, dy, button: d.button });
    return out;
  }

  up(p: GesturePointer): GestureEvent[] {
    const out: GestureEvent[] = [];
    const tr = this.ptrs.get(p.id);
    this.ptrs.delete(p.id);
    if (tr?.ui) return out; // UI üstünde başlayan dokunuş: dünya tıklaması değil
    if (this.pinchState) {
      if (this.fresh(p.now).length < 2) {
        this.pinchState = null;
        out.push({ type: 'pinchEnd' });
      }
      return out;
    }
    const d = this.drag;
    if (!d || d.id !== p.id) return out;
    this.drag = null;
    out.push({ type: 'release', x: p.x, y: p.y, wx: p.wx, wy: p.wy, button: d.button, touch: d.touch, moved: d.moved, longPressed: d.longPressed });
    return out;
  }

  /** Her karede: bayat pinch'i bitirir, süresi dolan uzun basışı bildirir. */
  update(now: number): GestureEvent[] {
    const out: GestureEvent[] = [];
    if (this.pinchState && this.fresh(now).length < 2) {
      this.pinchState = null;
      out.push({ type: 'pinchEnd' });
    }
    const d = this.drag;
    if (d && d.longPressOn && !d.moved && !d.longPressed && now - d.downAt >= this.cfg.longPressMs) {
      d.longPressed = true;
      out.push({ type: 'longPress', wx: d.downWx, wy: d.downWy });
    }
    return out;
  }

  /** Dokunma iptali, odak/sekme kaybı, sahne kapanışı: her şeyi bırakır. */
  reset(): GestureEvent[] {
    const out: GestureEvent[] = [];
    if (this.pinchState) out.push({ type: 'pinchEnd' });
    if (this.drag) out.push({ type: 'cancel' });
    this.pinchState = null;
    this.drag = null;
    this.ptrs.clear();
    return out;
  }

  /** Basılı, UI olmayan, taze dokunma işaretçileri. */
  private fresh(now: number): number[] {
    const ids: number[] = [];
    for (const [id, tr] of this.ptrs) {
      if (tr.down && !tr.ui && tr.touch && now - tr.seen <= this.cfg.staleMs) ids.push(id);
    }
    return ids;
  }

  private startPinch(now: number, out: GestureEvent[]): void {
    const [a, b] = this.fresh(now);
    const pa = this.ptrs.get(a)!;
    const pb = this.ptrs.get(b)!;
    if (this.drag) {
      this.drag = null;
      out.push({ type: 'cancel' });
    }
    this.pinchState = { a, b, startDist: Math.max(1, Math.hypot(pa.x - pb.x, pa.y - pb.y)), mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } };
    out.push({ type: 'pinchStart' });
  }

  private pinchMove(now: number, out: GestureEvent[]): void {
    const ps = this.pinchState!;
    const ids = this.fresh(now);
    if (!ids.includes(ps.a) || !ids.includes(ps.b)) return; // parmaklardan biri bayatladı: update() bitirir
    const pa = this.ptrs.get(ps.a)!;
    const pb = this.ptrs.get(ps.b)!;
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const scale = Math.max(1, Math.hypot(pa.x - pb.x, pa.y - pb.y)) / ps.startDist;
    out.push({ type: 'pinch', scale, dx: mid.x - ps.mid.x, dy: mid.y - ps.mid.y });
    ps.mid = mid;
  }
}
