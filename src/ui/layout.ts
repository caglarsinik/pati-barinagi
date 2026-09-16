/**
 * Yerleşim kuralları (saf, test edilebilir): cihaz sınıfı eşikleri ve alt rıhtım genişlik bütçesi.
 * CSS medya sorguları (responsive.css) aynı eşikleri kullanır; ölçüler layout.css/responsive.css ile eşleşmeli
 * (kutu modeli border-box: bildirilen boyut = görünen boyut).
 */
export type Layout = 'desktop' | 'tablet' | 'phone';

/** telefon = genişlik ≤ 767 ya da yükseklik ≤ 500 (yatay telefon); tablet = genişlik ≤ 1023. */
export function classifyLayout(w: number, h: number): Layout {
  if (w <= 767 || h <= 500) return 'phone';
  if (w <= 1023) return 'tablet';
  return 'desktop';
}

export interface HudSizes {
  /** Rıhtım kenar boşluğu ve yuvalar arası boşluk (--gap). */
  gap: number;
  /** Alt menü öğesi genişliği ve daraltılabildiği en küçük genişlik. */
  navItem: number;
  navItemMin: number;
  navGap: number;
  navPad: number;
  /** Sol yuva: araç çubuğu (6 araç) ya da telefonda tek araç düğmesi. */
  toolBtn: number;
  toolGap: number;
  toolPad: number;
  tools: number;
  /** Sağ yuva: E düğmesi (dokunmatik) ya da mini harita. */
  action: number;
  minimap: number;
}

const NAV_COUNT = 5;

/** Ölçüler layout.css / responsive.css ile birebir; değişirse layout.test kırılır. */
export function hudSizes(layout: Layout, touch: boolean): HudSizes {
  if (layout === 'phone') {
    return { gap: 6, navItem: touch ? 50 : 46, navItemMin: 36, navGap: 6, navPad: 6, toolBtn: 48, toolGap: 0, toolPad: 0, tools: 1, action: touch ? 64 : 0, minimap: 0 };
  }
  const minimap = layout === 'tablet' ? 124 + 8 + 4 : 160 + 8 + 4;
  return {
    gap: layout === 'tablet' ? 8 : 12,
    navItem: touch ? 66 : 62,
    navItemMin: 44,
    navGap: 6,
    navPad: 6,
    toolBtn: touch ? 48 : 44,
    toolGap: 4,
    toolPad: 8,
    tools: 6,
    action: touch ? 76 : 0,
    minimap,
  };
}

/** Alt rıhtımın en dar durumda istediği genişlik (sol yuva + orta yuvanın en küçüğü + sağ yuva + boşluklar). */
export function dockMinWidth(layout: Layout, touch: boolean): number {
  const s = hudSizes(layout, touch);
  const panelBorder = 4; // .panel 2 px kenarlık × 2
  const left = s.tools === 1 ? s.toolBtn : s.tools * s.toolBtn + (s.tools - 1) * s.toolGap + 2 * s.toolPad + panelBorder;
  const centerMin = NAV_COUNT * s.navItemMin + (NAV_COUNT - 1) * s.navGap + 2 * s.navPad + panelBorder;
  const right = Math.max(s.action, s.minimap);
  const slots = [left, centerMin, right].filter((x) => x > 0);
  return slots.reduce((a, b) => a + b, 0) + (slots.length - 1) * s.gap + 2 * s.gap;
}

/** Rıhtım bu genişlikte yuvaları daraltmadan/çakıştırmadan sığar mı. */
export function dockFits(w: number, layout: Layout, touch: boolean): boolean {
  return dockMinWidth(layout, touch) <= w;
}
