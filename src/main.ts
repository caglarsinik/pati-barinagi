import { h, render } from 'preact';
import { app } from './app';
import { App } from './ui/App';
import './ui/ui.css';
import './ui/layout.css';

window.addEventListener('error', (e) => {
  console.error('[hata]', e.message, e.error?.stack ?? '');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[promise hatası]', e.reason?.stack ?? String(e.reason));
});

app.init('game');
// Konsoldan ve otomatik testlerden erişim için.
(window as unknown as { __pati: typeof app }).__pati = app;
const root = document.getElementById('ui');
if (!root) throw new Error('#ui bulunamadı');
render(h(App, null), root);
