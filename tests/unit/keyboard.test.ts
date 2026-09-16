import { it, expect, vi } from 'vitest';
import { bindUiKeyboard } from '../../src/ui/keyboard';
it('keeps UI keys native and stops game propagation, including cleanup', () => {
 const root = new EventTarget(); const reset=vi.fn();
 const dispose = bindUiKeyboard(root as HTMLElement,reset);
 for(const type of ['keydown','keyup']) {
  const event=new Event(type,{cancelable:true,bubbles:true}); const stop=vi.spyOn(event,'stopPropagation');
  root.dispatchEvent(event); expect(stop).toHaveBeenCalled(); expect(event.defaultPrevented).toBe(false);
 }
 root.dispatchEvent(new Event('focusin')); expect(reset).toHaveBeenCalledTimes(3);
 dispose(); root.dispatchEvent(new Event('keydown')); expect(reset).toHaveBeenCalledTimes(3);
});
