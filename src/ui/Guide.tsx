import { app } from '../app';
import { t } from '../i18n';
import { isReady } from '../sim/entities/Building';
import { GOALS, type GoalDef, goalReward } from '../sim/systems/Goals';
import { formatMoney } from './format';
import { store } from './store';

/** Ödül metni: " · 200 ₺" (ödülsüz hedefte boş). */
export function goalRewardText(g: GoalDef): string {
  const r = goalReward(g);
  return r > 0 ? ' · ' + formatMoney(r) : '';
}

/**
 * Belediye hedef kartı (0.19.1): masaüstünde sıradaki ve bir sonraki hedef, telefonda tek satırlık pil. Dokununca Hedefler
 * paneli açılır. Zincir bitince kaybolur; Ayarlar'dan gizlenebilir.
 */
export function Guide() {
  store.tick.value;
  store.lang.value;
  const sim = app.sim;
  if (!sim || store.guideHidden.value) return null;
  const [goal, next] = sim.goals.upcoming(2);
  if (!goal) return null;
  const open = (): void => {
    store.panel.value = 'goals';
  };
  if (store.layout.value !== 'desktop') {
    return (
      <button class="guide guide-pill panel has-goal" onClick={open} title={t('Belediye hedefleri')}>
        🎯 {t(goal.title)}
        {goalRewardText(goal)} ▸
      </button>
    );
  }
  return (
    <div class="guide panel has-goal">
      <div class="guide-head">
        <b>{t('Belediye hedefleri')}</b>
        <span class="muted small-text">
          {sim.goals.done.size}/{GOALS.length}
        </span>
        <button class="btn small close" title={t("Gizle (Ayarlar'dan açılır)")} onClick={() => app.setGuideHidden(true)}>
          ✕
        </button>
      </div>
      <div class="guide-goal">
        🎯 <b>{t(goal.title)}</b>
        {goalRewardText(goal)}
        <div class="muted small-text">{t(goal.desc)}</div>
      </div>
      {next && <div class="guide-step muted small-text">{t('Sonra: {goal}', { goal: t(next.title) })}</div>}
      {sim.buildings.some((b) => !isReady(b)) && <div class="muted small-text">{t('İnşaat sürüyor…')}</div>}
      <button class="btn small" onClick={open}>
        {t('Tüm hedefler')}
      </button>
    </div>
  );
}
