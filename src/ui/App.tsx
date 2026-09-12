import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { store } from './store';

export function App() {
  const screen = store.screen.value;
  return (
    <>
      {screen === 'menu' ? <MainMenu /> : <HUD />}
      {screen === 'game' && store.pauseMenu.value && <PauseMenu />}
      {store.toast.value && <div class="toast panel">{store.toast.value}</div>}
    </>
  );
}
