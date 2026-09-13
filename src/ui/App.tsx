import { BuildBar } from './BuildBar';
import { DogList } from './DogList';
import { DogPanel } from './DogPanel';
import { Backpack, EggPanel, IncubatorPanel } from './EggPanels';
import { AdoptionDesk, FinancePanel, OfficePanel, WeeklyReport } from './EconomyPanels';
import { DeploymentPanel, StaffPanel } from './StaffPanels';
import { SettingsPanel } from './SettingsPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { Guide } from './Guide';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { AlertsPanel, KennelPanel, ShedPanel } from './Panels';
import { PauseMenu } from './PauseMenu';
import { Toolbar } from './Toolbar';
import { store } from './store';

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
          <Toolbar />
          <Backpack />
          <Guide />
          <BuildBar />
          <AlertsPanel />
          {panel === 'dog' && <DogPanel />}
          {panel === 'dogs' && <DogList />}
          {panel === 'shed' && <ShedPanel />}
          {panel === 'kennel' && <KennelPanel />}
          {panel === 'incubator' && <IncubatorPanel />}
          {panel === 'egg' && <EggPanel />}
          {panel === 'office' && <OfficePanel />}
          {panel === 'adoption' && <AdoptionDesk />}
          {panel === 'finance' && <FinancePanel />}
          {panel === 'staff' && <StaffPanel />}
          {panel === 'deployment' && <DeploymentPanel />}
          {panel === 'achievements' && <AchievementsPanel />}
          {store.report.value && <WeeklyReport />}
          {store.pauseMenu.value && <PauseMenu />}
        </>
      )}
      {store.settingsOpen.value && <SettingsPanel />}
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
