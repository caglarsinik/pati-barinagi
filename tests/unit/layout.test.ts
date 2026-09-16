import { describe, expect, it } from 'vitest';
import { classifyLayout, dockFits, dockMinWidth, hudSizes } from '../../src/ui/layout';

describe('Yerleşim kuralları', () => {
  it('cihaz sınıfı eşikleri CSS ile aynı', () => {
    expect(classifyLayout(1280, 720)).toBe('desktop');
    expect(classifyLayout(1024, 768)).toBe('desktop');
    expect(classifyLayout(1023, 768)).toBe('tablet');
    expect(classifyLayout(768, 1024)).toBe('tablet');
    expect(classifyLayout(767, 1024)).toBe('phone');
    expect(classifyLayout(1280, 500)).toBe('phone'); // yatay telefon: yükseklik eşiği
    expect(classifyLayout(812, 375)).toBe('phone');
  });

  it('alt rıhtım yatay telefonlarda daraltmadan sığar', () => {
    for (const w of [568, 640, 667, 736, 780, 812, 844, 896, 915, 932]) {
      expect(dockFits(w, 'phone', true), `telefon ${w}`).toBe(true);
      expect(dockFits(w, 'phone', false), `telefon (fare) ${w}`).toBe(true);
    }
    expect(dockMinWidth('phone', true)).toBeLessThanOrEqual(400);
  });

  it('tablet ve masaüstü rıhtımı sığar', () => {
    expect(dockFits(768, 'tablet', true)).toBe(true);
    expect(dockFits(1024, 'tablet', true)).toBe(true);
    expect(dockFits(1280, 'desktop', false)).toBe(true);
    expect(dockFits(1920, 'desktop', true)).toBe(true);
  });

  it('telefonda tek araç düğmesi ve küçük E düğmesi', () => {
    const p = hudSizes('phone', true);
    expect(p.tools).toBe(1);
    expect(p.action).toBe(64);
    expect(p.minimap).toBe(0);
    const d = hudSizes('desktop', false);
    expect(d.tools).toBe(6);
    expect(d.minimap).toBeGreaterThan(0);
  });
});
