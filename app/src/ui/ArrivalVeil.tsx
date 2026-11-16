// Opening the app, or arriving from the website: a calm loading screen that stays over the app until it has settled
// (account data in, fonts and photos loaded, first cloud sync done), then fades out. Without it the
// first second shows photos popping in, numbers changing and banners sliding in.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../lib/store';
import { firstSync, getSync, subscribeSync } from '../lib/cloud';

let held = false;
let label = 'Bringing back your data…';
const subs = new Set<() => void>();
const tell = () => subs.forEach(f => f());
export const holdVeil = (text: string) => { held = true; label = text; tell(); };
export const dropVeil = () => { held = false; tell(); };
/** Called once at start-up when the app opens on saved data: cover it until the cloud copy is in. */
export const holdOnOpen = () => { held = true; label = ''; };

const MIN_MS = 450, MAX_MS = 3000, FADE_MS = 260;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const imagesLoaded = () => Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); })));
const syncIdle = () => new Promise<void>(r => {
  if (getSync().status !== 'syncing') return r();
  const stop = subscribeSync(() => { if (getSync().status !== 'syncing') { stop(); r(); } });
});

/** The logo and one line, on the page colour. Also used by the welcome screen while it waits. */
// On the body itself, so no layout rule (like the computer's side panel) can squeeze it: it always fills the window.
export function ArrivalScreen({ text, fading }: { text: string; fading?: boolean }) {
  return createPortal(
    <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms var(--ease-out)`, pointerEvents: fading ? 'none' : 'auto' }}>
      <img className="arrive-mark" src="./pockets-mark.svg" alt="" width={64} height={64} />
      {text && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-600)' }}>{text}</span>}
    </div>,
    document.body
  );
}

export function ArrivalVeil() {
  const { ui } = useApp();
  const [on, setOn] = useState(held);
  const [fading, setFading] = useState(false);
  useEffect(() => { const f = () => setOn(held); subs.add(f); f(); return () => { subs.delete(f); }; }, []);
  const open = on && !ui.welcome;
  useEffect(() => {
    if (!open) return;
    let live = true;
    const settled = (async () => { await wait(MIN_MS); await firstSync; await document.fonts?.ready; await frame(); await imagesLoaded(); await syncIdle(); await frame(); })();
    Promise.race([settled, wait(MAX_MS)]).then(async () => {
      if (!live) return;
      setFading(true); await wait(FADE_MS);
      if (!live) return;
      held = false; setOn(false); setFading(false);
    });
    return () => { live = false; };
  }, [open]);
  return on ? <ArrivalScreen text={label} fading={fading} /> : null;
}
