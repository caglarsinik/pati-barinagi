import { app } from '../app';
import { t } from '../i18n';
import { isReady } from '../sim/entities/Building';
import { store } from './store';

interface Step {
  text: string;
  done: boolean;
}

/** İlk günler için küçük görev listesi; hepsi bitince kaybolur. */
export function Guide() {
  store.tick.value;
  const sim = app.sim;
  if (!sim || store.guideHidden.value) return null;
  const st = sim.stats;
  const steps: Step[] = [
    { text: 'Yem kabını doldur (kabın önünde E)', done: st.bowlsFilled >= 1 },
    { text: 'Köpeği sev (1 numaralı araç, E)', done: st.petted >= 1 },
    { text: 'Pisliği temizle (5 numaralı araç)', done: st.cleaned >= 1 },
    { text: 'Dünyada bir yumurta bul (sarı nokta)', done: st.eggsFound >= 1 },
    { text: 'Yumurtayı kuluçkaya koy', done: st.hatched >= 1 || sim.buildings.some((b) => b.type === 'incubator' && b.eggs.length > 0) },
    { text: 'Bir bina inşa et (B)', done: st.built >= 1 },
    { text: 'Personel al (P)', done: st.hired >= 1 },
    { text: 'İlk sahiplendirme (O)', done: st.adopted >= 1 },
    { text: 'Gece ofiste uyu', done: st.slept >= 1 },
  ];
  const remaining = steps.filter((s) => !s.done);
  if (remaining.length === 0) return null;
  const shown = remaining.slice(0, 4);
  return (
    <div class="hud guide panel">
      <div class="guide-head">
        <b>{t('Başlangıç rehberi')}</b>
        <span class="muted small-text">
          {steps.length - remaining.length}/{steps.length}
        </span>
        <button class="btn small close" title={t("Gizle (Ayarlar'dan açılır)")} onClick={() => app.setGuideHidden(true)}>
          ✕
        </button>
      </div>
      {shown.map((s) => (
        <div key={s.text} class="guide-step">
          ☐ {t(s.text)}
        </div>
      ))}
      {sim.buildings.some((b) => !isReady(b)) && <div class="muted small-text">{t('İnşaat sürüyor…')}</div>}
    </div>
  );
}
