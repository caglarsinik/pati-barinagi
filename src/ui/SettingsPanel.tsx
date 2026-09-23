import { useState } from 'preact/hooks';
import { app } from '../app';
import { audio } from '../audio/audio';
import { getLang, t } from '../i18n';
import { InstallControls } from './InstallControls';
import { showToast, store } from './store';

/** Ses ve dil ayarları, kaydı JSON olarak dışa/içe aktarma. */
export function SettingsPanel() {
  store.tick.value;
  store.lang.value;
  const [, force] = useState(0);
  const [importText, setImportText] = useState('');
  const s = audio.settings;
  const set = (patch: Parameters<typeof audio.update>[0]): void => {
    audio.update(patch);
    force((n) => n + 1);
    audio.play('click');
  };
  const slider = (label: string, key: 'master' | 'sfx' | 'music') => (
    <label class="setting">
      <span>{label}</span>
      <input type="range" min={0} max={100} value={Math.round(s[key] * 100)} onInput={(e) => set({ [key]: Number((e.target as HTMLInputElement).value) / 100 })} />
      <span class="muted small-text">{Math.round(s[key] * 100)}</span>
    </label>
  );
  const exportText = app.exportSave();
  const lang = getLang();
  return (
    <div class="overlay">
      <div class="menu-card panel wide settings">
        <div class="panel-head">
          <h2>{t('Ayarlar')}</h2>
          <button class="btn small close" onClick={() => (store.settingsOpen.value = false)}>
            ✕
          </button>
        </div>
        <h4>{t('Dil')}</h4>
        <div class="row">
          <button class={'btn small' + (lang === 'tr' ? ' active' : '')} onClick={() => app.setLang('tr')}>
            Türkçe
          </button>
          <button class={'btn small' + (lang === 'en' ? ' active' : '')} onClick={() => app.setLang('en')}>
            English
          </button>
        </div>
        <h4>{t('Ses')}</h4>
        <label class="setting">
          <input type="checkbox" checked={s.muted} onChange={(e) => set({ muted: (e.target as HTMLInputElement).checked })} />
          <span>{t('Sessiz')}</span>
        </label>
        {slider(t('Ana ses'), 'master')}
        {slider(t('Efektler'), 'sfx')}
        {slider(t('Müzik'), 'music')}
        <p class="muted small-text">{t('Tüm sesler kodla üretilir; dosya yoktur. Efektleri denemek için:')}</p>
        <div class="row">
          {(['bark', 'coin', 'adopt', 'hatch', 'build'] as const).map((n) => (
            <button key={n} class="btn small" onClick={() => audio.play(n)}>
              {n}
            </button>
          ))}
        </div>
        <h4>{t('Rehber')}</h4>
        <label class="setting">
          <input type="checkbox" checked={!store.guideHidden.value} onChange={(e) => app.setGuideHidden(!(e.target as HTMLInputElement).checked)} />
          <span>{t('Hedef kartını göster')}</span>
        </label>
        <label class="setting">
          <input type="checkbox" checked={store.labels.value} onChange={(e) => app.setLabels((e.target as HTMLInputElement).checked)} />
          <span>{t('Köpek ve kişi isimlerini dünyada göster (L)')}</span>
        </label>
        <h4>{t('Dokunmatik')}</h4>
        <label class="setting">
          <span>{t('Dokunmatik kontroller')}</span>
          <select value={store.touchMode.value} onChange={(e) => app.setTouchMode((e.target as HTMLSelectElement).value as 'auto' | 'on' | 'off')}>
            <option value="auto">{t('Otomatik (cihaza göre)')}</option>
            <option value="on">{t('Açık')}</option>
            <option value="off">{t('Kapalı')}</option>
          </select>
          <span class="muted small-text">{store.touch.value ? t('Şu an: açık') : t('Şu an: kapalı')}</span>
        </label>
        <InstallControls title />
        {app.sim && (
          <>
            <h4>{t('Kayıt')}</h4>
            <div class="row">
              <button
                class="btn small"
                onClick={() => {
                  void navigator.clipboard?.writeText(exportText).then(
                    () => showToast(t('Kayıt panoya kopyalandı')),
                    () => showToast(t('Pano erişimi yok; metni elle seç')),
                  );
                }}
              >
                {t('Kaydı panoya kopyala')}
              </button>
              <button class="btn small" onClick={() => app.downloadSave()}>
                {t('Dosya olarak indir')}
              </button>
            </div>
            <textarea class="save-text" readOnly value={exportText} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <div class="row">
              <textarea
                class="save-text"
                placeholder={t("İçe aktarmak için kayıt JSON'unu buraya yapıştır")}
                value={importText}
                onFocus={() => (store.inputFocused.value = true)}
                onBlur={() => (store.inputFocused.value = false)}
                onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)}
              />
            </div>
            <div class="row">
              <button class="btn small primary" disabled={importText.trim().length < 10} onClick={() => app.importSave(importText)}>
                {t('Yapıştırılan kaydı yükle')}
              </button>
              <label class="btn small">
                {t('Dosyadan yükle')}
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (!f) return;
                    void f.text().then((txt) => app.importSave(txt));
                  }}
                />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
