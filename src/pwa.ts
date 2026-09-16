import { GAME } from './config/game';
import { t } from './i18n';
import { showToast, store } from './ui/store';

/**
 * PWA katmanı: service worker kaydı, güncelleme bildirimi, "Ana ekrana ekle" istemi ve tam ekran.
 * Yalnız üretim build'inde ve güvenli bağlamda (https ya da localhost) kayıt yapılır; file:// altında sessizce atlanır.
 */

/** Chrome/Edge'in kurulum istemi olayı (standartta tip yok). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallHint = 'ios' | 'android' | 'none';

interface WindowLike {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
}

/** Uygulama simgesinden mi açıldı (kurulu PWA)? */
export function isStandalone(win: WindowLike = window as unknown as WindowLike): boolean {
  if (win.navigator?.standalone) return true;
  const mm = win.matchMedia;
  if (!mm) return false;
  return mm.call(win, '(display-mode: standalone)').matches || mm.call(win, '(display-mode: fullscreen)').matches;
}

/** Hangi kurulum ipucu gösterilecek: iOS'ta Safari paylaş menüsü, Android'de tarayıcı istemi, kuruluysa hiç. */
export function installHint(ua: string, standalone: boolean): InstallHint {
  if (standalone) return 'none';
  // iPadOS masaüstü UA verir ("Macintosh" + dokunmatik); iPhone/iPod açıkça yazar.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  if (ios) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'none';
}

let waiting: ServiceWorker | null = null;
let updating = false;

export function registerPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    store.installPrompt.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    store.installPrompt.value = null;
    showToast(t('Ana ekrana eklendi'));
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${encodeURIComponent(GAME.version)}`)
      .then((reg) => {
        const markReady = (sw: ServiceWorker): void => {
          waiting = sw;
          store.updateReady.value = true;
          showToast(t('Yeni sürüm indirildi · Ayarlar → Şimdi yenile'));
        };
        if (reg.waiting && navigator.serviceWorker.controller) markReady(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) markReady(sw);
          });
        });
      })
      .catch((err) => console.warn('[pwa] service worker kaydı başarısız', err));
    // Yalnız kullanıcı "Şimdi yenile" dediyse yeniden yükle; ilk kurulumda sayfa olduğu gibi kalır.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updating) location.reload();
    });
  });
}

/** Tarayıcının kurulum penceresini açar; kabul edildiyse true. */
export async function promptInstall(): Promise<boolean> {
  const e = store.installPrompt.value;
  if (!e) return false;
  await e.prompt();
  const r = await e.userChoice;
  if (r.outcome === 'accepted') store.installPrompt.value = null;
  return r.outcome === 'accepted';
}

/** Bekleyen yeni service worker'ı etkinleştirip sayfayı yeniler. */
export function applyUpdate(): void {
  updating = true;
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

/** Tam ekran + yatay kilit (yalnız kullanıcı hareketiyle çağrılabilir). */
export async function enterFullscreen(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* tarayıcı izin vermedi */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    /* desteklenmiyor */
  }
}
