import { app } from '../app';
import { t } from '../i18n';
import { needSummaryFromAlerts, needSummaryText } from '../sim/systems/NeedSummary';
import { store } from './store';

/**
 * Sol alttaki ihtiyaç şeridi (0.22.0): "3 köpek aç · 2 susuz" — oyuncunun sağlayabileceği şeylerden yoksun köpekleri
 * sayar; en ağır uyarının rengini alır. Dokununca uyarı listesi açılır (satıra dokununca köpek paneli). Telefonda da
 * görünür (uyarı sütunu orada gizli); telefonda inşa çubuğu açıkken yer kaplamasın diye gizlenir.
 */
export function NeedStrip() {
  store.lang.value;
  if (store.buildBar.value && store.layout.value === 'phone') return null;
  const s = needSummaryFromAlerts(store.alerts.value);
  const text = needSummaryText(s);
  if (!text) return null;
  return (
    <button class={'alert need-strip ' + (s.severity ?? 'info')} title={t('Uyarıları aç')} onClick={() => app.togglePanel('alerts')}>
      <span class="need-text">{text}</span>
    </button>
  );
}
