// Friends and shared trips, stored in Firestore so every member sees the same thing.
//   profiles/{uid}            name + email (readable by signed-in people, by id only)
//   emails/{email}            -> { uid, name }  lets someone find you by exact email (only verified emails)
//   friendships/{a_b}         { users: [a, b], from, status: 'pending' | 'accepted', names }
//   trips/{tripId}            { name, emoji, owner, members: [uid], guests: [{id, name}], names }
//   trips/{tripId}/items/{id} expenses and payments (see settle.ts)
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore/lite';
import { auth, db } from './cloud';
import { groupWideItems, relinkPerson, withMorePeople, type Member, type TripItem } from './settle';

export interface Friend { uid: string; name: string; email: string; status: 'pending' | 'accepted'; incoming: boolean; id: string }
export interface Trip { id: string; name: string; emoji: string; owner: string; members: string[]; guests: Member[]; names: Record<string, string>; createdAt: number; updatedAt: number }

const me = () => auth.currentUser;
const myName = () => me()?.displayName?.trim() || me()?.email?.split('@')[0] || 'Me';
export const pairId = (a: string, b: string) => [a, b].sort().join('_');
const clean = (e: string) => e.trim().toLowerCase();

/* ---------------- State shared with the screens ---------------- */
export interface Message { id: string; uid: string; name: string; text: string; createdAt: number }
interface SocialState { friends: Friend[]; trips: Trip[]; items: Record<string, TripItem[]>; messages: Record<string, Message[]>; latest: Record<string, number>; loading: boolean; error: string | null; loadedAt: number }
let state: SocialState = { friends: [], trips: [], items: {}, messages: {}, latest: {}, loading: false, error: null, loadedAt: 0 };
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
    await Promise.all(state.trips.map(t => Promise.all([loadItems(t.id), loadLatest(t.id).catch(() => {})])));
    setS({ loading: false, loadedAt: Date.now() });
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
    await loadItems(tripId); return null;
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

/* ---------------- Trip chat ---------------- */
//   trips/{tripId}/messages/{id}  { uid, name, text, createdAt }
const MAX_LOAD = 150;
/** When the newest message in a trip was sent (for the "new messages" dot). */
export async function loadLatest(tripId: string) {
  const snap = await getDocs(query(collection(db, 'trips', tripId, 'messages'), orderBy('createdAt', 'desc'), limit(1)));
  const at = snap.docs[0]?.data().createdAt as number | undefined;
  setS({ latest: { ...state.latest, [tripId]: at ?? 0 } });
}
/** Loads the last messages, or only the ones newer than what's already here. Cheap to call every few seconds. */
export async function loadMessages(tripId: string) {
  const have = state.messages[tripId] ?? [];
  const after = have.length ? have[have.length - 1].createdAt : 0;
  const q = after
    ? query(collection(db, 'trips', tripId, 'messages'), where('createdAt', '>', after), orderBy('createdAt'))
    : query(collection(db, 'trips', tripId, 'messages'), orderBy('createdAt', 'desc'), limit(MAX_LOAD));
  const snap = await getDocs(q);
  if (!snap.size && after) return;
  const got = snap.docs.map(d => ({ ...(d.data() as Omit<Message, 'id'>), id: d.id }));
  const all = [...have, ...got].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i).sort((a, b) => a.createdAt - b.createdAt);
  setS({ messages: { ...state.messages, [tripId]: all }, latest: { ...state.latest, [tripId]: all.length ? all[all.length - 1].createdAt : 0 } });
}
export async function sendMessage(tripId: string, text: string): Promise<string | null> {
  const u = me(); const t = text.trim();
  if (!u || !t) return null;
  try {
    await addDoc(collection(db, 'trips', tripId, 'messages'), { uid: u.uid, name: myName(), text: t.slice(0, 2000), createdAt: Date.now() });
    await loadMessages(tripId); markRead(tripId);
    return null;
  } catch (e) { return fail(e); }
}
export async function deleteMessage(tripId: string, id: string) {
  try { await deleteDoc(doc(db, 'trips', tripId, 'messages', id)); setS({ messages: { ...state.messages, [tripId]: (state.messages[tripId] ?? []).filter(m => m.id !== id) } }); return null; } catch (e) { return fail(e); }
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

/* ---------------- Activity for notifications ---------------- */
export interface TripActivity { trip: Trip; items: TripItem[]; messages: Message[]; /** Someone added you to this trip since the last check. */ joined?: boolean }
const seenKey = (tripId: string) => `pockets-seen-${tripId}`;
/**
 * What other people added to your trips since this phone last checked: expenses, payments and messages.
 * A trip seen for the first time starts from now, so old history doesn't flood the notifications.
 * Costs about one read per trip per kind when nothing is new.
 */
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
