import { useState } from 'react';
import { pullForWelcome, withoutMarking } from '../lib/cloud';
import { SignInForm } from '../sheets/CloudSheet';
import { normalize } from '../lib/store';
import { finishWelcome, flash, startTour } from '../lib/store';
import { emptyData, sampleData } from '../lib/seed';
import { pickBackupFile, readBackup } from '../lib/backup';
import { TEXT } from '../lib/constants';
import * as I from '../ui/icons';

/** First open on a device: pick how to start instead of landing on sample data. */
export default function Welcome() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [cloud, setCloud] = useState(false);
  const who = name.trim();

  const scratch = () => {
    const d = emptyData(sampleData());
    finishWelcome({ ...d, settings: { ...d.settings, name: who || 'there', lastBackup: undefined, tourSeen: true } });
  };
  const tour = () => startTour('first', who || 'there');
  const sample = () => {
    const d = sampleData();
    finishWelcome(who ? { ...d, settings: { ...d.settings, name: who } } : d);
  };
  const restore = async () => {
    const f = await pickBackupFile(); if (!f) return;
    setBusy(true);
    try { const r = await readBackup(f); finishWelcome(r.data); flash(`Welcome back, ${r.data.settings.name}`); }
    catch (e) { flash((e as Error).message); }
    setBusy(false);
  };
  const option = (title: string, sub: string, onClick: () => void, primary?: boolean) => (
    <button onClick={onClick} disabled={busy} style={{ width: '100%', textAlign: 'left', border: 0, borderRadius: 22, padding: '15px 16px', background: primary ? '#232e7a' : '#fff', color: primary ? '#fff' : TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: primary ? 'none' : 'inset 0 0 0 1px rgba(35,46,122,.12)' }}>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 13, opacity: primary ? 0.8 : 0.65 }}>{sub}</span>
      </span>
      <I.Chevron size={18} />
    </button>
  );

  const afterSignIn = async () => {
    setBusy(true);
    try {
      const d = await pullForWelcome();
      if (d) { withoutMarking(() => finishWelcome(normalize(d))); flash(`Welcome back, ${d.settings.name}`); }
      else { scratch(); flash('Signed in · your new account is ready and backed up'); }
    } catch (e) { flash((e as Error).message); }
    setBusy(false);
  };
  if (cloud) return (
    <div className="noscroll" style={{ position: 'absolute', inset: 0, zIndex: 80, overflowY: 'auto', background: 'linear-gradient(180deg, #f8f5ee 0%, #ebe3d2 100%)', display: 'flex', flexDirection: 'column', padding: 'calc(var(--top) + 18px) 22px calc(var(--tb) + 20px)' }}>
      <button onClick={() => setCloud(false)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: '#232e7a', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '6px 0' }}>‹ Back</button>
      <img src="./pockets-mark.svg" alt="" width={56} height={68} style={{ alignSelf: 'center', marginTop: 6 }} />
      <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#232e7a', textAlign: 'center', margin: '8px 0 4px' }}>Your Pockets account</span>
      <span style={{ fontSize: 14, lineHeight: 1.4, color: '#3d4784', textAlign: 'center', marginBottom: 14 }}>{busy ? 'Bringing back your data…' : 'Sign in to bring back your data, or create an account to keep it safe in the cloud.'}</span>
      <SignInForm onDone={afterSignIn} />
    </div>
  );

  return (
    <div className="noscroll" style={{ position: 'absolute', inset: 0, zIndex: 80, overflowY: 'auto', background: 'linear-gradient(180deg, #f8f5ee 0%, #ebe3d2 100%)', display: 'flex', flexDirection: 'column', padding: 'calc(var(--top) + 28px) 22px calc(var(--tb) + 20px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <img src="./pockets-mark.svg" alt="" width={74} height={90} />
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.035em', color: '#232e7a' }}>Pockets</span>
        <span style={{ fontSize: 15, lineHeight: 1.4, color: '#3d4784', maxWidth: 290 }}>Split your income into weekly pockets and always know what's safe to spend.</span>
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: '#3d4784' }}>What should we call you?</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="given-name"
          style={{ border: 0, borderRadius: 18, background: '#fff', fontSize: 16, color: TEXT, padding: '15px 18px', outline: 'none' }} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {option('Start with a quick tour', 'Recommended. Try every feature on a practice copy, then keep it or start clean', tour, true)}
        {option('Start from scratch', 'Skip the tour and add your own accounts', scratch)}
        {option('Try it with sample data', 'Explore with made-up accounts and expenses', sample)}
        {option('Sign in to my Pockets account', 'Bring back your data from the cloud', () => setCloud(true))}
        {option('Restore a backup', 'Bring back your data from a backup file', restore)}
      </div>
      <span style={{ marginTop: 14, fontSize: 12, color: '#3d4784', opacity: 0.75, textAlign: 'center' }}>Your data stays on this phone. You can replay the tour anytime from Profile.</span>
    </div>
  );
}
