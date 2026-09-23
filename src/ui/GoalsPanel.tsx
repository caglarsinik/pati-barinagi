import { app } from '../app';
import { t } from '../i18n';
import { GOALS, type GoalDef, goalShowTool } from '../sim/systems/Goals';
import { goalRewardText } from './Guide';
import { store } from './store';

/** Belediye hedefleri paneli (0.19.1): sıradaki hedef ve "Göster", sonraki iki hedef, tamamlananlar. */
export function GoalsPanel() {
  store.tick.value;
  store.lang.value;
  const sim = app.sim;
  if (!sim) return null;
  const goals = sim.goals;
  const [cur, ...next] = goals.upcoming(3);
  const done = GOALS.filter((g) => goals.done.has(g.id)).reverse();
  const close = (): void => {
    store.panel.value = 'none';
  };
  const canShow = (g: GoalDef): boolean => (g.tools?.length ?? 0) > 0 || !!g.plot || !!g.panel;
  const show = (g: GoalDef): void => {
    const tool = goalShowTool(sim, g);
    if (tool) app.showBuild(tool);
    else if (g.plot) app.showBuild('plot');
    else if (g.panel) store.panel.value = g.panel;
  };
  return (
    <div class="overlay">
      <div class="menu-card panel goals">
        <div class="panel-head">
          <h2>
            {t('Belediye hedefleri')} <span class="muted small-text">{done.length}/{GOALS.length}</span>
          </h2>
          <button class="btn small close" onClick={close}>
            ✕
          </button>
        </div>
        {cur ? (
          <div class="goal-current">
            <div>
              🎯 <b>{t(cur.title)}</b>
              {goalRewardText(cur)}
            </div>
            <p class="muted small-text">{t(cur.desc)}</p>
            {canShow(cur) && (
              <button class="btn primary" onClick={() => show(cur)}>
                {t('Göster')}
              </button>
            )}
          </div>
        ) : (
          <p>{t('Bütün belediye hedeflerini tamamladın!')}</p>
        )}
        {next.map((g) => (
          <div key={g.id} class="goal-row muted">
            ☐ {t(g.title)}
            {goalRewardText(g)}
          </div>
        ))}
        {done.length > 0 && (
          <>
            <h4>{t('Tamamlananlar')}</h4>
            {done.map((g) => (
              <div key={g.id} class="goal-row done">
                ✓ {t(g.title)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
