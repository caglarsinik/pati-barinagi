import { app } from '../app';
import { t } from '../i18n';
import { Backpack } from './EggPanels';
import { Minimap } from './Minimap';
import { store } from './store';

/** Telefonda uyarılar sütun yerine üst şeritteki 🔔 rozetinden açılan sayfada listelenir. */
export function AlertsSheet() {
  store.tick.value;
  store.lang.value;
  const alerts = store.alerts.value;
  const close = (): void => {
    store.panel.value = 'none';
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Uyarılar')}</h2>
          <button class="btn small close" onClick={close}>
            ✕
          </button>
        </div>
        {alerts.length === 0 && <p class="muted">{t('Uyarı yok.')}</p>}
        <div class="alerts-sheet">
          {alerts.map((a) => (
            <button
              key={a.id}
              class={`alert ${a.severity}`}
              onClick={() => {
                close();
                if (a.dogId !== undefined) {
                  store.selectedDogId.value = a.dogId;
                  store.panel.value = 'dog';
                } else if (a.tile) app.focusTile(a.tile.x, a.tile.y);
              }}
            >
              {a.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Telefonda çanta üst şeritteki çipten açılır. */
export function BackpackSheet() {
  store.lang.value;
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>{t('Çanta')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <Backpack inSheet />
        <p class="muted small-text">{t('Yumurtaya dokununca incelenir. Ödül maması sokak köpeklerini evcilleştirir.')}</p>
      </div>
    </div>
  );
}

/** Telefonda mini harita üst şeritteki 🗺️ çipinden büyük olarak açılır. */
export function MapSheet() {
  store.lang.value;
  return (
    <div class="overlay">
      <div class="menu-card panel map-sheet">
        <div class="panel-head">
          <h2>{t('Harita')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <Minimap inSheet />
        <p class="muted small-text">{t('Sarı nokta dolu yuva, turuncu nokta sokak köpeği ini, beyaz nokta sensin.')}</p>
      </div>
    </div>
  );
}
