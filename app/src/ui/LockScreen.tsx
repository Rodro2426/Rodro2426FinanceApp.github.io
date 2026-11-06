// Covers Pockets while it's locked (and while it's in the background, so the app switcher doesn't show your money).
import { useEffect, useRef, useState } from 'react';
import { bioName, disableLock, lockOn, markHidden, needsUnlock, unlockWithBiometrics } from '../lib/lock';
import { auth, signIn, signInGoogle } from '../lib/cloud';

const NAVY = '#232e7a', NAVY2 = '#3d4784';

export function LockGate() {
  // Locked on a cold start when the lock is on; "cover" hides the app while it's in the background.
  const [locked, setLocked] = useState(() => lockOn());
  const [cover, setCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pwMode, setPwMode] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const tried = useRef(false);

  const tryUnlock = async (tapped = true) => {
    if (busy) return;
    setBusy(true); setErr(null);
    const ok = await unlockWithBiometrics();
    setBusy(false);
    if (ok) { setLocked(false); setFailed(false); } else if (tapped) setFailed(true);
  };

  useEffect(() => {
    const onVis = () => {
      if (!lockOn()) { setCover(false); return; }
      if (document.visibilityState === 'hidden') { markHidden(); setCover(true); }
      else { setCover(false); if (needsUnlock()) { setLocked(true); tried.current = false; } }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => { if (lockOn()) { markHidden(); setCover(true); } });
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // Ask for Face ID right away when the lock screen appears (if the browser allows it without a tap, otherwise the button does).
  useEffect(() => { if (locked && !tried.current && document.visibilityState === 'visible') { tried.current = true; tryUnlock(false); } }, [locked]);

  if (!locked && !cover) return null;
  const email = auth.currentUser?.email ?? '';
  const google = !!auth.currentUser?.providerData.some(p => p.providerId === 'google.com');
  const usePassword = async () => {
    if (!email || !pw) return;
    setBusy(true);
    const e = await signIn(email, pw);
    setBusy(false);
    if (e) { setErr(e); return; }
    setLocked(false); setPwMode(false); setPw('');
  };

  return (
    <div className="force-light" role="dialog" aria-label="Pockets is locked" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'linear-gradient(180deg, #f8f5ee 0%, #ebe3d2 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, textAlign: 'center' }}>
      <img src="./pockets-mark.svg" alt="" width={64} height={78} />
      <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: NAVY }}>Pockets</span>
      {locked && <>
        <span style={{ fontSize: 15, color: NAVY2 }}>Locked</span>
        {!pwMode ? <>
          <button onClick={() => tryUnlock()} disabled={busy} style={{ marginTop: 10, height: 52, padding: '0 26px', borderRadius: 999, border: 0, background: NAVY, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2" /><path d="M9 9v1M15 9v1M12 9v4h-1M9 16c1.6 1.3 4.4 1.3 6 0" /></svg>
            {busy ? 'Checking…' : `Unlock with ${bioName()}`}
          </button>
          {failed && <span style={{ fontSize: 13, color: NAVY2 }}>Didn't work. Try again{email ? ', or use your password' : ''}.</span>}
          {email && !google && <button onClick={() => setPwMode(true)} style={{ border: 0, background: 'transparent', color: NAVY, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 8 }}>Use your Pockets password</button>}
          {google && <button onClick={async () => { setBusy(true); const e = await signInGoogle(); setBusy(false); if (e) setErr(e); else setLocked(false); }} style={{ border: 0, background: 'transparent', color: NAVY, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 8 }}>Continue with Google instead</button>}
          {err && !pwMode && <span role="alert" style={{ fontSize: 13, color: '#ae1800' }}>{err}</span>}
        </> : <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 13, color: NAVY2 }}>{email}</span>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') usePassword(); }} placeholder="Password" aria-label="Password" autoFocus
            style={{ height: 50, borderRadius: 16, border: 0, background: '#fff', padding: '0 16px', fontSize: 16, color: '#201e1d', outline: 'none' }} />
          {err && <span role="alert" style={{ fontSize: 13, color: '#ae1800' }}>{err}</span>}
          <button onClick={usePassword} disabled={busy || !pw} style={{ height: 50, borderRadius: 999, border: 0, background: NAVY, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy || !pw ? 0.6 : 1 }}>{busy ? 'Checking…' : 'Unlock'}</button>
          <button onClick={() => { setPwMode(false); setErr(null); }} style={{ border: 0, background: 'transparent', color: NAVY, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 6 }}>Back to {bioName()}</button>
          <button onClick={async () => { if (!pw) { setErr('Type your password first.'); return; } setBusy(true); const e = await signIn(email, pw); setBusy(false); if (e) { setErr(e); return; } disableLock(); setLocked(false); }} style={{ border: 0, background: 'transparent', color: NAVY2, fontSize: 12.5, cursor: 'pointer', padding: 4 }}>Unlock and turn the lock off</button>
        </div>}
      </>}
    </div>
  );
}
