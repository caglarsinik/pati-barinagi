import { app } from '../app';
import { BALANCE, type Speed } from '../config/balance';
import { t } from '../i18n';
import { Minimap } from './Minimap';
import { store } from './store';

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(Math.round(v));
  return `${sign}${abs.toLocaleString('tr-TR')} ${BALANCE.economy.currency}`;
}

export function HUD() {
  store.lang.value;
  const speed = store.speed.value;
  const mode = store.mode.value;
  const panel = store.panel.value;
  const tab = (id: typeof panel, label: string) => (
    <button class={'btn small' + (panel === id ? ' active' : '')} onClick={() => app.togglePanel(id)}>
      {label}
    </button>
  );
  return (
    <>
      <div class="hud hud-top-left panel">
        <div class="money">{formatMoney(store.money.value)}</div>
        <div class="muted small-text">
          🐕 {store.dogCount.value}/{store.kennelCapacity.value} · 🥣 {store.foodStock.value} {t('porsiyon')}
        </div>
        <div class="muted small-text" title={t('İtibar: sahiplenici sayısını ve isteklerini etkiler')}>
          ⭐ {t('İtibar {rep} · Lisans {lvl}', { rep: store.reputation.value, lvl: store.licenseLevel.value })} · 👷 {store.staffCount.value}
          {store.adoptersWaiting.value > 0 ? ` · 🧑 ${t('{n} bekliyor', { n: store.adoptersWaiting.value })}` : ''}
        </div>
        <div class={'stamina' + (store.exhausted.value ? ' exhausted' : '')} title={t('Dayanıklılık')}>
          <div class="bar">
            <div class="fill" style={{ width: `${store.stamina.value}%` }} />
          </div>
        </div>
      </div>

      <div class="hud hud-top-center panel">
        <div class="day">{store.dayText.value}</div>
        <div class="time">
          {store.timeText.value} · {store.weekText.value}
          {store.isNight.value ? ' · 🌙' : ''}
        </div>
        <div class="muted small-text">
          {store.season.value} · {store.weatherIcon.value} {store.weather.value}
        </div>
      </div>

      <div class="hud hud-top-right panel">
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
        <div class="btn-row">
          <button class={'btn small' + (mode === 'manage' ? ' active' : '')} onClick={() => app.toggleMode()}>
            {mode === 'avatar' ? t('Yönetim (Tab)') : t('Avatar (Tab)')}
          </button>
          <button class={'btn small' + (store.buildBar.value ? ' active' : '')} onClick={() => app.toggleBuildBar()}>
            {t('İnşa (B)')}
          </button>
          {tab('dogs', t('Köpekler (I)'))}
          {tab('adoption', t('Sahiplendirme (O)'))}
          {tab('finance', t('Finans (N)'))}
          {tab('staff', t('Personel (P)'))}
          {tab('deployment', t('Görevlendirme (F)'))}
          {tab('achievements', t('Başarımlar (H)'))}
          <button class="btn small" onClick={() => app.openPauseMenu()}>
            {t('Menü (Esc)')}
          </button>
        </div>
      </div>

      <div class="hud hud-bottom panel hint">{store.hint.value}</div>

      <Minimap />
    </>
  );
}
