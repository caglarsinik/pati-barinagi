import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('../../public/icons/', import.meta.url));
const MANIFEST = fileURLToPath(new URL('../../public/manifest.webmanifest', import.meta.url));
const EXPECTED: Array<[string, number]> = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon-180.png', 180],
  ['favicon-32.png', 32],
];

describe('PWA ikonları', () => {
  it.each(EXPECTED)('%s geçerli PNG ve %d piksel', (name, size) => {
    const buf = readFileSync(DIR + name);
    // PNG imzası ve IHDR boyutları
    expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.toString('ascii', 12, 16)).toBe('IHDR');
    expect(buf.readUInt32BE(16)).toBe(size);
    expect(buf.readUInt32BE(20)).toBe(size);
    expect(buf[24]).toBe(8); // bit derinliği
    expect(buf[25]).toBe(6); // RGBA
    expect(buf.length).toBeGreaterThan(200);
  });

  it('manifest ikon dosyalarını gösteriyor', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { icons?: Array<{ src: string; sizes: string }> };
    for (const icon of manifest.icons ?? []) {
      const file = icon.src.replace(/^\.\//, '').replace(/^icons\//, '');
      expect(EXPECTED.some(([n]) => n === file), icon.src).toBe(true);
    }
  });
});
