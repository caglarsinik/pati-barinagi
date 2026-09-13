import { canRotate } from '../sim/entities/Building';
import { DogPanel } from './DogPanel';
import { Backpack } from './EggPanels';
import { Guide } from './Guide';
import { BuildBar } from './BuildBar';
import { BottomNav } from './BottomNav';
import { Minimap } from './Minimap';
import { AlertsPanel } from './Panels';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { TouchControls } from './TouchControls';
import { app } from '../app';
import { t } from '../i18n';
import { store, rotateBuildTool } from './store';

export { formatMoney } from './format';

/**
 * Oyun içi iskelet: üst durum şeridi, sol sütun (çanta, rehber), sağ sütun (uyarılar, köpek paneli),
 * alt şerit (araç çubuğu, inşa çubuğu, ipucu), alt menü çubuğu ve mini harita. Konumlar layout.css'te.
 */
export function HUD() {
  store.lang.value;
  const panel = store.panel.value;
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
      <Toolbar />
      <BuildBar />
      <div class="hud hud-bottom panel hint">
        {store.hint.value}
        {store.touch.value && store.build.value.kind === 'building' && canRotate(store.build.value.type) && (
          <button class="chip-btn hint-cancel" onClick={() => rotateBuildTool()}>
            {t('Döndür')}
          </button>
        )}
        {store.touch.value && store.build.value.kind !== 'none' && (
          <button class="chip-btn hint-cancel" onClick={() => app.setBuildTool({ kind: 'none' })}>
            {t('İptal')}
          </button>
        )}
      </div>
      <BottomNav />
      <TouchControls />
      <Minimap />
    </>
  );
}
