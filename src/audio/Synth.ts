/**
 * Küçük sentez katmanı: osilatör + gürültü + zarf + filtre. Ses dosyası yok; her efekt anında üretilir.
 * Tarayıcı kuralı gereği AudioContext ilk kullanıcı hareketinden sonra açılır (unlock).
 */
export type Wave = OscillatorType;

export interface ToneOpts {
  type?: Wave;
  freq: number;
  /** Perde kayması hedefi (Hz); verilirse süre boyunca üstel kayar. */
  freqEnd?: number;
  dur: number;
  attack?: number;
  release?: number;
  gain?: number;
  /** Alçak geçiren filtre kesim frekansı. */
  lowpass?: number;
  /** Başlangıç gecikmesi (saniye). */
  at?: number;
  detune?: number;
}

export interface NoiseOpts {
  dur: number;
  gain?: number;
  attack?: number;
  release?: number;
  /** Bant geçiren merkez frekansı; yoksa alçak geçiren. */
  bandpass?: number;
  lowpass?: number;
  q?: number;
  at?: number;
}

export class Synth {
  readonly ctx: AudioContext;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Tek osilatörlü nota; hedef düğüme bağlanır. */
  tone(dest: AudioNode, o: ToneOpts): void {
    const ctx = this.ctx;
    const t0 = this.now + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.freqEnd && o.freqEnd > 0) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.dur);
    const env = ctx.createGain();
    const g = o.gain ?? 0.2;
    const a = Math.min(o.attack ?? 0.005, o.dur / 2);
    const r = Math.min(o.release ?? 0.05, o.dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(g, t0 + a);
    env.gain.setValueAtTime(g, Math.max(t0 + a, t0 + o.dur - r));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      node.connect(f);
      node = f;
    }
    node.connect(env);
    env.connect(dest);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  /** Beyaz gürültü patlaması (fırça, yem dökme, çatlama). */
  noise(dest: AudioNode, o: NoiseOpts): void {
    const ctx = this.ctx;
    const t0 = this.now + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    const env = ctx.createGain();
    const g = o.gain ?? 0.15;
    const a = Math.min(o.attack ?? 0.005, o.dur / 2);
    const r = Math.min(o.release ?? 0.05, o.dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(g, t0 + a);
    env.gain.setValueAtTime(g, Math.max(t0 + a, t0 + o.dur - r));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    const f = ctx.createBiquadFilter();
    if (o.bandpass) {
      f.type = 'bandpass';
      f.frequency.value = o.bandpass;
      f.Q.value = o.q ?? 1;
    } else {
      f.type = 'lowpass';
      f.frequency.value = o.lowpass ?? 3000;
    }
    src.connect(f);
    f.connect(env);
    env.connect(dest);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }
}

/** Nota adı → Hz (A4 = 440). */
export function noteHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
