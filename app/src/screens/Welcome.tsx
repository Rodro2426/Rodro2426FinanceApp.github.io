import { useState } from 'react';
import { pullForWelcome, withoutMarking } from '../lib/cloud';
import { SignInForm } from '../sheets/CloudSheet';
import { finishWelcome, flash, normalize, startTour } from '../lib/store';
import { emptyData, sampleData } from '../lib/seed';
import { pickBackupFile, readBackup } from '../lib/backup';
import { TEXT } from '../lib/constants';
import * as I from '../ui/icons';
import { useDesk } from '../ui/Desk';
import { LangSwitch } from '../ui/LangSwitch';

const NAVY = '#232e7a', NAVY2 = '#3d4784';

/**
 * First open on a device. The first screen is the account: sign in to bring your data back, or create an
 * account so it's backed up from day one. Scrolling down shows the other ways to start, without an account.
 */
export default function Welcome() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const who = name.trim();
  const desk = useDesk();

  const scratch = (n = who) => {
    const d = emptyData(sampleData());
    finishWelcome({ ...d, settings: { ...d.settings, name: n || 'there', lastBackup: undefined, tourSeen: true } });
  };
  const sample = () => { const d = sampleData(); finishWelcome(who ? { ...d, settings: { ...d.settings, name: who } } : d); };
  const restore = async () => {
    const f = await pickBackupFile(); if (!f) return;
    setBusy('Restoring your backup…');
    try { const r = await readBackup(f); finishWelcome(r.data); flash(`Welcome back, ${r.data.settings.name}`); }
    catch (e) { flash((e as Error).message); }
    setBusy(null);
  };
  /** Signed in: bring back the cloud copy, or start a new account with the tour (on a practice copy). */
  const afterSignIn = async ({ created, name: n }: { created: boolean; name: string }) => {
    setBusy('Bringing back your data…');
    try {
      const d = await pullForWelcome();
      if (d) { withoutMarking(() => finishWelcome(normalize(d))); flash(`Welcome back, ${d.settings.name}`); }
      else { startTour('first', n || 'there'); flash(created ? 'Account created · it will back up as soon as you start' : 'Signed in · let\'s set things up'); }
    } catch (e) { flash((e as Error).message); }
    setBusy(null);
  };

  const option = (icon: string, title: string, sub: string, onClick: () => void) => (
    <button onClick={onClick} disabled={!!busy} style={{ width: '100%', textAlign: 'left', border: 0, borderRadius: 22, padding: '14px 16px', background: 'var(--surface)', color: TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'inset 0 0 0 1px rgba(35,46,122,.12)' }}>
      <span style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 13, opacity: 0.65 }}>{sub}</span>
      </span>
      <I.Chevron size={18} />
    </button>
  );

  const features: [string, string, string][] = [
    ['👛', 'Weekly pockets', "Split your income into pockets and see what's safe to spend today, this week and this month."],
    ['☁️', 'Same data everywhere', 'Sign in on your iPhone and here: every change backs up to the cloud and shows up on both.'],
    ['🏖️', 'Trips with friends', 'Share expenses, see who owes what, settle up in the fewest payments and chat.'],
    ['📈', 'Net worth and investments', 'Accounts, cards, stocks and CDTs in one place, with reports you can filter.']
  ];
  if (desk) return (
    <div className="noscroll force-light" style={{ position: 'absolute', inset: 0, zIndex: 80, overflowY: 'auto', background: 'linear-gradient(160deg, #fbf9f3 0%, #ebe3d2 100%)' }}>
      <header style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 48px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="./pockets-mark.svg" alt="" width={38} height={46} />
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.035em', color: NAVY }}>Pockets</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: NAVY2 }}>On your computer and your iPhone</span>
        <LangSwitch />
      </header>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 48px 56px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(380px, 460px)', gap: 64, alignItems: 'start' }}>
        <section aria-label="About Pockets" style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
          <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.045em', color: NAVY, textWrap: 'balance' }}>Always know what's safe to spend.</h1>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.5, color: NAVY2, maxWidth: 540 }}>Pockets splits your income into weekly pockets, tracks every account and card, and keeps you and your friends even on shared trips.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 10 }}>
            {features.map(([icon, title, body]) => (
              <div key={title} style={{ background: 'rgba(255,255,255,.6)', borderRadius: 24, padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'inset 0 0 0 1px rgba(35,46,122,.08)' }}>
                <span aria-hidden="true" style={{ fontSize: 26 }}>{icon}</span>
                <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em', color: NAVY }}>{title}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: NAVY2 }}>{body}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Your account" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,.75)', borderRadius: 30, padding: '22px 20px 20px', boxShadow: '0 24px 60px rgba(35,46,122,.12), inset 0 0 0 1px rgba(35,46,122,.08)' }}>
            <span style={{ display: 'block', margin: '0 6px 12px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: NAVY }}>Sign in to Pockets</span>
            {busy ? <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 15, fontWeight: 600, color: NAVY }}>{busy}</div>
              : <SignInForm onDone={afterSignIn} askName dark />}
          </div>
          <span style={{ margin: '0 10px', fontSize: 12.5, lineHeight: 1.45, color: NAVY2, opacity: 0.85 }}>Use the same account as on your iPhone and your data comes right back. Only you can see it.</span>
          <details style={{ marginTop: 6, background: 'rgba(255,255,255,.45)', borderRadius: 24, padding: '14px 16px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: NAVY }}>Start without an account</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" autoComplete="given-name" aria-label="Name for starting without an account"
                style={{ border: 0, borderRadius: 16, background: 'var(--surface)', fontSize: 15, color: TEXT, padding: '13px 16px', outline: 'none' }} />
              {option('🧭', 'Quick tour', 'Try every feature on a practice copy', () => startTour('first', who || 'there'))}
              {option('✨', 'Start from scratch', 'Data stays only in this browser', () => scratch())}
              {option('🧪', 'Try it with sample data', 'Made-up accounts and expenses', sample)}
              {option('📂', 'Restore a backup file', 'Bring back a Pockets backup', restore)}
            </div>
          </details>
        </section>
      </main>
    </div>
  );

  return (
    <div className="noscroll force-light" style={{ position: 'absolute', inset: 0, zIndex: 80, overflowY: 'auto', background: 'linear-gradient(180deg, #f8f5ee 0%, #ebe3d2 100%)' }}>
      {/* Screen 1: the account */}
      <section aria-label="Your account" style={{ minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: 'calc(var(--top) + 18px) 22px 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <img src="./pockets-mark.svg" alt="" width={60} height={73} />
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.035em', color: NAVY }}>Pockets</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.4, color: NAVY2, maxWidth: 300 }}>Split your income into weekly pockets and always know what's safe to spend.</span>
          <div style={{ marginTop: 6 }}><LangSwitch /></div>
        </div>
        <div style={{ marginTop: 16, background: 'rgba(255,255,255,.55)', borderRadius: 26, padding: '12px 14px 14px' }}>
          {busy ? <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 15, fontWeight: 600, color: NAVY }}>{busy}</div>
            : <SignInForm onDone={afterSignIn} askName dark />}
        </div>
        <span style={{ margin: '10px 8px 0', fontSize: 12, lineHeight: 1.4, color: NAVY2, opacity: 0.8, textAlign: 'center' }}>With an account, your data is backed up to the cloud after every change, and only you can see it.</span>
        <div style={{ flex: 1, minHeight: 12 }} />
        <button onClick={e => (e.currentTarget.closest('.noscroll') as HTMLElement)?.scrollTo({ top: (e.currentTarget.closest('section') as HTMLElement).offsetHeight, behavior: 'smooth' })}
          style={{ alignSelf: 'center', marginTop: 12, border: 0, background: 'transparent', color: NAVY, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingBottom: 'var(--tb)' }}>
          More ways to start, without an account
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>⌄</span>
        </button>
      </section>

      {/* Screen 2: the other ways to start */}
      <section aria-label="Other ways to start" style={{ padding: '8px 22px calc(var(--tb) + 24px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ margin: '0 4px', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: NAVY }}>Start without an account</span>
        <span style={{ margin: '-4px 4px 4px', fontSize: 13, lineHeight: 1.4, color: NAVY2 }}>Your data stays only on this phone. You can turn on cloud backup later in Profile.</span>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: NAVY2 }}>What should we call you?</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" aria-label="Name for starting without an account"
            style={{ border: 0, borderRadius: 18, background: 'var(--surface)', fontSize: 16, color: TEXT, padding: '15px 18px', outline: 'none' }} />
        </label>
        {option('🧭', 'Quick tour', 'Try every feature on a practice copy, then keep it or start clean', () => startTour('first', who || 'there'))}
        {option('✨', 'Start from scratch', 'Add your own accounts, pockets and income', () => scratch())}
        {option('🧪', 'Try it with sample data', 'Explore with made-up accounts and expenses', sample)}
        {option('📂', 'Restore a backup file', 'Bring back your data from a backup file', restore)}
        <span style={{ marginTop: 6, fontSize: 12, color: NAVY2, opacity: 0.75, textAlign: 'center' }}>You can replay the tour anytime from Profile.</span>
      </section>
    </div>
  );
}
