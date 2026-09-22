import { app } from '../app';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { formatMoney } from './format';
import { store } from './store';

/** Zafer ekranı "Yılın Barınağı": bir kez açılır, oyun duraklatılır; "Devam et" ile oyun sürer. */
export function VictoryPanel() {
  store.lang.value;
  const info = store.victory.value;
  const sim = app.sim;
  if (!info || !sim) return null;
  const close = (): void => {
    store.victorySeen.value = true;
    if (sim.paused) sim.togglePause();
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide victory">
        <h2>{t('🏆 Yılın Barınağı!')}</h2>
        <p>
          {t('{adopted} köpeğe yuva buldun ve itibarın {rep} oldu. Barınağın bu yılın en iyisi seçildi.', {
            adopted: sim.stats.adopted,
            rep: Math.round(sim.reputation),
          })}
        </p>
        <p class="muted">
          {t('{day}. gün · {week}. hafta · {dogs} köpek · {hatched} yumurtadan yavru · {staff} personel · kasa {money}', {
            day: info.day,
            week: info.week,
            dogs: sim.shelterDogs().length,
            hatched: sim.stats.hatched,
            staff: sim.staff.length,
            money: formatMoney(sim.money),
          })}
        </p>
        <p class="muted small-text">{t('Oyun sürüyor: barınağını büyütmeye devam edebilirsin. Hedef: {n} sahiplendirme ve {r} itibar.', { n: BALANCE.victory.adoptions, r: BALANCE.victory.reputation })}</p>
        <div class="row">
          <button class="btn primary" onClick={close}>
            {t('Devam et')}
          </button>
        </div>
      </div>
    </div>
  );
}
