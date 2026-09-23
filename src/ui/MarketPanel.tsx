import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { RARITY_NAMES_TR } from '../sim/entities/DogGenome';
import { type MarketItem, type SupplyKind, isMarketDay, marketEggOffer, shopPrice } from '../sim/systems/ShopSystem';
import { formatMoney } from './format';
import { showToast, store } from './store';

/** Pazar günü köy meydanındaki tezgâh (0.20.0): indirimli oyuncak ve vitamin, haftanın nadir yumurtası. */
export function MarketPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const S = BALANCE.shop;
  const open = isMarketDay(sim);
  const buy = (item: MarketItem, qty = 1): void => {
    const r = sim.command({ type: 'buyMarket', item, qty });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'coin' : 'error');
  };
  const supply = (item: SupplyKind, icon: string, name: string) => {
    const price = shopPrice(item, true);
    return (
      <div class="shop-item">
        <div>
          {icon} <b>{t(name)}</b> · {formatMoney(price)} <span class="muted small-text">{t('(dükkânda {p})', { p: formatMoney(shopPrice(item)) })}</span>
        </div>
        <div class="row wrap">
          {[1, 5].map((n) => (
            <button key={n} class="btn small" disabled={!open || sim.money < n * price || sim.supplies[item] >= S.maxSupply} onClick={() => buy(item, n)}>
              {t('{n} tane ({cost})', { n, cost: formatMoney(n * price) })}
            </button>
          ))}
        </div>
      </div>
    );
  };
  const egg = marketEggOffer(sim);
  const full = sim.backpack.length >= sim.backpackSlots();
  return (
    <div class="overlay">
      <div class="menu-card panel shop">
        <div class="panel-head">
          <h2>{t('Pazar tezgâhı')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">
          {open ? t('Pazar indirimi: dükkân fiyatının %{n} altı.', { n: Math.round((1 - S.marketMul) * 100) }) : t('Tezgâh toplandı; Pazar günü yeniden kurulur.')}
        </p>
        {supply('toy', '🧸', 'Oyuncak paketi')}
        {supply('vitamin', '💊', 'Vitamin')}
        <div class="shop-item">
          <div>
            🥚 <b>{t('Haftanın yumurtası: {rarity}', { rarity: t(RARITY_NAMES_TR[egg.rarity]) })}</b> · {formatMoney(egg.price)}
          </div>
          <div class="muted small-text">{egg.sold ? t('Bu haftanın yumurtası satıldı.') : full ? t('Çantan dolu: önce kuluçkaya boşalt.') : t('Her Pazar bir tane; çantana girer, kuluçkada çatlar.')}</div>
          <button class="btn small" disabled={!open || egg.sold || full || sim.money < egg.price} onClick={() => buy('egg')}>
            {t('Satın al')}
          </button>
        </div>
      </div>
    </div>
  );
}
