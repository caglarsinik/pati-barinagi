import { app } from '../app';
import { BALANCE } from '../config/balance';
import { adoptable, hardMismatch, matchScore, requestText } from '../sim/entities/Adopter';
import { STAGE_NAMES_TR } from '../sim/entities/Dog';
import { LEDGER_NAMES_TR, type LedgerCategory, licenseUpgradeCost } from '../sim/systems/EconomySystem';
import { DogPortrait } from './DogPortrait';
import { formatMoney } from './HUD';
import { showToast, store } from './store';
import { useState } from 'preact/hooks';

function run(r: { ok: boolean; message?: string }): void {
  if (r.message) showToast(r.message);
}

/** Ofis: lisans, uyku, kısa özet. */
export function OfficePanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const h = sim.clock.hour;
  const canSleep = h >= BALANCE.time.sleepFromHour || h < BALANCE.time.nightEndHour;
  const cost = licenseUpgradeCost(sim.licenseLevel);
  const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>Ofis</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p>
          Lisans seviyesi <b>{sim.licenseLevel}</b>: en fazla <b>{sim.licenseCap()}</b> köpek için yardım alınır. Şu an {sim.shelterDogs().length} köpek.
        </p>
        {cost !== null ? (
          <button class="btn" disabled={sim.money < cost} onClick={() => run(sim.command({ type: 'upgradeLicense' }))}>
            Lisansı yükselt ({formatMoney(cost)})
          </button>
        ) : (
          <p class="muted">Lisans en üst seviyede.</p>
        )}
        <p class="muted small-text">İtibar {Math.round(sim.reputation)}/100 · toplam {sim.stats.adopted} sahiplendirme</p>
        <div class="row">
          <button class="btn" onClick={() => (store.panel.value = 'adoption')}>
            Sahiplendirme masası {waiting > 0 ? `(${waiting} bekliyor)` : ''}
          </button>
          <button class="btn" onClick={() => (store.panel.value = 'finance')}>
            Finans
          </button>
        </div>
        <button
          class="btn primary"
          disabled={!canSleep}
          title={canSleep ? '' : `${BALANCE.time.sleepFromHour}:00'den sonra uyunabilir`}
          onClick={() => {
            store.panel.value = 'none';
            run(sim.command({ type: 'sleep' }));
          }}
        >
          Sabaha kadar uyu
        </button>
      </div>
    </div>
  );
}

/** Sahiplendirme masası: bekleyenler ve uygun köpekler. */
export function AdoptionDesk() {
  store.tick.value;
  const sim = app.sim;
  const [selectedId, setSelected] = useState<number | null>(null);
  if (!sim) return null;
  const waiting = sim.adopters.filter((a) => a.state === 'waiting');
  const selected = waiting.find((a) => a.id === selectedId) ?? waiting[0] ?? null;
  const dogs = sim.shelterDogs();
  const rows = selected
    ? dogs
        .map((d) => ({ dog: d, score: matchScore(d, selected.request), why: adoptable(d) ?? hardMismatch(d, selected.request) }))
        .sort((a, b) => b.score - a.score)
    : [];
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>Sahiplendirme masası</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {waiting.length === 0 && (
          <p class="muted">
            Şu an bekleyen sahiplenici yok. Sahiplenici {BALANCE.adoption.arriveFromHour}:00-{BALANCE.adoption.arriveToHour}:00 arasında gelir; itibar arttıkça daha sık.
          </p>
        )}
        <div class="adopt-layout">
          <div class="adopter-list">
            {waiting.map((a) => (
              <button key={a.id} class={'adopter-card' + (selected?.id === a.id ? ' active' : '')} onClick={() => setSelected(a.id)}>
                <div class="adopter-name">
                  🧑 {a.name} · <b>{formatMoney(a.fee)}</b>
                </div>
                <div class="small-text">{requestText(a.request)}</div>
                <div class="muted small-text">Sabrı: {Math.max(0, Math.round(a.patienceLeft))} dk</div>
              </button>
            ))}
          </div>
          {selected && (
            <div class="match-list">
              <div class="row">
                <b>{selected.name} için uygun köpekler</b>
                <span class="spacer" />
                <button class="btn small" onClick={() => run({ ok: sim.command({ type: 'declineAdopter', adopterId: selected.id }).ok, message: `${selected.name} uğurlandı` })}>
                  Reddet
                </button>
              </div>
              {rows.length === 0 && <p class="muted small-text">Barınakta köpek yok.</p>}
              {rows.map(({ dog, score, why }) => (
                <div key={dog.id} class={'match-row' + (why || score === 0 ? ' disabled' : '')}>
                  <DogPortrait genome={dog.genome} stage={dog.stage} scale={1.5} />
                  <div class="match-info">
                    <b>{dog.name}</b> <span class="muted small-text">{STAGE_NAMES_TR[dog.stage]} · eğitim {dog.trainingLevel()}/6</span>
                    <div class="small-text">{why ? <span class="bad">{why}</span> : score >= 70 ? 'Harika eşleşme' : score >= 50 ? 'İdare eder' : 'Zayıf eşleşme (geri gelebilir)'}</div>
                  </div>
                  <div class={'score' + (score >= 70 ? ' good' : score >= 50 ? ' mid' : ' low')}>{score}</div>
                  <button class="btn small primary" disabled={!!why || score === 0} onClick={() => run(sim.command({ type: 'adopt', adopterId: selected.id, dogId: dog.id }))}>
                    Sahiplendir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {sim.adoptions.length > 0 && (
          <p class="muted small-text">
            Son sahiplendirme: {sim.adoptions[sim.adoptions.length - 1].dogName} → {sim.adoptions[sim.adoptions.length - 1].adopterName} (puan {sim.adoptions[sim.adoptions.length - 1].score})
          </p>
        )}
      </div>
    </div>
  );
}

/** Finans: bu hafta, geçmiş haftalar, son denetim. */
export function FinancePanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const t = sim.weekTotals();
  const weeks = [...sim.weeks].reverse();
  const insp = sim.lastInspection;
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>Finans</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="fin-summary">
          <div>
            Kasa <b>{formatMoney(sim.money)}</b>
          </div>
          <div>
            Bu hafta gelir <b class="good">+{formatMoney(t.income)}</b> · gider <b class="bad">-{formatMoney(t.expense)}</b>
          </div>
          <div class="muted small-text">
            Haftalık yardım: köpek başına {formatMoney(BALANCE.economy.aidPerDogPerWeek)} × denetim çarpanı ({insp ? insp.multiplier : 'henüz yok'}) · lisans sınırı {sim.licenseCap()} köpek
          </div>
        </div>
        <h4>Bu haftanın hareketleri</h4>
        <div class="ledger">
          {sim.ledger
            .filter((e) => e.week === sim.clock.week)
            .slice(-12)
            .reverse()
            .map((e, i) => (
              <div key={i} class="ledger-row">
                <span class="muted small-text">{e.day}. gün</span>
                <span>{LEDGER_NAMES_TR[e.category as LedgerCategory]}</span>
                <span class="muted small-text">{e.note}</span>
                <span class={e.amount >= 0 ? 'good' : 'bad'}>{e.amount >= 0 ? '+' : ''}{formatMoney(e.amount)}</span>
              </div>
            ))}
          {sim.ledger.filter((e) => e.week === sim.clock.week).length === 0 && <p class="muted small-text">Henüz hareket yok.</p>}
        </div>
        {weeks.length > 0 && (
          <>
            <h4>Geçmiş haftalar</h4>
            <table class="dog-table">
              <thead>
                <tr>
                  <th>Hafta</th>
                  <th>Yardım</th>
                  <th>Sahiplendirme</th>
                  <th>Gider</th>
                  <th>Net</th>
                  <th>Çarpan</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week}>
                    <td>{w.week}</td>
                    <td>{formatMoney(w.income.aid ?? 0)}</td>
                    <td>{formatMoney(w.income.adoption ?? 0)}</td>
                    <td>{formatMoney(Object.values(w.expense).reduce((s, v) => s + (v ?? 0), 0))}</td>
                    <td class={w.net >= 0 ? 'good' : 'bad'}>{formatMoney(w.net)}</td>
                    <td>{w.inspection?.multiplier ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

/** Hafta sonu raporu: denetim kalemleri ve para özeti. */
export function WeeklyReport() {
  const w = store.report.value;
  const sim = app.sim;
  if (!w || !sim) return null;
  const insp = w.inspection;
  const expense = Object.values(w.expense).reduce((s, v) => s + (v ?? 0), 0);
  const close = (): void => {
    store.report.value = null;
    if (sim.paused) sim.togglePause();
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <h2>{w.week}. hafta raporu</h2>
        {insp && (
          <>
            <h4>Denetim · çarpan {insp.multiplier}</h4>
            <div class="insp-list">
              {insp.items.map((it) => (
                <div key={it.name} class="insp-row">
                  <span>{it.name}</span>
                  <span class="muted">{it.value}</span>
                  <span class={it.effect > 0.1 ? 'good' : it.effect < -0.1 ? 'bad' : 'muted'}>{it.effect > 0.1 ? '▲' : it.effect < -0.1 ? '▼' : '•'}</span>
                </div>
              ))}
            </div>
            <p>
              Devlet yardımı: {insp.dogsCounted} köpek × {formatMoney(BALANCE.economy.aidPerDogPerWeek)} × {insp.multiplier} = <b>{formatMoney(insp.aid)}</b>
              {insp.dogsOverCap > 0 ? ` (${insp.dogsOverCap} köpek lisans dışı, yardım almadı)` : ''}
            </p>
          </>
        )}
        <p>
          Gelir <b class="good">+{formatMoney(Object.values(w.income).reduce((s, v) => s + (v ?? 0), 0))}</b> · Gider <b class="bad">-{formatMoney(expense)}</b> · Net{' '}
          <b class={w.net >= 0 ? 'good' : 'bad'}>{formatMoney(w.net)}</b> · Kasa <b>{formatMoney(w.endMoney)}</b>
        </p>
        <button class="btn primary" onClick={close}>
          Devam et
        </button>
      </div>
    </div>
  );
}
