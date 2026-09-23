import { app } from '../app';
import { t } from '../i18n';
import { Backpack } from './EggPanels';
import { MARKER_COLORS, Minimap } from './Minimap';
import { showToast, store } from './store';
import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import { audio } from '../audio/audio';

/** Telefonda uyarılar sütun yerine üst şeritteki 🔔 rozetinden açılan sayfada listelenir. */
export function AlertsSheet() {
  store.tick.value;
  store.lang.value;
  const alerts = store.alerts.value;
  const close = (): void => {
    store.panel.value = 'none';
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Uyarılar')}</h2>
          <button class="btn small close" onClick={close}>
            ✕
          </button>
        </div>
        {alerts.length === 0 && <p class="muted">{t('Uyarı yok.')}</p>}
        <div class="alerts-sheet">
          {alerts.map((a) => (
            <button
              key={a.id}
              class={`alert ${a.severity}`}
              onClick={() => {
                close();
                if (a.dogId !== undefined) {
                  store.selectedDogId.value = a.dogId;
                  store.panel.value = 'dog';
                } else if (a.tile) app.focusTile(a.tile.x, a.tile.y);
              }}
            >
              {a.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Telefonda çanta üst şeritteki çipten açılır. */
export function BackpackSheet() {
  store.lang.value;
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>{t('Çanta')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <Backpack inSheet />
        <p class="muted small-text">{t('Yumurtaya dokununca incelenir. Ödül maması sokak köpeklerini evcilleştirir.')}</p>
      </div>
    </div>
  );
}

/** Tam ekran harita (0.18.1): haritaya dokun → işaret koy; işaret listesinden "Git" ya da sil. M tuşu, 🗺️ çipi, mini harita. */
export function MapSheet() {
  store.lang.value;
  store.tick.value;
  const sim = app.sim;
  const [selected, setSelected] = useState<number | null>(null);
  if (!sim) return null;
  const max = BALANCE.map.maxMarkers;
  const po = sim.playerOutside;
  const pick = (x: number, y: number): void => {
    const near = sim.markers.find((m) => Math.hypot(m.x - x, m.y - y) <= 3);
    if (near) {
      setSelected(near.id);
      return;
    }
    const r = sim.command({ type: 'addMarker', x, y });
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'click' : 'error');
    if (r.ok) setSelected(sim.markers[sim.markers.length - 1]?.id ?? null);
  };
  const go = (id: number): void => {
    const r = sim.command({ type: 'goToMarker', id });
    if (r.message) showToast(r.message);
    if (r.ok) store.panel.value = 'none';
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide map-sheet">
        <div class="panel-head">
          <h2>{t('Harita')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="map-body">
          <Minimap inSheet onPick={pick} selected={selected} />
          <div class="map-side">
            <p class="muted small-text">{t('Haritaya dokun: işaret koy (en çok {n}). İşarete dokun: seç.', { n: max })}</p>
            {sim.markers.length === 0 && <p class="muted small-text">{t('Henüz işaret yok.')}</p>}
            {sim.markers.map((m) => (
              <div key={m.id} class={'marker-row' + (selected === m.id ? ' sel' : '')} onClick={() => setSelected(m.id)}>
                <span class="marker-dot" style={{ background: MARKER_COLORS[m.color] ?? MARKER_COLORS[0] }} />
                <span class="small-text marker-dist">{t('{d} kare uzakta', { d: Math.round(Math.hypot(m.x - po.tileX, m.y - po.tileY)) })}</span>
                <button class="btn small" onClick={() => go(m.id)}>
                  {t('Git')}
                </button>
                <button class="btn small" title={t('Sil')} onClick={() => sim.command({ type: 'removeMarker', id: m.id })}>
                  ✕
                </button>
              </div>
            ))}
            <p class="muted small-text">{t('Sarı nokta dolu yuva, turuncu nokta sokak köpeği ini, beyaz nokta sensin.')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
