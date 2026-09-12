import { app } from '../app';
import { BALANCE, type Speed } from '../config/balance';
import { Minimap } from './Minimap';
import { store } from './store';

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(Math.round(v));
  return `${sign}${abs.toLocaleString('tr-TR')} ${BALANCE.economy.currency}`;
}

export function HUD() {
  const speed = store.speed.value;
  const mode = store.mode.value;
  return (
    <>
      <div class="hud hud-top-left panel">
        <div class="money">{formatMoney(store.money.value)}</div>
        <div class="muted small-text">
          🐕 {store.dogCount.value}/{store.kennelCapacity.value} · 🥣 {store.foodStock.value} porsiyon
        </div>
        <div class="muted small-text" title="İtibar: sahiplenici sayısını ve isteklerini etkiler">
          ⭐ İtibar {store.reputation.value} · Lisans {store.licenseLevel.value}
          {store.adoptersWaiting.value > 0 ? ` · 🧑 ${store.adoptersWaiting.value} bekliyor` : ''}
        </div>
        <div class={'stamina' + (store.exhausted.value ? ' exhausted' : '')} title="Dayanıklılık">
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
      </div>

      <div class="hud hud-top-right panel">
        <div class="speed-row">
          {BALANCE.time.speeds.map((s) => (
            <button
              key={s}
              class={'btn small' + (speed === s ? ' active' : '')}
              title={s === 0 ? 'Duraklat (Space)' : `${s}x hız`}
              onClick={() => app.setSpeed(s as Speed)}
            >
              {s === 0 ? '❚❚' : `${s}x`}
            </button>
          ))}
        </div>
        <div class="btn-row">
          <button class={'btn small' + (mode === 'manage' ? ' active' : '')} onClick={() => app.toggleMode()}>
            {mode === 'avatar' ? 'Yönetim (Tab)' : 'Avatar (Tab)'}
          </button>
          <button class={'btn small' + (store.buildBar.value ? ' active' : '')} onClick={() => app.toggleBuildBar()}>
            İnşa (B)
          </button>
          <button class={'btn small' + (store.panel.value === 'dogs' ? ' active' : '')} onClick={() => app.togglePanel('dogs')}>
            Köpekler (I)
          </button>
          <button class={'btn small' + (store.panel.value === 'adoption' ? ' active' : '')} onClick={() => app.togglePanel('adoption')}>
            Sahiplendirme (O)
          </button>
          <button class={'btn small' + (store.panel.value === 'finance' ? ' active' : '')} onClick={() => app.togglePanel('finance')}>
            Finans (N)
          </button>
          <button class="btn small" onClick={() => app.openPauseMenu()}>
            Menü (Esc)
          </button>
        </div>
      </div>

      <div class="hud hud-bottom panel hint">{store.hint.value}</div>

      <Minimap />
    </>
  );
}
