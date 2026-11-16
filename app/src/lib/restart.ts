// Restarting the app after a colour change. On an iPhone home-screen app, iOS draws the status bar (time, Wi-Fi)
// itself and only reads its colour when the app starts, so a new theme or background only reaches it after a restart.
import { getData, getState, isPersisting, saveNow, setUI } from './store';
import { holdVeil } from '../ui/ArrivalVeil';
import { tr } from './i18n';
import type { Data, Tab, UI } from './types';

const RETURN_KEY = 'pockets-return';

/** Running as an app from the home screen (not in a Safari tab, not on a computer). */
export const isHomeScreenApp = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** What the status bar's colour depends on: light/dark/system and the background colours. */
export const lookOf = (d: Data) => JSON.stringify([d.settings.theme ?? 'system', d.settings.bg ?? {}]);

/** Saves everything, shows the loading screen and reloads, coming back to the same tab (and to Profile, if it was open). */
export async function restartApp(text = 'Updating your colors…') {
  if (!isPersisting()) return; // the practice tour isn't saved, so a restart would lose it
  const { tab, page, sheet } = getState().ui;
  const panel = document.querySelector('.sheet-panel');
  const back = { tab, page: page ?? null, settings: sheet?.name === 'settings', scroll: panel ? panel.scrollTop : 0, text: tr(text) };
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(back)); } catch { /* comes back on Home */ }
  holdVeil(text);
  await saveNow();
  location.reload();
}

/** Where Profile was scrolled to before a restart (read once by Profile when it opens again). */
let scrollBack = 0;
export const takeScrollBack = () => { const v = scrollBack; scrollBack = 0; return v; };

/** After a restart: go back to where you were. Called once at start-up. */
export function returnAfterRestart() {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return;
    sessionStorage.removeItem(RETURN_KEY);
    const r = JSON.parse(raw) as { tab?: Tab; page?: UI['page']; settings?: boolean; scroll?: number; text?: string };
    // Same loading screen and message as before the restart, so nothing flashes.
    if (r.text) holdVeil(r.text);
    if (r.tab) setUI({ tab: r.tab, page: r.page ?? null });
    if (r.settings) { scrollBack = r.scroll ?? 0; setUI({ sheet: { name: 'settings' } }); }
  } catch { /* nothing to restore */ }
}

/** A colour change in Profile: restart shortly after the last change (home-screen app only), so trying several
 *  colours in a row restarts once. Back in Profile, at the same place, after the restart. */
let timer: ReturnType<typeof setTimeout> | undefined;
export function restartSoon(start: string) {
  clearTimeout(timer);
  if (!isHomeScreenApp() || lookOf(getData()) === start) return;
  timer = setTimeout(() => restartApp(), 900);
}
