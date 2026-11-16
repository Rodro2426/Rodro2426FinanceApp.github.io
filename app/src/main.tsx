import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getState, loadData } from './lib/store';
import { holdOnOpen } from './ui/ArrivalVeil';
import { returnAfterRestart } from './lib/restart';
import { watchForUpdates } from './lib/update';
import './styles.css';
import { startTranslator } from './lib/i18n';

startTranslator();

// Keep the app sized to the visible area when the iPhone keyboard opens, and stop
// Safari from scrolling the whole page (which pushed sheets out of view).
const vv = window.visualViewport;
const syncViewport = () => {
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
  document.documentElement.classList.toggle('kb', !!vv && window.innerHeight - vv.height > 120);
  if (window.scrollY) window.scrollTo(0, 0);
};
vv?.addEventListener('resize', syncViewport);
vv?.addEventListener('scroll', syncViewport);
window.addEventListener('resize', syncViewport);
syncViewport();

watchForUpdates();

loadData().then(() => {
  if (!getState().ui.welcome) holdOnOpen();
  returnAfterRestart();
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});

