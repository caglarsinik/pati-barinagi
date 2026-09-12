import { app } from '../app';
import { t } from '../i18n';
import { store } from './store';

export function PauseMenu() {
  store.lang.value;
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <h2>{t('Duraklatıldı')}</h2>
        <p class="sub">{t('Tohum: {seed}', { seed: store.seed.value })}</p>
        <button class="btn primary" onClick={() => app.closePauseMenu()}>
          {t('Devam et (Esc)')}
        </button>
        <button class="btn" onClick={() => app.save()}>
          {t('Kaydet')}
        </button>
        <button class="btn" onClick={() => (store.settingsOpen.value = true)}>
          {t('Ayarlar ve kayıt aktarımı')}
        </button>
        <button class="btn" onClick={() => app.toMenu()}>
          {t('Kaydet ve ana menüye dön')}
        </button>
      </div>
    </div>
  );
}
