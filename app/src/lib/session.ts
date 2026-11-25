// Log out: back up the last changes, stop this device's notifications, sign out and clear this device, so the next
// person (or your other account) starts clean. Your data stays safe in your account and comes back when you sign in.
// Delete account: the same clearing, after removing the account and its cloud data for good.
import { del } from 'idb-keyval';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore/lite';
import { db, deleteAccount, flushNow, logOut } from './cloud';
import { disablePush, pushOn } from './push';
import { removePushSub } from './social';

/** Clears everything Pockets keeps on this device and starts the app again. */
async function clearDevice(search = '') {
  await del('pockets-data-v1').catch(() => {});
  try {
    // Everything Pockets keeps on this device (read markers, sync state, theme, background…), except "install guide skipped".
    Object.keys(localStorage).filter(k => k.startsWith('pockets-') && k !== 'pockets-install-skipped').forEach(k => localStorage.removeItem(k));
  } catch { /* nothing stored */ }
  location.replace(location.pathname + search);
}

/** 'unsynced' when some changes couldn't be backed up (nothing is done unless `anyway`). */
export async function logOutAndClear(anyway = false): Promise<'unsynced' | 'done'> {
  const safe = await flushNow().catch(() => false);
  if (!safe && !anyway) return 'unsynced';
  if (pushOn()) await disablePush(removePushSub).catch(() => {});
  await logOut().catch(() => {});
  await clearDevice();
  return 'done';
}

/** Your synced copy, your friendships and your friend-search email; your profile keeps no name, email or photo.
 *  Trips, shared debts and messages stay: they are your friends' records too. */
async function wipeCloud(uid: string, email: string) {
  if (pushOn()) await disablePush(removePushSub).catch(() => {}); // stop this phone's notifications while the account still exists
  const chunks = await getDocs(collection(db, 'users', uid, 'chunks'));
  const b = writeBatch(db);
  chunks.docs.forEach(d => b.delete(d.ref));
  b.delete(doc(db, 'users', uid, 'meta', 'state'));
  await b.commit();
  const fr = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', uid)));
  await Promise.all(fr.docs.map(d => deleteDoc(d.ref)));
  if (email) await deleteDoc(doc(db, 'emails', email.trim().toLowerCase())).catch(() => {}); // only there once the email was confirmed
  // The rules let you replace your profile, not delete it: replacing drops the name, email, photo and notification addresses.
  await setDoc(doc(db, 'profiles', uid), { name: 'Deleted account', deleted: true, updatedAt: Date.now() });
}

/** Deletes the account and everything of yours in the cloud, then opens the app's welcome. Null password = Google. */
export async function deleteAccountAndClear(password: string | null): Promise<string | null> {
  const err = await deleteAccount(password, wipeCloud);
  if (err) return err;
  await clearDevice('?app'); // ?app: the app's own welcome, not the website
  return null;
}
