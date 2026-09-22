import { app } from '../app';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { isReady } from '../sim/entities/Building';
import { breedMinutes, breedingIssues, mutualAffinity } from '../sim/systems/BreedingSystem';
import { EggIcon } from './EggIcon';
import { showToast, store } from './store';

/** Yuva evi: çift seçimi, koşullar, ilerleme ve hazır yumurta. */
export function NurseryPanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.panelBuildingId.value;
  const b = sim && id !== null ? sim.buildingById(id) : undefined;
  if (!sim || !b || b.type !== 'nursery') return null;
  const B = BALANCE.breeding;
  const ready = isReady(b);
  const adults = sim.shelterDogs().filter((d) => d.stage === 'adult');
  const [aId, cId] = [b.pair[0] ?? null, b.pair[1] ?? null];
  const a = aId !== null ? sim.dogById(aId) : undefined;
  const c = cId !== null ? sim.dogById(cId) : undefined;
  const issues = a && c ? breedingIssues(sim, a, c, b) : [];
  const egg = b.eggs[0];
  const run = (r: { ok: boolean; message?: string }): void => {
    if (r.message) showToast(r.message);
  };
  const choose = (slot: 0 | 1, value: string): void => {
    const ids: Array<number | null> = [aId, cId];
    ids[slot] = value === '' ? null : Number(value);
    run(sim.command({ type: 'setNurseryPair', buildingId: b.id, dogIds: ids.filter((x): x is number => x !== null) }));
  };
  const picker = (slot: 0 | 1, current: number | null, other: number | null) => (
    <select value={current ?? ''} onChange={(e) => choose(slot, (e.target as HTMLSelectElement).value)}>
      <option value="">{t('— köpek seç —')}</option>
      {adults
        .filter((d) => d.id !== other)
        .map((d) => {
          const o = other !== null ? sim.dogById(other) : undefined;
          return (
            <option key={d.id} value={d.id}>
              {o ? t('{name} (dostluk {n})', { name: d.name, n: Math.floor(mutualAffinity(d, o)) }) : d.name}
            </option>
          );
        })}
    </select>
  );
  const total = breedMinutes();
  return (
    <div class="overlay">
      <div class="menu-card panel wide nursery">
        <div class="panel-head">
          <h2>{t('Yuva evi')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!ready && <p class="muted">{t('Yuva evi henüz inşa ediliyor.')}</p>}
        <p class="muted small-text">
          {t('İki yetişkin köpek {days} günde bir yumurta verir. Sağlıkları en az {h}, birbirlerine dostlukları en az {f} olmalı; sonra {w} hafta dinlenirler. Yavru özelliklerini ikisinden alır.', {
            days: B.days,
            h: B.minHealth,
            f: B.minAffinity,
            w: B.cooldownWeeks,
          })}
        </p>
        <div class="nursery-pair">
          <label class="field">
            <span>{t('1. köpek')}</span>
            {picker(0, aId, cId)}
          </label>
          <span class="nursery-heart">❤</span>
          <label class="field">
            <span>{t('2. köpek')}</span>
            {picker(1, cId, aId)}
          </label>
        </div>
        {adults.length < 2 && <p class="muted small-text">{t('Barınakta en az iki yetişkin köpek olmalı.')}</p>}
        {a && c && !egg && (
          <div class="nursery-status">
            {issues.length === 0 ? (
              <>
                <div class="good small-text">{t('✓ Koşullar tamam: yumurta yolda')}</div>
                <div class="bar mini">
                  <div class="fill" style={{ width: `${Math.max(0, Math.min(100, 100 * (1 - b.breedLeft / total)))}%` }} />
                </div>
                <div class="muted small-text">{t('{days} gün kaldı', { days: (b.breedLeft / (24 * 60)).toFixed(1) })}</div>
              </>
            ) : (
              <>
                <div class="bad small-text">{t('Sayaç duruyor:')}</div>
                {issues.map((x) => (
                  <div key={x} class="small-text">
                    ✗ {x}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {egg && (
          <div class="row nursery-egg">
            <EggIcon genome={egg.genome} scale={3} />
            <span>{t('Yumurta hazır!')}</span>
            <span class="spacer" />
            <button class="btn primary" disabled={sim.backpack.length >= sim.backpackSlots()} onClick={() => run(sim.command({ type: 'takeNurseryEgg', buildingId: b.id }))}>
              {t('Yumurtayı al')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
