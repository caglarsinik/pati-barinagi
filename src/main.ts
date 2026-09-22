import { h, render } from 'preact';
import { app } from './app';
import { registerPwa } from './pwa';
import { type TouchDebug, createTouchDebug, debugEnabled } from './debug/touchDebug';
import { App } from './ui/App';
import './ui/ui.css';
import './ui/layout.css';
import './ui/responsive.css';

window.addEventListener('error', (e) => {
  console.error('[hata]', e.message, e.error?.stack ?? '');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[promise hatası]', e.reason?.stack ?? String(e.reason));
});

app.init('game');
registerPwa();
// Konsoldan ve otomatik testlerden erişim için; ?debug=1 ile dokunma test kancası (__pati.debug) da bağlanır.
const handle = app as typeof app & { debug?: TouchDebug };
if (debugEnabled(location.search)) handle.debug = createTouchDebug(app);
(window as unknown as { __pati: typeof handle }).__pati = handle;
const root = document.getElementById('ui');
if (!root) throw new Error('#ui bulunamadı');
render(h(App, null), root);
