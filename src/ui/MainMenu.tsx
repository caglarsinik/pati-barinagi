import { useState } from 'preact/hooks';
import { app } from '../app';
import { GAME } from '../config/game';
import { BALANCE } from '../config/balance';
import { getLang, t } from '../i18n';
import { DIFFICULTIES, DIFFICULTY_NAMES_TR, type Difficulty } from '../sim/Sim';
import { formatMoney } from './format';
import { InstallControls } from './InstallControls';
import { store } from './store';

export function MainMenu() {
  store.lang.value;
  const [seed, setSeed] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(() => app.lastDifficulty());
  const D = BALANCE.difficulty[difficulty];
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
              if (e.key === 'Enter' && booted) app.newGame(seed, difficulty);
            }}
          />
        </label>
        <label class="field">
          <span>{t('Zorluk')}</span>
          <select value={difficulty} onChange={(e) => setDifficulty((e.target as HTMLSelectElement).value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t(DIFFICULTY_NAMES_TR[d])}
              </option>
            ))}
          </select>
          <span class="muted small-text">
            {t('Başlangıç {money} · yardım ×{aid} · ihtiyaç hızı ×{needs}', { money: formatMoney(D.startMoney), aid: D.aidMul, needs: D.needsMul })}
          </span>
        </label>
        <button class="btn" disabled={!booted} onClick={() => app.newGame(seed, difficulty)}>
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
        <InstallControls />
        <p class="version">
          v{GAME.version} · {booted ? t('hazır') : t('dokular üretiliyor...')}
        </p>
      </div>
    </div>
  );
}
