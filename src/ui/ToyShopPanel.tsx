import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { type ShopItem, type SupplyKind, shopPrice } from '../sim/systems/ShopSystem';
import { formatMoney } from './format';
import { showToast, store } from './store';

/** Köydeki oyuncak ve ilaç dükkânının tezgâhı (0.20.0): oyuncak paketi, vitamin, bisiklet. */
export function ToyShopPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const S = BALANCE.shop;
  const buy = (item: ShopItem, qty = 1): void => {
    const r = sim.command({ type: 'buyShop', item, qty });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'coin' : 'error');
  };
  const supply = (item: SupplyKind, icon: string, name: string, desc: string) => {
    const price = shopPrice(item);
    return (
      <div class="shop-item">
        <div>
          {icon} <b>{t(name)}</b> · {formatMoney(price)}
        </div>
        <div class="muted small-text">{desc}</div>
        <div class="row wrap">
          {[1, 5].map((n) => (
            <button key={n} class="btn small" disabled={sim.money < n * price || sim.supplies[item] >= S.maxSupply} onClick={() => buy(item, n)}>
              {t('{n} tane ({cost})', { n, cost: formatMoney(n * price) })}
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div class="overlay">
      <div class="menu-card panel shop">
        <div class="panel-head">
          <h2>{t('Oyuncak ve ilaç dükkânı')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">
          {t('Çantanda 🧸 {toy} · 💊 {vitamin}. Köpeğe vermek için köpek panelini aç.', { toy: sim.supplies.toy, vitamin: sim.supplies.vitamin })}
        </p>
        {supply('toy', '🧸', 'Oyuncak paketi', t('Oyun keyfini doldurur, sadakat +{n}.', { n: S.toyLoyalty }))}
        {supply('vitamin', '💊', 'Vitamin', t('Sağlık +{n}; bir gün boyunca hastalanma olasılığı yarıya iner.', { n: S.vitaminHealth }))}
        <div class="shop-item">
          <div>
            🚲 <b>{t('Bisiklet')}</b> · {formatMoney(shopPrice('bicycle'))}
          </div>
          <div class="muted small-text">{t('Koşarken {x} kat hızlı gidersin ve daha az yorulursun.', { x: String(S.bicycleRunMul).replace('.', ',') })}</div>
          {sim.bicycle ? (
            <div class="muted">{t('Bisikletin var.')}</div>
          ) : (
            <button class="btn small" disabled={sim.money < shopPrice('bicycle')} onClick={() => buy('bicycle')}>
              {t('Satın al')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
