import { useState, useSyncExternalStore } from 'react';
import { flash, closeSheet } from '../lib/store';
import { TEXT } from '../lib/constants';
import { currentName, getSync, logOut, resetPassword, resolveConflict, signIn, signInGoogle, signUp, subscribeSync, syncNow, type SyncState } from '../lib/cloud';
import { FieldLabel, PrimaryBtn, Segmented, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';

export const useSync = () => useSyncExternalStore(subscribeSync, getSync);
const ago = (t: number) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
export const syncLabel = (s: SyncState) => !s.uid ? 'Off' : s.status === 'syncing' ? 'Syncing…' : s.status === 'conflict' ? 'Needs your choice' : s.status === 'offline' ? 'Offline · will sync later' : s.status === 'error' ? 'Couldn\'t sync' : s.dirty ? 'Changes waiting to upload' : `Synced ${ago(s.syncedAt)}`;

/** Sign-in form; also used by the welcome screen. */
export function SignInForm({ onDone, askName, dark }: { onDone?: (info: { created: boolean; name: string }) => void; askName?: boolean; dark?: boolean }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (f: () => Promise<string | null>, created: boolean) => { setBusy(true); setErr(null); const e = await f(); setBusy(false); if (e) setErr(e); else onDone?.({ created, name: name.trim() || currentName() }); };
  const cant = !email.includes('@') || pw.length < 6 || busy;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Segmented items={[['in', 'Sign in'], ['up', 'Create account']]} value={mode} onPick={m => { setMode(m); setErr(null); }} mt={4} />
      {askName && mode === 'up' && <>
        <FieldLabel m="14px 4px 6px">What should we call you?</FieldLabel>
        <input autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" aria-label="Your name" style={textInput} />
      </>}
      <FieldLabel m="14px 4px 6px">Email</FieldLabel>
      <input type="email" autoComplete="email" inputMode="email" autoCapitalize="off" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" style={textInput} />
      <FieldLabel m="14px 4px 6px">Password</FieldLabel>
      <input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={e => setPw(e.target.value)} placeholder={mode === 'up' ? 'At least 6 characters' : 'Your password'} aria-label="Password" style={textInput} />
      {err && <span role="alert" style={{ margin: '10px 4px 0', fontSize: 13, color: 'var(--color-accent-700)' }}>{err}</span>}
      <PrimaryBtn onClick={() => run(() => (mode === 'up' ? signUp(email, pw) : signIn(email, pw)), mode === 'up')} disabled={cant} mt={16} bg={dark ? '#232e7a' : undefined} hover={dark ? 'hv-n200' : undefined}>{busy ? 'One moment…' : mode === 'up' ? 'Create account' : 'Sign in'}</PrimaryBtn>
      {mode === 'in' && <button onClick={async () => { if (!email.includes('@')) { setErr('Type your email first, then tap this again.'); return; } const e = await resetPassword(email); if (e) setErr(e); else flash('Check your email for a link to reset your password'); }} style={{ marginTop: 10, border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Forgot your password?</button>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 4px 10px', color: 'var(--color-neutral-500)', fontSize: 12 }}><span style={{ flex: 1, height: 1, background: 'var(--color-neutral-200)' }} />or<span style={{ flex: 1, height: 1, background: 'var(--color-neutral-200)' }} /></div>
      <button onClick={() => run(signInGoogle, false)} disabled={busy} style={{ height: 50, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: 'inset 0 0 0 1px var(--color-neutral-200)' }}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </button>
      <span style={{ margin: '8px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-600)', textAlign: 'center' }}>If Google doesn't open from the home screen app, use email and password.</span>
    </div>
  );
}

/** Conflict card: both this phone and the cloud changed. */
export function ConflictChoice() {
  const s = useSync();
  if (s.status !== 'conflict' || !s.conflict) return null;
  return (
    <div role="alertdialog" aria-label="Choose which data to keep" style={{ background: 'oklch(0.96 0.055 92)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'oklch(0.33 0.07 70)' }}>This phone and your cloud copy are different</span>
      <span style={{ fontSize: 13, lineHeight: 1.4, color: 'oklch(0.4 0.08 70)' }}>The cloud copy was saved {new Date(s.conflict.cloudAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{s.conflict.cloudSummary ? ` (${s.conflict.cloudSummary})` : ''}. Which one do you want to keep? The other one is replaced.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => resolveConflict('phone')} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: 'oklch(0.33 0.07 70)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Keep this phone's</button>
        <button onClick={() => resolveConflict('cloud')} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Use the cloud's</button>
      </div>
      <span style={{ fontSize: 12, color: 'oklch(0.4 0.08 70)' }}>Not sure? Make a backup file first in Profile.</span>
    </div>
  );
}

/** Profile → Cloud backup. */
export function CloudSheet() {
  const s = useSync();
  const [busy, setBusy] = useState(false);
  return (
    <SheetFrame title="Cloud backup">
      {!s.uid ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ margin: '0 4px 6px', fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Sign in and Pockets keeps a copy of your data in the cloud, updated after every change. If you lose or change your phone, sign in again and everything comes back. Only you can see your data.</span>
          <SignInForm onDone={() => flash('Signed in · syncing your data')} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Signed in as</span>
            <span style={{ fontSize: 17, fontWeight: 700, wordBreak: 'break-all' }}>{s.email}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 6, color: s.status === 'error' ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.status === 'synced' && !s.dirty ? 'oklch(0.62 0.12 160)' : s.status === 'error' || s.status === 'conflict' ? 'var(--color-accent)' : 'oklch(0.8 0.14 82)' }} />
              {syncLabel(s)}
            </span>
            {s.status === 'error' && s.error && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{s.error}</span>}
          </div>
          <ConflictChoice />
          <button onClick={async () => { setBusy(true); await syncNow(); setBusy(false); }} disabled={busy} style={{ height: 48, borderRadius: 999, border: 0, background: TEXT, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Syncing…' : 'Sync now'}</button>
          <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Your data stays on this phone too, so the app works without internet and uploads when you're back online. Backup files in Profile still work as an extra copy.</span>
          <button onClick={async () => { await logOut(); closeSheet(); flash('Signed out · your data stays on this phone'); }} style={{ height: 44, borderRadius: 999, border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
        </div>
      )}
    </SheetFrame>
  );
}
