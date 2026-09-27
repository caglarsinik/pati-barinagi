import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, type BackgroundDoc, type BackgroundTarget } from '../../src/audio/audio';

/** Düğümde Web Audio yok: askıya alma/sürdürme sayan sahte bağlam; nota kurulumu sayılıp bırakılır. */
class FakeCtx {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  suspends = 0;
  resumes = 0;
  voices = 0;
  createGain(): unknown {
    return { gain: { value: 0 }, connect() {} };
  }
  createOscillator(): never {
    this.voices++;
    throw new Error('sahte');
  }
  createBufferSource(): never {
    this.voices++;
    throw new Error('sahte');
  }
  suspend(): Promise<void> {
    this.suspends++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  resume(): Promise<void> {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
}

class FakeTarget implements BackgroundTarget {
  private handlers = new Map<string, Array<() => void>>();
  addEventListener(type: string, listener: () => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), listener]);
  }
  fire(type: string): void {
    for (const h of this.handlers.get(type) ?? []) h();
  }
}

class FakeDoc extends FakeTarget implements BackgroundDoc {
  visibilityState = 'visible';
  focused = true;
  hasFocus(): boolean {
    return this.focused;
  }
}

const g = globalThis as unknown as { window?: unknown };
const inner = (a: AudioEngine) => a as unknown as { ctx: FakeCtx; music: { isRunning: boolean } };

describe('Arka planda ses (0.22.0)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    g.window = { AudioContext: FakeCtx };
  });
  afterEach(() => {
    vi.useRealTimers();
    delete g.window;
  });

  it('arka planda bağlam askıya alınır, müzik durmaz (kaldığı yerden sürer), efekt çalınmaz; öne gelince sürer', () => {
    const a = new AudioEngine();
    a.unlock();
    const ctx = inner(a).ctx;
    a.startMusic('day');
    expect(inner(a).music.isRunning).toBe(true);
    a.play('click');
    expect(ctx.voices).toBeGreaterThan(0);

    a.setBackground(true);
    expect(ctx.suspends).toBe(1);
    expect(ctx.state).toBe('suspended');
    expect(inner(a).music.isRunning).toBe(true);
    ctx.voices = 0;
    a.play('bark');
    expect(ctx.voices).toBe(0);
    a.setBackground(true);
    expect(ctx.suspends).toBe(1);

    a.setBackground(false);
    expect(ctx.resumes).toBe(1);
    expect(ctx.state).toBe('running');
    a.play('bark');
    expect(ctx.voices).toBeGreaterThan(0);
    a.stopMusic();
  });

  it('dinleyiciler: gizli sekme, odak kaybı ve sayfa önbelleği susturur; görünür ve odakta sürer', () => {
    const a = new AudioEngine();
    a.unlock();
    const ctx = inner(a).ctx;
    const win = new FakeTarget();
    const doc = new FakeDoc();
    a.attachBackgroundListeners(win, doc);
    expect(a.inBackground).toBe(false);

    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(ctx.state).toBe('suspended');
    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    expect(ctx.state).toBe('running');

    win.fire('blur');
    expect(a.inBackground).toBe(true);
    expect(ctx.state).toBe('suspended');
    win.fire('focus');
    expect(ctx.state).toBe('running');

    win.fire('pagehide');
    expect(ctx.state).toBe('suspended');
    win.fire('pageshow');
    expect(ctx.state).toBe('running');

    // Görünür ama odak dışı pencere de arka plan sayılır.
    doc.focused = false;
    doc.fire('visibilitychange');
    expect(a.inBackground).toBe(true);
  });

  it('bağlam yokken yalnız bayrak tutulur; ilk dokunuş (unlock) oyunu öne alır', () => {
    const a = new AudioEngine();
    a.setBackground(true);
    expect(a.inBackground).toBe(true);
    a.unlock();
    expect(a.inBackground).toBe(false);
    const ctx = inner(a).ctx;
    expect(ctx.state).toBe('running');
    // Arka planda müzik istenirse bağlam askıda kalır; öne gelince çalar.
    a.setBackground(true);
    a.startMusic('night');
    expect(ctx.state).toBe('suspended');
    a.setBackground(false);
    expect(ctx.state).toBe('running');
    expect(inner(a).music.isRunning).toBe(true);
    a.stopMusic();
  });
});
