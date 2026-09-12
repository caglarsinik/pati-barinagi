/**
 * Tohumlu rastgele sayı üreteci (mulberry32). Aynı tohum her zaman aynı diziyi verir;
 * dünya üretimi, genom ve testler bunun üzerine kurulur.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** [0, 1) aralığında sayı. */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] aralığında tam sayı (iki uç dahil). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Ağırlıklı seçim: weights[i] >= 0. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Bu üreteçten bağımsız, deterministik bir alt üreteç. */
  fork(salt: number): Rng {
    return new Rng(hash2(this.s, salt));
  }

  get state(): number {
    return this.s;
  }

  set state(v: number) {
    this.s = v >>> 0;
  }
}

/** İki tam sayıyı tek bir 32 bit hash'e karıştırır. */
export function hash2(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = (h ^ (b + 0x7f4a7c15)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

export function hash3(a: number, b: number, c: number): number {
  return hash2(hash2(a, b), c);
}

/** Metinden tohum üretir ("kopek" gibi bir kelimeyi tohum olarak yazmak için). */
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Kullanıcının yazdığı tohum: sayıysa sayı, değilse metin hash'i. */
export function parseSeed(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  if (/^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  return hashStr(trimmed);
}
