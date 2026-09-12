import { app } from '../app';
import { t } from '../i18n';
import { ACHIEVEMENTS } from '../sim/systems/Achievements';
import { store } from './store';

export function AchievementsPanel() {
  store.tick.value;
  store.lang.value;
  const sim = app.sim;
  if (!sim) return null;
  const unlocked = sim.achievements.unlocked;
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>
            {t('Başarımlar')} <span class="muted small-text">{t('{n}/{total} açıldı', { n: unlocked.size, total: ACHIEVEMENTS.length })}</span>
          </h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="ach-list">
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.has(a.id);
            return (
              <div key={a.id} class={'ach ' + (on ? 'on' : 'off')} title={on ? t('Açıldı') : t('Kilitli')}>
                <span class="ach-icon">{on ? '🏅' : '🔒'}</span>
                <div>
                  <div class="ach-name">{t(a.name)}</div>
                  <div class="muted small-text">{t(a.desc)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
