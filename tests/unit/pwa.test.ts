import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { installHint, isStandalone } from '../../src/pwa';

const pub = (name: string): string => fileURLToPath(new URL(`../../public/${name}`, import.meta.url));

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

describe('PWA yardımcıları', () => {
  it('kurulum ipucu platforma göre', () => {
    expect(installHint(IOS, false)).toBe('ios');
    expect(installHint(IPAD_DESKTOP, false)).toBe('ios');
    expect(installHint(ANDROID, false)).toBe('android');
    expect(installHint(DESKTOP, false)).toBe('none');
    expect(installHint(IOS, true)).toBe('none'); // kuruluysa ipucu yok
  });

  it('standalone algısı: iOS navigator.standalone ya da display-mode', () => {
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ matchMedia: (q) => ({ matches: q.includes('fullscreen') }) })).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isStandalone({})).toBe(false);
  });

  it('service worker sürümü kayıt URL\'sinden alır ve manifest + ikonları önbelleğe alır', () => {
    const sw = readFileSync(pub('sw.js'), 'utf8');
    expect(sw).toContain("searchParams.get('v')");
    expect(sw).toContain("'./manifest.webmanifest'");
    expect(sw).toContain("'./icons/icon-192.png'");
    expect(sw).toContain("'./icons/icon-512.png'");
    expect(sw).toContain('SKIP_WAITING');
  });

  it('manifest yatay, tam ekran ve ikonlu', () => {
    const m = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8')) as Record<string, unknown>;
    expect(m.name).toBe('Pati Barınağı');
    expect(m.display).toBe('fullscreen');
    expect(m.orientation).toBe('landscape');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    const icons = m.icons as Array<{ sizes: string; purpose?: string }>;
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  });
});
