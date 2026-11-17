import { useEffect, useState } from 'react';
import { glyph } from '../ui/PocketIcons';
import { getSync, pullForWelcome, subscribeSync, withoutMarking } from '../lib/cloud';
import { takeHandoff, type Handoff } from '../lib/handoff';
import { ArrivalScreen, dropVeil, holdVeil } from '../ui/ArrivalVeil';
import { SignInForm } from '../sheets/CloudSheet';
import { finishWelcome, flash, normalize, setUI } from '../lib/store';
import { PrivacyBody } from '../sheets/PrivacySheet';
import { emptyData, sampleData } from '../lib/seed';
import { pickBackupFile, readBackup } from '../lib/backup';
import { TEXT } from '../lib/constants';
import * as I from '../ui/icons';
import { useDesk } from '../ui/Desk';
import { LangSwitch } from '../ui/LangSwitch';

const NAVY = '#1f5f5a', NAVY2 = '#3c6b66';

/**
 * First open on a device. On the phone: one big "Start" that opens the setup, "I have an account" for people
 * coming back, and "More options" (sample data, a backup file). On a computer the account comes first.
 */
// The website's note, read once per page load (outside React so StrictMode's double render can't lose it).
let pending: Handoff | null | undefined;
const pendingHandoff = () => (pending === undefined ? (pending = takeHandoff()) : pending);

export default function Welcome() {
  // Arriving from the website: show only a calm loading screen, never this welcome page in between.
  const [arriving, setArriving] = useState(() => { const h = pendingHandoff(); return h?.kind === 'signedin' || h?.kind === 'sample'; });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const who = name.trim();
  const desk = useDesk();

  const scratch = (n = who) => {
    const d = emptyData(sampleData());
    finishWelcome({ ...d, settings: { ...d.settings, name: n || 'there', lastBackup: undefined, tourSeen: true } });
    setUI({ setup: true });
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
      else { scratch(n); flash(created ? 'Account created · it backs up as you go' : 'Signed in · let\'s set things up'); }
    } catch (e) { flash((e as Error).message); setArriving(false); dropVeil(); }
    setBusy(null);
  };

  // Coming from the website: finish what was started there (sign-in, or sample data).
  useEffect(() => {
    const h = pendingHandoff(); pending = null;
    if (!h) return;
    if (h.kind === 'sample') { holdVeil('Opening Pockets…'); sample(); return; }
    if (h.kind !== 'signedin') return;
    holdVeil('Bringing back your data…');
    setBusy('Bringing back your data…');
    let done = false;
    const go = () => { if (done || !getSync().uid) return; done = true; stop(); clearTimeout(t); afterSignIn({ created: h.created, name: h.name }); };
    const stop = subscribeSync(go);
    // If the sign-in didn't carry over, show the normal welcome so they can sign in here.
    const t = setTimeout(() => { if (done) return; done = true; stop(); setBusy(null); setArriving(false); dropVeil(); flash('Sign in again to continue'); }, 12000);
    go();
    // No cleanup on purpose: the note is read once, so the wait must survive React's dev double-run.
  }, []);

  const option = (icon: string, title: string, sub: string, onClick: () => void) => (
    <button onClick={onClick} disabled={!!busy} style={{ width: '100%', textAlign: 'left', border: 0, borderRadius: 22, padding: '14px 16px', background: 'var(--surface)', color: TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'inset 0 0 0 1px rgba(35,46,122,.12)' }}>
      <span aria-hidden="true" style={{ fontSize: 22, width: 30, display: 'flex', justifyContent: 'center', color: 'var(--brand)' }}>{glyph(icon)}</span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 13, opacity: 0.65 }}>{sub}</span>
      </span>
      <I.Chevron size={18} />
    </button>
  );

  const link = { border: 0, background: 'transparent', color: NAVY, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', textAlign: 'center' as const, padding: '8px 0', width: '100%' };
  const promise = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.6)', borderRadius: 22, padding: '12px 14px', boxShadow: 'inset 0 0 0 1px rgba(35,46,122,.08)' }}>
      <span aria-hidden="true" style={{ display: 'flex', fontSize: 22, color: NAVY }}>{glyph('pk:lock')}</span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: NAVY }}>Your data lives on your phone. We never sell or share it.</span>
        <button onClick={() => setPrivacy(true)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, color: NAVY2, fontSize: 13, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>How we protect your privacy</button>
      </span>
    </div>
  );

  const privacyModal = privacy && (
    <div data-modal role="dialog" aria-label="Your privacy" className="noscroll" style={{ position: 'fixed', inset: 0, zIndex: 90, overflowY: 'auto', background: 'var(--page)', padding: 'calc(var(--top) + 14px) 20px calc(var(--tb) + 24px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: TEXT }}>Your privacy</span>
        <button onClick={() => setPrivacy(false)} aria-label="Close" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.X size={16} sw={2.5} /></button>
      </div>
      <PrivacyBody />
    </div>
  );

  const features: [string, string, string][] = [
    ['pk:pocket', 'Weekly pockets', "Split your income into pockets and see what's safe to spend today, this week and this month."],
    ['pk:cloud', 'Same data everywhere', 'Sign in on your iPhone and here: every change backs up to the cloud and shows up on both.'],
    ['pk:beach', 'Trips with friends', 'Share expenses, see who owes what, settle up in the fewest payments and chat.'],
    ['pk:chart', 'Net worth and investments', 'Accounts, cards, stocks and CDTs in one place, with reports you can filter.']
  ];
  if (arriving) return <ArrivalScreen text="Bringing back your data…" />;
  if (desk) return (
    <div className="noscroll force-light" style={{ position: 'absolute', inset: 0, zIndex: 80, overflowY: 'auto', background: 'linear-gradient(160deg, #fbf9f3 0%, #ebe3d2 100%)' }}>
      <header style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 48px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="./pockets-mark.svg" alt="" width={40} height={40} />
        <span className="wordmark" style={{ fontSize: 26, fontWeight: 800, color: NAVY }}>Pockets</span>
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
                <span aria-hidden="true" style={{ fontSize: 26, display: 'flex', color: NAVY }}>{glyph(icon)}</span>
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
          {promise}
          <details style={{ marginTop: 6, background: 'rgba(255,255,255,.45)', borderRadius: 24, padding: '14px 16px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: NAVY }}>Start without an account</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" autoComplete="given-name" aria-label="Name for starting without an account"
                style={{ border: 0, borderRadius: 16, background: 'var(--surface)', fontSize: 15, color: TEXT, padding: '13px 16px', outline: 'none' }} />
              {option('pk:sparkle', 'Start from scratch', 'Data stays only in this browser', () => scratch())}
              {option('pk:flask', 'Try it with sample data', 'Made-up accounts and expenses', sample)}
              {option('pk:folder', 'Restore a backup file', 'Bring back a Pockets backup', restore)}
            </div>
          </details>
        </section>
      </main>
      {privacyModal}
    </div>
  );

  return (
    <div className="noscroll force-light" style={{ position: 'absolute', inset: 0, zIndex: 80, overflowY: 'auto', background: 'linear-gradient(180deg, #f8f5ee 0%, #ebe3d2 100%)' }}>
      <section aria-label="Start" style={{ minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, padding: 'calc(var(--top) + 18px) 22px calc(var(--tb) + 24px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <img src="./pockets-mark.svg" alt="" width={64} height={64} />
          <span className="wordmark" style={{ fontSize: 32, fontWeight: 800, color: NAVY }}>Pockets</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.4, color: NAVY2, maxWidth: 300 }}>Split your income into pockets and always know what's safe to spend.</span>
          <div style={{ marginTop: 6 }}><LangSwitch /></div>
        </div>
        {promise}
        <div style={{ flex: 1, minHeight: 8 }} />
        {busy ? <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 15, fontWeight: 600, color: NAVY }}>{busy}</div> : signIn ? (
          <div style={{ background: 'rgba(255,255,255,.55)', borderRadius: 26, padding: '12px 14px 14px' }}>
            <SignInForm onDone={afterSignIn} askName dark />
            <button onClick={() => setSignIn(false)} style={{ ...link, marginTop: 8 }}>Back</button>
          </div>
        ) : <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: NAVY2 }}>What should we call you?</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" aria-label="Your name"
              style={{ border: 0, borderRadius: 18, background: 'var(--surface)', fontSize: 16, color: TEXT, padding: '15px 18px', outline: 'none' }} />
          </label>
          <button onClick={() => scratch()} className="pr97" style={{ height: 58, borderRadius: 999, border: 0, background: 'var(--action)', color: 'var(--action-ink)', fontSize: 18, fontWeight: 800, cursor: 'pointer' }}>Start</button>
          <button onClick={() => setSignIn(true)} style={{ height: 50, borderRadius: 999, border: 0, background: 'rgba(255,255,255,.7)', color: NAVY, fontSize: 15.5, fontWeight: 700, cursor: 'pointer' }}>I already have an account</button>
          <details style={{ marginTop: 2 }}>
            <summary style={{ ...link, listStyle: 'none' }}>More options</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {option('pk:flask', 'Try it with sample data', 'Explore with made-up accounts and expenses', sample)}
              {option('pk:folder', 'Restore a backup file', 'Bring back your data from a backup file', restore)}
            </div>
          </details>
        </>}
      </section>
      {privacyModal}
    </div>
  );
}
