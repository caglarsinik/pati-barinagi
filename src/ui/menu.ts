import type { Panel } from './store';

/** Alt menü çubuğu, telefon menü sayfası ve yardım sayfası aynı tablodan beslenir. */
export type MenuAction =
  | { kind: 'panel'; panel: Panel }
  | { kind: 'build' }
  | { kind: 'settings' }
  | { kind: 'save' }
  | { kind: 'pause' }
  | { kind: 'mainMenu' };

export interface MenuItem {
  id: string;
  icon: string;
  /** Türkçe etiket; t() ile çevrilir. */
  label: string;
  key?: string;
  action: MenuAction;
}

export interface MenuGroup {
  id: string;
  icon: string;
  label: string;
  key?: string;
  /** Tek öğeli grup: kategori düğmesi doğrudan o öğeyi çalıştırır. */
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'shelter',
    icon: '🐕',
    label: 'Barınak',
    items: [
      { id: 'dogs', icon: '📋', label: 'Köpekler', key: 'I', action: { kind: 'panel', panel: 'dogs' } },
      { id: 'adoption', icon: '🧑', label: 'Sahiplendirme', key: 'O', action: { kind: 'panel', panel: 'adoption' } },
    ],
  },
  {
    id: 'manage',
    icon: '📊',
    label: 'Yönetim',
    items: [
      { id: 'finance', icon: '💰', label: 'Finans', key: 'N', action: { kind: 'panel', panel: 'finance' } },
      { id: 'staff', icon: '👷', label: 'Personel', key: 'P', action: { kind: 'panel', panel: 'staff' } },
      { id: 'deployment', icon: '🗓️', label: 'Görevlendirme', key: 'F', action: { kind: 'panel', panel: 'deployment' } },
    ],
  },
  {
    id: 'build',
    icon: '🏗️',
    label: 'İnşa',
    key: 'B',
    items: [{ id: 'build', icon: '🏗️', label: 'İnşa', key: 'B', action: { kind: 'build' } }],
  },
  {
    id: 'achievements',
    icon: '🏅',
    label: 'Başarımlar',
    key: 'H',
    items: [{ id: 'achievements', icon: '🏅', label: 'Başarımlar', key: 'H', action: { kind: 'panel', panel: 'achievements' } }],
  },
  {
    id: 'menu',
    icon: '☰',
    label: 'Menü',
    items: [
      { id: 'help', icon: '🎮', label: 'Kontroller', action: { kind: 'panel', panel: 'help' } },
      { id: 'settings', icon: '⚙️', label: 'Ayarlar', action: { kind: 'settings' } },
      { id: 'save', icon: '💾', label: 'Kaydet', action: { kind: 'save' } },
      { id: 'pause', icon: '⏸️', label: 'Duraklat', key: 'Esc', action: { kind: 'pause' } },
      { id: 'mainMenu', icon: '🏠', label: 'Kaydet ve ana menüye dön', action: { kind: 'mainMenu' } },
    ],
  },
];

/** Bir panelin hangi grupta olduğunu bulur (alt çubukta aktif vurgusu için). */
export function groupOfPanel(panel: Panel): string | null {
  for (const g of MENU_GROUPS) for (const i of g.items) if (i.action.kind === 'panel' && i.action.panel === panel) return g.id;
  return null;
}
