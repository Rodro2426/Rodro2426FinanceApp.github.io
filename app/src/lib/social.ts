// Friends and shared trips, stored in Firestore so every member sees the same thing.
//   profiles/{uid}            name + email (readable by signed-in people, by id only)
//   emails/{email}            -> { uid, name }  lets someone find you by exact email (only verified emails)
//   friendships/{a_b}         { users: [a, b], from, status: 'pending' | 'accepted', names }
//   trips/{tripId}            { name, emoji, owner, members: [uid], guests: [{id, name}], names }
//   trips/{tripId}/items/{id} expenses and payments (see settle.ts)
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore/lite';
import { auth, db } from './cloud';
import { notifyThread } from './push';
import { getData, setData, flash } from './store';
import { debtsOf, saveDebt } from './debts';
import { debtFromDoc, planDebtSync, type DebtDoc } from './debtShare';
import { fmtPlain } from './derive';
import { groupWideItems, relinkPerson, withMorePeople, type Member, type TripItem } from './settle';

export interface Friend { uid: string; name: string; email: string; status: 'pending' | 'accepted'; incoming: boolean; id: string }
export interface Trip { id: string; name: string; emoji: string; owner: string; members: string[]; guests: Member[]; names: Record<string, string>; createdAt: number; updatedAt: number }

const me = () => auth.currentUser;
/** Your name as friends see it: the name in your Profile, then your account's name, then your email's first part. */
const myName = () => {
  const own = getData().settings.name?.trim();
  return (own && own.toLowerCase() !== 'there' ? own : '') || me()?.displayName?.trim() || me()?.email?.split('@')[0] || 'Me';
};
export const pairId = (a: string, b: string) => [a, b].sort().join('_');
const clean = (e: string) => e.trim().toLowerCase();

/* ---------------- State shared with the screens ---------------- */
export interface Message {
  id: string; uid: string; name: string; text: string; createdAt: number;
  /** A photo: the small preview is here; the full photo is in trips/{id}/media/{media}. */
  img?: { thumb: string; w: number; h: number; media?: string; gif?: boolean };
  /** A GIF from GIPHY. */
  gif?: { url: string; w: number; h: number; big?: string };
}
interface SocialState { /** Debts friends sent you, waiting for Accept or Decline. */ debtRequests: DebtDoc[]; /** Direct-message conversations, newest first. */ dms: Dm[]; /** Friends' profile pictures (small), by account id; null = no picture. */ photos: Record<string, string | null>; friends: Friend[]; trips: Trip[]; items: Record<string, TripItem[]>; messages: Record<string, Message[]>; latest: Record<string, number>; loading: boolean; error: string | null; loadedAt: number }
let state: SocialState = { debtRequests: [], dms: [], photos: {}, friends: [], trips: [], items: {}, messages: {}, latest: {}, loading: false, error: null, loadedAt: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const getSocial = () => state;
export const subscribeSocial = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const setS = (p: Partial<SocialState>) => { state = { ...state, ...p }; emit(); };
const fail = (e: unknown) => {
  const msg = (e as { code?: string }).code === 'permission-denied' ? 'Firebase refused this. Check that the new security rules were published.' : (e as Error).message;
  setS({ loading: false, error: msg });
  return msg;
};

/* ---------------- Profile ---------------- */
/** Keeps your public profile up to date; your email becomes findable once it's confirmed. */
export async function ensureProfile(name?: string) {
  const u = me(); if (!u) return;
  const n = name?.trim() || myName();
  await setDoc(doc(db, 'profiles', u.uid), { name: n, email: clean(u.email ?? ''), updatedAt: Date.now() }, { merge: true });
  if (u.emailVerified && u.email) await setDoc(doc(db, 'emails', clean(u.email)), { uid: u.uid, name: n });
}

/* ---------------- Notification addresses ---------------- */
/** Saves this phone's notification address in your profile (one per device), so the server can deliver to it. */
export async function savePushSub(device: string, sub: string) {
  const u = me(); if (!u) throw new Error('Sign in first.');
  await setDoc(doc(db, 'profiles', u.uid), { push: { [device]: sub }, updatedAt: Date.now() }, { merge: true });
}
export async function removePushSub(device: string) {
  const u = me(); if (!u) return;
  await updateDoc(doc(db, 'profiles', u.uid), { [`push.${device}`]: deleteField() });
}

/* ---------------- Profile pictures ---------------- */
// Your picture is copied to your public profile as a small 160px image (about 10 KB) so friends can see it.
// Friends' pictures are fetched once per visit and kept in memory.
export async function publishPhoto(photo: string | null) {
  const u = me(); if (!u) return;
  let small: string | null = null;
  if (photo) {
    const { shrink } = await import('./chatMedia');
    const blob = await (await fetch(photo)).blob();
    small = (await shrink(blob, 160, 30_000)).data;
  }
  await setDoc(doc(db, 'profiles', u.uid), { photo: small, updatedAt: Date.now() }, { merge: true });
  setS({ photos: { ...state.photos, [u.uid]: small } });
}
const asked = new Set<string>();
/** Loads the pictures of these people (once per visit each). */
export async function loadPhotos(uids: string[]) {
  const want = [...new Set(uids)].filter(id => id && !id.startsWith('g:') && !asked.has(id));
  if (!want.length) return;
  want.forEach(id => asked.add(id));
  // A failed fetch (offline) keeps what's already here and is tried again next time.
  const got = await Promise.all(want.map(id => getDoc(doc(db, 'profiles', id)).then(d => [id, (d.exists() && (d.data().photo as string | null)) || null] as const).catch(() => { asked.delete(id); return null; })));
  const ok = got.filter((x): x is readonly [string, string | null] => !!x);
  if (ok.length) setS({ photos: { ...state.photos, ...Object.fromEntries(ok) } });
}

/* ---------------- Friends ---------------- */
export async function loadFriends() {
  const u = me(); if (!u) return;
  const snap = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', u.uid)));
  const friends: Friend[] = snap.docs.map(d => {
    const f = d.data() as { users: string[]; from: string; status: 'pending' | 'accepted'; names: Record<string, string>; emails?: Record<string, string> };
    const other = f.users.find(x => x !== u.uid) ?? '';
    return { id: d.id, uid: other, name: f.names?.[other] ?? 'Friend', email: f.emails?.[other] ?? '', status: f.status, incoming: f.from !== u.uid };
  }).sort((a, b) => a.name.localeCompare(b.name));
  setS({ friends });
}

/** Sends a friend request to whoever confirmed this email. */
export async function addFriendByEmail(email: string): Promise<string | null> {
  const u = me(); if (!u) return 'Sign in first.';
  const e = clean(email);
  if (!e.includes('@')) return 'That email doesn\'t look right.';
  if (e === clean(u.email ?? '')) return 'That\'s your own email.';
  try {
    const found = await getDoc(doc(db, 'emails', e));
    if (!found.exists()) return 'Nobody with that email uses Pockets yet (or they haven\'t confirmed their email). Ask them to create an account and tap the link in their confirmation email.';
    const { uid, name } = found.data() as { uid: string; name: string };
    const id = pairId(u.uid, uid), ref = doc(db, 'friendships', id);
    const existing = await getDoc(ref).catch(() => null);
    if (existing?.exists()) {
      const f = existing.data() as { status: string; from: string };
      if (f.status === 'accepted') return `${name} is already your friend.`;
      if (f.from === u.uid) return `You already sent ${name} a request.`;
      await updateDoc(ref, { status: 'accepted' }); await loadFriends(); return null; // they had asked you: accept
    }
    await setDoc(ref, { users: [u.uid, uid], from: u.uid, status: 'pending', names: { [u.uid]: myName(), [uid]: name }, emails: { [u.uid]: clean(u.email ?? ''), [uid]: e }, createdAt: Date.now() });
    await loadFriends();
    return null;
  } catch (err) { return fail(err); }
}
export async function acceptFriend(id: string) { try { await updateDoc(doc(db, 'friendships', id), { status: 'accepted' }); await loadFriends(); return null; } catch (e) { return fail(e); } }
export async function removeFriend(id: string) { try { await deleteDoc(doc(db, 'friendships', id)); await loadFriends(); return null; } catch (e) { return fail(e); } }

/* ---------------- Trips ---------------- */
export async function loadTrips() {
  const u = me(); if (!u) return;
  const snap = await getDocs(query(collection(db, 'trips'), where('members', 'array-contains', u.uid)));
  const trips = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) })).sort((a, b) => b.updatedAt - a.updatedAt);
  setS({ trips });
}
export async function loadItems(tripId: string) {
  const snap = await getDocs(collection(db, 'trips', tripId, 'items'));
  const items = snap.docs.map(d => ({ ...(d.data() as TripItem), id: d.id })).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt));
  setS({ items: { ...state.items, [tripId]: items } });
}
/** Friends, trips and every trip's items. */
export async function refreshSocial() {
  if (!me()) return;
  setS({ loading: true, error: null });
  try {
    await ensureProfile().catch(() => {});
    await Promise.all([loadFriends(), loadTrips()]);
    await loadDms().catch(() => {});
    await Promise.all(state.trips.map(t => Promise.all([loadItems(t.id), loadLatest(t.id).catch(() => {})])));
    setS({ loading: false, loadedAt: Date.now() });
    syncDebts().catch(() => {});
    loadPhotos([...state.friends.map(f => f.uid), ...state.trips.flatMap(t => t.members), ...state.dms.map(t => t.other)]).catch(() => {});
  } catch (e) { fail(e); }
}

export async function createTrip(name: string, emoji: string, friendUids: string[], guestNames: string[]): Promise<string | null> {
  const u = me(); if (!u) return null;
  const names: Record<string, string> = { [u.uid]: myName() };
  friendUids.forEach(id => { names[id] = state.friends.find(f => f.uid === id)?.name ?? 'Friend'; });
  const guests = guestNames.map(n => n.trim()).filter(Boolean).map((n, i) => ({ id: `g:${Date.now().toString(36)}${i}`, name: n }));
  try {
    const ref = await addDoc(collection(db, 'trips'), { name: name.trim(), emoji, owner: u.uid, members: [u.uid, ...friendUids], guests, names, createdAt: Date.now(), updatedAt: Date.now() });
    await loadTrips(); setS({ items: { ...state.items, [ref.id]: [] } });
    return ref.id;
  } catch (e) { fail(e); return null; }
}
export async function updateTrip(id: string, patch: Partial<Omit<Trip, 'id'>>) {
  try { await updateDoc(doc(db, 'trips', id), { ...patch, updatedAt: Date.now() }); await loadTrips(); return null; } catch (e) { return fail(e); }
}
/**
 * Adds friends and guests to a trip that already exists, and links guests to the friend's account when they join.
 * splitPast: the trip's whole-group equal expenses are split with the new people too.
 */
export async function addPeople(t: Trip, add: { friends: string[]; guests: string[]; links: Record<string, string>; splitPast: boolean }): Promise<string | null> {
  const fname = (id: string) => state.friends.find(f => f.uid === id)?.name ?? 'Friend';
  const linkTo = Object.entries(add.links).filter(([g, f]) => f && t.guests.some(x => x.id === g) && !t.members.includes(f));
  const friends = add.friends.filter(f => !t.members.includes(f) && !linkTo.some(([, x]) => x === f));
  const newGuests = add.guests.map(n => n.trim()).filter(Boolean).map((n, i) => ({ id: `g:${Date.now().toString(36)}${i}`, name: n }));
  const names = { ...t.names };
  [...friends, ...linkTo.map(([, f]) => f)].forEach(f => { names[f] = fname(f); });
  const before = tripMembers(t).map(m => m.id);
  try {
    const its = await getDocs(collection(db, 'trips', t.id, 'items'));
    let items = its.docs.map(d => ({ ...(d.data() as TripItem), id: d.id }));
    const orig = new Map(items.map(i => [i.id, JSON.stringify(i)]));
    linkTo.forEach(([g, f]) => { items = items.map(i => relinkPerson(i, g, f)); });
    const people = before.map(id => linkTo.find(([g]) => g === id)?.[1] ?? id);
    const joining = [...friends, ...newGuests.map(g => g.id)];
    if (add.splitPast && joining.length) { const wide = new Set(groupWideItems(items, people).map(i => i.id)); items = items.map(i => (wide.has(i.id) ? withMorePeople(i, joining) : i)); }
    const batch = writeBatch(db);
    batch.update(doc(db, 'trips', t.id), {
      members: [...t.members, ...friends, ...linkTo.map(([, f]) => f)], names,
      guests: [...t.guests.filter(g => !linkTo.some(([x]) => x === g.id)), ...newGuests], updatedAt: Date.now()
    });
    items.filter(i => orig.get(i.id) !== JSON.stringify(i)).forEach(({ id, ...rest }) => batch.set(doc(db, 'trips', t.id, 'items', id), rest));
    await batch.commit();
    await loadTrips(); await loadItems(t.id);
    return null;
  } catch (e) { return fail(e); }
}
export async function deleteTrip(id: string) {
  try {
    const its = await getDocs(collection(db, 'trips', id, 'items'));
    await Promise.all(its.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'trips', id)); await loadTrips(); return null;
  } catch (e) { return fail(e); }
}
export async function saveItem(tripId: string, item: Omit<TripItem, 'id'> & { id?: string }) {
  try {
    const { id, ...rest } = item;
    const body = JSON.parse(JSON.stringify(rest)); // Firestore rejects undefined fields
    if (id) await setDoc(doc(db, 'trips', tripId, 'items', id), body);
    else await addDoc(collection(db, 'trips', tripId, 'items'), body);
    await updateDoc(doc(db, 'trips', tripId), { updatedAt: Date.now() });
    await loadItems(tripId);
    if (!id) {
      const t = state.trips.find(x => x.id === tripId), who = (x?: string) => (t ? tripMembers(t).find(m => m.id === x)?.name : undefined) ?? 'someone';
      const amt = fmtPlain(item.amount);
      notifyThread(tripId, { title: `${t?.emoji ?? ''} ${t?.name ?? 'Trip'}`.trim(), body: item.kind === 'payment' ? `${myName()} paid ${who(item.to)} ${amt}` : `${myName()} added ${item.desc} · ${amt}`, url: `#trip:${tripId}`, tag: `item:${tripId}` });
    }
    return null;
  } catch (e) { return fail(e); }
}
export async function deleteItem(tripId: string, id: string) {
  try { await deleteDoc(doc(db, 'trips', tripId, 'items', id)); await loadItems(tripId); return null; } catch (e) { return fail(e); }
}

/** Everyone in a trip: members with accounts, then guests. */
export const tripMembers = (t: Trip): Member[] => [...t.members.map(id => ({ id, name: t.names[id] ?? 'Friend' })), ...t.guests];
let testUid = '';
export const myUid = () => testUid || me()?.uid || '';
// Development builds only: lets screenshots fill in a sample trip without Firebase. Not in the live app.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __social: unknown }).__social = { set: (p: Partial<SocialState>, uid?: string) => { if (uid) testUid = uid; setS(p); } };

/* ---------------- Chats: trips and direct messages ---------------- */
// A chat is named by a key: a trip's id, or "dm:" + the pair id of two friends (the same id as their friendship).
//   trips/{tripId}/messages, trips/{tripId}/media     dms/{pairId} (users, names, last), dms/{pairId}/messages, /media
export const dmKey = (friendUid: string) => `dm:${pairId(myUid(), friendUid)}`;
const threadPath = (key: string): [string, string] => (key.startsWith('dm:') ? ['dms', key.slice(3)] : ['trips', key]);
//   trips/{tripId}/messages/{id}  { uid, name, text, createdAt }
const MAX_LOAD = 150;
/** When the newest message in a trip was sent (for the "new messages" dot). */
export async function loadLatest(tripId: string) {
  const snap = await getDocs(query(collection(db, ...threadPath(tripId), 'messages'), orderBy('createdAt', 'desc'), limit(1)));
  const at = snap.docs[0]?.data().createdAt as number | undefined;
  setS({ latest: { ...state.latest, [tripId]: at ?? 0 } });
}
/** Loads the last messages, or only the ones newer than what's already here. Cheap to call every few seconds. */
export async function loadMessages(tripId: string) {
  const have = state.messages[tripId] ?? [];
  const after = have.length ? have[have.length - 1].createdAt : 0;
  const q = after
    ? query(collection(db, ...threadPath(tripId), 'messages'), where('createdAt', '>', after), orderBy('createdAt'))
    : query(collection(db, ...threadPath(tripId), 'messages'), orderBy('createdAt', 'desc'), limit(MAX_LOAD));
  const snap = await getDocs(q);
  if (!snap.size && after) return;
  const got = snap.docs.map(d => ({ ...(d.data() as Omit<Message, 'id'>), id: d.id }));
  const all = [...have, ...got].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i).sort((a, b) => a.createdAt - b.createdAt);
  setS({ messages: { ...state.messages, [tripId]: all }, latest: { ...state.latest, [tripId]: all.length ? all[all.length - 1].createdAt : 0 } });
}
export interface Attachment { img?: { thumb: string; w: number; h: number; gif?: boolean }; full?: string; gif?: Message['gif'] }
/** Sends a message, optionally with a photo (the full photo is saved first, then the message points to it) or a GIF. */
export async function sendMessage(tripId: string, text: string, att?: Attachment): Promise<string | null> {
  const u = me(); const t = text.trim();
  if (!u || (!t && !att)) return null;
  try {
    const msg: Omit<Message, 'id'> = { uid: u.uid, name: myName(), text: t.slice(0, 2000), createdAt: Date.now() };
    if (tripId.startsWith('dm:')) {
      const other = tripId.slice(3).split('_').find(x => x !== u.uid) ?? '';
      const f = state.friends.find(x => x.uid === other);
      const preview = att?.gif || att?.img?.gif ? 'GIF' : att?.img ? (msg.text ? `📷 ${msg.text}` : '📷 Photo') : msg.text;
      await setDoc(doc(db, 'dms', tripId.slice(3)), { users: [u.uid, other].sort(), names: { [u.uid]: myName(), [other]: f?.name ?? 'Friend' }, updatedAt: msg.createdAt, last: { uid: u.uid, name: msg.name, text: preview.slice(0, 120), at: msg.createdAt } }, { merge: true });
    }
    if (att?.img) {
      msg.img = { ...att.img };
      if (att.full) { const m = await addDoc(collection(db, ...threadPath(tripId), 'media'), { uid: u.uid, data: att.full, createdAt: Date.now() }); msg.img.media = m.id; media.set(m.id, att.full); }
      if (!msg.img.gif) delete msg.img.gif;
    }
    if (att?.gif) msg.gif = att.gif;
    await addDoc(collection(db, ...threadPath(tripId), 'messages'), msg);
    await loadMessages(tripId); markRead(tripId);
    const shown = msg.gif || msg.img?.gif ? (msg.text ? `GIF · ${msg.text}` : 'GIF') : msg.img ? (msg.text ? `📷 ${msg.text}` : '📷 Photo') : msg.text;
    if (tripId.startsWith('dm:')) notifyThread(tripId, { title: msg.name, body: shown, url: `#dm:${u.uid}`, tag: tripId });
    else { const t = state.trips.find(x => x.id === tripId); notifyThread(tripId, { title: `${t?.emoji ?? ''} ${t?.name ?? 'Trip'}`.trim(), body: `${msg.name}: ${shown}`, url: `#tripchat:${tripId}`, tag: `chat:${tripId}` }); }
    return null;
  } catch (e) { return fail(e); }
}
/** Full-size photos already downloaded during this visit. */
const media = new Map<string, string>();
export async function loadMedia(tripId: string, id: string): Promise<string | null> {
  if (media.has(id)) return media.get(id)!;
  const snap = await getDoc(doc(db, ...threadPath(tripId), 'media', id));
  const data = snap.exists() ? (snap.data().data as string) : null;
  if (data) media.set(id, data);
  return data;
}
export async function deleteMessage(tripId: string, id: string) {
  try {
    const m = (state.messages[tripId] ?? []).find(x => x.id === id);
    await deleteDoc(doc(db, ...threadPath(tripId), 'messages', id));
    if (m?.img?.media) await deleteDoc(doc(db, ...threadPath(tripId), 'media', m.img.media)).catch(() => {});
    setS({ messages: { ...state.messages, [tripId]: (state.messages[tripId] ?? []).filter(x => x.id !== id) } });
    return null;
  } catch (e) { return fail(e); }
}
/** Read markers live on this phone only. */
const readKey = (tripId: string) => `pockets-read-${tripId}`;
export function markRead(tripId: string) { try { localStorage.setItem(readKey(tripId), String(Date.now())); } catch { /* not saved */ } emit(); }
export function hasUnread(tripId: string) {
  const at = state.latest[tripId] ?? 0;
  let read = 0; try { read = Number(localStorage.getItem(readKey(tripId)) || 0); } catch { /* none */ }
  const mine = (state.messages[tripId] ?? []).filter(m => m.createdAt === at).every(m => m.uid === myUid());
  return at > read && !(mine && (state.messages[tripId] ?? []).length > 0);
}

/* ---------------- Direct messages ---------------- */
export interface Dm { key: string; other: string; name: string; updatedAt: number; last?: { uid: string; name: string; text: string; at: number } }
/** Your conversations with friends (one read for all of them). */
export async function loadDms() {
  const u = me(); if (!u) return;
  const snap = await getDocs(query(collection(db, 'dms'), where('users', 'array-contains', u.uid)));
  const dms: Dm[] = snap.docs.map(d => {
    const x = d.data() as { users: string[]; names?: Record<string, string>; updatedAt: number; last?: Dm['last'] };
    const other = x.users.find(v => v !== u.uid) ?? '';
    return { key: `dm:${d.id}`, other, name: state.friends.find(f => f.uid === other)?.name ?? x.names?.[other] ?? 'Friend', updatedAt: x.updatedAt, last: x.last };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
  setS({ dms, latest: { ...state.latest, ...Object.fromEntries(dms.map(t => [t.key, t.last && t.last.uid !== u.uid ? t.last.at : 0])) } });
}

/* ---------------- Activity for notifications ---------------- */
export interface DmActivity { dm: Dm; messages: Message[] }
export interface TripActivity { trip: Trip; items: TripItem[]; messages: Message[]; /** Someone added you to this trip since the last check. */ joined?: boolean }
const seenKey = (tripId: string) => `pockets-seen-${tripId}`;
/**
 * What other people added to your trips since this phone last checked: expenses, payments and messages.
 * A trip seen for the first time starts from now, so old history doesn't flood the notifications.
 * Costs about one read per trip per kind when nothing is new.
 */
/** New messages from friends in direct messages since this phone last checked (one read when nothing is new). */
export async function checkDmActivity(): Promise<DmActivity[]> {
  const u = me(); if (!u) return [];
  await loadDms();
  const out: DmActivity[] = [];
  await Promise.all(state.dms.map(async dm => {
    let since = 0; try { since = Number(localStorage.getItem(seenKey(dm.key)) || 0); } catch { /* none */ }
    if (!since) { try { localStorage.setItem(seenKey(dm.key), String(dm.last?.at ?? Date.now())); } catch { /* not saved */ } if (!dm.last || dm.last.uid === u.uid || dm.last.at < Date.now() - 864e5) return; since = dm.last.at - 1; }
    if (!dm.last || dm.last.at <= since) return;
    const ms = await getDocs(query(collection(db, 'dms', dm.key.slice(3), 'messages'), where('createdAt', '>', since), orderBy('createdAt')));
    const messages = ms.docs.map(d => ({ ...(d.data() as Omit<Message, 'id'>), id: d.id })).filter(m => m.uid !== u.uid);
    const newest = Math.max(since, ...ms.docs.map(d => d.data().createdAt as number));
    try { localStorage.setItem(seenKey(dm.key), String(newest)); } catch { /* not saved */ }
    if (messages.length) out.push({ dm, messages });
  }));
  return out;
}

export async function checkTripActivity(): Promise<TripActivity[]> {
  const u = me(); if (!u) return [];
  await loadTrips();
  const out: TripActivity[] = [];
  // The very first check on this phone only takes note of the trips you're in; after that, a new trip means you were added.
  let first = false; try { first = !localStorage.getItem('pockets-seen-init'); localStorage.setItem('pockets-seen-init', '1'); } catch { /* none */ }
  await Promise.all(state.trips.map(async trip => {
    let since = 0; try { since = Number(localStorage.getItem(seenKey(trip.id)) || 0); } catch { /* none */ }
    const now = Date.now();
    if (!since) {
      try { localStorage.setItem(seenKey(trip.id), String(now)); } catch { /* not saved */ }
      if (!first && trip.owner !== u.uid) out.push({ trip, items: [], messages: [], joined: true });
      return;
    }
    const [it, ms] = await Promise.all([
      getDocs(query(collection(db, 'trips', trip.id, 'items'), where('createdAt', '>', since))),
      getDocs(query(collection(db, 'trips', trip.id, 'messages'), where('createdAt', '>', since), orderBy('createdAt')))
    ]);
    const items = it.docs.map(d => ({ ...(d.data() as TripItem), id: d.id })).filter(x => x.createdBy !== u.uid);
    const messages = ms.docs.map(d => ({ ...(d.data() as Omit<Message, 'id'>), id: d.id })).filter(m => m.uid !== u.uid);
    const newest = Math.max(since, ...it.docs.map(d => d.data().createdAt as number), ...ms.docs.map(d => d.data().createdAt as number));
    try { localStorage.setItem(seenKey(trip.id), String(newest)); } catch { /* not saved */ }
    if (messages.length) setS({ latest: { ...state.latest, [trip.id]: Math.max(state.latest[trip.id] ?? 0, messages[messages.length - 1].createdAt) } });
    if (items.length || messages.length) out.push({ trip, items, messages });
  }));
  return out;
}

/* ---------------- Shared debts (lib/debtShare.ts decides; this reads and writes Firestore) ---------------- */
let debtSyncing = false;
/**
 * Sends new debts with friends as requests, sends your changes, takes your friends' changes, and lists the
 * requests waiting for you. Runs when the app opens, after you change a shared debt, and on Friends & trips.
 */
export async function syncDebts(): Promise<void> {
  const u = me();
  if (!u || debtSyncing) return;
  debtSyncing = true;
  try {
    if (!state.loadedAt && !state.friends.length) await loadFriends().catch(() => {});
    const snap = await getDocs(query(collection(db, 'debts'), where('users', 'array-contains', u.uid)));
    const docs = snap.docs.map(x => ({ ...(x.data() as Partial<DebtDoc>), id: x.id }));
    const friends = state.friends.filter(f => f.status === 'accepted').map(f => ({ uid: f.uid, name: f.name }));
    const now = Date.now();
    const plan = planDebtSync(debtsOf(getData()), docs, u.uid, myName(), friends, now);
    const failed = new Set<string>();
    const run = async (id: string, job: () => Promise<unknown>) => { try { await job(); } catch (e) { failed.add(id); fail(e); } };
    for (const o of plan.creates) { const { id, ...body } = o; await run(id, () => setDoc(doc(db, 'debts', id), body)); }
    for (const up of plan.updates) await run(up.id, () => updateDoc(doc(db, 'debts', up.id), { ...up.fields, updatedAt: now }));
    // Only mark as shared what Firestore really saved, so a failed send is tried again next time.
    const local = plan.local.filter(x => !failed.has(x.id));
    // Replaced as they are: a friend's change never moves your account balances (see lib/debtShare.ts).
    if (local.length) setData(x => { const by = new Map(local.map(y => [y.id, y])); return { debts: debtsOf(x).map(y => by.get(y.id) ?? y) }; });
    setS({ debtRequests: plan.requests });
  } catch (e) { fail(e); } finally { debtSyncing = false; }
}

/** Accept a debt a friend sent you: it appears in your Debts, from your side, without moving your accounts. */
export async function acceptDebt(o: DebtDoc): Promise<string | null> {
  const u = me(); if (!u) return 'Sign in first';
  const now = Date.now();
  try {
    await updateDoc(doc(db, 'debts', o.id), { status: 'accepted', updatedAt: now });
    setData(x => saveDebt(x, debtFromDoc({ ...o, status: 'accepted', updatedAt: now }, u.uid, now)));
    setS({ debtRequests: state.debtRequests.filter(r => r.id !== o.id) });
    return null;
  } catch (e) { return fail(e); }
}

/** You deleted a shared debt: remove the shared copy (your friend keeps theirs, marked as no longer shared). */
export async function unshareDebt(id: string) {
  if (!me()) return;
  try { await deleteDoc(doc(db, 'debts', id)); } catch { /* already gone, or offline: nothing else to undo */ }
}

/** Decline a debt a friend sent you: they see that you declined, and it never reaches your Debts. */
export async function declineDebt(o: DebtDoc): Promise<string | null> {
  try {
    await updateDoc(doc(db, 'debts', o.id), { status: 'declined', updatedAt: Date.now() });
    setS({ debtRequests: state.debtRequests.filter(r => r.id !== o.id) });
    flash('Request declined');
    return null;
  } catch (e) { return fail(e); }
}
