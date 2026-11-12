// The marketing website (/site/) is the front door for people who aren't using Pockets yet.
// - The app's main address sends a browser with no Pockets data there (except the installed Home Screen app,
//   automated tests, and links that ask for the app with ?app).
// - The website signs people in with the same Firebase account (same browser, so the app is signed in too) or lets
//   them pick sample data, then leaves a short note here and opens the app, which finishes the job on its
//   welcome screen. Nothing personal goes in the URL.
const KEY = 'pockets-handoff';
const MAX_AGE = 10 * 60 * 1000;

export type Handoff = { kind: 'signedin'; created: boolean; name: string } | { kind: 'sample' } | { kind: 'welcome' };

function read(): (Handoff & { at: number }) | null {
  try {
    const h = JSON.parse(localStorage.getItem(KEY) || 'null');
    return h && typeof h.at === 'number' && Date.now() - h.at < MAX_AGE ? h : null;
  } catch { return null; }
}
/** True when the website just handed over (so the app must not send the visitor back to it). */
export const hasHandoff = () => !!read();
/** Reads the note once and forgets it. */
export function takeHandoff(): Handoff | null {
  const h = read();
  try { localStorage.removeItem(KEY); } catch { /* nothing saved */ }
  return h;
}

/** Whether a browser with no Pockets data should see the website instead of the app's own welcome screen. */
export function shouldShowSite(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || navigator.webdriver || hasHandoff()) return false;
  return !new URLSearchParams(location.search).has('app');
}
/** Where the website lives (the dev server needs the file name). */
export const SITE_URL = import.meta.env.DEV ? './site/index.html' : './site/';
