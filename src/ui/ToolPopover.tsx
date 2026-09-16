import { useEffect } from 'preact/hooks';
import { app } from '../app';
import { t } from '../i18n';
import { TOOL_DEFS } from '../sim/systems/Interaction';
import { store } from './store';

/**
 * Telefonda araç çubuğu tek "etkin araç" düğmesine katlanır; dokununca 6 araçlık şerit yukarı açılır.
 * Klavye tuşları (1-6) aynen çalışır. Dışına dokununca kapanır (BottomNav ile aynı desen).
 */
export function ToolPopover() {
  store.lang.value;
  const tool = store.tool.value;
  const open = store.toolMenu.value;
  const def = TOOL_DEFS.find((x) => x.id === tool);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('.tool-dock')) return;
      store.toolMenu.value = false;
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  return (
    <div class="tool-dock">
      {open && (
        <div class="tool-popover panel">
          <div class="tool-row">
            {TOOL_DEFS.map((x) => (
              <button
                key={x.id}
                class={'tool' + (tool === x.id ? ' active' : '')}
                title={`${t(x.name)} (${x.key})`}
                onClick={() => {
                  app.setTool(x.id);
                  store.toolMenu.value = false;
                }}
              >
                <span class="tool-icon">{x.icon}</span>
                <span class="tool-key">{x.key}</span>
              </button>
            ))}
          </div>
          <div class="tool-desc">
            <b>{def ? t(def.name) : ''}</b> · {def ? t(def.desc) : ''}
          </div>
        </div>
      )}
      <button class={'tool tool-current' + (open ? ' active' : '')} title={def ? `${t(def.name)} · ${t('Araçlar')}` : t('Araçlar')} onClick={() => (store.toolMenu.value = !open)}>
        <span class="tool-icon">{def?.icon ?? '🧰'}</span>
        <span class="tool-key">{def?.key ?? ''}</span>
      </button>
    </div>
  );
}
