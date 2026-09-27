import type { Sim, StarterKind } from '../../sim/Sim';
import { type TutorialCtx, type TutorialStep, type TutorialUi, type TutorialView, stepsFor, tutorialCtx } from './steps';

export interface TutorialState {
  id: string;
  /** 0 tabanlı adım sırası. */
  index: number;
  total: number;
}

/** Tanıtım nasıl bitti: son adım tamam ya da oyuncu kapattı (ikisinde de tercih "görüldü" olur); `stop` sessiz. */
export type TutorialEnd = 'done' | 'closed';

/**
 * Açılış tanıtımının durum makinesi (0.22.5; DOM'suz, test edilebilir). `update` 10 Hz ve arayüz değişince çağrılır:
 * koşulu sağlanmış adımlar hemen geçilir (öne geçen oyuncu beklemez); bilgi adımı yalnız düğmeyle (`next`) geçer.
 */
export class Tutorial {
  private steps: readonly TutorialStep[] = [];
  private i = -1;
  private ctx: TutorialCtx | null = null;
  /** Denetim ve hata ayıklama: adımlar kendiliğinden geçmez. */
  hold = false;

  constructor(
    private readonly ui: TutorialUi,
    private readonly onChange: (state: TutorialState | null, end?: TutorialEnd) => void,
  ) {}

  get active(): boolean {
    return this.i >= 0;
  }

  get step(): TutorialStep | null {
    return this.i >= 0 ? this.steps[this.i] : null;
  }

  get state(): TutorialState | null {
    const s = this.step;
    return s ? { id: s.id, index: this.i, total: this.steps.length } : null;
  }

  start(sim: Sim, starter: StarterKind): void {
    this.steps = stepsFor(starter);
    this.ctx = tutorialCtx(sim);
    this.hold = false;
    this.go(0);
  }

  /** Koşulu sağlanan adımları geçer (birden çok adım bir kerede geçilebilir). */
  update(sim: Sim, view: TutorialView): void {
    if (this.hold || !this.ctx) return;
    for (let guard = 0; this.i >= 0 && guard < this.steps.length; guard++) {
      const s = this.steps[this.i];
      if (!s.done || !s.done(sim, view, this.ctx)) return;
      this.next();
    }
  }

  /** Bilgi düğmesi ya da "Atla": sıradaki adım; son adımdan sonra tanıtım biter. */
  next(): void {
    if (this.i < 0) return;
    if (this.i + 1 >= this.steps.length) this.end('done');
    else this.go(this.i + 1);
  }

  /** "Tanıtımı kapat". */
  close(): void {
    if (this.i >= 0) this.end('closed');
  }

  /** Oyun değişince ya da ana menüye dönünce: tercih değişmeden kapanır. */
  stop(): void {
    if (this.i < 0) return;
    this.i = -1;
    this.steps = [];
    this.ctx = null;
    this.hold = false;
    this.onChange(null);
  }

  /** Denetim için: listeyi kurup n. adıma (0 tabanlı) atlar, adımlar kendiliğinden geçmez. */
  jump(sim: Sim, starter: StarterKind, n: number, hold = true): void {
    this.steps = stepsFor(starter);
    this.ctx = tutorialCtx(sim);
    this.hold = hold;
    this.go(Math.max(0, Math.min(this.steps.length - 1, n)));
  }

  private go(i: number): void {
    this.i = i;
    this.steps[i].enter?.(this.ui);
    this.onChange(this.state);
  }

  private end(end: TutorialEnd): void {
    this.i = -1;
    this.steps = [];
    this.ctx = null;
    this.hold = false;
    this.onChange(null, end);
  }
}
