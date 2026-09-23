import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { buildingDef, isReady } from '../sim/entities/Building';
import { FURNITURE_BY_KIND, FURNITURE_DESC_TR, FURNITURE_NAMES_TR, interiorKindFor } from '../sim/interior/Interiors';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

/** İç mekân eşya alımı (0.16.3 dinlenme odası; 0.17.0'dan beri tüm iç mekânlar için ortak). */
export function FurniturePanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.panelBuildingId.value;
  const b = sim && id !== null ? sim.buildingById(id) : undefined;
  const kind = b ? interiorKindFor(b.type) : null;
  if (!sim || !b || !kind) return null;
  const F = BALANCE.interior.furniture;
  const ready = isReady(b);
  const rest = b.type === 'staffRoom';
  const resting = rest ? sim.staffSystem.restingIn(b) : [];
  const seats = rest ? sim.staffSystem.seatsIn(b) : 0;
  return (
    <div class="overlay">
      <div class="menu-card panel furniture">
        <div class="panel-head">
          <h2>{t(buildingDef(b).name)}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!ready && <p class="muted">{t('Henüz inşa ediliyor.')}</p>}
        {rest && <p class="muted small-text">{t('Personel molada buraya gelir. Eşyalar molayı hızlandırır ve morali artırır.')}</p>}
        {rest && (
          <p class="small-text">
            {resting.length > 0
              ? t('Molada: {names} · kanepe yeri {seats}', { names: resting.map((s) => s.name).join(', '), seats })
              : t('Şu an molada kimse yok · kanepe yeri {seats}', { seats })}
          </p>
        )}
        <div class="furniture-list">
          {FURNITURE_BY_KIND[kind].map((f) => {
            const n = b.furniture.filter((x) => x === f).length;
            const full = n >= F[f].max;
            const buy = (): void => {
              const r = sim.command({ type: 'buyFurniture', buildingId: b.id, item: f });
              if (r.message) showToast(r.message);
              audio.play(r.ok ? 'coin' : 'error');
            };
            return (
              <div key={f} class="furniture-row">
                <div class="furniture-info">
                  <div>
                    <b>{t(FURNITURE_NAMES_TR[f])}</b> <span class="muted small-text">{n}/{F[f].max}</span>
                  </div>
                  <div class="muted small-text">{t(FURNITURE_DESC_TR[f])}</div>
                </div>
                <button class="btn small" disabled={full || !ready || sim.money < F[f].cost} onClick={buy}>
                  {full ? t('Tam') : t('Al ({cost})', { cost: formatMoney(F[f].cost) })}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
