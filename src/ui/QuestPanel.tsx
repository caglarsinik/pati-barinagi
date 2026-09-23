import { useState } from 'preact/hooks';
import { app } from '../app';
import { audio } from '../audio/audio';
import { t } from '../i18n';
import type { Command } from '../sim/Sim';
import { VILLAGER_ROLE_NAMES_TR } from '../sim/entities/Villager';
import { type QuestKind, questTimeText } from '../sim/systems/QuestSystem';
import { formatMoney } from './format';
import { showToast, store } from './store';

const ICONS: Record<QuestKind, string> = { lost: '🐾', pup: '🐶', treats: '🍖' };

/** Köy görev panosu (0.20.4): köylülerin ilanları; panoda kabul et, süresi dolmadan köylüye ya da panoya teslim et. */
export function QuestPanel() {
  store.tick.value;
  store.lang.value;
  // Düğmeden sonra pano hemen yenilensin (oyunun ara güncellemesini beklemeden).
  const [, bump] = useState(0);
  const sim = app.sim;
  if (!sim) return null;
  const qs = sim.quests;
  const here = qs.nearBoard();
  const run = (cmd: Command, good: 'coin' | 'click'): void => {
    const r = sim.command(cmd);
    if (r.message) showToast(r.message);
    audio.play(r.ok ? good : 'error');
    bump((n) => n + 1);
  };
  return (
    <div class="overlay">
      <div class="menu-card panel shop quests">
        <div class="panel-head">
          <h2>{t('📋 Görev panosu')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">{t('Köylülerin ricaları. İlanlar her Pazartesi yenilenir; kabul ettiğin görevi süresi dolmadan köylüye ya da panoya teslim et.')}</p>
        {qs.list.length === 0 && <p class="muted">{t('Panoda ilan yok. Pazartesi yeni ilanlar asılır.')}</p>}
        {qs.list.map((q) => {
          const v = sim.villagers.list[q.villager];
          const issue = q.state === 'active' ? qs.issue(q) : null;
          return (
            <div key={q.id} class="shop-item">
              <div>
                {ICONS[q.kind]} <b>{qs.title(q)}</b>
                {v ? ' · ' + v.name + ' (' + t(VILLAGER_ROLE_NAMES_TR[v.role]) + ')' : ''}
              </div>
              <div class="muted small-text">{qs.desc(q)}</div>
              <div class="small-text">
                {t('Ödül: {money} · itibar +{rep}', { money: formatMoney(q.reward), rep: q.rep })}
                {q.state === 'active' ? ' · ' + questTimeText(qs.timeLeft(q)) : ''}
              </div>
              {q.state === 'active' && <div class={issue ? 'small-text muted' : 'small-text'}>{issue ?? t('✔ Teslime hazır')}</div>}
              <div class="row">
                {q.state === 'offer' ? (
                  <button class="btn small" disabled={!here} onClick={() => run({ type: 'questAccept', id: q.id }, 'click')}>
                    {t('Kabul et')}
                  </button>
                ) : (
                  <>
                    <button class="btn small" disabled={!here || issue !== null} onClick={() => run({ type: 'questDeliver', id: q.id }, 'coin')}>
                      {t('Teslim et')}
                    </button>{' '}
                    <button class="btn small" onClick={() => run({ type: 'questAbandon', id: q.id }, 'click')}>
                      {t('Vazgeç')}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!here && <p class="muted small-text">{t('İlan almak ve teslim etmek için köydeki panonun yanında ol.')}</p>}
      </div>
    </div>
  );
}
