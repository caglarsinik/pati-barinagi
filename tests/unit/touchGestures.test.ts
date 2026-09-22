import { describe, expect, it } from 'vitest';
import { type GestureEvent, type GesturePointer, TouchGestures } from '../../src/scenes/TouchGestures';

const CFG = { touchSlop: 8, mouseSlop: 3, longPressMs: 450, staleMs: 3000 };

function ptr(id: number, x: number, y: number, now: number, extra: Partial<GesturePointer> = {}): GesturePointer {
  return { id, x, y, wx: x / 10, wy: y / 10, button: 0, touch: true, ui: false, isDown: true, now, longPress: true, ...extra };
}

const types = (ev: GestureEvent[]): string[] => ev.map((e) => e.type);

describe('TouchGestures', () => {
  it('dokunma: bas-bırak tek tap üretir', () => {
    const g = new TouchGestures(CFG);
    expect(types(g.down(ptr(1, 100, 100, 0)))).toEqual(['press']);
    const up = g.up(ptr(1, 102, 101, 120, { isDown: false }));
    expect(up).toEqual([{ type: 'release', x: 102, y: 101, wx: 10.2, wy: 10.1, button: 0, touch: true, moved: false, longPressed: false }]);
    expect(g.dragging).toBe(false);
  });

  it('fare tıklaması düğmesini taşır; sağ tık da release üretir', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(0, 50, 50, 0, { touch: false, button: 2, longPress: false }));
    const [r] = g.up(ptr(0, 50, 50, 10, { touch: false, button: 2, isDown: false }));
    expect(r).toMatchObject({ type: 'release', button: 2, touch: false, moved: false });
  });

  it('sürükleme eşiği basış noktasından ölçülür: dokunma 8, fare 3', () => {
    const t = new TouchGestures(CFG);
    t.down(ptr(1, 0, 0, 0));
    for (let i = 1; i <= 4; i++) t.move(ptr(1, i * 2, 0, i)); // küçük adımlar, toplam 8 (eşik aşılmadı)
    const drags = t.move(ptr(1, 9, 0, 5));
    expect(drags[0]).toMatchObject({ type: 'drag', dx: 1, dy: 0 });
    expect(t.up(ptr(1, 9, 0, 6, { isDown: false }))[0]).toMatchObject({ moved: true });

    const m = new TouchGestures(CFG);
    m.down(ptr(0, 0, 0, 0, { touch: false, longPress: false }));
    m.move(ptr(0, 3, 0, 1, { touch: false }));
    expect(m.up(ptr(0, 3, 0, 2, { touch: false, isDown: false }))[0]).toMatchObject({ moved: false });
    m.down(ptr(0, 0, 0, 3, { touch: false, longPress: false }));
    m.move(ptr(0, 4, 0, 4, { touch: false }));
    expect(m.up(ptr(0, 4, 0, 5, { touch: false, isDown: false }))[0]).toMatchObject({ moved: true });
  });

  it('uzun basış 450 ms sonra bir kez bildirilir ve bırakmada işaretlenir', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 30, 40, 1000));
    expect(g.update(1400)).toEqual([]);
    expect(g.update(1450)).toEqual([{ type: 'longPress', wx: 3, wy: 4 }]);
    expect(g.update(2000)).toEqual([]);
    expect(g.up(ptr(1, 30, 40, 2100, { isDown: false }))[0]).toMatchObject({ longPressed: true, moved: false });
  });

  it('hareket edince ya da kapalıyken uzun basış olmaz', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 0, 0, 0));
    g.move(ptr(1, 20, 0, 100));
    expect(g.update(1000)).toEqual([]);
    g.up(ptr(1, 20, 0, 1000, { isDown: false }));
    g.down(ptr(1, 0, 0, 2000, { longPress: false }));
    expect(g.update(3000)).toEqual([]);
  });

  it('iki parmak: pinch başlar, ölçek ve kayma verir; tek parmak jesti iptal olur', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 100, 100, 0));
    expect(types(g.down(ptr(2, 200, 100, 10)))).toEqual(['cancel', 'pinchStart']);
    expect(g.pinching).toBe(true);
    const [p] = g.move(ptr(2, 300, 100, 20));
    expect(p.type).toBe('pinch');
    if (p.type === 'pinch') {
      expect(p.scale).toBeCloseTo(2);
      expect(p.dx).toBeCloseTo(50);
      expect(p.dy).toBe(0);
    }
    // Bir parmak kalkınca pinch biter; kalan parmağın bırakması dokunuş değildir.
    expect(types(g.up(ptr(2, 300, 100, 30, { isDown: false })))).toEqual(['pinchEnd']);
    expect(g.move(ptr(1, 100, 100, 40))).toEqual([]);
    expect(g.up(ptr(1, 100, 100, 50, { isDown: false }))).toEqual([]);
    // Sonraki tek dokunuş normal çalışır.
    g.down(ptr(1, 10, 10, 60));
    expect(types(g.up(ptr(1, 10, 10, 70, { isDown: false })))).toEqual(['release']);
  });

  it('iki parmakla dokunup kaldırmak yürüme dokunuşu üretmez', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 100, 100, 0));
    g.down(ptr(2, 110, 100, 5));
    const ev = [...g.up(ptr(2, 110, 100, 60, { isDown: false })), ...g.up(ptr(1, 100, 100, 70, { isDown: false }))];
    expect(types(ev)).not.toContain('release');
  });

  it('#ui üstündeki işaretçi olay üretmez; basılı değilken hareketi kaydı siler', () => {
    const g = new TouchGestures(CFG);
    expect(g.down(ptr(1, 5, 5, 0, { ui: true }))).toEqual([]);
    expect(g.move(ptr(1, 50, 5, 10, { ui: true }))).toEqual([]);
    expect(g.up(ptr(1, 50, 5, 20, { ui: true, isDown: false }))).toEqual([]);
    // Bırakması kaçan UI işaretçisi: sonraki gezinme kaydı temizler, ardından dünya dokunuşu normal.
    g.down(ptr(1, 5, 5, 30, { ui: true }));
    g.move(ptr(1, 5, 5, 40, { ui: true, isDown: false }));
    expect(types(g.down(ptr(1, 80, 80, 50)))).toEqual(['press']);
    expect(types(g.up(ptr(1, 80, 80, 60, { isDown: false })))).toEqual(['release']);
    // UI'da basılı duran parmak pinch'e sayılmaz.
    g.down(ptr(2, 5, 5, 70, { ui: true }));
    expect(types(g.down(ptr(1, 90, 90, 80)))).toEqual(['press']);
    expect(g.pinching).toBe(false);
  });

  it('bırakması kaçan bayat parmak sonraki dokunuşu pinch yapmaz; update bayat pinch i bitirir', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 100, 100, 0)); // bırakma olayı hiç gelmeyecek
    expect(types(g.down(ptr(2, 200, 200, 3500)))).toEqual(['cancel', 'press']);
    expect(g.pinching).toBe(false);
    expect(types(g.up(ptr(2, 200, 200, 3600, { isDown: false })))).toEqual(['release']);

    const h = new TouchGestures(CFG);
    h.down(ptr(1, 0, 0, 0));
    h.down(ptr(2, 50, 0, 10));
    expect(h.pinching).toBe(true);
    expect(h.update(1000)).toEqual([]); // iki parmak da taze
    expect(types(h.update(3100))).toEqual(['pinchEnd']); // ikisi de sustu (touchend kaçtı)
    h.down(ptr(3, 10, 10, 3200));
    expect(types(h.up(ptr(3, 10, 10, 3300, { isDown: false })))).toEqual(['release']);
  });

  it('pinch açıkken bayat parmakla gelen yeni basış pinch i bitirip dokunuş başlatır', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 0, 0, 0));
    g.down(ptr(2, 50, 0, 10));
    expect(types(g.down(ptr(3, 70, 70, 4000)))).toEqual(['pinchEnd', 'press']);
  });

  it('reset (touchcancel, odak kaybı) her şeyi bırakır; sonra dokunuş çalışır', () => {
    const g = new TouchGestures(CFG);
    g.down(ptr(1, 0, 0, 0));
    g.down(ptr(2, 50, 0, 10));
    expect(types(g.reset())).toEqual(['pinchEnd']);
    g.down(ptr(1, 5, 5, 20));
    expect(types(g.reset())).toEqual(['cancel']);
    expect(g.up(ptr(1, 5, 5, 30, { isDown: false }))).toEqual([]);
    g.down(ptr(1, 5, 5, 40));
    expect(types(g.up(ptr(1, 5, 5, 50, { isDown: false })))).toEqual(['release']);
  });

  it('fare gezinmesi (basılı değil) olay üretmez', () => {
    const g = new TouchGestures(CFG);
    expect(g.move(ptr(0, 10, 10, 0, { touch: false, isDown: false }))).toEqual([]);
  });
});
