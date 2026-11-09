// Talks to the quick-add inbox on the Pockets Worker: uploads the pocket list for the Shortcut and collects what the
// Shortcut sent. Offline or Worker errors are ignored; the next open tries again.
import { PUSH_URL } from './push';
import { auth } from './cloud';
import { getData, setData, flash } from './store';
import { getLang } from './i18n';
import { importInbox, quickMenu, type InboxItem } from './quickadd';

export const quickUrl = (key: string, action: 'menu' | 'add' | 'items' | 'ack' | 'off') => `${PUSH_URL}/q/${key}/${action}`;

const post = (url: string, body: unknown, token?: string) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
});
const SENT = 'pockets-qmenu';

/**
 * Uploads the pocket/account/category lists when they changed since the last upload (or when `force`).
 * It needs the Pockets sign-in: the Worker only creates an inbox for a signed-in person. Returns true when saved.
 */
export async function pushQuickMenu(force = false): Promise<boolean> {
  const key = getData().settings.quickAdd?.key;
  if (!key) return false;
  const menu = quickMenu(getData(), getLang()), mark = key + JSON.stringify(menu);
  let last = ''; try { last = localStorage.getItem(SENT) ?? ''; } catch { /* none */ }
  if (!force && last === mark) return true;
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  if (!token) return false;
  try {
    const r = await post(quickUrl(key, 'menu'), menu, token);
    const ok = r.ok && !!(await r.json()).saved;
    if (ok) try { localStorage.setItem(SENT, mark); } catch { /* not saved */ }
    return ok;
  } catch { return false; }
}

let busy = false, lastPull = 0;
/** Collects the inbox (at most every 10 seconds unless `now`), saves the expenses and empties it. Returns how many were added. */
export async function pullQuickInbox(now = false): Promise<number> {
  const key = getData().settings.quickAdd?.key;
  if (!key || busy || (!now && Date.now() - lastPull < 10_000)) return 0;
  busy = true; lastPull = Date.now();
  try {
    const r = await fetch(quickUrl(key, 'items'));
    if (!r.ok) return 0;
    const items = ((await r.json()).items ?? []) as InboxItem[];
    if (!items.length) return 0;
    const { patch, added } = importInbox(getData(), items);
    if (patch) setData(patch);
    await post(quickUrl(key, 'ack'), { ids: items.map(i => i.id) });
    if (added.length) flash(added.length === 1 ? 'Added 1 expense from your Shortcut' : `Added ${added.length} expenses from your Shortcut`);
    return added.length;
  } catch { return 0; } finally { busy = false; }
}

/** Turns quick add off: empties the inbox and forgets the list on the Worker. */
export async function quickAddOff(key: string) {
  try { await post(quickUrl(key, 'off'), {}); } catch { /* offline: the inbox expires on its own */ }
  try { localStorage.removeItem(SENT); } catch { /* none */ }
}
