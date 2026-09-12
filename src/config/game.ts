export const GAME = {
  name: 'Pati Barınağı',
  version: '0.6.0',
  /** Kayıt formatı sürümü; değişince SaveManager migrasyon zinciri çalışır. */
  saveVersion: 1,
  saveKeyPrefix: 'pati-barinagi.save.',
  settingsKey: 'pati-barinagi.settings',
  /** Native piksel sanatı boyutu: 1 kare = 16 px. */
  tile: 16,
} as const;
