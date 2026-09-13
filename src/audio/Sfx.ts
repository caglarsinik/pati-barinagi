import { type Synth, noteHz } from './Synth';

export type SfxName =
  | 'click'
  | 'pet'
  | 'play'
  | 'feed'
  | 'clean'
  | 'groom'
  | 'pick'
  | 'berries'
  | 'build'
  | 'demolish'
  | 'coin'
  | 'error'
  | 'hatch'
  | 'adopt'
  | 'bark'
  | 'whine'
  | 'alert'
  | 'week'
  | 'sleep'
  | 'step'
  | 'treat'
  | 'tame'
  | 'gate';

export interface SfxOpts {
  /** 1 = normal; 2 = bir oktav tiz. */
  pitch?: number;
  volume?: number;
}

/** Her efekt, sentezleyiciye birkaç nota/gürültü olayı zamanlayan küçük bir tarif. */
export function playSfx(s: Synth, dest: AudioNode, name: SfxName, opts: SfxOpts = {}): void {
  const p = opts.pitch ?? 1;
  const v = opts.volume ?? 1;
  const g = (x: number): number => x * v;
  switch (name) {
    case 'click':
      s.tone(dest, { type: 'square', freq: 1200 * p, freqEnd: 900 * p, dur: 0.05, gain: g(0.08), lowpass: 3000 });
      break;
    case 'pet':
      s.tone(dest, { freq: noteHz(76) * p, dur: 0.12, gain: g(0.12), release: 0.08 });
      s.tone(dest, { freq: noteHz(79) * p, dur: 0.16, gain: g(0.1), at: 0.11, release: 0.1 });
      break;
    case 'play':
      [72, 76, 79, 84].forEach((n, i) => s.tone(dest, { type: 'triangle', freq: noteHz(n) * p, dur: 0.09, gain: g(0.14), at: i * 0.07 }));
      break;
    case 'feed':
      s.noise(dest, { dur: 0.28, gain: g(0.12), lowpass: 2500, attack: 0.02, release: 0.15 });
      for (let i = 0; i < 6; i++) s.tone(dest, { type: 'square', freq: (1800 + i * 137) * p, dur: 0.02, gain: g(0.04), at: 0.03 + i * 0.04 });
      break;
    case 'clean':
      s.noise(dest, { dur: 0.16, gain: g(0.14), bandpass: 900, q: 1.5, attack: 0.02 });
      s.noise(dest, { dur: 0.16, gain: g(0.12), bandpass: 1100, q: 1.5, attack: 0.02, at: 0.2 });
      break;
    case 'groom':
      s.noise(dest, { dur: 0.35, gain: g(0.1), lowpass: 1200, attack: 0.05, release: 0.2 });
      s.tone(dest, { freq: 600 * p, freqEnd: 900 * p, dur: 0.3, gain: g(0.05), at: 0.05 });
      break;
    case 'pick':
      s.tone(dest, { freq: 500 * p, freqEnd: 950 * p, dur: 0.09, gain: g(0.16) });
      s.tone(dest, { type: 'triangle', freq: 1300 * p, dur: 0.05, gain: g(0.08), at: 0.09 });
      break;
    case 'berries':
      s.tone(dest, { freq: 700 * p, freqEnd: 500 * p, dur: 0.06, gain: g(0.12) });
      s.tone(dest, { freq: 800 * p, freqEnd: 600 * p, dur: 0.06, gain: g(0.12), at: 0.09 });
      break;
    case 'build':
      for (let i = 0; i < 2; i++) {
        s.noise(dest, { dur: 0.05, gain: g(0.18), lowpass: 1800, at: i * 0.14 });
        s.tone(dest, { type: 'square', freq: 180 * p, freqEnd: 120 * p, dur: 0.08, gain: g(0.12), lowpass: 800, at: i * 0.14 });
      }
      break;
    case 'demolish':
      s.noise(dest, { dur: 0.45, gain: g(0.2), lowpass: 600, attack: 0.01, release: 0.3 });
      s.tone(dest, { type: 'sawtooth', freq: 120, freqEnd: 60, dur: 0.4, gain: g(0.08), lowpass: 400 });
      break;
    case 'gate':
      // Gıcırtı + mandal tıkı.
      s.tone(dest, { type: 'sawtooth', freq: 320 * p, freqEnd: 180 * p, dur: 0.22, gain: g(0.06), lowpass: 900, attack: 0.03 });
      s.noise(dest, { dur: 0.05, gain: g(0.08), lowpass: 2500, at: 0.2 });
      break;
    case 'coin':
      s.tone(dest, { freq: 1500 * p, dur: 0.07, gain: g(0.14) });
      s.tone(dest, { freq: 2000 * p, dur: 0.14, gain: g(0.14), at: 0.07, release: 0.1 });
      break;
    case 'error':
      s.tone(dest, { type: 'square', freq: 220, freqEnd: 150, dur: 0.18, gain: g(0.1), lowpass: 1200 });
      break;
    case 'hatch':
      s.noise(dest, { dur: 0.06, gain: g(0.2), lowpass: 3500 });
      s.noise(dest, { dur: 0.05, gain: g(0.15), lowpass: 3500, at: 0.09 });
      [72, 76, 79, 84, 88].forEach((n, i) => s.tone(dest, { type: 'triangle', freq: noteHz(n), dur: 0.14, gain: g(0.13), at: 0.2 + i * 0.09, release: 0.1 }));
      break;
    case 'adopt':
      [72, 76, 79, 84, 88, 91].forEach((n, i) => {
        s.tone(dest, { freq: noteHz(n), dur: 0.16, gain: g(0.11), at: i * 0.1, release: 0.12 });
        s.tone(dest, { type: 'triangle', freq: noteHz(n - 12), dur: 0.16, gain: g(0.05), at: i * 0.1, release: 0.12 });
      });
      break;
    case 'tame':
      [67, 71, 74, 79].forEach((n, i) => s.tone(dest, { type: 'triangle', freq: noteHz(n), dur: 0.18, gain: g(0.12), at: i * 0.12, release: 0.14 }));
      break;
    case 'bark':
      for (let i = 0; i < 2; i++) {
        s.tone(dest, { type: 'sawtooth', freq: 420 * p, freqEnd: 240 * p, dur: 0.12, gain: g(0.14), lowpass: 1500 * p, at: i * 0.17, attack: 0.01 });
        s.noise(dest, { dur: 0.08, gain: g(0.05), bandpass: 700 * p, q: 0.8, at: i * 0.17 });
      }
      break;
    case 'whine':
      s.tone(dest, { freq: 900 * p, freqEnd: 1150 * p, dur: 0.22, gain: g(0.07), attack: 0.05 });
      s.tone(dest, { freq: 1150 * p, freqEnd: 800 * p, dur: 0.25, gain: g(0.07), at: 0.22, release: 0.15 });
      break;
    case 'alert':
      s.tone(dest, { type: 'square', freq: noteHz(69), dur: 0.09, gain: g(0.07), lowpass: 2500 });
      s.tone(dest, { type: 'square', freq: noteHz(74), dur: 0.12, gain: g(0.07), lowpass: 2500, at: 0.1 });
      break;
    case 'week':
      [60, 64, 67, 72].forEach((n) => s.tone(dest, { freq: noteHz(n), dur: 1.0, gain: g(0.07), attack: 0.15, release: 0.6 }));
      break;
    case 'sleep':
      s.tone(dest, { freq: 700, freqEnd: 220, dur: 1.1, gain: g(0.08), attack: 0.1, release: 0.7 });
      break;
    case 'step':
      s.noise(dest, { dur: 0.035, gain: g(0.05), lowpass: 500 * p });
      break;
    case 'treat':
      s.tone(dest, { freq: 880, dur: 0.35, gain: g(0.08), attack: 0.01, release: 0.25 });
      s.tone(dest, { freq: 1320, dur: 0.3, gain: g(0.04), at: 0.05, release: 0.2 });
      break;
    default:
      break;
  }
}
