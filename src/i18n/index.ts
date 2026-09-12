import { EN } from './en';

export type Lang = 'tr' | 'en';

const LANG_KEY = 'pati-barinagi.lang';
let current: Lang = 'tr';
const listeners = new Set<(l: Lang) => void>();

/** Kaydedilmiş dili yükler (tarayıcı yoksa Türkçe). */
export function initLang(): Lang {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (v === 'en' || v === 'tr') current = v;
  } catch {
    /* varsayılan */
  }
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* yoksay */
  }
  for (const fn of listeners) fn(l);
}

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Çeviri: Türkçe metin anahtardır. İngilizce sözlükte karşılığı yoksa Türkçe döner.
 * `{ad}` biçimindeki yer tutucular params ile doldurulur (çeviriden sonra).
 */
export function t(text: string, params?: Record<string, string | number>): string {
  let out = current === 'en' ? (EN[text] ?? text) : text;
  if (params) {
    for (const k of Object.keys(params)) out = out.split(`{${k}}`).join(String(params[k]));
  }
  return out;
}

/** Sözlükte eksik anahtarları bulmak için (geliştirme). */
export function missingTranslations(keys: string[]): string[] {
  return keys.filter((k) => !(k in EN));
}
