/**
 * Küçük piksel tuvali. Tüm sprite'lar burada çizilir, sonra canvas'a aktarılıp Phaser dokusu olur.
 * Tarayıcıya bağımlı tek metod `toCanvas`; geri kalanı Node'da da çalışır (testler için).
 */
export type RGBA = readonly [number, number, number, number];

export const TRANSPARENT: RGBA = [0, 0, 0, 0];

export function hex(h: number, a = 255): RGBA {
  return [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff, a];
}

/** İki rengi karıştırır (t=0 a, t=1 b). */
export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

/** Rengi koyulaştırır/açar: k<1 koyu, k>1 açık. */
export function shade(c: RGBA, k: number): RGBA {
  return [clamp255(c[0] * k), clamp255(c[1] * k), clamp255(c[2] * k), c[3]];
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export class Pixels {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }

  get(x: number, y: number): RGBA {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return TRANSPARENT;
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  isOpaque(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.data[(y * this.w + x) * 4 + 3] > 0;
  }

  fill(c: RGBA): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c);
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  /** Piksel merkezleri (px+0.5) elips içindeyse boyar. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    const x0 = Math.max(0, Math.floor(cx - rx - 1));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx + 1));
    const y0 = Math.max(0, Math.floor(cy - ry - 1));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    void dx;
    void dy;
  }

  /** Opak bölgenin dışına 1 piksel dış çizgi çeker (4 komşuluk). */
  outline(c: RGBA): void {
    const mask = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.isOpaque(x, y)) continue;
        if (this.isOpaque(x - 1, y) || this.isOpaque(x + 1, y) || this.isOpaque(x, y - 1) || this.isOpaque(x, y + 1)) {
          mask[y * this.w + x] = 1;
        }
      }
    }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (mask[y * this.w + x]) this.set(x, y, c);
  }

  /** Opak kısımlara verilen rengi belirli oranda karıştırır (renklendirme/gölge). */
  tintOpaque(c: RGBA, t: number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.isOpaque(x, y)) continue;
        this.set(x, y, mix(this.get(x, y), c, t));
      }
    }
  }

  /** Kaynağın opak piksellerini üstüne kopyalar. */
  blit(src: Pixels, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        if (!src.isOpaque(x, y)) continue;
        this.set(dx + x, dy + y, src.get(x, y));
      }
    }
  }

  flipH(): Pixels {
    const out = new Pixels(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(this.w - 1 - x, y, this.get(x, y));
    return out;
  }

  crop(x: number, y: number, w: number, h: number): Pixels {
    const out = new Pixels(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.set(xx, yy, this.get(x + xx, y + yy));
    return out;
  }

  /** Tarayıcıda: piksel verisini canvas'a döker. */
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas bağlamı alınamadı');
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}
