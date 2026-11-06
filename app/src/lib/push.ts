// Lock-screen notifications. Firebase keeps the data; a small Cloudflare Worker (cloudflare/pockets-push.js)
// delivers the notifications. Each phone that turns them on gets a "notification address" from Apple (or Google,
// Mozilla), saved in the person's profile so the Worker knows where to deliver.
import { auth } from './cloud';
import type { Data } from './types';
import { upcomingReminders } from './reminders';

/** The Worker's address (set once it's deployed). Empty = lock-screen notifications aren't available yet. */
export const PUSH_URL: string = '';
/** Public half of the notification signing key; the private half is a secret in the Worker. */
export const VAPID_PUBLIC = 'BOnlN8on5VmeBKs8p-PcRBYxolX2PY79zaTJyVK979ram_9HJZFDwyLXnlmCdQxdffONf0jv8pEuJRweJck9Tw4';

const ON = 'pockets-push', DEVICE = 'pockets-device', SCHED = 'pockets-push-sched';
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not saved */ } }, del: (k: string) => { try { localStorage.removeItem(k); } catch { /* none */ } } };
export const deviceId = () => { let id = ls.get(DEVICE); if (!id) { id = Math.random().toString(36).slice(2, 12); ls.set(DEVICE, id); } return id; };

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
/** ok: can turn on. install: on iPhone, only from the home-screen app. old: this browser/iOS can't. off: not set up yet. */
export function pushSupport(): 'ok' | 'install' | 'old' | 'off' {
  if (!PUSH_URL) return 'off';
  if (isIOS() && !standalone()) return 'install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'old';
  return 'ok';
}
export const pushOn = () => ls.get(ON) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';

/** Registers the background script that shows notifications (harmless if notifications stay off). */
export function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

const b64u = (s: string) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function subscription(create: boolean) {
  const reg = await navigator.serviceWorker.ready;
  const have = await reg.pushManager.getSubscription();
  if (have || !create) return have;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC) });
}

/** Asks permission (must come from a tap), subscribes this phone and saves its address. null = done, else a message. */
export async function enablePush(save: (device: string, sub: string) => Promise<void>, d: Data): Promise<string | null> {
  const s = pushSupport();
  if (s === 'off') return 'Lock-screen notifications aren\'t set up yet.';
  if (s === 'install') return 'On iPhone, open Pockets from its home-screen icon to turn on notifications.';
  if (s === 'old') return 'This browser can\'t show notifications. On iPhone you need iOS 16.4 or newer.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'Notifications are blocked. Turn them on in Settings > Notifications > Pockets.' : 'Notifications were not allowed.';
  try {
    const sub = await subscription(true);
    if (!sub) return 'Couldn\'t turn on notifications.';
    await save(deviceId(), JSON.stringify(sub.toJSON()));
    ls.set(ON, '1'); ls.del(SCHED);
    await syncReminders(d, true);
    return null;
  } catch (e) { return (e as Error).message || 'Couldn\'t turn on notifications.'; }
}

export async function disablePush(remove: (device: string) => Promise<void>) {
  ls.del(ON);
  try { await post('/schedule', { device: deviceId(), sub: (await subscription(false))?.toJSON(), items: [] }); } catch { /* fine */ }
  try { const sub = await subscription(false); await sub?.unsubscribe(); } catch { /* fine */ }
  await remove(deviceId()).catch(() => {});
  ls.del(SCHED);
}

async function post(path: string, body: unknown) {
  const token = await auth.currentUser?.getIdToken();
  if (!PUSH_URL || !token) return null;
  const r = await fetch(PUSH_URL.replace(/\/$/, '') + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok ? r.json() : null;
}

/** Tells the other people in a trip or conversation (only those with notifications on get anything). */
export function notifyThread(thread: string, n: { title: string; body: string; url: string; tag: string }) {
  if (!PUSH_URL) return;
  post('/notify', { thread, ...n }).catch(() => { /* in-app notifications still cover it */ });
}

/** Sends this phone's upcoming reminders to the server when they change. */
export async function syncReminders(d: Data, force = false) {
  if (!PUSH_URL || !pushOn() || !auth.currentUser) return;
  const items = upcomingReminders(d);
  const sig = JSON.stringify(items.map(i => [i.at, i.tag, i.body]));
  if (!force && ls.get(SCHED) === sig) return;
  const sub = await subscription(false).catch(() => null);
  if (!sub) return;
  const r = await post('/schedule', { device: deviceId(), sub: sub.toJSON(), items }).catch(() => null);
  if (r?.saved) ls.set(SCHED, sig);
}
