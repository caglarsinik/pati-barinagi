import { BuildBar } from './BuildBar';
import { DogList } from './DogList';
import { DogPanel } from './DogPanel';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { AlertsPanel, KennelPanel, ShedPanel } from './Panels';
import { PauseMenu } from './PauseMenu';
import { Toolbar } from './Toolbar';
import { store } from './store';

export function App() {
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
          <BuildBar />
          <AlertsPanel />
          {panel === 'dog' && <DogPanel />}
          {panel === 'dogs' && <DogList />}
          {panel === 'shed' && <ShedPanel />}
          {panel === 'kennel' && <KennelPanel />}
          {store.pauseMenu.value && <PauseMenu />}
        </>
      )}
      {store.toast.value && <div class="toast panel">{store.toast.value}</div>}
    </>
  );
}
