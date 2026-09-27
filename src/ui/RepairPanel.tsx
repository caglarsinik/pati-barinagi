import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { formatMoney } from './format';
import { showToast, store } from './store';

/** Nuri Usta'nın evini onar (0.23.3): gerekenler ve sende olanlar; malzeme şart (parayla yerine konmaz). */
export function RepairPanel() {
  store.tick.value;
  store.lang.value;
  const sim = app.sim;
  if (!sim) return null;
  const C = BALANCE.ruin.repair;
  const rows = [
    { key: 'wood', label: t('🪵 Odun'), have: sim.materials.wood, need: C.wood, text: `${sim.materials.wood}/${C.wood}` },
    { key: 'stone', label: t('🪨 Taş'), have: sim.materials.stone, need: C.stone, text: `${sim.materials.stone}/${C.stone}` },
    { key: 'money', label: t('💰 Para'), have: sim.money, need: C.money, text: `${formatMoney(sim.money)} / ${formatMoney(C.money)}` },
  ];
  const ready = !sim.ruin.repaired && rows.every((r) => r.have >= r.need);
  const repair = (): void => {
    const r = sim.command({ type: 'repairRuin' });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'build' : 'error');
    if (r.ok) store.panel.value = 'none';
  };
  return (
    <div class="overlay">
      <div class="menu-card panel repair-panel">
        <div class="panel-head">
          <h2>{t("🔨 Nuri Usta'nın evi")}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">
          {t('Onarınca orman evi olur: yatakta sabaha kadar uyunur, ocakta günde bir ısınırsın (dayanıklılık dolar), kapının yanındaki tabeladan hızlı seyahat edilir; gece dışarıda bayılırsan yakınsa burada uyanırsın.')}
        </p>
        {rows.map((r) => (
          <div key={r.key} class="repair-row">
            <span>{r.label}</span>
            <b class={r.have >= r.need ? '' : 'short'}>{r.text}</b>
          </div>
        ))}
        <div class="row">
          <button class="btn" disabled={!ready} onClick={repair}>
            {t('🔨 Onar')}
          </button>
        </div>
        {!ready && !sim.ruin.repaired && <p class="muted small-text">{t('Odun ve taş ormandan toplanır: malzeme olmadan ev onarılmaz.')}</p>}
      </div>
    </div>
  );
}
