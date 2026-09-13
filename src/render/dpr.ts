/**
 * Cihaz piksel oranı: tam sayı (16 px kareler tam ölçekli kalsın, titreme olmasın) ve en çok 2
 * (telefonda dolgu maliyeti sınırlı). Canvas arka tamponu pencere × DPR, CSS boyutu pencere kadar;
 * kamera zoom değerleri bu çarpanla ölçeklenir (WorldScene.zoomOf).
 */
export const DPR: number = typeof window === 'undefined' ? 1 : Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
