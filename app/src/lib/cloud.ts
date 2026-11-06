// Cloud sync with Firebase: each person signs in and their data is kept in their own private space
// (users/{uid}). The phone keeps the full copy; the cloud is a second copy that follows every change.
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, getAuth, onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, type User
} from 'firebase/auth';
import { doc, getDoc, getFirestore, writeBatch } from 'firebase/firestore/lite';
import { get, set } from 'idb-keyval';
import type { Data } from './types';

const app = initializeApp({
  apiKey: 'AIzaSyBSxMmcFuvYlDA4LKRnCRg-1uRnKosWdgk',
  authDomain: 'pockets-rodar.firebaseapp.com',
  projectId: 'pockets-rodar',
  storageBucket: 'pockets-rodar.firebasestorage.app',
  messagingSenderId: '223677884702',
  appId: '1:223677884702:web:ec5dda45af414d2e3ec10f'
});
export const auth = getAuth(app);
export const db = getFirestore(app);

/** Firestore keeps each record under 1 MiB, so the data is stored in parts of this many characters. */
export const CHUNK = 700_000;
const SYNC_KEY = 'pockets-sync-v1';

export interface SyncState {
  uid: string | null; email: string | null;
  /** The cloud copy's `updatedAt` this phone last matched. */
  syncedAt: number;
  /** This phone has changes the cloud doesn't have yet. */
  dirty: boolean;
  status: 'off' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
  error?: string;
  /** When the cloud and this phone both changed (or on first sign-in with data on both sides). */
  conflict?: { cloudAt: number; cloudSummary: string } | null;
}
let state: SyncState = { uid: null, email: null, syncedAt: 0, dirty: false, status: 'off', conflict: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
// Development builds only: lets screenshots show signed-in screens without Firebase. Not in the live app.
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __sync: (p: Partial<SyncState>) => { state = { ...state, ...p }; emit(); } });
export const getSync = () => state;
export const subscribeSync = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function update(p: Partial<SyncState>) {
  state = { ...state, ...p };
  set(SYNC_KEY, { uid: state.uid, syncedAt: state.syncedAt, dirty: state.dirty }).catch(() => {});
  emit();
}

/* ---------------- Splitting and joining ---------------- */
export const split = (s: string) => { const out: string[] = []; for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK)); return out.length ? out : ['']; };
export const summary = (d: Data) => `${d.accounts.length} accounts, ${d.expenses.length} expenses, ${d.incomes.length} incomes`;

interface Hooks { getData: () => Data; replace: (d: Data) => void; canSync: () => boolean }
let hooks: Hooks | null = null;

/* ---------------- Push and pull ---------------- */
async function push(force = false) {
  if (!hooks || !state.uid || (!state.dirty && !force) || !hooks.canSync()) return;
  if (!navigator.onLine) { update({ status: 'offline' }); return; }
  const uid = state.uid, data = hooks.getData(), json = JSON.stringify(data), parts = split(json), at = Date.now();
  update({ status: 'syncing' });
  try {
    // Never overwrite a newer cloud copy from another phone without asking.
    const meta = await getDoc(doc(db, 'users', uid, 'meta', 'state'));
    const cloudAt = meta.exists() ? (meta.data().updatedAt as number) : 0;
    if (!force && cloudAt > state.syncedAt) { update({ status: 'conflict', conflict: { cloudAt, cloudSummary: meta.data()?.summary ?? '' } }); return; }
    const b = writeBatch(db);
    parts.forEach((p, i) => b.set(doc(db, 'users', uid, 'chunks', String(i)), { i, data: p }));
    b.set(doc(db, 'users', uid, 'meta', 'state'), { updatedAt: at, chunks: parts.length, size: json.length, summary: summary(data), version: 1 });
    await b.commit();
    update({ syncedAt: at, dirty: false, status: 'synced', error: undefined, conflict: null });
  } catch (e) { update({ status: navigator.onLine ? 'error' : 'offline', error: (e as Error).message }); }
}

async function readCloud(uid: string): Promise<{ at: number; data: Data | null; summary: string }> {
  const meta = await getDoc(doc(db, 'users', uid, 'meta', 'state'));
  if (!meta.exists()) return { at: 0, data: null, summary: '' };
  const m = meta.data() as { updatedAt: number; chunks: number; summary?: string };
  const parts = await Promise.all(Array.from({ length: m.chunks }, (_, i) => getDoc(doc(db, 'users', uid, 'chunks', String(i)))));
  const json = parts.map(p => (p.data()?.data as string) ?? '').join('');
  return { at: m.updatedAt, data: json ? (JSON.parse(json) as Data) : null, summary: m.summary ?? '' };
}

/** Compares with the cloud: downloads newer data, uploads local changes, or flags a conflict. */
export async function syncNow(): Promise<void> {
  if (!hooks || !state.uid || !hooks.canSync()) return;
  if (!navigator.onLine) { update({ status: 'offline' }); return; }
  update({ status: 'syncing' });
  try {
    const meta = await getDoc(doc(db, 'users', state.uid, 'meta', 'state'));
    const cloudAt = meta.exists() ? (meta.data().updatedAt as number) : 0;
    if (!cloudAt) { await push(true); return; }
    if (cloudAt > state.syncedAt) {
      if (state.dirty || state.syncedAt === 0 && hasData(hooks.getData())) { update({ status: 'conflict', conflict: { cloudAt, cloudSummary: meta.data()?.summary ?? '' } }); return; }
      const r = await readCloud(state.uid);
      if (r.data) applyCloud(r.data);
      update({ syncedAt: r.at, dirty: false, status: 'synced', conflict: null });
      return;
    }
    if (state.dirty) { await push(); return; }
    update({ status: 'synced', error: undefined });
  } catch (e) { update({ status: navigator.onLine ? 'error' : 'offline', error: (e as Error).message }); }
}
const hasData = (d: Data) => d.accounts.length + d.expenses.length + d.incomes.length + d.pockets.length > 0;

/** Settles a conflict: keep this phone's data (upload it) or take the cloud's (replace this phone's). */
export async function resolveConflict(keep: 'phone' | 'cloud') {
  if (!hooks || !state.uid) return;
  update({ status: 'syncing' });
  try {
    if (keep === 'phone') { update({ dirty: true }); await push(true); return; }
    const r = await readCloud(state.uid);
    if (r.data) applyCloud(r.data);
    update({ syncedAt: r.at, dirty: false, status: 'synced', conflict: null });
  } catch (e) { update({ status: 'error', error: (e as Error).message }); }
}

/* ---------------- Changes on this phone ---------------- */
let timer: ReturnType<typeof setTimeout> | undefined;
/** True while cloud data is being applied, so that applying it isn't mistaken for a new local change. */
let applyingCloud = false;
const applyCloud = (d: Data) => withoutMarking(() => hooks!.replace(d));
/** Runs a change that came from the cloud, so it isn't uploaded straight back. */
export function withoutMarking(f: () => void) { applyingCloud = true; try { f(); } finally { applyingCloud = false; } }
/** Called after every local save: uploads a few seconds after the last change. */
export function markDirty() {
  if (!state.uid || applyingCloud) return;
  if (!state.dirty) update({ dirty: true });
  clearTimeout(timer);
  timer = setTimeout(() => { push(); }, 4000);
}

/* ---------------- Accounts ---------------- */
const friendly = (e: unknown) => {
  const c = (e as { code?: string }).code ?? '';
  return c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'Wrong email or password.'
    : c.includes('email-already-in-use') ? 'There is already an account with that email. Sign in instead.'
    : c.includes('weak-password') ? 'Use at least 6 characters for the password.'
    : c.includes('invalid-email') ? 'That email doesn\'t look right.'
    : c.includes('network') ? 'No internet connection. Try again when you\'re online.'
    : c.includes('popup') ? 'The Google window was closed or blocked. Try email and password instead.'
    : c.includes('too-many-requests') ? 'Too many tries. Wait a minute and try again.'
    : (e as Error).message;
};
export async function signUp(email: string, password: string, name = '') {
  try {
    const c = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name) await updateProfile(c.user, { displayName: name }).catch(() => {});
    // Friends find you by email, so the email has to be confirmed as yours.
    await sendEmailVerification(c.user).catch(() => {});
    return null;
  } catch (e) { return friendly(e); }
}
/** Sends the confirmation email again. */
export async function resendVerification() { try { if (auth.currentUser) await sendEmailVerification(auth.currentUser); return null; } catch (e) { return friendly(e); } }
/** Reloads the account to see if the email was confirmed (after tapping the link). */
export async function checkVerified() { if (!auth.currentUser) return false; await reload(auth.currentUser).catch(() => {}); await auth.currentUser.getIdToken(true).catch(() => {}); return !!auth.currentUser.emailVerified; }
export async function signIn(email: string, password: string) { try { await signInWithEmailAndPassword(auth, email.trim(), password); return null; } catch (e) { return friendly(e); } }
export async function signInGoogle() { try { await signInWithPopup(auth, new GoogleAuthProvider()); return null; } catch (e) { return friendly(e); } }
export async function resetPassword(email: string) { try { await sendPasswordResetEmail(auth, email.trim()); return null; } catch (e) { return friendly(e); } }
/** The signed-in person's name, when the account has one (Google). */
export const currentName = () => auth.currentUser?.displayName?.split(' ')[0] ?? '';
/** Uploads anything pending, then signs out. This phone keeps its data. */
export async function logOut() { clearTimeout(timer); if (state.dirty) await push(); await signOut(auth); }

/** For the welcome screen: after signing in, bring back the cloud copy (null if this account has none yet). */
export async function pullForWelcome(): Promise<Data | null> {
  if (!state.uid) return null;
  const r = await readCloud(state.uid);
  if (r.data) update({ syncedAt: r.at, dirty: false, status: 'synced', conflict: null });
  return r.data;
}

/* ---------------- Start ---------------- */
export async function startCloud(h: Hooks) {
  hooks = h;
  // Ask iOS to keep this app's storage even when the phone runs low on space.
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
  const saved = await get<{ uid: string | null; syncedAt: number; dirty: boolean }>(SYNC_KEY).catch(() => undefined);
  onAuthStateChanged(auth, (u: User | null) => {
    if (!u) { clearTimeout(timer); update({ uid: null, email: null, status: 'off', conflict: null, syncedAt: 0, dirty: false }); return; }
    const same = saved?.uid === u.uid;
    update({ uid: u.uid, email: u.email, syncedAt: same ? saved!.syncedAt : 0, dirty: same ? saved!.dirty : true });
    syncNow();
  });
  const again = () => { if (document.visibilityState === 'visible') syncNow(); else { clearTimeout(timer); push(); } };
  document.addEventListener('visibilitychange', again);
  window.addEventListener('online', () => syncNow());
}
