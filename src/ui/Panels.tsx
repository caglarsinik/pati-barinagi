import { app } from '../app';
import { BALANCE } from '../config/balance';
import { buildingDef } from '../sim/entities/Building';
import { formatMoney } from './HUD';
import { store } from './store';
import { audio } from '../audio/audio';

/** Sağ üstteki uyarı listesi; tıklayınca ilgili köpeğe/kareye gider. */
export function AlertsPanel() {
  const alerts = store.alerts.value;
  if (alerts.length === 0) return null;
  const shown = alerts.slice(0, 6);
  return (
    <div class="hud alerts">
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
      {alerts.length > shown.length && <div class="alert info">+{alerts.length - shown.length} daha</div>}
    </div>
  );
}

export function ShedPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const price = BALANCE.economy.foodBagPrice;
  const portions = BALANCE.economy.foodBagPortions;
  const order = (bags: number): void => {
    const r = sim.command({ type: 'orderFood', bags });
    if (r.message) store.toast.value = r.message;
    audio.play(r.ok ? 'coin' : 'error');
  };
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>Kiler</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p>
          Stok: <b>{Math.floor(sim.foodStock)} porsiyon</b>
        </p>
        <p class="muted">
          Bir çuval {portions} porsiyon, {formatMoney(price)}. Kasa: {formatMoney(sim.money)}.
        </p>
        <div class="row">
          <button class="btn primary" disabled={sim.money < price} onClick={() => order(1)}>
            1 çuval al ({formatMoney(price)})
          </button>
          <button class="btn" disabled={sim.money < price * 5} onClick={() => order(5)}>
            5 çuval al ({formatMoney(price * 5)})
          </button>
        </div>
        <p class="muted small-text">Yem kabını doldurmak için kabın önünde E'ye bas; yem kilerden düşer.</p>
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
  const candidates = sim.dogs.filter((d) => d.kennelId !== kennel.id && sim.kennelHasRoom(kennel, d));
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>
            {def.name} #{kennel.id}
          </h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted">{def.desc}</p>
        <p>
          Doluluk: {occupants.length}/{def.capacity}
        </p>
        {occupants.map((d) => (
          <div key={d.id} class="row">
            <span>{d.name}</span>
            <button class="btn small" onClick={() => sim.command({ type: 'assignKennel', dogId: d.id, buildingId: null })}>
              Çıkar
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
              Yerleştir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
