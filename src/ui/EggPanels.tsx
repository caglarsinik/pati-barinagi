import { app } from '../app';
import { BALANCE } from '../config/balance';
import { buildingDef, isReady } from '../sim/entities/Building';
import { type Egg, eggLook } from '../sim/entities/Egg';
import { EggIcon } from './EggIcon';
import { showToast, store } from './store';

function EggDetails({ egg }: { egg: Egg }) {
  const l = eggLook(egg);
  return (
    <div class="egg-details">
      <div class="egg-head">
        <EggIcon genome={egg.genome} scale={4} />
        <div>
          <div class="traits">
            <span>{l.sizeName}</span>
            <span>{l.shapeName}</span>
            <span>{l.colorName}</span>
            <span>{l.patternName}</span>
            <span class={`rarity-${l.rarity}`}>{l.rarityName}</span>
          </div>
          <div class="muted small-text">{egg.foundDay}. günde bulundu</div>
        </div>
      </div>
      <ul class="hints">
        {l.hints.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

/** Sol üstteki çanta: yumurtalar ve ödül maması. */
export function Backpack() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const slots = sim.backpackSlots();
  return (
    <div class="hud backpack panel" title="Çanta">
      <div class="backpack-row">
        {Array.from({ length: slots }, (_, i) => {
          const egg = sim.backpack[i];
          return (
            <button
              key={i}
              class={'egg-slot' + (egg ? ' full' : '')}
              disabled={!egg}
              title={egg ? 'Yumurtayı incele' : 'Boş yuva'}
              onClick={() => {
                if (!egg) return;
                store.panelEggId.value = egg.id;
                store.panel.value = 'egg';
              }}
            >
              {egg ? <EggIcon genome={egg.genome} scale={2} /> : <span class="muted">·</span>}
            </button>
          );
        })}
        <div class="treats" title="Ödül maması: sokak köpeklerini evcilleştirmek için">
          🦴 {store.treats.value}
        </div>
      </div>
    </div>
  );
}

export function EggPanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.panelEggId.value;
  const egg = sim?.backpack.find((e) => e.id === id) ?? sim?.buildings.flatMap((b) => b.eggs).find((e) => e.id === id);
  if (!sim || !egg) return null;
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>Yumurta</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <EggDetails egg={egg} />
        <p class="muted small-text">
          Boy köpeğin boyutunu, şekil gövde tipini, renk ve desen tüyünü belirler. Huyu ancak yumurta çatlayınca kesinleşir.
        </p>
      </div>
    </div>
  );
}

export function IncubatorPanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.panelBuildingId.value;
  const b = sim && id !== null ? sim.buildingById(id) : undefined;
  if (!sim || !b || b.type !== 'incubator') return null;
  const def = buildingDef(b);
  const slots = def.eggSlots ?? 0;
  const ready = isReady(b);
  const dayMin = 24 * 60;
  const run = (r: { ok: boolean; message?: string }): void => {
    if (r.message) showToast(r.message);
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>Kuluçka</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!ready && <p class="muted">Kuluçka henüz inşa ediliyor.</p>}
        <p class="muted small-text">
          Yumurtalar {BALANCE.eggs.hatchDays} günde çatlar. Çıkan yavru kuluçkanın kapısında bekler; kulübe varsa otomatik atanır.
        </p>
        <div class="incubator-slots">
          {Array.from({ length: slots }, (_, i) => {
            const egg = b.eggs[i];
            if (!egg) {
              return (
                <div key={i} class="inc-slot empty">
                  <span class="muted">Boş yuva</span>
                </div>
              );
            }
            const daysLeft = egg.hatchLeft / dayMin;
            return (
              <div key={egg.id} class="inc-slot">
                <EggIcon genome={egg.genome} scale={3} />
                <div class="inc-info">
                  <div>{eggLook(egg).colorName} yumurta</div>
                  <div class="muted small-text">{daysLeft < 0.05 ? 'Çatlamak üzere' : `${daysLeft.toFixed(1)} gün kaldı`}</div>
                  <div class="bar mini">
                    <div class="fill" style={{ width: `${100 * (1 - egg.hatchLeft / (BALANCE.eggs.hatchDays * dayMin))}%` }} />
                  </div>
                </div>
                <div class="row">
                  <button
                    class="btn small"
                    onClick={() => {
                      store.panelEggId.value = egg.id;
                      store.panel.value = 'egg';
                    }}
                  >
                    İncele
                  </button>
                  <button class="btn small" onClick={() => run(sim.command({ type: 'takeEgg', buildingId: b.id, eggId: egg.id }))}>
                    Al
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <h4>Çantadaki yumurtalar</h4>
        {sim.backpack.length === 0 && <p class="muted small-text">Çanta boş. Dünyadaki yuvalardan yumurta topla.</p>}
        <div class="backpack-list">
          {sim.backpack.map((egg) => (
            <div key={egg.id} class="row">
              <EggIcon genome={egg.genome} scale={2} />
              <span>{eggLook(egg).colorName} · {eggLook(egg).rarityName}</span>
              <button
                class="btn small primary"
                disabled={!ready || b.eggs.length >= slots}
                onClick={() => run(sim.command({ type: 'placeEgg', buildingId: b.id, eggId: egg.id }))}
              >
                Kuluçkaya koy
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
