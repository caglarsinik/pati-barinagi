/** UI keyboard events retain browser defaults and never reach Phaser's window listener. */
export function isUiKeyboardTarget(target: Element | null): boolean {
 return !!target?.closest('#ui input, #ui textarea, #ui select, #ui button, #ui a, #ui [contenteditable]');
}
export function bindUiKeyboard(root: HTMLElement, reset: () => void): () => void {
 const key = (event: KeyboardEvent): void => { reset(); event.stopPropagation(); };
 const focus = (): void => reset();
 root.addEventListener('keydown', key);
 root.addEventListener('keyup', key);
 root.addEventListener('focusin', focus);
 return () => { root.removeEventListener('keydown',key); root.removeEventListener('keyup',key); root.removeEventListener('focusin',focus); };
}
