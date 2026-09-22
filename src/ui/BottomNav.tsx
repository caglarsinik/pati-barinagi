import { useEffect } from 'preact/hooks';
import { app } from '../app';
import { t } from '../i18n';
import { MENU_GROUPS, type MenuAction, type MenuGroup, groupOfPanel } from './menu';
import { store } from './store';

function runAction(a: MenuAction): void {
  store.navMenu.value = null;
  switch (a.kind) {
    case 'panel':
      app.togglePanel(a.panel);
      break;
    case 'build':
      app.toggleBuildBar();
      break;
    case 'settings':
      store.settingsOpen.value = true;
      break;
    case 'save':
      app.save();
      break;
    case 'pause':
      app.openPauseMenu();
      break;
    case 'autopilot':
      if (app.sim) app.sim.command({ type: 'setAutopilot', on: !app.sim.autopilot });
      break;
    case 'mainMenu':
      app.toMenu();
      break;
    default:
      break;
  }
}

/** Alt menü çubuğu: 5 kategori; çok öğeli kategoriler yukarı açılır liste gösterir. */
export function BottomNav() {
  store.lang.value;
  const open = store.navMenu.value;
  const panel = store.panel.value;
  const activeGroup = groupOfPanel(panel);

  // Dışarı tıklayınca açık listeyi kapat (tuval tıklamaları dahil).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('.bottom-nav')) return;
      store.navMenu.value = null;
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const isActive = (g: MenuGroup): boolean => {
    if (g.id === 'build') return store.buildBar.value;
    return activeGroup === g.id;
  };
  const badge = (g: MenuGroup): string => {
    if (g.id !== 'shelter') return '';
    if (store.adoptersWaiting.value > 0) return String(store.adoptersWaiting.value);
    return store.adoptionsOpen.value ? '' : '!';
  };
  const title = (g: MenuGroup): string => {
    if (g.items.length === 1) return g.key ? `${t(g.label)} (${g.key})` : t(g.label);
    return g.items.map((i) => (i.key ? `${t(i.label)} (${i.key})` : t(i.label))).join(' · ');
  };

  return (
    <div class="bottom-nav panel">
      {MENU_GROUPS.map((g) => (
        <div key={g.id} class="nav-slot">
          {open === g.id && g.items.length > 1 && (
            <div class="nav-menu panel">
              {g.items.map((i) => (
                <button
                  key={i.id}
                  class={'nav-menu-item' + (i.action.kind === 'panel' && i.action.panel === panel ? ' active' : '')}
                  onClick={() => runAction(i.action)}
                >
                  <span class="nmi-icon">{i.icon}</span>
                  <span class="nmi-label">{t(i.label)}</span>
                  {i.key && <span class="nmi-key">{i.key}</span>}
                </button>
              ))}
            </div>
          )}
          <button
            class={'nav-item' + (isActive(g) || open === g.id ? ' active' : '')}
            title={title(g)}
            onClick={(e) => {
              (e.currentTarget as HTMLButtonElement).blur();
              if (g.items.length === 1) runAction(g.items[0].action);
              else store.navMenu.value = open === g.id ? null : g.id;
            }}
          >
            <span class="nav-icon">{g.icon}</span>
            <span class="nav-label">{t(g.label)}</span>
            {badge(g) !== '' && <span class="nav-badge">{badge(g)}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
