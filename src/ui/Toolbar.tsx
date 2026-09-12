import { app } from '../app';
import { TOOL_DEFS } from '../sim/systems/Interaction';
import { store } from './store';

export function Toolbar() {
  const tool = store.tool.value;
  const mode = store.mode.value;
  if (mode !== 'avatar') return null;
  const def = TOOL_DEFS.find((t) => t.id === tool);
  return (
    <div class="hud toolbar panel">
      <div class="tool-row">
        {TOOL_DEFS.map((t) => (
          <button
            key={t.id}
            class={'tool' + (tool === t.id ? ' active' : '')}
            title={`${t.name} (${t.key})`}
            onClick={() => app.setTool(t.id)}
          >
            <span class="tool-icon">{t.icon}</span>
            <span class="tool-key">{t.key}</span>
          </button>
        ))}
      </div>
      <div class="tool-desc">
        <b>{def?.name}</b> · {def?.desc}
      </div>
    </div>
  );
}
