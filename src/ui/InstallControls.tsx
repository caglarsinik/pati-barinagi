import { t } from '../i18n';
import { applyUpdate, enterFullscreen, installHint, isStandalone, promptInstall } from '../pwa';
import { store } from './store';

/**
 * Telefona kurulum denetimleri: tarayıcının "Ana ekrana ekle" istemi, iOS/Android ipucu, tam ekran,
 * bekleyen güncelleme. Gösterecek bir şey yoksa hiç çizilmez (masaüstünde çoğu zaman boş).
 */
export function InstallControls({ title = false }: { title?: boolean }) {
  store.lang.value;
  const prompt = store.installPrompt.value;
  const update = store.updateReady.value;
  const standalone = isStandalone();
  const hint = installHint(navigator.userAgent, standalone);
  const mobileLayout = store.touch.value || store.layout.value !== 'desktop';
  const showFullscreen = !standalone && mobileLayout && typeof document.documentElement.requestFullscreen === 'function';
  const items: preact.JSX.Element[] = [];
  if (update) {
    items.push(
      <button key="update" class="btn small primary" onClick={() => applyUpdate()}>
        {t('Yeni sürüm: şimdi yenile')}
      </button>,
    );
  }
  if (prompt) {
    items.push(
      <button key="install" class="btn small" onClick={() => void promptInstall()}>
        {t('Ana ekrana ekle')}
      </button>,
    );
  } else if (hint === 'ios') {
    items.push(
      <span key="ios" class="muted small-text">
        {t("iPhone/iPad: Safari'de Paylaş → Ana Ekrana Ekle")}
      </span>,
    );
  } else if (hint === 'android') {
    items.push(
      <span key="android" class="muted small-text">
        {t('Android: tarayıcı menüsü (⋮) → Ana ekrana ekle')}
      </span>,
    );
  }
  if (showFullscreen) {
    items.push(
      <button key="fs" class="btn small" onClick={() => void enterFullscreen()}>
        {t('Tam ekran')}
      </button>,
    );
  }
  if (standalone && title) {
    items.push(
      <span key="installed" class="muted small-text">
        {t('Uygulama olarak yüklü')}
      </span>,
    );
  }
  if (items.length === 0) return null;
  return (
    <>
      {title && <h4>{t('Telefona kurulum')}</h4>}
      <div class="install-controls">{items}</div>
    </>
  );
}
