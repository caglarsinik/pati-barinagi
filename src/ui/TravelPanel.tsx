import { app } from '../app';
import { audio } from '../audio/audio';
import { t } from '../i18n';
import { SIGN_NAMES_TR, type SignId, signKnown, signposts, travelMinutes } from '../sim/world/Signposts';
import { showToast, store } from './store';

/** Hızlı seyahat (0.20.3): tabeladan keşfedilmiş başka bir tabelaya; yol kadar oyun zamanı geçer. */
export function TravelPanel() {
  store.tick.value;
  store.lang.value;
  const sim = app.sim;
  if (!sim) return null;
  const here = sim.signHere();
  const go = (to: SignId): void => {
    const r = sim.command({ type: 'travel', to });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'click' : 'error');
    if (r.ok) store.panel.value = 'none';
  };
  return (
    <div class="overlay">
      <div class="menu-card panel shop">
        <div class="panel-head">
          <h2>{t('Hızlı seyahat')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">
          {here
            ? t('Buradasın: {name}. Yol boyunca zaman geçer; peşindeki köpekler seninle gelir.', { name: t(SIGN_NAMES_TR[here.id]) })
            : t('Hızlı seyahat için bir tabelanın yanına git.')}
        </p>
        {signposts(sim.world)
          .filter((s) => s.id !== here?.id)
          .map((s) => {
            const known = signKnown(sim.world, s);
            return (
              <div key={s.id} class="shop-item">
                <div>
                  🚏 <b>{known ? t(SIGN_NAMES_TR[s.id]) : t('Keşfedilmemiş tabela')}</b>
                  {known && here ? ' · ' + t('{n} dakika', { n: travelMinutes(here, s, sim.bicycle) }) : ''}
                </div>
                <button class="btn small" disabled={!known || !here} onClick={() => go(s.id)}>
                  {t('Git')}
                </button>
              </div>
            );
          })}
        {sim.bicycle && <p class="muted small-text">{t('🚲 Bisikletle yol üçte bir kısa sürer.')}</p>}
      </div>
    </div>
  );
}
