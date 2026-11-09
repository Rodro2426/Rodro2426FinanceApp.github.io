import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getState, loadData, setUI } from './lib/store';
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
  openFromLink();
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});

/**
 * Links that open a sheet right away, for iPhone Shortcuts (Control Center, Action button) and the icon menu:
 * ./?add=expense or ./?add=income. The part after ? is removed so a reload doesn't open it again.
 */
function openFromLink() {
  const q = new URLSearchParams(location.search), add = q.get('add');
  if (!add) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if ((add === 'expense' || add === 'income') && !getState().ui.welcome) setUI({ sheet: { name: 'add', mode: add } });
}
