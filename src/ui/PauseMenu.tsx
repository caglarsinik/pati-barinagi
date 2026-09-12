import { app } from '../app';
import { store } from './store';

export function PauseMenu() {
  return (
    <div class="overlay">
      <div class="menu-card panel">
        <h2>Duraklatıldı</h2>
        <p class="sub">Tohum: {store.seed.value}</p>
        <button class="btn primary" onClick={() => app.closePauseMenu()}>
          Devam et (Esc)
        </button>
        <button class="btn" onClick={() => app.save()}>
          Kaydet
        </button>
        <button class="btn" onClick={() => (store.settingsOpen.value = true)}>
          Ayarlar ve kayıt aktarımı
        </button>
        <button class="btn" onClick={() => app.toMenu()}>
          Kaydet ve ana menüye dön
        </button>
      </div>
    </div>
  );
}
