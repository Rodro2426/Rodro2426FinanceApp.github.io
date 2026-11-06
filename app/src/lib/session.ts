// Log out: back up the last changes, stop this device's notifications, sign out and clear this device, so the next
// person (or your other account) starts clean. Your data stays safe in your account and comes back when you sign in.
import { del } from 'idb-keyval';
import { flushNow, logOut } from './cloud';
import { disablePush, pushOn } from './push';
import { removePushSub } from './social';

/** 'unsynced' when some changes couldn't be backed up (nothing is done unless `anyway`). */
export async function logOutAndClear(anyway = false): Promise<'unsynced' | 'done'> {
  const safe = await flushNow().catch(() => false);
  if (!safe && !anyway) return 'unsynced';
  if (pushOn()) await disablePush(removePushSub).catch(() => {});
  await logOut().catch(() => {});
  await del('pockets-data-v1').catch(() => {});
  try {
    // Everything Pockets keeps on this device (read markers, sync state, theme, background…), except "install guide skipped".
    Object.keys(localStorage).filter(k => k.startsWith('pockets-') && k !== 'pockets-install-skipped').forEach(k => localStorage.removeItem(k));
  } catch { /* nothing stored */ }
  location.replace(location.pathname);
  return 'done';
}
