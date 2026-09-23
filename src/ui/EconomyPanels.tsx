import { useState } from 'preact/hooks';
import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { adoptable, hardMismatch, likeHits, matchScore, requestText } from '../sim/entities/Adopter';
import { ADOPTER_TYPES } from '../sim/entities/AdopterType';
import { STAGE_NAMES_TR } from '../sim/entities/Dog';
import { DIFFICULTY_NAMES_TR } from '../sim/Sim';
import { LEDGER_NAMES_TR, type LedgerCategory, licenseUpgradeCost, projectCash } from '../sim/systems/EconomySystem';
import { FinanceChart } from './FinanceChart';
import { DogPortrait } from './DogPortrait';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

function run(r: { ok: boolean; message?: string }): void {
  if (r.message) showToast(r.message);
  if (!r.ok && r.message) audio.play('error');
}

/** Ofis: lisans, uyku, olaylar, kısayollar. */
/** Ofiste zafer hedefi: iki çubuk ya da kazanıldı satırı. */
function GoalProgress() {
  const sim = app.sim;
  if (!sim) return null;
  const V = BALANCE.victory;
  const adopted = Math.min(sim.stats.adopted, V.adoptions);
  const rep = Math.min(Math.round(sim.reputation), V.reputation);
  return (
    <div class="goal">
      <h4>{t('Hedef: Yılın Barınağı')}</h4>
      {sim.victory && <p class="good">{t('🏆 Kazanıldı ({day}. gün)', { day: sim.victory.day })}</p>}
      <div class="goal-row">
        <span>{t('Sahiplendirme {n}/{max}', { n: adopted, max: V.adoptions })}</span>
        <div class="bar mini">
          <div class="fill" style={{ width: `${(100 * adopted) / V.adoptions}%` }} />
        </div>
      </div>
      <div class="goal-row">
        <span>{t('İtibar {n}/{max}', { n: rep, max: V.reputation })}</span>
        <div class="bar mini">
          <div class="fill" style={{ width: `${(100 * rep) / V.reputation}%` }} />
        </div>
      </div>
    </div>
  );
}

export function OfficePanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const cost = licenseUpgradeCost(sim.licenseLevel);
  const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <div class="panel-head">
          <h2>{t('Ofis')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p>{t('Lisans seviyesi {lvl}: en fazla {cap} köpek için yardım alınır. Şu an {n} köpek.', { lvl: sim.licenseLevel, cap: sim.licenseCap(), n: sim.shelterDogs().length })}</p>
        <p class="muted small-text">{t('Ofis lisansla büyür (şu an Sv{lvl}); Sv3 ofiste en fazla {n} personel çalışır.', { lvl: sim.licenseLevel, n: BALANCE.staff.maxStaffTop })}</p>
        {cost !== null ? (
          <button
            class="btn"
            disabled={sim.money < cost}
            onClick={() => {
              const r = sim.command({ type: 'upgradeLicense' });
              run(r);
              if (r.ok) audio.play('coin');
            }}
          >
            {t('Lisansı yükselt ({cost})', { cost: formatMoney(cost) })}
          </button>
        ) : (
          <p class="muted">{t('Lisans en üst seviyede.')}</p>
        )}
        {sim.backpackLevel < 2 ? (
          <button
            class="btn"
            disabled={sim.money < BALANCE.upgrades.backpack.cost}
            onClick={() => {
              const r = sim.command({ type: 'buyBackpack' });
              run(r);
              if (r.ok) audio.play('coin');
            }}
          >
            {t('Büyük çanta: {n} yumurta ({cost})', { n: BALANCE.upgrades.backpack.slots, cost: formatMoney(BALANCE.upgrades.backpack.cost) })}
          </button>
        ) : (
          <p class="muted small-text">{t('Büyük çanta alındı ({n} yumurta).', { n: sim.backpackSlots() })}</p>
        )}
        <p class="muted small-text">{t('İtibar {rep}/100 · toplam {n} sahiplendirme', { rep: Math.round(sim.reputation), n: sim.stats.adopted })}</p>
        <GoalProgress />
        <div class="row">
          {sim.loan > 0 ? (
            <button
              class="btn"
              disabled={sim.money <= 0}
              onClick={() => {
                const r = sim.command({ type: 'repayLoan' });
                run(r);
                if (r.ok) audio.play('coin');
              }}
            >
              {t('Krediyi öde ({n})', { n: formatMoney(Math.min(sim.loan, Math.max(0, Math.floor(sim.money)))) })}
            </button>
          ) : (
            <button
              class="btn"
              onClick={() => {
                const r = sim.command({ type: 'takeLoan' });
                run(r);
                if (r.ok) audio.play('coin');
              }}
            >
              {t('Kredi al ({n}, haftalık %{p} faiz)', { n: formatMoney(BALANCE.economy.loan.amount), p: Math.round(BALANCE.economy.loan.weeklyInterest * 100) })}
            </button>
          )}
          {sim.loan > 0 && <span class="muted small-text">{t('Kalan borç {n}', { n: formatMoney(sim.loan) })}</span>}
        </div>
        <label class="policy">
          <input
            type="checkbox"
            checked={sim.policies.adoptionsOpen}
            onChange={(e) => sim.command({ type: 'setPolicy', policy: { adoptionsOpen: (e.target as HTMLInputElement).checked } })}
          />
          <span>{t('Sahiplendirmeye açık')}</span>
          <span class="muted small-text">{t('Kapalıyken sahiplenici gelmez; bekleyenler itibar kaybı olmadan uğurlanır.')}</span>
        </label>
        <div class="row">
          <button class="btn" onClick={() => (store.panel.value = 'adoption')}>
            {!sim.policies.adoptionsOpen ? t('Sahiplendirme masası (kapalı)') : waiting > 0 ? t('Sahiplendirme masası ({n} bekliyor)', { n: waiting }) : t('Sahiplendirme masası')}
          </button>
          <button class="btn" onClick={() => (store.panel.value = 'finance')}>
            {t('Finans')}
          </button>
          <button class="btn" onClick={() => (store.panel.value = 'staff')}>
            {sim.candidates.length > 0 ? t('Personel ({n} aday)', { n: sim.candidates.length }) : t('Personel')}
          </button>
          <button class="btn" onClick={() => (store.panel.value = 'achievements')}>
            {t('Başarımlar')}
          </button>
        </div>
        {sim.eventSys.log.length > 0 && (
          <div class="event-log">
            <h4>{t('Son olaylar')}</h4>
            {sim.eventSys.log
              .slice(-5)
              .reverse()
              .map((e, i) => (
                <div key={i} class="small-text">
                  <span class="muted">{t('{day}. gün', { day: e.day })}</span> {e.text}
                </div>
              ))}
          </div>
        )}
        <p class="muted small-text">{t('Uyku: ofisteki yatakta, {h}:00 ile 06:00 arası.', { h: BALANCE.time.sleepFromHour })}</p>
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
  const open = sim.policies.adoptionsOpen;
  const all = sim.shelterDogs();
  const dogs = all.filter((d) => !d.keep);
  const kept = all.length - dogs.length;
  const rows = selected
    ? dogs
        .map((d) => ({ dog: d, score: matchScore(d, selected.request), why: adoptable(d) ?? hardMismatch(d, selected.request) }))
        .sort((a, b) => b.score - a.score)
    : [];
  const last = sim.adoptions[sim.adoptions.length - 1];
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Sahiplendirme masası')}</h2>
          <button class={'btn small' + (open ? '' : ' danger active')} onClick={() => sim.command({ type: 'setPolicy', policy: { adoptionsOpen: !open } })}>
            {open ? t('Sahiplendirmeyi kapat') : t('Sahiplendirmeyi aç')}
          </button>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!open && <p class="muted">{t('Sahiplendirme kapalı. Sahiplenici gelmesi için aç.')}</p>}
        {open && waiting.length === 0 && (
          <p class="muted">
            {t('Şu an bekleyen sahiplenici yok. Sahiplenici {from}:00-{to}:00 arasında gelir; itibar arttıkça daha sık.', {
              from: BALANCE.adoption.arriveFromHour,
              to: BALANCE.adoption.arriveToHour,
            })}
          </p>
        )}
        <div class="adopt-layout">
          <div class="adopter-list">
            {waiting.map((a) => (
              <button key={a.id} class={'adopter-card' + (selected?.id === a.id ? ' active' : '')} onClick={() => setSelected(a.id)}>
                <div class="adopter-name">
                  {ADOPTER_TYPES[a.type].icon} {a.name}
                  {a.villager !== undefined && <span class="muted small-text"> ({t('köyden')})</span>} · <b>{formatMoney(a.fee)}</b>
                </div>
                <div class="muted small-text">
                  {t(ADOPTER_TYPES[a.type].name)} · {t(ADOPTER_TYPES[a.type].trait)}
                </div>
                <div class="small-text">{requestText(a.request)}</div>
                <div class="muted small-text">{t('Sabrı: {min} dk', { min: Math.max(0, Math.round(a.patienceLeft)) })}</div>
              </button>
            ))}
          </div>
          {selected && (
            <div class="match-list">
              <div class="row">
                <b>{t('{name} için uygun köpekler', { name: selected.name })}</b>
                <span class="spacer" />
                <button class="btn small" onClick={() => run({ ok: sim.command({ type: 'declineAdopter', adopterId: selected.id }).ok, message: t('{name} uğurlandı', { name: selected.name }) })}>
                  {t('Reddet')}
                </button>
              </div>
              {rows.length === 0 && <p class="muted small-text">{t('Barınakta köpek yok.')}</p>}
              {kept > 0 && <p class="muted small-text">{t('{n} köpek tutuluyor (listede yok)', { n: kept })}</p>}
              {rows.map(({ dog, score, why }) => (
                <div key={dog.id} class={'match-row' + (why || score === 0 ? ' disabled' : '')}>
                  <DogPortrait genome={dog.genome} stage={dog.stage} scale={1.5} />
                  <div class="match-info">
                    <b>{dog.name}</b>{' '}
                    <span class="muted small-text">
                      {t(STAGE_NAMES_TR[dog.stage])} · {t('eğitim {n}/6', { n: dog.trainingLevel() })}
                    </span>
                    <div class="small-text">
                      {why ? <span class="bad">{why}</span> : score >= 70 ? t('Harika eşleşme') : score >= 50 ? t('İdare eder') : t('Zayıf eşleşme (geri gelebilir)')}
                      {!why && likeHits(dog, selected.request) > 0 ? ' · 💛 ' + t('sevdiği gibi') : ''}
                    </div>
                  </div>
                  <div class={'score' + (score >= 70 ? ' good' : score >= 50 ? ' mid' : ' low')}>{score}</div>
                  <button
                    class="btn small primary"
                    disabled={!!why || score === 0}
                    onClick={() => {
                      const r = sim.command({ type: 'adopt', adopterId: selected.id, dogId: dog.id });
                      run(r);
                      if (r.ok) audio.play('adopt');
                    }}
                  >
                    {t('Sahiplendir')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {last && <p class="muted small-text">{t('Son sahiplendirme: {dog} → {person} (puan {score})', { dog: last.dogName, person: last.adopterName, score: last.score })}</p>}
      </div>
    </div>
  );
}

/** Finans: bu hafta, geçmiş haftalar, son denetim. */
export function FinancePanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const tot = sim.weekTotals();
  const weeks = [...sim.weeks].reverse();
  const insp = sim.lastInspection;
  const entries = sim.ledger.filter((e) => e.week === sim.clock.week);
  const proj = projectCash(sim, 4);
  const forecast = proj.weeksUntilNegative
    ? t('Bu gidişle {n} hafta sonra kasa eksiye düşer (haftalık tahmini net {net}).', { n: proj.weeksUntilNegative, net: formatMoney(proj.weeklyNet) })
    : proj.weeklyNet >= 0
      ? t('Kasa önümüzdeki {n} hafta artıda; haftalık tahmini net {net}.', { n: proj.points.length, net: formatMoney(proj.weeklyNet) })
      : t('Kasa önümüzdeki {n} hafta artıda kalır ama eriyor; haftalık tahmini net {net}.', { n: proj.points.length, net: formatMoney(proj.weeklyNet) });
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Finans')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="fin-summary">
          <div>
            {t('Kasa')} <b>{formatMoney(sim.money)}</b> · {t('Zorluk')} <b>{t(DIFFICULTY_NAMES_TR[sim.difficulty])}</b>
          </div>
          <div>
            {t('Bu hafta gelir')} <b class="good">+{formatMoney(tot.income)}</b> · {t('gider')} <b class="bad">-{formatMoney(tot.expense)}</b>
          </div>
          <div class="muted small-text">
            {t('Haftalık yardım: köpek başına {aid} × denetim çarpanı ({mult}) · lisans sınırı {cap} köpek', {
              aid: formatMoney(BALANCE.economy.aidPerDogPerWeek),
              mult: insp ? insp.multiplier : t('henüz yok'),
              cap: sim.licenseCap(),
            })}
          </div>
          {(sim.loan > 0 || sim.negativeWeeks > 0) && (
            <div class="small-text">
              {sim.loan > 0 &&
                t('Kredi borcu {n} · haftalık faiz {f}', { n: formatMoney(sim.loan), f: formatMoney(Math.round(sim.loan * BALANCE.economy.loan.weeklyInterest)) })}
              {sim.loan > 0 && sim.negativeWeeks > 0 && ' · '}
              {sim.negativeWeeks > 0 && <b class="bad">{t('İflas riski: {n}/{max} hafta', { n: sim.negativeWeeks, max: BALANCE.economy.bankruptcy.weeks })}</b>}
            </div>
          )}
        </div>
        <p class={'small-text ' + (proj.weeksUntilNegative ? 'bad' : 'muted')} title={t('Son 3 haftanın ortalaması; maaş ve kredi faizi bugünkü değerle')}>
          {forecast}
        </p>
        {sim.weeks.length > 0 && (
          <>
            <h4>
              {t('Son {n} hafta', { n: Math.min(8, sim.weeks.length) })} <span class="muted small-text">{t('yeşil gelir · kırmızı gider · sarı net')}</span>
            </h4>
            <FinanceChart weeks={sim.weeks.slice(-8)} />
          </>
        )}
        <h4>{t('Bu haftanın hareketleri')}</h4>
        <div class="ledger">
          {entries
            .slice(-12)
            .reverse()
            .map((e, i) => (
              <div key={i} class="ledger-row">
                <span class="muted small-text">{t('{day}. gün', { day: e.day })}</span>
                <span>{t(LEDGER_NAMES_TR[e.category as LedgerCategory])}</span>
                <span class="muted small-text">{e.note}</span>
                <span class={e.amount >= 0 ? 'good' : 'bad'}>
                  {e.amount >= 0 ? '+' : ''}
                  {formatMoney(e.amount)}
                </span>
              </div>
            ))}
          {entries.length === 0 && <p class="muted small-text">{t('Henüz hareket yok.')}</p>}
        </div>
        {weeks.length > 0 && (
          <>
            <h4>{t('Geçmiş haftalar')}</h4>
            <div class="table-scroll">
            <table class="dog-table">
              <thead>
                <tr>
                  <th>{t('Hafta')}</th>
                  <th>{t('Yardım')}</th>
                  <th>{t('Sahiplendirme')}</th>
                  <th>{t('Gider')}</th>
                  <th>{t('Net')}</th>
                  <th>{t('Çarpan')}</th>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Hafta sonu raporu: denetim kalemleri ve para özeti. */
export function WeeklyReport() {
  store.lang.value;
  const w = store.report.value;
  const sim = app.sim;
  if (!w || !sim) return null;
  const insp = w.inspection;
  const expense = Object.values(w.expense).reduce((s, v) => s + (v ?? 0), 0);
  const income = Object.values(w.income).reduce((s, v) => s + (v ?? 0), 0);
  const close = (): void => {
    store.report.value = null;
    if (sim.paused) sim.togglePause();
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <h2>{t('{week}. hafta raporu', { week: w.week })}</h2>
        {insp && (
          <>
            <h4>{t('Denetim · çarpan {mult}', { mult: insp.multiplier })}</h4>
            <div class="insp-list">
              {insp.items.map((it) => (
                <div key={it.name} class="insp-row">
                  <span>{t(it.name)}</span>
                  <span class="muted">{it.value}</span>
                  <span class={it.effect > 0.1 ? 'good' : it.effect < -0.1 ? 'bad' : 'muted'}>{it.effect > 0.1 ? '▲' : it.effect < -0.1 ? '▼' : '•'}</span>
                </div>
              ))}
            </div>
            <p>
              {t('Devlet yardımı: {n} köpek × {aid} × {mult}{diff} = {total}', {
                n: insp.dogsCounted,
                aid: formatMoney(BALANCE.economy.aidPerDogPerWeek),
                mult: insp.multiplier,
                diff: sim.aidMul() !== 1 ? ` × ${sim.aidMul()}` : '',
                total: formatMoney(insp.aid),
              })}
              {insp.dogsOverCap > 0 ? t(' ({n} köpek lisans dışı, yardım almadı)', { n: insp.dogsOverCap }) : ''}
            </p>
          </>
        )}
        <p>
          {t('Gelir')} <b class="good">+{formatMoney(income)}</b> · {t('Gider')} <b class="bad">-{formatMoney(expense)}</b> · {t('Net')}{' '}
          <b class={w.net >= 0 ? 'good' : 'bad'}>{formatMoney(w.net)}</b> · {t('Kasa')} <b>{formatMoney(w.endMoney)}</b>
        </p>
        <button class="btn primary" onClick={close}>
          {t('Devam et')}
        </button>
      </div>
    </div>
  );
}
