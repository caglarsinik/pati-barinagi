import { app } from '../app';
import { BALANCE, type Speed } from '../config/balance';
import { t } from '../i18n';
import { formatMoney } from './format';
import { store } from './store';

const RUN_SPEEDS = BALANCE.time.speeds.filter((s) => s !== 0) as Speed[];

/**
 * Üst durum şeridi: sol durum çipleri (dar ekranda parmakla kaydırılır), ortada saat, sağda hız ve mod.
 * Telefonda: saat kısa, hız ⏸/▶ + döngülü tek düğme, mod düğmesi ikonlu; 🥣/⭐ çipleri çok dar ekranda CSS ile gizlenir.
 * Tablette ve dokunmatikte de kısa kontroller (0.21.6): sağ grup kesilmez; sığmazsa sol çipler daralıp kayar.
 */
export function TopBar() {
  store.lang.value;
  const speed = store.speed.value as Speed;
  const mode = store.mode.value;
  const autopilot = store.autopilot.value;
  const phone = store.layout.value === 'phone';
  const compact = store.layout.value !== 'desktop' || store.touch.value;
  const running: Speed = speed === 0 ? RUN_SPEEDS[0] : speed;
  const nextSpeed = RUN_SPEEDS[(RUN_SPEEDS.indexOf(running) + 1) % RUN_SPEEDS.length];
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
  const speedControls = compact ? (
    <div class="speed-row">
      <button class={'btn small' + (speed === 0 ? ' active' : '')} title={t('Duraklat / devam')} onClick={() => app.setSpeed(speed === 0 ? running : 0)}>
        {speed === 0 ? '▶' : '❚❚'}
      </button>
      <button class="btn small" title={t('{s}x hız', { s: nextSpeed })} onClick={() => app.setSpeed(nextSpeed)}>
        {running}x
      </button>
    </div>
  ) : (
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
  );
  const dayShort = store.dayText.value.split(' · ')[0];
  return (
    <div class="hud topbar">
      <div class="tb-left">
        <span class="money">{formatMoney(store.money.value)}</span>
        <span class="chip" title={t('Köpek sayısı / kulübe kapasitesi')}>
          🐕 {store.dogCount.value}/{store.kennelCapacity.value}
        </span>
        <span class="chip chip-food" title={t('Yem stoğu (porsiyon)')}>
          🥣 {store.foodStock.value}
        </span>
        <span class="chip chip-rep" title={t('İtibar: sahiplenici sayısını ve isteklerini etkiler')}>
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
      <div class="tb-center" title={`${store.dayText.value} · ${store.weekText.value} · ${store.season.value} ${store.weather.value}`}>
        {phone ? (
          <>
            <b>{dayShort}</b> · {store.timeText.value}
            {store.isNight.value ? ' 🌙' : ''} {store.weatherIcon.value}
          </>
        ) : (
          <>
            <b>{store.dayText.value}</b> · {store.timeText.value} · {store.weekText.value}
            {store.isNight.value ? ' 🌙' : ''} {store.weatherIcon.value}
            <span class="muted tb-season">
              {' '}
              · {store.season.value} {store.weather.value}
            </span>
          </>
        )}
      </div>
      <div class="tb-right">
        {phoneChips}
        {speedControls}
        <button class={'btn small' + (autopilot ? ' active' : '')} title={t('Otopilot (T): barınağın işlerini kendiliğinden yapar')} onClick={() => app.sim?.command({ type: 'setAutopilot', on: !autopilot })}>
          🤖{compact ? '' : ` ${t('Otopilot')}`}
        </button>
        <button class={'btn small' + (mode === 'manage' ? ' active' : '')} title={t('Avatar ve yönetim modu arasında geçiş (Tab)')} onClick={() => app.toggleMode()}>
          {compact ? (
            <>
              {mode === 'avatar' ? '🛠' : '🧍'}
              <span class="tb-label"> {mode === 'avatar' ? t('Yönet') : t('Avatar')}</span>
            </>
          ) : mode === 'avatar' ? (
            t('Yönetim (Tab)')
          ) : (
            t('Avatar (Tab)')
          )}
        </button>
      </div>
    </div>
  );
}
