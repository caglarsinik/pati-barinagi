import { useState } from 'preact/hooks';
import { app } from '../app';
import { GAME } from '../config/game';
import { store } from './store';

export function MainMenu() {
  const [seed, setSeed] = useState('');
  const booted = store.booted.value;
  return (
    <div class="menu-screen">
      <div class="menu-card panel">
        <h1 class="title">{GAME.name}</h1>
        <p class="sub">Yumurtadan çıkan köpekler, bir barınak ve keşfedilecek koca bir dünya.</p>
        {store.hasSave.value && (
          <button class="btn primary" disabled={!booted} onClick={() => app.continueGame()}>
            Devam et
          </button>
        )}
        <label class="field">
          <span>Dünya tohumu (boş bırakırsan rastgele)</span>
          <input
            value={seed}
            placeholder="ör. 1234 ya da boncuk"
            onInput={(e) => setSeed((e.target as HTMLInputElement).value)}
            onFocus={() => (store.inputFocused.value = true)}
            onBlur={() => (store.inputFocused.value = false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && booted) app.newGame(seed);
            }}
          />
        </label>
        <button class="btn" disabled={!booted} onClick={() => app.newGame(seed)}>
          Yeni oyun
        </button>
        <button class="btn small" onClick={() => (store.settingsOpen.value = true)}>
          Ayarlar
        </button>
        <p class="version">
          v{GAME.version} · {booted ? 'hazır' : 'dokular üretiliyor...'}
        </p>
      </div>
    </div>
  );
}
