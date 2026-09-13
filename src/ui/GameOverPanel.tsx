import { app } from '../app';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { formatMoney } from './format';
import { store } from './store';

/** İflas ekranı: oyun durur, kayıt korunur ("Devam et" yine bu ekranı açar); ana menüye dönülür. */
export function GameOverPanel() {
  store.lang.value;
  store.tick.value;
  const info = store.gameOver.value;
  const sim = app.sim;
  if (!info || !sim) return null;
  return (
    <div class="overlay">
      <div class="menu-card panel wide game-over">
        <h2>{t('İflas')}</h2>
        <p>{t('Kasa {n} hafta üst üste maaşları karşılayamayacak kadar eksideydi. Barınak kapatıldı.', { n: BALANCE.economy.bankruptcy.weeks })}</p>
        <p class="muted">
          {t('{week}. hafta · {dogs} köpek · {adopted} sahiplendirme · kasa {money}', {
            week: info.week,
            dogs: sim.shelterDogs().length,
            adopted: sim.stats.adopted,
            money: formatMoney(sim.money),
          })}
        </p>
        <div class="row">
          <button class="btn primary" onClick={() => app.toMenu()}>
            {t('Ana menüye dön')}
          </button>
        </div>
      </div>
    </div>
  );
}
