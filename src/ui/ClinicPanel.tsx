import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { ILLNESS_NAMES_TR } from '../sim/entities/Dog';
import { treatmentCost, vaccinateIssue, vaccineDaysLeft } from '../sim/systems/ClinicSystem';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

/** Veteriner odasındaki muayene masası (0.17.2): köpeklerin sağlığı, hastalığı, aşısı; aşı düğmesi. */
export function ClinicPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const C = BALANCE.clinic;
  const dogs = [...sim.shelterDogs()].sort((a, b) => (a.illness ? 0 : 1) - (b.illness ? 0 : 1) || a.needs.health - b.needs.health);
  const vaccinate = (id: number): void => {
    const r = sim.command({ type: 'vaccinate', dogId: id });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'treat' : 'error');
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide clinic">
        <div class="panel-head">
          <h2>{t('Muayene masası')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">
          {t('Aşı {w} hafta boyunca hastalanma ve bulaşma olasılığını yarıya indirir. Tedavi ({price}) için hasta köpeği binanın önüne getirip E yap.', {
            w: C.vaccineWeeks,
            price: formatMoney(treatmentCost(sim)),
          })}
        </p>
        <div class="clinic-list">
          {dogs.length === 0 && <p class="muted">{t('Barınakta köpek yok.')}</p>}
          {dogs.map((d) => {
            const days = vaccineDaysLeft(sim, d);
            const why = vaccinateIssue(sim, d);
            return (
              <div key={d.id} class="clinic-row">
                <div class="clinic-info">
                  <b>{d.name}</b>{' '}
                  <span class={d.illness ? 'bad small-text' : 'muted small-text'}>{d.illness ? t(ILLNESS_NAMES_TR[d.illness.kind]) : t('sağlıklı')}</span>
                  <div class="bar mini">
                    <div class={'fill' + (d.needs.health < 40 ? ' bad' : '')} style={{ width: `${Math.round(d.needs.health)}%` }} />
                  </div>
                </div>
                {days > 0 ? (
                  <span class="good small-text">{t('💉 aşılı · {n} gün', { n: days })}</span>
                ) : (
                  <button class="btn small" disabled={why !== null} title={why ?? ''} onClick={() => vaccinate(d.id)}>
                    {t('Aşıla ({cost})', { cost: formatMoney(C.vaccineCost) })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
