import { app } from '../app';
import { t } from '../i18n';
import { TOOL_DEFS } from '../sim/systems/Interaction';
import { store } from './store';

export function Toolbar() {
  store.lang.value;
  const tool = store.tool.value;
  const mode = store.mode.value;
  if (mode !== 'avatar') return null;
  const def = TOOL_DEFS.find((x) => x.id === tool);
  return (
    <div class="toolbar panel">
      <div class="tool-row">
        {TOOL_DEFS.map((x) => (
          <button key={x.id} class={'tool' + (tool === x.id ? ' active' : '')} title={`${t(x.name)} (${x.key})`} onClick={() => app.setTool(x.id)}>
            <span class="tool-icon">{x.icon}</span>
            <span class="tool-key">{x.key}</span>
          </button>
        ))}
      </div>
      <div class="tool-desc">
        <b>{def ? t(def.name) : ''}</b> · {def ? t(def.desc) : ''}
      </div>
    </div>
  );
}
