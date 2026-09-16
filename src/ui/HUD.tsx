import { useEffect, useRef } from 'preact/hooks';
import { canRotate } from '../sim/entities/Building';
import { DogPanel } from './DogPanel';
import { Backpack } from './EggPanels';
import { Guide } from './Guide';
import { BuildBar } from './BuildBar';
import { BottomNav } from './BottomNav';
import { Minimap } from './Minimap';
import { AlertsPanel } from './Panels';
import { Toolbar } from './Toolbar';
import { ToolPopover } from './ToolPopover';
import { TopBar } from './TopBar';
import { TouchControls } from './TouchControls';
import { app } from '../app';
import { t } from '../i18n';
import { store, rotateBuildTool } from './store';

export { formatMoney } from './format';

/** Üst şerit ve alt rıhtımın gerçek yüksekliklerini #ui üzerinde --top-h / --dock-h olarak yazar (sütunlar buna göre biter). */
function useMeasuredBands(dockRef: { current: HTMLDivElement | null }): void {
  useEffect(() => {
    const root = document.getElementById('ui');
    const dock = dockRef.current;
    const top = document.querySelector<HTMLElement>('.topbar');
    if (!root || !dock || typeof ResizeObserver === 'undefined') return;
    const apply = (): void => {
      root.style.setProperty('--dock-h', `${Math.ceil(dock.getBoundingClientRect().height)}px`);
      if (top) root.style.setProperty('--top-h', `${Math.ceil(top.getBoundingClientRect().height)}px`);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(dock);
    if (top) ro.observe(top);
    apply();
    return () => {
      ro.disconnect();
      root.style.removeProperty('--dock-h');
      root.style.removeProperty('--top-h');
    };
  }, [dockRef]);
}

/**
 * Oyun içi iskelet: üst durum şeridi, sol sütun (çanta, rehber), sağ sütun (uyarılar, köpek paneli) ve alt rıhtım.
 * Rıhtım tek bir flex satırıdır: sol yuva araç çubuğu (telefonda tek düğme), orta yuva inşa çubuğu + ipucu + alt menü,
 * sağ yuva dokunmatik E/Koş ve mini harita. Flex kardeşler üst üste binemez; dar ekranda orta yuva daralır.
 */
export function HUD() {
  store.lang.value;
  const panel = store.panel.value;
  const phone = store.layout.value === 'phone';
  const mode = store.mode.value;
  const build = store.build.value;
  const touch = store.touch.value;
  const hint = store.hint.value;
  // Telefonda avatar modunda ipucu E düğmesinin üstünde zaten yazıyor; yalnız araç seçiliyken (yönetim) satır gösterilir.
  const showHint = hint !== '' && !(phone && mode === 'avatar' && build.kind === 'none');
  const dockRef = useRef<HTMLDivElement>(null);
  useMeasuredBands(dockRef);
  return (
    <>
      <TopBar />
      <div class="col-left">
        <Backpack />
        <Guide />
      </div>
      <div class="col-right">
        <AlertsPanel />
        {panel === 'dog' && <DogPanel />}
      </div>
      <div class="hud-dock" ref={dockRef}>
        <div class="dock-left">{mode === 'avatar' && (phone ? <ToolPopover /> : <Toolbar />)}</div>
        <div class="dock-center">
          <BuildBar />
          {showHint && (
            <div class="hud-bottom panel hint">
              {hint}
              {touch && build.kind === 'building' && canRotate(build.type) && (
                <button class="chip-btn hint-cancel" onClick={() => rotateBuildTool()}>
                  {t('Döndür')}
                </button>
              )}
              {touch && build.kind !== 'none' && (
                <button class="chip-btn hint-cancel" onClick={() => app.setBuildTool({ kind: 'none' })}>
                  {t('İptal')}
                </button>
              )}
            </div>
          )}
          <BottomNav />
        </div>
        <div class="dock-right">
          <TouchControls />
          <Minimap />
        </div>
      </div>
    </>
  );
}
