import { app } from '../app';
import { t } from '../i18n';
import { buildingDef, isReady } from '../sim/entities/Building';
import { type Egg, eggLook } from '../sim/entities/Egg';
import { EggIcon } from './EggIcon';
import { formatMoney } from './format';
import { incubatorHatchDays, incubatorSlots, incubatorTimeMul } from '../sim/systems/IncubatorSystem';
import { showToast, store } from './store';

function EggDetails({ egg }: { egg: Egg }) {
  const l = eggLook(egg);
  return (
    <div class="egg-details">
      <div class="egg-head">
        <EggIcon genome={egg.genome} scale={4} />
        <div>
          <div class="traits">
            <span>{t('{size} boy', { size: t(l.sizeName) })}</span>
            <span>{t(l.shapeName)}</span>
            <span>{t(l.colorName)}</span>
            <span>{t(l.patternName)}</span>
            <span class={`rarity-${l.rarity}`}>{t(l.rarityName)}</span>
          </div>
          <div class="muted small-text">{t('{day}. günde bulundu', { day: egg.foundDay })}</div>
        </div>
      </div>
      <ul class="hints">
        {l.hints.map((h) => (
          <li key={h}>{t(h)}</li>
        ))}
      </ul>
    </div>
  );
}

/** Sol üstteki çanta: yumurtalar ve ödül maması. */
export function Backpack({ inSheet = false }: { inSheet?: boolean } = {}) {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const slots = sim.backpackSlots();
  return (
    <div class={inSheet ? 'backpack in-sheet' : 'backpack panel'} title={t('Çanta')}>
      <div class="backpack-row">
        {Array.from({ length: slots }, (_, i) => {
          const egg = sim.backpack[i];
          return (
            <button
              key={i}
              class={'egg-slot' + (egg ? ' full' : '')}
              disabled={!egg}
              title={egg ? t('Yumurtayı incele') : t('Boş yuva')}
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
        <div class="treats" title={t('Ödül maması: sokak köpeklerini evcilleştirmek için')}>
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
          <h2>{t('Yumurta')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <EggDetails egg={egg} />
        <p class="muted small-text">{t('Boy köpeğin boyutunu, şekil gövde tipini, renk ve desen tüyünü belirler. Huyu ancak yumurta çatlayınca kesinleşir.')}</p>
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
  const slots = incubatorSlots(b);
  const ready = isReady(b);
  const dayMin = 24 * 60;
  const days = incubatorHatchDays(b);
  const up = def.upgrade;
  const run = (r: { ok: boolean; message?: string }): void => {
    if (r.message) showToast(r.message);
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>
            {t('Kuluçka')}
            {b.level >= 2 ? ` · ${t('Sv{n}', { n: b.level })}` : ''}
          </h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!ready && <p class="muted">{t('Kuluçka henüz inşa ediliyor.')}</p>}
        <p class="muted small-text">{t('Yumurtalar {days} günde çatlar. Çıkan yavru kuluçkanın kapısında bekler; kulübe varsa otomatik atanır.', { days })}</p>
        {up && b.level < 2 && (
          <div class="row">
            <button class="btn" disabled={!ready || sim.money < up.cost} onClick={() => run(sim.command({ type: 'upgradeBuilding', buildingId: b.id }))}>
              {t('Yükselt: {slots} yuva, {days} günde çatlar ({cost})', { slots: up.eggSlots ?? slots, days: up.hatchDays ?? days, cost: formatMoney(up.cost) })}
            </button>
          </div>
        )}
        <div class="incubator-slots">
          {Array.from({ length: slots }, (_, i) => {
            const egg = b.eggs[i];
            if (!egg) {
              return (
                <div key={i} class="inc-slot empty">
                  <span class="muted">{t('Boş yuva')}</span>
                </div>
              );
            }
            const daysLeft = (egg.hatchLeft * incubatorTimeMul(b)) / dayMin;
            return (
              <div key={egg.id} class="inc-slot">
                <EggIcon genome={egg.genome} scale={3} />
                <div class="inc-info">
                  <div>{t('{color} yumurta', { color: t(eggLook(egg).colorName) })}</div>
                  <div class="muted small-text">{daysLeft < 0.05 ? t('Çatlamak üzere') : t('{days} gün kaldı', { days: daysLeft.toFixed(1) })}</div>
                  <div class="bar mini">
                    <div class="fill" style={{ width: `${Math.max(0, Math.min(100, 100 * (1 - egg.hatchLeft / (days * dayMin))))}%` }} />
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
                    {t('İncele')}
                  </button>
                  <button class="btn small" onClick={() => run(sim.command({ type: 'takeEgg', buildingId: b.id, eggId: egg.id }))}>
                    {t('Al')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <h4>{t('Çantadaki yumurtalar')}</h4>
        {sim.backpack.length === 0 && <p class="muted small-text">{t('Çanta boş. Dünyadaki yuvalardan yumurta topla.')}</p>}
        <div class="backpack-list">
          {sim.backpack.map((egg) => (
            <div key={egg.id} class="row">
              <EggIcon genome={egg.genome} scale={2} />
              <span>
                {t(eggLook(egg).colorName)} · {t(eggLook(egg).rarityName)}
                {egg.hatchLeft >= 0 && <span class="muted small-text"> · {t('{days} gün kaldı', { days: (egg.hatchLeft / dayMin).toFixed(1) })}</span>}
              </span>
              <button class="btn small primary" disabled={!ready || b.eggs.length >= slots} onClick={() => run(sim.command({ type: 'placeEgg', buildingId: b.id, eggId: egg.id }))}>
                {t('Kuluçkaya koy')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
