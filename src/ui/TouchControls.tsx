import { app } from '../app';
import { t } from '../i18n';
import { type ActionKind, resolveAction } from '../sim/systems/Interaction';
import { actionLabel, store } from './store';

/** Köpeğe yönelik işlerde düğmede fiil ve altında köpeğin adı (0.21.6: 16 harflik adda fiil kesiliyordu). */
const DOG_VERBS: Partial<Record<ActionKind, string>> = {
  pet: 'Sev',
  play: 'Oyna',
  train: 'Eğit',
  groom: 'Fırçala',
  wash: 'Yıka',
  treat: 'Tedavi et',
  treatWild: 'Ödül ver',
};

/** Düğmedeki ad: uzun, çok kelimeli adın ilk kelimesi (0.23.2: 1024×768'de "Minnoş Karabaşım" 5 px kesiliyordu); tamamı ipucunda. */
function buttonName(name: string): string {
  return name.length > 12 && name.includes(' ') ? name.split(' ')[0] : name;
}

/**
 * Dokunmatik kontroller (avatar modu): büyük E düğmesi ipucundaki işi gösterir ve yapar; Koş anahtarı.
 * Yürüme dokun-git ile (WorldScene.touchTap), joystick yok.
 */
export function TouchControls() {
  store.lang.value;
  if (!store.touch.value || store.screen.value !== 'game' || store.mode.value !== 'avatar') return null;
  const hint = store.hint.value;
  // Düğmede iki satır yer var: ayrıntı atılır, ipucunun tamamı title'da.
  const label = actionLabel(hint);
  const action = label && app.sim ? resolveAction(app.sim) : null;
  const verb = action?.dog ? DOG_VERBS[action.kind] : undefined;
  return (
    <div class="touch-controls">
      <button class={'btn small run-toggle' + (store.touchRun.value ? ' active' : '')} onClick={() => (store.touchRun.value = !store.touchRun.value)}>
        {t('Koş')}
      </button>
      <button class="action-btn" disabled={!label} title={hint} onClick={() => app.game?.events.emit('ui:interact')}>
        <span class="action-key">E</span>
        {verb && action?.dog ? (
          <>
            <span class="action-label one">{t(verb)}</span>
            <span class="action-name">{buttonName(action.dog.name)}</span>
          </>
        ) : (
          <span class="action-label">{label ?? t('Yakında iş yok')}</span>
        )}
      </button>
    </div>
  );
}
