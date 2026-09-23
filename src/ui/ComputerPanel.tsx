import { useState } from 'preact/hooks';
import { app } from '../app';
import { audio } from '../audio/audio';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import type { Command } from '../sim/Sim';
import { formatMoney } from './format';
import { type Panel, showToast, store } from './store';

/** Ofis bilgisayarı (0.16.1): masadaki bilgisayardan yönetim panellerine kısayol. */
export function ComputerPanel() {
  store.tick.value;
  const [, bump] = useState(0);
  const sim = app.sim;
  if (!sim) return null;
  const act = (cmd: Command): void => {
    const r = sim.command(cmd);
    if (r.message) showToast(r.message);
    audio.play(r.ok ? 'coin' : 'error');
    bump((n) => n + 1);
  };
  const S = BALANCE.stories;
  const dayIssue = sim.campaigns.adoptionDayIssue();
  const campIssue = sim.campaigns.campaignIssue();
  const waiting = sim.adopters.filter((a) => a.state === 'waiting').length;
  const unread = sim.mail.unread();
  const open = (p: Panel): void => {
    store.panel.value = p;
  };
  return (
    <div class="overlay">
      <div class="menu-card panel computer">
        <div class="panel-head">
          <h2>{t('Bilgisayar')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="computer-menu">
          <button class={waiting > 0 ? 'btn primary' : 'btn'} onClick={() => open('adoption')}>
            {waiting > 0 ? t('🏠 Sahiplendirme ({n} bekliyor)', { n: waiting }) : t('🏠 Sahiplendirme')}
          </button>
          <button class="btn" onClick={() => open('finance')}>
            {t('📊 Finans')}
          </button>
          <button class="btn" onClick={() => open('staff')}>
            {t('👥 Personel')}
          </button>
          <button class="btn" onClick={() => open('achievements')}>
            {t('🏅 Başarımlar')}
          </button>
          <button class="btn" onClick={() => open('goals')}>
            {t('🎯 Hedefler')}
          </button>
          <button class={unread > 0 ? 'btn primary' : 'btn'} onClick={() => open('mail')}>
            {unread > 0 ? t('📬 Posta ({n} yeni)', { n: unread }) : t('📬 Posta')}
          </button>
          <button class="btn" onClick={() => open('album')}>
            {t('📖 Mezunlar')}
          </button>
          <p class="muted small-text">{t('Etkinlikler')}</p>
          <button class="btn" disabled={dayIssue !== null} onClick={() => act({ type: 'announceAdoptionDay' })}>
            {t('🎈 Sahiplendirme günü ilan et · {cost}', { cost: formatMoney(S.adoptionDayCost) })}
          </button>
          {dayIssue && <p class="muted small-text">{dayIssue}</p>}
          <button class="btn" disabled={campIssue !== null} onClick={() => act({ type: 'startCampaign' })}>
            {t('📣 Bağış kampanyası · {cost}', { cost: formatMoney(S.campaignCost) })}
          </button>
          {campIssue && <p class="muted small-text">{campIssue}</p>}
        </div>
      </div>
    </div>
  );
}
