// Restarting the app after a colour change. On an iPhone home-screen app, iOS draws the status bar (time, Wi-Fi)
// itself and only reads its colour when the app starts, so a new theme or background only reaches it after a restart.
import { getData, getState, isPersisting, saveNow, setUI } from './store';
import { holdVeil } from '../ui/ArrivalVeil';
import type { Data, Tab, UI } from './types';

const RETURN_KEY = 'pockets-return';

/** Running as an app from the home screen (not in a Safari tab, not on a computer). */
export const isHomeScreenApp = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** What the status bar's colour depends on: light/dark/system and the background colours. */
export const lookOf = (d: Data) => JSON.stringify([d.settings.theme ?? 'system', d.settings.bg ?? {}]);

/** Saves everything, shows the loading screen and reloads, coming back to the same tab. */
export async function restartApp(text = 'Updating your colors…') {
  if (!isPersisting()) return; // the practice tour isn't saved, so a restart would lose it
  const { tab, page } = getState().ui;
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ tab, page: page ?? null })); } catch { /* comes back on Home */ }
  holdVeil(text);
  await saveNow();
  location.reload();
}

/** After a restart: go back to where you were. Called once at start-up. */
export function returnAfterRestart() {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return;
    sessionStorage.removeItem(RETURN_KEY);
    const r = JSON.parse(raw) as { tab?: Tab; page?: UI['page'] };
    if (r.tab) setUI({ tab: r.tab, page: r.page ?? null });
  } catch { /* nothing to restore */ }
}

/** Remembers the look when Profile opens; when it closes with a different look, restarts (home-screen app only). */
export function restartIfLookChanged(start: string) {
  if (!isHomeScreenApp() || lookOf(getData()) === start) return;
  // Only once Profile is really closed, not when it hands over to another sheet.
  setTimeout(() => { if (!getState().ui.sheet) restartApp(); }, 0);
}
