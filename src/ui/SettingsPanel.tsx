import { useState } from 'preact/hooks';
import { app } from '../app';
import { audio } from '../audio/audio';
import { showToast, store } from './store';

/** Ses ayarları ve kaydı JSON olarak dışa/içe aktarma. */
export function SettingsPanel() {
  store.tick.value;
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
  return (
    <div class="overlay">
      <div class="menu-card panel wide settings">
        <div class="panel-head">
          <h2>Ayarlar</h2>
          <button class="btn small close" onClick={() => (store.settingsOpen.value = false)}>
            ✕
          </button>
        </div>
        <h4>Ses</h4>
        <label class="setting">
          <input type="checkbox" checked={s.muted} onChange={(e) => set({ muted: (e.target as HTMLInputElement).checked })} />
          <span>Sessiz</span>
        </label>
        {slider('Ana ses', 'master')}
        {slider('Efektler', 'sfx')}
        {slider('Müzik', 'music')}
        <p class="muted small-text">Tüm sesler kodla üretilir; dosya yoktur. Efektleri denemek için: </p>
        <div class="row">
          {(['bark', 'coin', 'adopt', 'hatch', 'build'] as const).map((n) => (
            <button key={n} class="btn small" onClick={() => audio.play(n)}>
              {n}
            </button>
          ))}
        </div>
        <h4>Rehber</h4>
        <label class="setting">
          <input type="checkbox" checked={!store.guideHidden.value} onChange={(e) => app.setGuideHidden(!(e.target as HTMLInputElement).checked)} />
          <span>Başlangıç rehberini göster</span>
        </label>
        {app.sim && (
          <>
            <h4>Kayıt</h4>
            <div class="row">
              <button
                class="btn small"
                onClick={() => {
                  void navigator.clipboard?.writeText(exportText).then(
                    () => showToast('Kayıt panoya kopyalandı'),
                    () => showToast('Pano erişimi yok; metni elle seç'),
                  );
                }}
              >
                Kaydı panoya kopyala
              </button>
              <button class="btn small" onClick={() => app.downloadSave()}>
                Dosya olarak indir
              </button>
            </div>
            <textarea class="save-text" readOnly value={exportText} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <div class="row">
              <textarea
                class="save-text"
                placeholder="İçe aktarmak için kayıt JSON'unu buraya yapıştır"
                value={importText}
                onFocus={() => (store.inputFocused.value = true)}
                onBlur={() => (store.inputFocused.value = false)}
                onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)}
              />
            </div>
            <div class="row">
              <button class="btn small primary" disabled={importText.trim().length < 10} onClick={() => app.importSave(importText)}>
                Yapıştırılan kaydı yükle
              </button>
              <label class="btn small">
                Dosyadan yükle
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (!f) return;
                    void f.text().then((t) => app.importSave(t));
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
