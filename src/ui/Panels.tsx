import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { buildingDef, isReady } from '../sim/entities/Building';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

/** Sağ üstteki uyarı listesi; tıklayınca ilgili köpeğe/kareye gider. */
export function AlertsPanel() {
  store.lang.value;
  const alerts = store.alerts.value;
  if (alerts.length === 0) return null;
  const shown = alerts.slice(0, 6);
  return (
    <div class="alerts">
      {shown.map((a) => (
        <button
          key={a.id}
          class={`alert ${a.severity}`}
          onClick={() => {
            if (a.dogId !== undefined) {
              store.selectedDogId.value = a.dogId;
              store.panel.value = 'dog';
            } else if (a.tile) app.focusTile(a.tile.x, a.tile.y);
          }}
        >
          {a.text}
        </button>
      ))}
      {alerts.length > shown.length && <div class="alert info">{t('+{n} daha', { n: alerts.length - shown.length })}</div>}
    </div>
  );
}

export function ShedPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const price = sim.foodBagPrice();
  const portions = BALANCE.economy.foodBagPortions;
  const discount = price < BALANCE.economy.foodBagPrice;
  const order = (bags: number): void => {
    const r = sim.command({ type: 'orderFood', bags });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'coin' : 'error');
  };
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>{t('Kiler')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p>
          <b>{t('Stok: {n} porsiyon', { n: Math.floor(sim.foodStock) })}</b>
        </p>
        <p class="muted">{t('Bir çuval {n} porsiyon, {price}. Kasa: {money}.', { n: portions, price: formatMoney(price), money: formatMoney(sim.money) })}</p>
        {discount && <p class="good">{t('Bugün indirim: çuvallar yarı fiyat!')}</p>}
        <div class="row">
          <button class="btn primary" disabled={sim.money < price} onClick={() => order(1)}>
            {t('1 çuval al ({price})', { price: formatMoney(price) })}
          </button>
          <button class="btn" disabled={sim.money < price * 5} onClick={() => order(5)}>
            {t('5 çuval al ({price})', { price: formatMoney(price * 5) })}
          </button>
        </div>
        <p class="muted small-text">{t("Yem kabını doldurmak için kabın önünde E'ye bas; yem kilerden düşer.")}</p>
      </div>
    </div>
  );
}

export function KennelPanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.panelBuildingId.value;
  const kennel = sim && id !== null ? sim.buildingById(id) : undefined;
  if (!sim || !kennel) return null;
  const def = buildingDef(kennel);
  const occupants = kennel.occupants.map((d) => sim.dogById(d)).filter((d) => !!d);
  const candidates = sim.shelterDogs().filter((d) => d.kennelId !== kennel.id && sim.kennelHasRoom(kennel, d));
  const ready = isReady(kennel);
  // Kulübe konforu (0.22.4): sahip olunan eşyaların simgeleri ve etkileri tek satırda.
  const K = BALANCE.kennelComfort;
  const f = kennel.furniture;
  const pct = (m: number): number => Math.round(Math.abs(1 - m) * 100);
  const owned: Array<[string, string, string]> = [
    ['dogBed', '🛏️', t('uykuda enerji +%{n}', { n: pct(K.bedSleepRegenMul) })],
    ['blanket', '🧺', t('uykuda kirlenme −%{n}, hastalık −%{m}', { n: pct(K.blanketHygieneAsleepMul), m: pct(K.blanketIllnessMul) })],
    ['dogBowl', '💧', t('uykuda susamaz')],
    ['dogToy', '🎾', t('keyif %{n} yavaş düşer', { n: pct(K.toyPlayDecayMul) })],
    ['kennelWindow', '🪟', t('dekor +{n}', { n: K.windowDecor })],
  ];
  const icons = owned.map(([k, icon]) => icon.repeat(f.filter((x) => x === k).length)).join('');
  const effects = owned.filter(([k]) => f.includes(k)).map(([, , text]) => text);
  // Kulübe içi (0.22.3): kapıya yürüyüp girer (dokunmatikte kapı karesi köpeğin yattığı yer olabilir); eşya paneli.
  const enter = (): void => {
    const r = sim.command({ type: 'goInteract', goal: { kind: 'enter', id: kennel.id } });
    if (r.ok) store.panel.value = 'none';
    else if (r.message) showToast(r.message);
  };
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>
            {t(def.name)} #{kennel.id}
          </h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted">{t(def.desc)}</p>
        <div class="row wrap">
          <button class="btn small" disabled={!ready || sim.mode !== 'avatar'} onClick={enter}>
            {t('🚪 İçeri gir')}
          </button>
          <button class="btn small" disabled={!ready} onClick={() => (store.panel.value = 'furniture')}>
            {t('🛋️ Eşyalar ({n})', { n: kennel.furniture.length })}
          </button>
        </div>
        <p class={effects.length > 0 ? 'small-text' : 'muted small-text'}>
          {effects.length > 0 ? `${icons} ${effects.join(' · ')}` : t('Eşya yok: yatak, battaniye, su kabı, oyuncak ve pencere köpeği rahatlatır')}
        </p>
        <p>{t('Doluluk: {n}/{cap}', { n: occupants.length, cap: def.capacity ?? 0 })}</p>
        {occupants.map((d) => (
          <div key={d.id} class="row">
            <span>{d.name}</span>
            <button class="btn small" onClick={() => sim.command({ type: 'assignKennel', dogId: d.id, buildingId: null })}>
              {t('Çıkar')}
            </button>
          </div>
        ))}
        {candidates.length > 0 && occupants.length < (def.capacity ?? 0) && (
          <div class="row">
            <select id="kennel-assign">
              {candidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              class="btn small"
              onClick={() => {
                const sel = document.getElementById('kennel-assign') as HTMLSelectElement | null;
                if (sel) sim.command({ type: 'assignKennel', dogId: Number(sel.value), buildingId: kennel.id });
              }}
            >
              {t('Yerleştir')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
