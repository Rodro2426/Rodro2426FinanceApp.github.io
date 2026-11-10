import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getData, loadData, setData } from './lib/store';
import type { Settings } from './lib/types';
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
  forgetQuickAdd();
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});

/**
 * Quick add from an iPhone Shortcut was removed. If this phone had it on, switch its inbox off on the Worker (so the
 * pocket names stored there go away) and forget the key. Safe to delete once everyone has opened the app once.
 */
type OldSettings = Settings & { quickAdd?: { key: string } };
function forgetQuickAdd() {
  const key = (getData().settings as OldSettings).quickAdd?.key;
  if (!key) return;
  fetch(`https://pockets-push.santi-health.workers.dev/q/${key}/off`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  setData(x => { const { quickAdd: _gone, ...settings } = x.settings as OldSettings; return { settings }; });
}
