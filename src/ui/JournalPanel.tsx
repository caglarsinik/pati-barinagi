import { app } from '../app';
import { t } from '../i18n';
import { JOURNAL_PAGES_TR } from '../sim/systems/RuinSystem';
import { store } from './store';

/** Nuri Usta'nın günlüğü (0.23.2): üç sayfa; son sayfada gizli yuvanın uzaklığı ve haritaya geçiş. */
export function JournalPanel() {
  store.lang.value;
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const total = JOURNAL_PAGES_TR.length;
  const page = Math.max(0, Math.min(total - 1, store.journalPage.value));
  const last = page === total - 1;
  const nest = sim.ruin.nest;
  const po = sim.playerOutside;
  const turn = (to: number): void => {
    store.journalPage.value = to;
  };
  return (
    <div class="overlay">
      <div class="menu-card panel journal-panel">
        <div class="panel-head">
          <h2>{t("📜 Nuri Usta'nın günlüğü")}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="journal-page">{t(JOURNAL_PAGES_TR[page])}</p>
        {last && nest && (
          <p class="muted small-text">{t('🥚 Gizli yuva: {d} kare uzakta (haritada mor nokta)', { d: Math.round(Math.hypot(nest.x - po.tileX, nest.y - po.tileY)) })}</p>
        )}
        <div class="row journal-nav">
          <button class="btn small" disabled={page === 0} onClick={() => turn(page - 1)}>
            {t('‹ Önceki')}
          </button>
          <span class="muted small-text">{t('Sayfa {n}/{total}', { n: page + 1, total })}</span>
          {last ? (
            <button class="btn small" onClick={() => (store.panel.value = 'map')}>
              {t('🗺️ Harita')}
            </button>
          ) : (
            <button class="btn small" onClick={() => turn(page + 1)}>
              {t('Sonraki ›')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
