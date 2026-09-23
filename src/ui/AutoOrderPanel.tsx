import { app } from '../app';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { store } from './store';

/** Kilerdeki otomatik sipariş panosu (0.17.0): Görevlendirme → Politikalar'daki ayarın aynısı. */
export function AutoOrderPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const p = sim.policies;
  return (
    <div class="overlay">
      <div class="menu-card panel auto-order">
        <div class="panel-head">
          <h2>{t('Otomatik sipariş')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">{t('Kilerde şu an {n} porsiyon var.', { n: Math.floor(sim.foodStock) })}</p>
        <div class="policies">
          <label class="policy">
            <input type="checkbox" checked={p.autoOrderFood} onChange={(e) => sim.command({ type: 'setPolicy', policy: { autoOrderFood: (e.target as HTMLInputElement).checked } })} />
            <span>{t('Yem stoğu eşiğin altına inince otomatik çuval sipariş et (+{fee} ₺ teslimat)', { fee: BALANCE.economy.deliveryFee })}</span>
            <input
              type="number"
              min={0}
              max={200}
              value={p.foodThreshold}
              onFocus={() => (store.inputFocused.value = true)}
              onBlur={() => (store.inputFocused.value = false)}
              onInput={(e) => sim.command({ type: 'setPolicy', policy: { foodThreshold: Number((e.target as HTMLInputElement).value) } })}
            />
            <span class="muted small-text">{t('porsiyon')}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
