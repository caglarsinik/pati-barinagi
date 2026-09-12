import { useState } from 'preact/hooks';
import { app } from '../app';
import { GAME } from '../config/game';
import { getLang, t } from '../i18n';
import { store } from './store';

export function MainMenu() {
  store.lang.value;
  const [seed, setSeed] = useState('');
  const booted = store.booted.value;
  const lang = getLang();
  return (
    <div class="menu-screen">
      <div class="menu-card panel">
        <h1 class="title">{t(GAME.name)}</h1>
        <p class="sub">{t('Yumurtadan çıkan köpekler, bir barınak ve keşfedilecek koca bir dünya.')}</p>
        {store.hasSave.value && (
          <button class="btn primary" disabled={!booted} onClick={() => app.continueGame()}>
            {t('Devam et')}
          </button>
        )}
        <label class="field">
          <span>{t('Dünya tohumu (boş bırakırsan rastgele)')}</span>
          <input
            value={seed}
            placeholder={t('ör. 1234 ya da boncuk')}
            onInput={(e) => setSeed((e.target as HTMLInputElement).value)}
            onFocus={() => (store.inputFocused.value = true)}
            onBlur={() => (store.inputFocused.value = false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && booted) app.newGame(seed);
            }}
          />
        </label>
        <button class="btn" disabled={!booted} onClick={() => app.newGame(seed)}>
          {t('Yeni oyun')}
        </button>
        <div class="row">
          <button class="btn small" onClick={() => (store.settingsOpen.value = true)}>
            {t('Ayarlar')}
          </button>
          <span class="spacer" />
          <button class={'btn small' + (lang === 'tr' ? ' active' : '')} onClick={() => app.setLang('tr')}>
            Türkçe
          </button>
          <button class={'btn small' + (lang === 'en' ? ' active' : '')} onClick={() => app.setLang('en')}>
            English
          </button>
        </div>
        <p class="version">
          v{GAME.version} · {booted ? t('hazır') : t('dokular üretiliyor...')}
        </p>
      </div>
    </div>
  );
}
