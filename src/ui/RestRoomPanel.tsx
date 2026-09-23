import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { isReady } from '../sim/entities/Building';
import { FURNITURE_DESC_TR, FURNITURE_NAMES_TR, FURNITURE_TYPES } from '../sim/interior/Interiors';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

/** Dinlenme odası (0.16.3): içerideki panodan eşya alımı ve moladakiler. */
export function RestRoomPanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.panelBuildingId.value;
  const b = sim && id !== null ? sim.buildingById(id) : undefined;
  if (!sim || !b || b.type !== 'staffRoom') return null;
  const R = BALANCE.staff.rest;
  const ready = isReady(b);
  const resting = sim.staffSystem.restingIn(b);
  const seats = sim.staffSystem.seatsIn(b);
  return (
    <div class="overlay">
      <div class="menu-card panel rest-room">
        <div class="panel-head">
          <h2>{t('Dinlenme odası')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!ready && <p class="muted">{t('Dinlenme odası henüz inşa ediliyor.')}</p>}
        <p class="muted small-text">{t('Personel molada buraya gelir. Eşyalar molayı hızlandırır ve morali artırır.')}</p>
        <p class="small-text">
          {resting.length > 0
            ? t('Molada: {names} · kanepe yeri {seats}', { names: resting.map((s) => s.name).join(', '), seats })
            : t('Şu an molada kimse yok · kanepe yeri {seats}', { seats })}
        </p>
        <div class="furniture-list">
          {FURNITURE_TYPES.map((f) => {
            const F = R.furniture[f];
            const n = b.furniture.filter((x) => x === f).length;
            const full = n >= F.max;
            const buy = (): void => {
              const r = sim.command({ type: 'buyFurniture', buildingId: b.id, item: f });
              if (r.message) showToast(r.message);
              audio.play(r.ok ? 'coin' : 'error');
            };
            return (
              <div key={f} class="furniture-row">
                <div class="furniture-info">
                  <div>
                    <b>{t(FURNITURE_NAMES_TR[f])}</b> <span class="muted small-text">{n}/{F.max}</span>
                  </div>
                  <div class="muted small-text">{t(FURNITURE_DESC_TR[f])}</div>
                </div>
                <button class="btn small" disabled={full || !ready || sim.money < F.cost} onClick={buy}>
                  {full ? t('Tam') : t('Al ({cost})', { cost: formatMoney(F.cost) })}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
