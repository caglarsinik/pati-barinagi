import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { wholesaleBagPrice } from '../sim/world/Village';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

/** Köydeki yem toptancısı (0.18.2): indirimli çuval, en az 3, kilere hemen gönderilir. */
export function WholesalePanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const V = BALANCE.village;
  const price = wholesaleBagPrice();
  const buy = (bags: number): void => {
    const r = sim.command({ type: 'buyWholesale', bags });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'coin' : 'error');
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wholesale">
        <div class="panel-head">
          <h2>{t('Yem toptancısı')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p>
          {t('Çuval {p} (kilerden siparişte {full}) · en az {m} çuval · kilere hemen gönderilir.', {
            p: formatMoney(price),
            full: formatMoney(BALANCE.economy.foodBagPrice),
            m: V.minBags,
          })}
        </p>
        <p class="muted small-text">{t('Kilerde şu an {n} porsiyon var. Bir çuval {k} porsiyon.', { n: Math.floor(sim.foodStock), k: BALANCE.economy.foodBagPortions })}</p>
        <div class="row wrap">
          {[V.minBags, 5, 10].map((n) => (
            <button key={n} class="btn" disabled={sim.money < n * price} onClick={() => buy(n)}>
              {t('{n} çuval ({cost})', { n, cost: formatMoney(n * price) })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
