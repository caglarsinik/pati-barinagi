import { DogList } from './DogList';
import { EggPanel, IncubatorPanel } from './EggPanels';
import { NurseryPanel } from './NurseryPanel';
import { AdoptionDesk, FinancePanel, OfficePanel, WeeklyReport } from './EconomyPanels';
import { DeploymentPanel, StaffPanel } from './StaffPanels';
import { SettingsPanel } from './SettingsPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { GameOverPanel } from './GameOverPanel';
import { VictoryPanel } from './VictoryPanel';
import { HelpSheet } from './HelpSheet';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { KennelPanel, ShedPanel } from './Panels';
import { AlertsSheet, BackpackSheet, MapSheet } from './PhoneSheets';
import { t } from '../i18n';
import { PauseMenu } from './PauseMenu';
import { store } from './store';
import { ComputerPanel } from './ComputerPanel';
import { FurniturePanel } from './FurniturePanel';
import { AutoOrderPanel } from './AutoOrderPanel';
import { ClinicPanel } from './ClinicPanel';
import { WholesalePanel } from './WholesalePanel';
import { GoalsPanel } from './GoalsPanel';
import { MorningPanel } from './MorningPanel';
import { ToyShopPanel } from './ToyShopPanel';
import { MarketPanel } from './MarketPanel';
import { TravelPanel } from './TravelPanel';
import { QuestPanel } from './QuestPanel';
import { MailPanel } from './MailPanel';
import { AlbumPanel } from './AlbumPanel';

export function App() {
  store.lang.value;
  const screen = store.screen.value;
  const panel = store.panel.value;
  return (
    <>
      {screen === 'menu' ? (
        <MainMenu />
      ) : (
        <>
          <HUD />
          {panel === 'dogs' && <DogList />}
          {panel === 'shed' && <ShedPanel />}
          {panel === 'kennel' && <KennelPanel />}
          {panel === 'incubator' && <IncubatorPanel />}
          {panel === 'nursery' && <NurseryPanel />}
          {panel === 'egg' && <EggPanel />}
          {panel === 'office' && <OfficePanel />}
          {panel === 'adoption' && <AdoptionDesk />}
          {panel === 'finance' && <FinancePanel />}
          {panel === 'staff' && <StaffPanel />}
          {panel === 'deployment' && <DeploymentPanel />}
          {panel === 'achievements' && <AchievementsPanel />}
          {panel === 'help' && <HelpSheet />}
          {panel === 'alerts' && <AlertsSheet />}
          {panel === 'backpack' && <BackpackSheet />}
          {panel === 'map' && <MapSheet />}
          {panel === 'computer' && <ComputerPanel />}
          {panel === 'furniture' && <FurniturePanel />}
          {panel === 'autoOrder' && <AutoOrderPanel />}
          {panel === 'clinic' && <ClinicPanel />}
          {panel === 'wholesale' && <WholesalePanel />}
          {panel === 'goals' && <GoalsPanel />}
          {panel === 'morning' && <MorningPanel />}
          {panel === 'toyShop' && <ToyShopPanel />}
          {panel === 'market' && <MarketPanel />}
          {panel === 'travel' && <TravelPanel />}
          {panel === 'quests' && <QuestPanel />}
          {panel === 'mail' && <MailPanel />}
          {panel === 'album' && <AlbumPanel />}
          {store.report.value && <WeeklyReport />}
          {store.pauseMenu.value && <PauseMenu />}
          {store.gameOver.value && <GameOverPanel />}
          {store.victory.value && !store.victorySeen.value && !store.gameOver.value && <VictoryPanel />}
        </>
      )}
      {store.settingsOpen.value && <SettingsPanel />}
      <div class="rotate-hint">
        <div class="rotate-icon">📱</div>
        <div>{t('Telefonu yatay çevir')}</div>
      </div>
      {store.toasts.value.length > 0 && (
        <div class="toasts">
          {store.toasts.value.map((x) => (
            <div key={x.id} class="toast panel">
              {x.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
