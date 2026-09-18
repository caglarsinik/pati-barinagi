/**
 * Olay hedefi arayüz katmanında (#ui) mı? Phaser dokunma ve fare olaylarını pencere düzeyinde de dinlediği için
 * HUD düğmelerine dokunuşlar sahneye de ulaşır; sahne bunları dünya girdisi saymamak için bu süzgeci kullanır.
 */
export function isUiTarget(target: EventTarget | null | undefined): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null | undefined;
  return !!el && typeof el.closest === 'function' && !!el.closest('#ui');
}
