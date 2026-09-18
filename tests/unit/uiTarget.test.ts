import { expect, it } from 'vitest';
import { isUiTarget } from '../../src/ui/uiTarget';

it('yalnız #ui içindeki hedefler arayüz dokunuşu sayılır', () => {
  const inUi = { closest: (sel: string) => (sel === '#ui' ? {} : null) } as unknown as EventTarget;
  const canvas = { closest: () => null } as unknown as EventTarget;
  expect(isUiTarget(inUi)).toBe(true);
  expect(isUiTarget(canvas)).toBe(false);
  expect(isUiTarget(new EventTarget())).toBe(false); // closest yok (window, document)
  expect(isUiTarget(null)).toBe(false);
  expect(isUiTarget(undefined)).toBe(false);
});
