import { useState } from 'preact/hooks';
import { app } from '../app';
import { t } from '../i18n';
import { ADOPTER_TYPES } from '../sim/entities/AdopterType';
import { type AlbumFilter, albumEntries, albumStats } from '../sim/systems/Stories';
import { ScenePhoto } from './MailPanel';
import { store } from './store';

/** Mezunlar albümü (0.21.2): sahiplendirilen köpekler fotoğraflarıyla; rozetler ve son mektuptan bir cümle. */
export function AlbumPanel() {
  store.tick.value;
  store.lang.value;
  const [filter, setFilter] = useState<AlbumFilter>('all');
  const sim = app.sim;
  if (!sim) return null;
  const stats = albumStats(sim);
  const entries = albumEntries(sim, filter);
  const filterBtn = (f: AlbumFilter, label: string) => (
    <button key={f} class={'btn small' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
      {label}
    </button>
  );
  return (
    <div class="overlay">
      <div class="menu-card panel wide album">
        <div class="panel-head">
          <h2>{t('📖 Mezunlar')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">{t('{n} mezun · %{p} mutlu · {r} geri döndü', { n: stats.total, p: stats.happyPct, r: stats.returned })}</p>
        <div class="row album-filters">
          {filterBtn('all', t('Tümü'))}
          {filterBtn('letters', t('Mektuplu'))}
          {filterBtn('village', t('Köyde'))}
        </div>
        {entries.length === 0 && <p class="muted">{stats.total === 0 ? t('Henüz mezun yok. Sahiplendirdiğin köpekler burada toplanır.') : t('Bu süzgeçte mezun yok.')}</p>}
        <div class="album-grid">
          {entries.map((e) => {
            const r = e.record;
            const T = r.type ? ADOPTER_TYPES[r.type] : null;
            const text = e.letter ? sim.mail.text(e.letter) : '';
            const badges = [
              e.pair ? '💞 ' + t('{name} ile', { name: e.pair }) : '',
              e.village ? '🏘️ ' + t('köyde') : '',
              e.returning ? '🔁 ' + t('tekrar gelen aile') : '',
              e.returned ? '↩️ ' + t('geri döndü') : '',
            ].filter(Boolean);
            return (
              <div key={e.index} class="album-card">
                <ScenePhoto scene={e.scene} genome={r.genome} stage={r.stage} caption={r.dogName} small />
                <div class="album-info">
                  <div>
                    <b>{r.dogName}</b> <span class="stars">{'★'.repeat(e.stars) + '☆'.repeat(5 - e.stars)}</span>
                  </div>
                  <div class="small-text">
                    {T ? T.icon + ' ' : ''}
                    {r.adopterName} · {t('{n}. gün', { n: r.day })}
                  </div>
                  {badges.length > 0 && <div class="small-text">{badges.join(' · ')}</div>}
                  {text && <div class="muted small-text">“{text.length > 70 ? text.slice(0, 68) + '…' : text}”</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
