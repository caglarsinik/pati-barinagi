import { app } from '../app';
import { MINUTES_PER_DAY, WEEKDAYS_TR } from '../core/Clock';
import { t } from '../i18n';
import { questTimeText } from '../sim/systems/QuestSystem';
import { SEASON_NAMES_TR, WEATHER_NAMES_TR } from '../sim/systems/WeatherSystem';
import { formatMoney } from './format';
import { store } from './store';

interface Line {
  text: string;
  warn?: boolean;
}

/** Sabah raporu ve hoş geldin kartı (0.19.2): dünün özeti ve bugünün işleri. */
export function MorningPanel() {
  store.lang.value;
  const r = store.morningReport.value;
  if (!r || !app.sim) return null;
  const close = (): void => {
    store.panel.value = 'none';
  };
  const title = r.kind === 'welcome' ? t('👋 Hoş geldin!') : r.passedOut ? t('😵 Dışarıda bayıldın, ofiste uyandın') : t('☀️ Günaydın!');
  const y = r.yesterday;
  const done: string[] = [];
  if (y) {
    if (y.adopted > 0) done.push(t('🏠 {n} sahiplendirme', { n: y.adopted }));
    if (y.hatched > 0) done.push(t('🐣 {n} yavru çatladı', { n: y.hatched }));
    if (y.strays > 0) done.push(t('🐕 {n} sokak köpeği katıldı', { n: y.strays }));
    if (y.cured > 0) done.push(t('💊 {n} tedavi', { n: y.cured }));
    if (y.eggsFound > 0) done.push(t('🥚 {n} yumurta bulundu', { n: y.eggsFound }));
    if (y.fed > 0) done.push(t('🥣 {n} öğün yendi', { n: y.fed }));
  }
  const today: Line[] = [];
  if (r.eggsSoon > 0) today.push({ text: t('🥚 {n} yumurta bugün çatlayabilir', { n: r.eggsSoon }) });
  if (r.nurseryEggs > 0) today.push({ text: t('🏡 Yuva evinde yumurta seni bekliyor') });
  if (r.sickDogs > 0) today.push({ text: t('🤒 {n} hasta köpek var', { n: r.sickDogs }), warn: true });
  if (r.foodDays !== null) {
    if (r.foodDays < 1) today.push({ text: t('🥣 Yem bugün bitebilir: sipariş ver'), warn: true });
    else today.push({ text: t('🥣 Yem {n} gün yeter', { n: Math.floor(r.foodDays) }), warn: r.foodDays < 2 });
  }
  if (r.staffToday > 0) today.push({ text: t('👥 Bugün {n} personel çalışıyor', { n: r.staffToday }) });
  if (!r.adoptionsOpen) today.push({ text: t('🚪 Sahiplendirme kapalı') });
  else if (r.adoptableDogs > 0) today.push({ text: t('🏠 Sahiplenici gelebilir: {n} köpek hazır', { n: r.adoptableDogs }) });
  if (r.goal) today.push({ text: t('🎯 Hedef: {goal}', { goal: t(r.goal.title) }) + (r.goal.reward > 0 ? ' · ' + formatMoney(r.goal.reward) : '') });
  for (const q of r.quests) today.push({ text: t('📋 {title} · {time}', { title: q.title, time: questTimeText(q.minutesLeft) }), warn: q.minutesLeft < MINUTES_PER_DAY });
  if (r.questOffers > 0 && r.weekday === 0) today.push({ text: t('📋 Köy panosuna yeni ilanlar asıldı ({n})', { n: r.questOffers }) });
  return (
    <div class="overlay">
      <div class="menu-card panel morning">
        <div class="panel-head">
          <h2>{title}</h2>
          <button class="btn small close" onClick={close}>
            ✕
          </button>
        </div>
        <p class="muted small-text">
          {t('{day}. gün · {weekday} · {season} · {weather}', {
            day: r.day,
            weekday: t(WEEKDAYS_TR[r.weekday]),
            season: t(SEASON_NAMES_TR[r.season]),
            weather: t(WEATHER_NAMES_TR[r.weather]),
          })}
        </p>
        {y && (
          <>
            <h4>{t('Dün')}</h4>
            <div class={'morning-money ' + (y.money >= 0 ? 'up' : 'down')}>{t('Kasa: {money}', { money: (y.money > 0 ? '+' : '') + formatMoney(y.money) })}</div>
            <div class="morning-line">{done.length > 0 ? done.join(' · ') : t('Sakin bir gündü.')}</div>
          </>
        )}
        <h4>{t('Bugün')}</h4>
        {today.length === 0 ? (
          <div class="morning-line">{t('Her şey yolunda.')}</div>
        ) : (
          today.map((x) => (
            <div key={x.text} class={'morning-line' + (x.warn ? ' warn' : '')}>
              {x.text}
            </div>
          ))
        )}
        <button class="btn primary morning-start" onClick={close}>
          {r.kind === 'welcome' ? t('Devam et') : t('Güne başla')}
        </button>
      </div>
    </div>
  );
}
