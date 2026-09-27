import { describe, expect, it } from 'vitest';
import { ZOOM_LEVELS, clampCenter, inView, panBy, parseZoom, pickTile, pinchZoom, viewRect, zoomStep } from '../../src/ui/minimapView';

const W = 200;
const H = 200;

describe('Mini harita yakınlaştırma (0.22.1)', () => {
  it('tercih ve kademeler: 1×/2×/4×, uçlarda kalır; iki parmak en yakın kademe', () => {
    expect(parseZoom('2')).toBe(2);
    expect(parseZoom('4')).toBe(4);
    expect(parseZoom('3')).toBe(1);
    expect(parseZoom(null)).toBe(1);
    expect(zoomStep(1, -1)).toBe(1);
    expect(zoomStep(1, 1)).toBe(2);
    expect(zoomStep(2, 1)).toBe(4);
    expect(zoomStep(4, 1)).toBe(4);
    expect(pinchZoom(1, 1.3)).toBe(1);
    expect(pinchZoom(1, 1.5)).toBe(2);
    expect(pinchZoom(1, 5)).toBe(4);
    expect(pinchZoom(4, 0.6)).toBe(2);
    expect(pinchZoom(2, 0.3)).toBe(1);
    expect(pinchZoom(2, Number.NaN)).toBe(2);
    expect(pinchZoom(2, 0)).toBe(2);
  });

  it('görünen dikdörtgen: 1× bütün dünya; yakında dünya içine kırpılır ve tuval pikseline oturur', () => {
    expect(viewRect(37, 150, 1, W, H)).toEqual({ sx: 0, sy: 0, sw: 200, sh: 200 });
    expect(viewRect(10, 190, 4, W, H)).toEqual({ sx: 0, sy: 150, sw: 50, sh: 50 });
    expect(viewRect(190, 5, 2, W, H)).toEqual({ sx: 100, sy: 0, sw: 100, sh: 100 });
    for (const z of ZOOM_LEVELS) {
      const v = viewRect(100.37, 61.9, z, W, H);
      expect((v.sx * z) % 1).toBe(0);
      expect((v.sy * z) % 1).toBe(0);
      expect(v.sx).toBeGreaterThanOrEqual(0);
      expect(v.sx + v.sw).toBeLessThanOrEqual(W);
    }
  });

  it('dokunuş → kare: her kademede karenin ortasına dokunmak o kareyi verir', () => {
    const css = 520;
    for (const z of ZOOM_LEVELS) {
      const v = viewRect(120, 80, z, W, H);
      for (const [x, y] of [
        [Math.ceil(v.sx), Math.ceil(v.sy)],
        [Math.floor(v.sx + v.sw / 2), Math.floor(v.sy + v.sh / 3)],
        [Math.floor(v.sx + v.sw) - 1, Math.floor(v.sy + v.sh) - 1],
      ]) {
        const px = ((x + 0.5 - v.sx) / v.sw) * css;
        const py = ((y + 0.5 - v.sy) / v.sh) * css;
        expect(pickTile(v, px, py, css, css)).toEqual({ x, y });
      }
    }
  });

  it('sürükleme: harita parmakla gelir, merkez ters yöne kayar ve dünyada kalır', () => {
    // 2×'te görünen 100 kare; tuvalin yarısı kadar sağa sürükleyince merkez 50 kare sola.
    expect(panBy(100, 100, 260, 0, 2, W, H, 520, 520)).toEqual({ x: 50, y: 100 });
    expect(panBy(100, 100, 0, -130, 4, W, H, 520, 520)).toEqual({ x: 100, y: 112.5 });
    expect(panBy(60, 60, 5000, 5000, 2, W, H, 520, 520)).toEqual({ x: 50, y: 50 });
    expect(clampCenter(-20, 999, 4, W, H)).toEqual({ x: 25, y: 175 });
  });

  it('görünen alanda mı (kenar payıyla)', () => {
    const v = viewRect(100, 100, 4, W, H);
    expect(inView(v, 100, 100)).toBe(true);
    expect(inView(v, v.sx, v.sy)).toBe(true);
    expect(inView(v, v.sx, v.sy, 2)).toBe(false);
    expect(inView(v, v.sx + v.sw, 100)).toBe(false);
  });
});
