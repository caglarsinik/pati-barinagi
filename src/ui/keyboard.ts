/**
 * Arayüz ile oyun klavyesinin ayrımı.
 * - Yalnız METİN girişi (input, textarea, select, contenteditable) odaktayken oyun tuşları kapanır ve o tuş olayları
 *   Phaser'ın pencere dinleyicisine ulaşmaz (Space/Tab tarayıcı davranışıyla kalır).
 * - Düğmeler ve bağlantılar tıklamadan sonra, seçim kutuları değer değişince odağı bırakır; böylece bir HUD düğmesine
 *   basmak WASD/Esc/kısayolları öldürmez (0.10.1 gerilemesi) ve dokunmatikte odak kayması yürüyüşü iptal etmez.
 */
const TEXT_TARGETS = 'input, textarea, select, [contenteditable]';
const CLICK_TARGETS = 'button, a';

type Closable = { closest?: (selector: string) => unknown };
type Blurable = { blur?: () => void };

function closestOf(target: EventTarget | null, selector: string): unknown {
  const el = target as Closable | null;
  return el && typeof el.closest === 'function' ? el.closest(selector) : null;
}

/** Odaktaki öğe oyun tuşlarını kapatmalı mı (yalnız #ui içindeki metin girişleri). */
export function isUiKeyboardTarget(target: Element | null): boolean {
  return !!target?.closest('#ui input, #ui textarea, #ui select, #ui [contenteditable]');
}

/**
 * `root` (#ui) üzerindeki klavye/odak kurallarını bağlar; dönen fonksiyon dinleyicileri kaldırır.
 * `reset`: metin alanında tuşa basılınca çağrılır (basılı oyun tuşlarını bırakmak için).
 */
export function bindUiKeyboard(root: HTMLElement, reset: () => void): () => void {
  const key = (event: Event): void => {
    if (!closestOf(event.target, TEXT_TARGETS)) return;
    reset();
    event.stopPropagation();
  };
  const click = (event: Event): void => {
    if (closestOf(event.target, TEXT_TARGETS)) return;
    (closestOf(event.target, CLICK_TARGETS) as Blurable | null)?.blur?.();
  };
  const change = (event: Event): void => {
    (closestOf(event.target, 'select') as Blurable | null)?.blur?.();
  };
  root.addEventListener('keydown', key);
  root.addEventListener('keyup', key);
  root.addEventListener('click', click);
  root.addEventListener('change', change);
  return () => {
    root.removeEventListener('keydown', key);
    root.removeEventListener('keyup', key);
    root.removeEventListener('click', click);
    root.removeEventListener('change', change);
  };
}
