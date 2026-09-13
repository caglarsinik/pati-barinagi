import { app } from '../app';
import { BALANCE, type Speed } from '../config/balance';
import { t } from '../i18n';
import { formatMoney } from './format';
import { store } from './store';

/** Üst durum şeridi: sol durum çipleri, ortada saat, sağda hız ve mod. Düğme kümesi alt menüye taşındı. */
export function TopBar() {
  store.lang.value;
  const speed = store.speed.value;
  const mode = store.mode.value;
  const phone = store.layout.value === 'phone';
  const phoneChips = phone ? (
    <>
      <button class="chip-btn" title={t('Çanta')} onClick={() => app.togglePanel('backpack')}>
        🥚 {store.backpackCount.value} · 🦴 {store.treats.value}
      </button>
      {store.alerts.value.length > 0 && (
        <button class="chip-btn" title={t('Uyarılar')} onClick={() => app.togglePanel('alerts')}>
          🔔 {store.alerts.value.length}
        </button>
      )}
      <button class="chip-btn" title={t('Harita')} onClick={() => app.togglePanel('map')}>
        🗺️
      </button>
    </>
  ) : null;
  return (
    <div class="hud topbar">
      <div class="tb-left">
        <span class="money">{formatMoney(store.money.value)}</span>
        <span class="chip" title={t('Köpek sayısı / kulübe kapasitesi')}>
          🐕 {store.dogCount.value}/{store.kennelCapacity.value}
        </span>
        <span class="chip" title={t('Yem stoğu (porsiyon)')}>
          🥣 {store.foodStock.value}
        </span>
        <span class="chip" title={t('İtibar: sahiplenici sayısını ve isteklerini etkiler')}>
          ⭐ {store.reputation.value} · L{store.licenseLevel.value}
        </span>
        {!phone && (
          <span class="chip" title={t('Personel sayısı')}>
            👷 {store.staffCount.value}
          </span>
        )}
        {store.adoptersWaiting.value > 0 && (
          <button class="chip-btn" title={t('Sahiplendirme masasını aç')} onClick={() => app.togglePanel('adoption')}>
            🧑 {t('{n} bekliyor', { n: store.adoptersWaiting.value })}
          </button>
        )}
        {!store.adoptionsOpen.value && (
          <button class="chip-btn" title={t('Sahiplendirme kapalı: tıkla ve aç')} onClick={() => app.togglePanel('adoption')}>
            🚫 {phone ? '' : t('Sahiplendirme kapalı')}
          </button>
        )}
        {store.walkingDog.value && (
          <span class="chip">
            🦮 {store.walkingDog.value}
            <button class="chip-btn" title={t('Gezintiyi bitir')} onClick={() => app.sim?.command({ type: 'endWalk' })}>
              {t('Bırak')}
            </button>
          </span>
        )}
        {mode === 'avatar' && (
          <span class={'stamina' + (store.exhausted.value ? ' exhausted' : '')} title={t('Dayanıklılık')}>
            <div class="bar">
              <div class="fill" style={{ width: `${store.stamina.value}%` }} />
            </div>
          </span>
        )}
      </div>
      <div class="tb-center">
        <b>{store.dayText.value}</b> · {store.timeText.value} · {store.weekText.value}
        {store.isNight.value ? ' 🌙' : ''}
        <span class="muted">
          {' '}
          · {store.season.value} {store.weatherIcon.value} {store.weather.value}
        </span>
      </div>
      <div class="tb-right">
        {phoneChips}
        <div class="speed-row">
          {BALANCE.time.speeds.map((s) => (
            <button
              key={s}
              class={'btn small' + (speed === s ? ' active' : '')}
              title={s === 0 ? t('Duraklat (Space)') : t('{s}x hız', { s })}
              onClick={() => app.setSpeed(s as Speed)}
            >
              {s === 0 ? '❚❚' : `${s}x`}
            </button>
          ))}
        </div>
        <button class={'btn small' + (mode === 'manage' ? ' active' : '')} title={t('Avatar ve yönetim modu arasında geçiş (Tab)')} onClick={() => app.toggleMode()}>
          {mode === 'avatar' ? t('Yönetim (Tab)') : t('Avatar (Tab)')}
        </button>
      </div>
    </div>
  );
}
