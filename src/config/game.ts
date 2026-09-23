export const GAME = {
  name: 'Pati Barınağı',
  version: '0.16.3',
  /** Kayıt formatı sürümü; değişince SaveManager migrasyon zinciri çalışır. */
  saveVersion: 2,
  saveKeyPrefix: 'pati-barinagi.save.',
  /** Ana menüdeki kayıt yuvası sayısı (anahtarlar saveKeyPrefix + 0..n-1). */
  saveSlots: 3,
  settingsKey: 'pati-barinagi.settings',
  /** Native piksel sanatı boyutu: 1 kare = 16 px. */
  tile: 16,
} as const;
