import { app } from '../app';
import { t } from '../i18n';
import { store } from './store';

/**
 * Dokunmatik kontroller (avatar modu): büyük E düğmesi ipucundaki işi gösterir ve yapar; Koş anahtarı.
 * Yürüme dokun-git ile (WorldScene.touchTap), joystick yok.
 */
export function TouchControls() {
  store.lang.value;
  if (!store.touch.value || store.screen.value !== 'game' || store.mode.value !== 'avatar') return null;
  const hint = store.hint.value;
  const m = /^E: (.+)$/.exec(hint);
  const label = m ? m[1] : null;
  return (
    <div class="touch-controls">
      <button class={'btn small run-toggle' + (store.touchRun.value ? ' active' : '')} onClick={() => (store.touchRun.value = !store.touchRun.value)}>
        {t('Koş')}
      </button>
      <button class="action-btn" disabled={!label} title={hint} onClick={() => app.game?.events.emit('ui:interact')}>
        <span class="action-key">E</span>
        <span class="action-label">{label ?? t('Yakında iş yok')}</span>
      </button>
    </div>
  );
}
