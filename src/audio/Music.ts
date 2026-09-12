import { type Synth, noteHz } from './Synth';

export type MusicMode = 'day' | 'night';

/** Akor: kök MIDI notası ve aralıklar. */
interface Chord {
  root: number;
  intervals: number[];
}

const DAY_CHORDS: Chord[] = [
  { root: 60, intervals: [0, 4, 7] }, // C
  { root: 55, intervals: [0, 4, 7] }, // G
  { root: 57, intervals: [0, 3, 7] }, // Am
  { root: 53, intervals: [0, 4, 7] }, // F
];
const NIGHT_CHORDS: Chord[] = [
  { root: 57, intervals: [0, 3, 7, 10] }, // Am7
  { root: 53, intervals: [0, 4, 7, 11] }, // Fmaj7
  { root: 60, intervals: [0, 4, 7] }, // C
  { root: 55, intervals: [0, 4, 7, 10] }, // G7
];
const PENTA = [0, 2, 4, 7, 9];

/**
 * Üretken ortam müziği: 4 akorluk döngü üstünde pad, bas ve pentatonik melodi.
 * Zamanlama ileriye dönük planlanır (lookahead), böylece kare düşüşleri müziği bozmaz.
 */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private mode: MusicMode = 'day';
  private running = false;
  private lastMelody = 72;

  constructor(
    private readonly synth: Synth,
    private readonly dest: AudioNode,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(mode: MusicMode): void {
    this.mode = mode;
    if (this.running) return;
    this.running = true;
    this.beat = 0;
    this.nextBeat = this.synth.now + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setMode(mode: MusicMode): void {
    this.mode = mode;
  }

  private bpm(): number {
    return this.mode === 'day' ? 84 : 60;
  }

  private schedule(): void {
    const lookahead = 0.35;
    while (this.nextBeat < this.synth.now + lookahead) {
      this.playBeat(this.beat, this.nextBeat);
      this.nextBeat += 60 / this.bpm();
      this.beat++;
    }
  }

  /** Her vuruş: 4 vuruşluk ölçü, 4 ölçülük akor döngüsü. */
  private playBeat(beat: number, at: number): void {
    const chords = this.mode === 'day' ? DAY_CHORDS : NIGHT_CHORDS;
    const bar = Math.floor(beat / 4) % chords.length;
    const chord = chords[bar];
    const inBar = beat % 4;
    const delay = Math.max(0, at - this.synth.now);
    const beatLen = 60 / this.bpm();
    const s = this.synth;
    const d = this.dest;

    // Pad: ölçü başında, iki detune'lu üçgen.
    if (inBar === 0) {
      for (const iv of chord.intervals) {
        const f = noteHz(chord.root + iv);
        s.tone(d, { type: 'triangle', freq: f, dur: beatLen * 4.2, gain: 0.045, attack: beatLen, release: beatLen * 1.5, lowpass: 900, at: delay, detune: -6 });
        s.tone(d, { type: 'triangle', freq: f, dur: beatLen * 4.2, gain: 0.045, attack: beatLen, release: beatLen * 1.5, lowpass: 900, at: delay, detune: 6 });
      }
    }
    // Bas: 1. ve 3. vuruş.
    if (inBar === 0 || inBar === 2) {
      s.tone(d, { type: 'sine', freq: noteHz(chord.root - 24), dur: beatLen * 1.6, gain: 0.11, attack: 0.02, release: beatLen * 0.8, at: delay });
    }
    // Melodi: gündüz her sekizlikte %55, gece her vuruşta %35 ihtimalle.
    const steps = this.mode === 'day' ? 2 : 1;
    for (let k = 0; k < steps; k++) {
      const chance = this.mode === 'day' ? 0.55 : 0.35;
      if (Math.random() > chance) continue;
      const scaleRoot = 60; // C pentatonik
      let candidates = PENTA.map((iv) => scaleRoot + 12 + iv).concat(PENTA.map((iv) => scaleRoot + 24 + iv));
      // Akorla uyumlu notalara ağırlık: yakın adımları tercih et.
      candidates = candidates.filter((n) => Math.abs(n - this.lastMelody) <= 7 || Math.random() < 0.25);
      const n = candidates[Math.floor(Math.random() * candidates.length)] ?? 72;
      this.lastMelody = n;
      const start = delay + (k * beatLen) / steps;
      const len = this.mode === 'day' ? beatLen * 0.5 : beatLen * 1.2;
      s.tone(d, { type: 'sine', freq: noteHz(n), dur: len, gain: 0.07, attack: 0.01, release: len * 0.6, at: start });
      // Hafif yankı.
      s.tone(d, { type: 'sine', freq: noteHz(n), dur: len, gain: 0.025, attack: 0.01, release: len * 0.6, at: start + beatLen * 0.75 });
    }
  }
}
