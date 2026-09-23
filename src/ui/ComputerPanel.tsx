import { app } from '../app';
import { t } from '../i18n';
import { type Panel, store } from './store';

/** Ofis bilgisayarı (0.16.1): masadaki bilgisayardan yönetim panellerine kısayol. */
export function ComputerPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
  const open = (p: Panel): void => {
    store.panel.value = p;
  };
  return (
    <div class="overlay">
      <div class="menu-card panel computer">
        <div class="panel-head">
          <h2>{t('Bilgisayar')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="computer-menu">
          <button class={waiting > 0 ? 'btn primary' : 'btn'} onClick={() => open('adoption')}>
            {waiting > 0 ? t('🏠 Sahiplendirme ({n} bekliyor)', { n: waiting }) : t('🏠 Sahiplendirme')}
          </button>
          <button class="btn" onClick={() => open('finance')}>
            {t('📊 Finans')}
          </button>
          <button class="btn" onClick={() => open('staff')}>
            {t('👥 Personel')}
          </button>
          <button class="btn" onClick={() => open('achievements')}>
            {t('🏅 Başarımlar')}
          </button>
          <button class="btn" onClick={() => open('goals')}>
            {t('🎯 Hedefler')}
          </button>
        </div>
      </div>
    </div>
  );
}
