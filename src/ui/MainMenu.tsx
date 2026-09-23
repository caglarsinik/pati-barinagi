import { useState } from 'preact/hooks';
import { app } from '../app';
import { GAME } from '../config/game';
import { BALANCE } from '../config/balance';
import type { SaveSummary } from '../core/SaveManager';
import { getLang, t } from '../i18n';
import { DIFFICULTIES, DIFFICULTY_NAMES_TR, type Difficulty, type StarterKind } from '../sim/Sim';
import { formatMoney } from './format';
import { InstallControls } from './InstallControls';
import { store } from './store';

function savedAtText(ms: number): string {
  try {
    return new Date(ms).toLocaleString(getLang() === 'en' ? 'en-GB' : 'tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Bir kayıt yuvası: özet, seçim, Devam ve iki adımlı Sil. */
function SlotCard({ index, summary, selected, onSelect }: { index: number; summary: SaveSummary | null; selected: boolean; onSelect: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const booted = store.booted.value;
  const diff = summary?.difficulty && (DIFFICULTIES as readonly string[]).includes(summary.difficulty) ? t(DIFFICULTY_NAMES_TR[summary.difficulty as Difficulty]) : '';
  return (
    <div class={'slot-card' + (selected ? ' active' : '') + (summary ? '' : ' empty')} onClick={onSelect}>
      <div class="slot-head">
        <b>{t('Yuva {n}', { n: index + 1 })}</b>
        {summary ? (
          <span class="small-text">
            {t('{day}. gün · {money}', { day: summary.day, money: formatMoney(summary.money) })}
            {diff ? ` · ${diff}` : ''}
            {summary.victory ? ' · 🏆' : ''}
          </span>
        ) : (
          <span class="muted small-text">{t('Boş')}</span>
        )}
      </div>
      {summary && (
        <div class="row">
          <span class="muted small-text">{savedAtText(summary.savedAt)}</span>
          <span class="spacer" />
          {confirmDelete ? (
            <>
              <button
                class="btn small danger"
                onClick={(e) => {
                  e.stopPropagation();
                  app.deleteSlot(index);
                  setConfirmDelete(false);
                }}
              >
                {t('Evet, sil')}
              </button>
              <button
                class="btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
              >
                {t('Vazgeç')}
              </button>
            </>
          ) : (
            <>
              <button
                class="btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
              >
                {t('Sil')}
              </button>
              <button
                class="btn small primary"
                disabled={!booted}
                onClick={(e) => {
                  e.stopPropagation();
                  app.continueGame(index);
                }}
              >
                {t('Devam et')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MainMenu() {
  store.lang.value;
  const [seed, setSeed] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(() => app.lastDifficulty());
  const [starter, setStarter] = useState<StarterKind>(() => app.lastStarter());
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const D = BALANCE.difficulty[difficulty];
  const booted = store.booted.value;
  const lang = getLang();
  const slots = store.slots.value;
  const selected = store.saveSlot.value;
  const occupied = !!slots[selected];
  const startNew = (): void => {
    if (occupied && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    setConfirmOverwrite(false);
    app.newGame(seed, difficulty, selected, starter);
  };
  const select = (i: number): void => {
    store.saveSlot.value = i;
    setConfirmOverwrite(false);
  };
  return (
    <div class="menu-screen">
      <div class="menu-card panel">
        <div class="menu-intro">
          <h1 class="title">{t(GAME.name)}</h1>
          <p class="sub">{t('Yumurtadan çıkan köpekler, bir barınak ve keşfedilecek koca bir dünya.')}</p>
          <InstallControls />
          <p class="version">
            v{GAME.version} · {booted ? t('hazır') : t('dokular üretiliyor...')}
          </p>
        </div>
        <div class="menu-form">
          <div class="slot-list">
            {slots.map((s, i) => (
              <SlotCard key={i} index={i} summary={s} selected={i === selected} onSelect={() => select(i)} />
            ))}
          </div>
          <p class="muted small-text">{t('Oyun her sabah ve her hafta seçili yuvaya kendiliğinden kaydedilir.')}</p>
          <label class="field">
            <span>{t('Dünya tohumu (boş bırakırsan rastgele)')}</span>
            <input
              value={seed}
              placeholder={t('ör. 1234 ya da boncuk')}
              onInput={(e) => setSeed((e.target as HTMLInputElement).value)}
              onFocus={() => (store.inputFocused.value = true)}
              onBlur={() => (store.inputFocused.value = false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && booted) startNew();
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
          <label class="field">
            <span>{t('Başlangıç türü')}</span>
            <select value={starter} onChange={(e) => setStarter((e.target as HTMLSelectElement).value as StarterKind)}>
              <option value="guided">{t('Kuruluş: küçük arsa, adım adım (önerilir)')}</option>
              <option value="ready">{t('Hazır barınak: büyük arsa, binalar kurulu')}</option>
            </select>
          </label>
          <button class={'btn' + (confirmOverwrite ? ' danger' : '')} disabled={!booted} onClick={startNew}>
            {confirmOverwrite ? t('Yuva {n} silinip yeni oyun başlasın mı? Onayla', { n: selected + 1 }) : occupied ? t('Yeni oyun (yuva {n}, üzerine yazar)', { n: selected + 1 }) : t('Yeni oyun (yuva {n})', { n: selected + 1 })}
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
        </div>
      </div>
    </div>
  );
}
