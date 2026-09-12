import { describe, expect, it } from 'vitest';
import { Rng, hash2, hashStr, parseSeed } from '../../src/core/Rng';

describe('Rng', () => {
  it('aynı tohum aynı diziyi verir', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('farklı tohumlar farklı dizi verir', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBeLessThan(3);
  });

  it('int aralığı iki ucu da kapsar', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('weighted ağırlığı sıfır olanı seçmez', () => {
    const r = new Rng(9);
    for (let i = 0; i < 500; i++) expect(r.weighted(['a', 'b', 'c'], [1, 0, 2])).not.toBe('b');
  });

  it('fork deterministik ve ana üreteçten bağımsızdır', () => {
    const a = new Rng(5);
    const f1 = a.fork(1).next();
    a.next();
    const f2 = new Rng(5).fork(1).next();
    expect(f1).toBe(f2);
  });

  it('hash ve parseSeed kararlı', () => {
    expect(hash2(1, 2)).toBe(hash2(1, 2));
    expect(hash2(1, 2)).not.toBe(hash2(2, 1));
    expect(hashStr('boncuk')).toBe(hashStr('boncuk'));
    expect(parseSeed('1234')).toBe(1234);
    expect(parseSeed(' boncuk ')).toBe(hashStr('boncuk'));
    expect(parseSeed('')).not.toBeNaN();
  });
});
