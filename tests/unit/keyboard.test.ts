import { describe, expect, it, vi } from 'vitest';
import { bindUiKeyboard } from '../../src/ui/keyboard';

/** DOM'suz sahte öğe: closest() seçiciye göre kendini ya da null döndürür. */
class FakeEl extends EventTarget {
  blur = vi.fn();
  constructor(private readonly matches: string[]) {
    super();
  }
  closest(selector: string): FakeEl | null {
    return selector.split(',').some((s) => this.matches.includes(s.trim())) ? this : null;
  }
}

function fire(target: EventTarget, type: string): { event: Event; stop: ReturnType<typeof vi.spyOn> } {
  const event = new Event(type, { cancelable: true, bubbles: true });
  const stop = vi.spyOn(event, 'stopPropagation');
  target.dispatchEvent(event);
  return { event, stop };
}

describe('UI klavye ayrımı', () => {
  it('metin alanındaki tuşlar oyuna ulaşmaz, tarayıcı davranışı korunur', () => {
    const input = new FakeEl(['input']);
    const reset = vi.fn();
    const dispose = bindUiKeyboard(input as unknown as HTMLElement, reset);
    for (const type of ['keydown', 'keyup']) {
      const { event, stop } = fire(input, type);
      expect(stop).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    }
    expect(reset).toHaveBeenCalledTimes(2);
    dispose();
    fire(input, 'keydown');
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('düğme odaktayken tuşlar oyuna geçer ve odak değişimi hiçbir şeyi sıfırlamaz', () => {
    const button = new FakeEl(['button']);
    const reset = vi.fn();
    bindUiKeyboard(button as unknown as HTMLElement, reset);
    const { stop } = fire(button, 'keydown');
    expect(stop).not.toHaveBeenCalled();
    fire(button, 'focusin');
    expect(reset).not.toHaveBeenCalled();
  });

  it('düğme tıklamadan sonra, seçim kutusu değer değişince odağı bırakır; metin alanı bırakmaz', () => {
    const button = new FakeEl(['button']);
    bindUiKeyboard(button as unknown as HTMLElement, vi.fn());
    fire(button, 'click');
    expect(button.blur).toHaveBeenCalledTimes(1);

    const select = new FakeEl(['select']);
    bindUiKeyboard(select as unknown as HTMLElement, vi.fn());
    fire(select, 'click');
    expect(select.blur).not.toHaveBeenCalled(); // açılır liste tıklamasında odak kalır
    fire(select, 'change');
    expect(select.blur).toHaveBeenCalledTimes(1);

    const input = new FakeEl(['input']);
    bindUiKeyboard(input as unknown as HTMLElement, vi.fn());
    fire(input, 'click');
    fire(input, 'change');
    expect(input.blur).not.toHaveBeenCalled();
  });
});
