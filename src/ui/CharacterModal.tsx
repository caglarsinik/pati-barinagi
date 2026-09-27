import { useState } from 'preact/hooks';
import { app } from '../app';
import { Rng } from '../core/Rng';
import { t } from '../i18n';
import { DEFAULT_LOOK, type PlayerLook, randomLook } from '../sim/entities/PlayerLook';
import { CharacterEditor } from './CharacterEditor';
import { store } from './store';

/** Ayarlar → Karakter (0.24.2): açık oyunda görünüm ve ad; Uygula `app.setPlayer` ile anında uygular ve kaydeder. Sim durmaz. */
export function CharacterModal() {
  store.lang.value;
  const [look, setLook] = useState<PlayerLook>(() => ({ ...(app.sim?.player.look ?? DEFAULT_LOOK) }));
  const [name, setName] = useState(() => app.sim?.player.name ?? '');
  if (!app.sim) return null;
  const close = (): void => {
    store.characterOpen.value = false;
  };
  const apply = (): void => {
    app.setPlayer(look, name);
    close();
  };
  const random = (): void => setLook(randomLook(new Rng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0)));
  return (
    <div class="overlay">
      <div class="menu-card panel character">
        <CharacterEditor
          look={look}
          name={name}
          onLook={setLook}
          onName={setName}
          onSubmit={apply}
          title={t('Karakter')}
          actions={
            <div class="row char-actions">
              <button class="btn small" data-char="random" onClick={random}>
                {t('Rastgele')}
              </button>
              <button class="btn small" data-char="cancel" onClick={close}>
                {t('Vazgeç')}
              </button>
              <span class="spacer" />
              <button class="btn primary" data-char="apply" onClick={apply}>
                {t('Uygula')}
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
