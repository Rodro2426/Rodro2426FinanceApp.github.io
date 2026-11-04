// Home-screen apps on iPhone can keep an old copy of the page. On open and whenever
// the app comes back to the foreground, ask the server for the current build and,
// if it's newer, reload from a fresh URL so the new version loads.

export async function checkForUpdate() {
  if (import.meta.env.DEV) return;
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { id } = await r.json();
    if (!id || id === __BUILD_ID__) return;
    const key = 'reloaded-for-' + id;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* private mode */ }
    const url = new URL(location.href);
    url.searchParams.set('v', id);
    location.replace(url.toString());
  } catch { /* offline: keep the current version */ }
}

export function watchForUpdates() {
  checkForUpdate();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
}
