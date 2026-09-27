import { useState } from 'preact/hooks';
import { app } from '../app';
import { Rng } from '../core/Rng';
import { t } from '../i18n';
import { type PlayerLook, randomLook, sanitizePlayerName } from '../sim/entities/PlayerLook';
import { CharacterEditor } from './CharacterEditor';
import { store } from './store';

/**
 * "Yeni oyun" → "Karakterin" adımı (0.24.1): ana menüdeki seçimler `store.newGameDraft`'ta bekler; Başla ile oyun kurulur.
 * Son seçilen görünüm ve ad tarayıcıda kalır (`app.lastLook`/`lastPlayerName`); Geri taslağı korur.
 */
export function CharacterScreen() {
  store.lang.value;
  const draft = store.newGameDraft.value;
  const booted = store.booted.value;
  const [look, setLook] = useState<PlayerLook>(() => app.lastLook());
  const [name, setName] = useState(() => app.lastPlayerName());
  const start = (): void => {
    if (!booted || !draft) return;
    store.newGameDraft.value = null;
    app.newGame(draft.seed, draft.difficulty, draft.slot, draft.starter, draft.dayMinutes, { look, name: sanitizePlayerName(name) });
  };
  const random = (): void => setLook(randomLook(new Rng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0)));
  return (
    <div class="menu-screen">
      <div class="menu-card panel character">
        <CharacterEditor
          look={look}
          name={name}
          onLook={setLook}
          onName={setName}
          onSubmit={start}
          title={t('Karakterin')}
          actions={
            <div class="row char-actions">
              <button class="btn small" data-char="random" onClick={random}>
                {t('Rastgele')}
              </button>
              <button class="btn small" data-char="back" onClick={() => (store.screen.value = 'menu')}>
                {t('Geri')}
              </button>
              <span class="spacer" />
              <button class="btn primary" data-char="start" disabled={!booted || !draft} onClick={start}>
                {t('Başla')}
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
