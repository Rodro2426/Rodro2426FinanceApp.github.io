// First-time setup after creating an account (or starting from scratch): one question at a time, each a glass pill
// that opens into a card, over a dark screen with the glowing Pockets flower and a breathing mint/lavender light.
// The motion copies the approved mock (mocks/welcome-motion/compositions/opt-a.html). Every step saves as you go.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { closeSheet, flash, getData, replaceData, setData, setUI, useApp } from '../lib/store';
import type { Data } from '../lib/types';
import { emptyData } from '../lib/seed';
import { pickPhoto } from '../lib/photo';
import { findLogo, siteHost } from '../lib/logo';
import { fmt, num, periodsInMonth } from '../lib/derive';
import { BANKS, BILLS, bankLogo, leftFree, makeAccount, makeBills, makeCard, makeIncome, makePockets, suggestPockets, weeklyOf, type BillPick, type PocketPick } from '../lib/setup';
import { newQuickKey, quickAccount } from '../lib/quickadd';
import { pushQuickMenu } from '../lib/quickaddSync';
import { useSync } from '../sheets/CloudSheet';
import { SHORTCUT_LINK } from '../sheets/QuickAddSheet';
import { isIOS } from './InstallGuide';
import { MoneyInput } from '../ui/MoneyInput';
import { TutorialVideoButton } from '../ui/TutorialVideo';
import { glyph } from '../ui/PocketIcons';

type Step = 'hello' | 'account' | 'card' | 'income' | 'bills' | 'pockets' | 'split' | 'applepay' | 'done';

// Colours come from CSS (styles.css, .setup): dark or light with the app's theme, so the iPhone's top bar matches.
const INK = 'var(--su-ink)', SOFT = 'var(--su-soft)', MINT = 'var(--su-accent)', DEEP = 'var(--su-on-accent)';
const PILL = 76, R_PILL = 38, R_CARD = 36, EDGE = 2;
const OPEN = 850, CLOSE = 800, SHAPE = 'cubic-bezier(0.76, 0, 0.24, 1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** The outline (ring) and the glass (panel) always get the same shape, the panel EDGE px inside it. */
const shapes = (h: number) => {
  const cut = Math.max(0, h - PILL);
  return {
    dot: [`inset(0px 45% ${cut}px 45% round ${R_PILL}px)`, `inset(${EDGE}px calc(45% + ${EDGE}px) ${cut + EDGE}px calc(45% + ${EDGE}px) round ${R_PILL - EDGE}px)`],
    pill: [`inset(0px 0% ${cut}px 0% round ${R_PILL}px)`, `inset(${EDGE}px calc(0% + ${EDGE}px) ${cut + EDGE}px calc(0% + ${EDGE}px) round ${R_PILL - EDGE}px)`],
    card: [`inset(0px 0% 0px 0% round ${R_CARD}px)`, `inset(${EDGE}px calc(0% + ${EDGE}px) ${EDGE}px calc(0% + ${EDGE}px) round ${R_CARD - EDGE}px)`]
  };
};

const QUESTION: Record<Step, string> = {
  hello: 'Welcome to Pockets', account: "What's your main bank?", card: 'Do you have a credit card?', income: 'How much do you earn a month?',
  pockets: 'What do you spend on each month?', split: 'How your income splits', bills: 'Any fixed bills?', applepay: 'Add your Apple Pay purchases on their own?', done: 'All set'
};

export default function Setup() {
  const { data: d } = useApp();
  const sync = useSync();
  const steps: Step[] = ['hello', 'account', 'card', 'income', 'bills', 'pockets', 'split', ...(isIOS() && sync.uid ? ['applepay' as Step] : []), 'done'];
  const [step, setStep] = useState<Step>(() => { const s = getData().settings.setupStep as Step | undefined; return s && QUESTION[s] ? s : 'hello'; });
  // Reopened on a step that isn't in today's list (e.g. Apple Pay before the sign-in loaded): keep it, just before Done.
  if (!steps.includes(step)) steps.splice(steps.length - 1, 0, step);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const shape = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const q = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), logo = useRef<HTMLSpanElement>(null), scroller = useRef<HTMLDivElement>(null);

  // The shape the outline and the glass are in now. The end shape is also written on the element itself, so when the
  // card under it grows or shrinks (a new step), it can be recomputed for the new height before anything is drawn.
  const phase = useRef<'dot' | 'pill' | 'card'>('dot');
  const setShape = (p: 'dot' | 'pill' | 'card') => {
    const s = shapes(shape.current?.offsetHeight ?? 400);
    [ring.current, panel.current].forEach((el, i) => { if (!el) return; el.getAnimations().forEach(a => a.cancel()); el.style.clipPath = s[p][i]; });
    phase.current = p;
  };
  const morph = (from: 'dot' | 'pill' | 'card', to: 'pill' | 'card', ms: number, ease: string) => {
    const s = shapes(shape.current?.offsetHeight ?? 400);
    let done: Promise<unknown> = Promise.resolve();
    [ring.current, panel.current].forEach((el, i) => {
      if (!el) return;
      el.getAnimations().forEach(a => a.cancel());
      el.style.clipPath = s[to][i];
      const a = el.animate([{ clipPath: s[from][i] }, { clipPath: s[to][i] }], { duration: ms, easing: ease });
      if (i === 0) done = a.finished.catch(() => undefined);
    });
    phase.current = to;
    return done;
  };
  const fade = (el: HTMLElement | null, on: boolean, ms: number) => el?.animate(
    on ? [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }]
      : [{ opacity: 1 }, { opacity: 0 }],
    { duration: ms, easing: on ? 'cubic-bezier(0.23, 1, 0.32, 1)' : 'ease-in', fill: 'forwards' }
  ).finished.catch(() => undefined);
  const pulse = () => logo.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-out' });

  /** Opens the current step: the question shows in the pill, then the pill opens into the card. */
  const reveal = async (first: boolean) => {
    if (reduced()) { setOpen(true); q.current && (q.current.style.opacity = '0'); await fade(body.current, true, 200); setBusy(false); return; }
    if (first) { await wait(200); morph('dot', 'pill', 650, 'cubic-bezier(0.16, 1, 0.3, 1)'); await wait(200); }
    await fade(q.current, true, 350);
    await wait(first ? 450 : 250);
    pulse();
    fade(q.current, false, 220);
    setOpen(true);
    const opening = morph('pill', 'card', OPEN, SHAPE);
    await wait(OPEN * 0.65);
    await fade(body.current, true, 320);
    await opening;
    setBusy(false);
  };
  useLayoutEffect(() => {
    // Start hidden: no shape, no text.
    setShape('dot');
    if (body.current) body.current.style.opacity = '0';
    if (q.current) q.current.style.opacity = '0';
  }, []);
  // A new step's card has another height: fit the pill (or dot) to it before the screen is drawn, or the old shape
  // flashes for a frame at the wrong size.
  useLayoutEffect(() => { if (phase.current !== 'card') setShape(phase.current); }, [step]);
  useEffect(() => { reveal(true); }, []);
  useEffect(() => { setData(x => (x.settings.setupStep === step ? {} : { settings: { ...x.settings, setupStep: step } })); }, [step]);

  /** Next (or another) step: the card folds back into a pill, the next question appears, and it opens again. */
  const go = async (to: Step) => {
    if (busy) return;
    setBusy(true);
    if (reduced()) { await fade(body.current, false, 150); setStep(to); scroller.current?.scrollTo(0, 0); await wait(30); await fade(body.current, true, 200); setBusy(false); return; }
    await fade(body.current, false, 200);
    pulse();
    setOpen(false);
    await morph('card', 'pill', CLOSE, SHAPE);
    setStep(to);
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
    await wait(60);
    await reveal(false);
  };
  const next = () => go(steps[Math.min(steps.length - 1, steps.indexOf(step) + 1)]);
  // What the data looked like when each step opened: going back to a step puts that back, so what the step saved is undone.
  const before = useRef<Partial<Record<Step, Data>>>({});
  useEffect(() => { before.current[step] = getData(); }, [step]);
  const prev = steps[steps.indexOf(step) - 1];
  const back = () => {
    const snap = prev && before.current[prev];
    if (!snap || busy) return;
    replaceData({ ...snap, settings: { ...getData().settings, ...snap.settings, setupStep: prev } });
    go(prev);
  };
  const finish = () => { setData(x => ({ settings: { ...x.settings, setupStep: undefined } })); setUI({ setup: false, tab: 'home' }); flash('Your Pockets is ready'); };

  const idx = steps.indexOf(step);
  const name = d.settings.name && d.settings.name !== 'there' ? d.settings.name : '';
  return (
    <div ref={scroller} className="noscroll setup" role="dialog" aria-label="Set up Pockets" style={{ position: 'absolute', inset: 0, zIndex: 85, overflowY: 'auto', overflowX: 'hidden', background: 'var(--su-bg)', color: INK }}>
      {/* Clipped, so the wide light never makes the page scroll sideways. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1100, overflow: 'hidden', pointerEvents: 'none' }}>
        <div className={'setup-glow' + (open ? ' open' : '')}><i /><i /><i /></div>
      </div>
      <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto', padding: 'calc(var(--top) + 8px) 18px calc(var(--tb) + 40px)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Back only while this visit remembers what the earlier step looked like (not after the app was reopened). */}
          <button onClick={back} disabled={busy} aria-label="Back" style={{ ...ghost, width: 44, fontSize: 26, visibility: prev && before.current[prev] ? 'visible' : 'hidden' }}>‹</button>
          {step !== 'done' && step !== 'hello' && <button onClick={next} disabled={busy} style={{ ...ghost, width: 'auto', padding: '0 14px', fontSize: 15, fontWeight: 600 }}>Skip</button>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 26px' }}>
          <div className="setup-logo"><span ref={logo} style={{ display: 'block' }}><img className="su-mark-dark" src="./pockets-mark-dark.svg" alt="" width={64} height={64} /><img className="su-mark-light" src="./pockets-mark.svg" alt="" width={64} height={64} /></span></div>
        </div>
        <div ref={shape} style={{ position: 'relative' }}>
          <div ref={ring} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}><div className="setup-spin" /></div>
          <div ref={panel} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--su-panel)' }} />
          <div ref={q} aria-live="polite" style={{ position: 'absolute', left: 24, right: 24, top: 0, height: PILL, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 18, fontWeight: 600, pointerEvents: 'none' }}>{QUESTION[step]}</div>
          <div ref={body} style={{ position: 'relative', padding: '28px 22px 22px', minHeight: 180, pointerEvents: busy ? 'none' : undefined }}>
            {step === 'hello' && <Hello name={name} onStart={next} />}
            {step === 'account' && <AccountStep onDone={next} />}
            {step === 'card' && <CardStep onDone={next} />}
            {step === 'income' && <IncomeStep onDone={next} />}
            {step === 'pockets' && <PocketsStep onDone={next} />}
            {step === 'split' && <SplitStep onDone={next} />}
            {step === 'bills' && <BillsStep onDone={next} />}
            {step === 'applepay' && <ApplePayStep onDone={next} />}
            {step === 'done' && <Done name={name} onFinish={finish} />}
          </div>
        </div>
        <div aria-hidden="true" style={{ marginTop: 'auto', paddingTop: 28, display: 'flex', justifyContent: 'center', gap: 7 }}>
          {steps.map((s, i) => <span key={s} style={{ height: 7, width: i === idx ? 22 : 7, borderRadius: 4, background: i === idx ? MINT : 'var(--su-dot)', transition: `width .5s ${SHAPE}, background .5s` }} />)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pieces ---------------- */
const ghost: CSSProperties = { height: 44, borderRadius: 999, border: 0, background: 'var(--su-fill)', color: INK, fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 16, background: 'var(--su-fill)', color: INK, fontSize: 17, fontWeight: 600, padding: '14px 16px', outline: 'none' };
const H = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{children}</div>;
const Sub = ({ children }: { children: ReactNode }) => <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.4, color: SOFT }}>{children}</div>;
const Label = ({ children }: { children: ReactNode }) => <div style={{ margin: '18px 2px 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: SOFT }}>{children}</div>;
function Chip({ on, onClick, children, icon }: { on?: boolean; onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return <button onClick={onClick} aria-pressed={!!on} className="pr97" style={{ height: 44, padding: icon ? '0 16px 0 7px' : '0 16px', borderRadius: 22, border: 0, background: on ? MINT : 'var(--su-fill)', color: on ? DEEP : INK, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background .25s, color .25s' }}>{icon}{children}</button>;
}
function Main({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="pr97" style={{ width: '100%', height: 54, marginTop: 24, borderRadius: 27, border: 0, background: MINT, color: DEEP, fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: disabled ? 0.4 : 1, transition: 'opacity .2s' }}>{children}</button>;
}
const Money = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => <MoneyInput value={value} onChange={onChange} ariaLabel={label} style={field} />;
/** A box to type your own name for something the suggestions don't have, with an Add button. */
function OwnName({ placeholder, onAdd, label }: { placeholder: string; onAdd: (name: string) => void; label: string }) {
  const [v, setV] = useState('');
  const add = () => { if (v.trim()) { onAdd(v.trim()); setV(''); } };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder={placeholder} aria-label={label} enterKeyHint="done" style={{ ...field, flex: 1, minWidth: 0 }} />
      <button onClick={add} disabled={!v.trim()} className="pr97" style={{ flex: 'none', padding: '0 16px', borderRadius: 16, border: 0, background: v.trim() ? INK : 'var(--su-fill)', color: v.trim() ? DEEP : SOFT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Add</button>
    </div>
  );
}
const Logo = ({ src, size = 32, pad }: { src: string | null; size?: number; pad?: boolean }) => src
  ? <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), overflow: 'hidden', background: '#fff', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 1px var(--su-line)' }}><img src={src} alt="" width={size} height={size} style={{ width: pad ? '72%' : '100%', height: pad ? '72%' : '100%', objectFit: 'contain' }} /></span>
  : null;
const padded = (name: string) => !!BANKS.find(b => b.name === name)?.pad;

/** For a bank typed by hand: a photo from the phone, or the logo of its website. */
function OwnLogo({ name, photo, onPhoto }: { name: string; photo: string | null; onPhoto: (p: string | null) => void }) {
  const [site, setSite] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'none'>('idle');
  const get = () => {
    if (!siteHost(site) || state === 'busy') return;
    setState('busy');
    findLogo(site).then(u => { if (u) { onPhoto(u); setSite(''); } setState(u ? 'idle' : 'none'); });
  };
  const small: CSSProperties = { flex: 'none', height: 40, padding: '0 14px', borderRadius: 14, border: 0, background: 'var(--su-fill2)', color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
  return (
    <div style={{ margin: '8px 0 6px', padding: 10, borderRadius: 16, background: 'var(--su-card2)' }}>
      <div style={{ fontSize: 13, color: SOFT, margin: '0 2px 8px' }}>{`Logo for ${name}`}</div>
      <button onClick={() => pickPhoto().then(p => p && onPhoto(p))} className="pr97" style={{ ...small, width: '100%' }}>{photo ? 'Change photo' : 'Add photo'}</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={site} onChange={e => { setSite(e.target.value); setState('idle'); }} onKeyDown={e => { if (e.key === 'Enter') get(); }} placeholder="or its website" aria-label={`Website of ${name}`} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          style={{ ...field, flex: 1, minWidth: 0, padding: '10px 12px', fontSize: 14, height: 40 }} />
        {site.trim() && <button onClick={get} disabled={!siteHost(site) || state === 'busy'} className="pr97" style={{ ...small, background: MINT, color: DEEP }}>{state === 'busy' ? '…' : 'Logo'}</button>}
      </div>
      {state === 'none' && <div style={{ marginTop: 6, fontSize: 13, color: SOFT }}>No logo found for that website. Check the address, or add a photo instead.</div>}
    </div>
  );
}

/* ---------------- Steps ---------------- */
function Hello({ name, onStart }: { name: string; onStart: () => void }) {
  return <>
    <H>{name ? `Hi, ${name}` : 'Hi there'}</H>
    <Sub>Let's set up your money in 2 minutes: your bank, your income and your pockets. You can skip anything and change it later.</Sub>
    <Main onClick={onStart}>Let's start</Main>
  </>;
}

function AccountStep({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<{ name: string; bal: string; photo?: string | null }[]>([]);
  const own = (n: string) => !BANKS.some(b => b.name === n);
  const setPhoto = (n: string, photo: string | null) => setRows(x => x.map(y => (y.name === n ? { ...y, photo } : y)));
  const has = (n: string) => rows.some(r => r.name === n);
  const toggle = (n: string) => setRows(r => (has(n) ? r.filter(x => x.name !== n) : [...r, { name: n, bal: '' }]));
  const save = () => {
    const ok = rows.filter(r => r.name.trim());
    // One after another, so each new account gets the next colour.
    if (ok.length) setData(x => ({ accounts: ok.reduce((acc, r) => [...acc, makeAccount({ ...x, accounts: acc }, r.name, num(r.bal), r.photo)], x.accounts) }));
    onDone();
  };
  return <>
    <H>Your accounts</H>
    <Sub>Tap your bank (or several) and add its logo in one go. Not on the list? Type it below.</Sub>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
      {BANKS.map(b => <Chip key={b.name} on={has(b.name)} onClick={() => toggle(b.name)} icon={<Logo src={bankLogo(b.name)} pad={b.pad} />}>{b.name}</Chip>)}
      {rows.filter(r => own(r.name)).map(r => <Chip key={r.name} on onClick={() => toggle(r.name)} icon={<Logo src={r.photo ?? null} />}>{r.name}</Chip>)}
    </div>
    <OwnName placeholder="Another bank or wallet" label="Your own bank name" onAdd={n => !has(n) && setRows(r => [...r, { name: n, bal: '' }])} />
    {rows.length > 0 && <Label>How much is in each one now?</Label>}
    {rows.map(r => (
      <div key={r.name} style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo src={own(r.name) ? r.photo ?? null : bankLogo(r.name)} size={36} pad={padded(r.name)} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
          <div style={{ width: '52%' }}><Money value={r.bal} onChange={v => setRows(x => x.map(y => (y.name === r.name ? { ...y, bal: v } : y)))} label={`Balance of ${r.name}`} /></div>
        </div>
        {own(r.name) && <OwnLogo name={r.name} photo={r.photo ?? null} onPhoto={p => setPhoto(r.name, p)} />}
      </div>
    ))}
    <Main onClick={save} disabled={!rows.length}>Continue</Main>
  </>;
}

function CardStep({ onDone }: { onDone: () => void }) {
  const [yes, setYes] = useState<boolean | null>(null);
  const [f, setF] = useState({ name: '', limit: '', owed: '', cut: '', pay: '' });
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const save = () => {
    if (yes && f.name.trim()) setData(x => ({ accounts: [...x.accounts, makeCard(x, f.name, num(f.owed), num(f.limit), num(f.cut), num(f.pay))] }));
    onDone();
  };
  const day = (k: 'cut' | 'pay', label: string, ph: string) => (
    <label style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', margin: '0 2px 6px', fontSize: 13, color: SOFT }}>{label}</span>
      <input inputMode="numeric" value={f[k]} placeholder={ph} aria-label={label} onChange={e => set(k)(e.target.value.replace(/\D/g, '').slice(0, 2))} style={field} /></label>
  );
  return <>
    <H>Credit card</H>
    <Sub>Pockets keeps track of what you owe and reminds you before the pay-by day.</Sub>
    <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
      <Chip on={yes === true} onClick={() => setYes(true)}>Yes, I have one</Chip>
      <Chip on={yes === false} onClick={() => setYes(false)}>No</Chip>
    </div>
    {yes && <>
      <Label>Card name</Label>
      <input value={f.name} onChange={e => set('name')(e.target.value)} placeholder="Visa Davivienda" aria-label="Card name" style={field} />
      <Label>Credit limit</Label>
      <Money value={f.limit} onChange={set('limit')} label="Credit limit" />
      <Label>What you owe today</Label>
      <Money value={f.owed} onChange={set('owed')} label="What you owe today" />
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>{day('cut', 'Cutoff day', '25')}{day('pay', 'Pay-by day', '10')}</div>
    </>}
    <Main onClick={save} disabled={yes === null || (yes && !f.name.trim())}>Continue</Main>
  </>;
}

function IncomeStep({ onDone }: { onDone: () => void }) {
  const { data: d } = useApp();
  const own = d.accounts.filter(a => a.type !== 'card' && !a.notMine);
  const [amt, setAmt] = useState(num(d.incomeStr) ? d.incomeStr : '');
  const [pay, setPay] = useState<'month' | 'half'>('month');
  const [day, setDay] = useState('30');
  const [acct, setAcct] = useState(own[0]?.id ?? '');
  const save = () => {
    const made = makeIncome(num(amt), pay, num(day), acct);
    setData(x => ({ incomeStr: made.incomeStr, bills: [...x.bills, ...(acct ? made.bills : [])] }));
    onDone();
  };
  return <>
    <H>Your income</H>
    <Sub>What arrives each month after deductions. Pockets splits it into your pockets.</Sub>
    <Label>Every month</Label>
    <Money value={amt} onChange={setAmt} label="Monthly income" />
    <Label>How you're paid</Label>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip on={pay === 'month'} onClick={() => setPay('month')}>Once a month</Chip>
      <Chip on={pay === 'half'} onClick={() => setPay('half')}>Quincena (15 and 30)</Chip>
    </div>
    {pay === 'month' && <><Label>Payday</Label><input inputMode="numeric" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label="Payday" style={{ ...field, width: 110 }} /></>}
    {own.length > 1 && <><Label>It arrives in</Label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{own.map(a => <Chip key={a.id} on={acct === a.id} onClick={() => setAcct(a.id)} icon={<Logo src={a.photo ?? null} pad={padded(a.name)} />}>{a.name}</Chip>)}</div></>}
    {!own.length && <Sub>Add a bank account first to have your pay arrive on its own. The amount is still used for your pockets.</Sub>}
    <Main onClick={save} disabled={!(num(amt) > 0)}>Continue</Main>
  </>;
}

function PocketsStep({ onDone }: { onDone: () => void }) {
  const { data: d } = useApp();
  const income = num(d.incomeStr), weeks = d.settings.weeks || 4;
  const [picks, setPicks] = useState<PocketPick[]>(() => suggestPockets(income));
  const free = leftFree(income, picks, d.bills.filter(b => b.kind !== 'Income').map(b => ({ on: true, amt: b.amt })));
  const upd = (key: string, patch: Partial<PocketPick>) => setPicks(p => p.map(x => (x.key === key ? { ...x, ...patch } : x)));
  const save = () => { const ps = makePockets(picks, weeks); if (ps.length) setData(x => ({ pockets: [...x.pockets, ...ps] })); onDone(); };
  return <>
    <H>Your pockets</H>
    <Sub>Money for each kind of spending. Type what you spend on each one a month; Pockets splits it into weeks. We suggested amounts from your income.</Sub>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
      {picks.map(p => <Chip key={p.key} on={p.on} onClick={() => upd(p.key, { on: !p.on })} icon={<span style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{glyph(p.emoji)}</span>}>{p.name}</Chip>)}
    </div>
    <OwnName placeholder="Your own pocket" label="Your own pocket name" onAdd={n => setPicks(p => [...p, { key: 'own:' + n + p.length, name: n, emoji: 'pk:pocket', share: 0, on: true, monthly: 0 }])} />
    {picks.some(p => p.on) && <Label>Each month</Label>}
    {picks.filter(p => p.on).map(p => (
      <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ width: 28, display: 'inline-flex', justifyContent: 'center', fontSize: 20 }}>{glyph(p.emoji)}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
        <div style={{ width: '48%' }}><Money value={p.monthly ? String(p.monthly) : ''} onChange={v => upd(p.key, { monthly: num(v) })} label={`Monthly budget for ${p.name}`} /></div>
      </div>
    ))}
    {income > 0 && <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 16, background: free < 0 ? 'rgba(229,72,77,0.16)' : 'var(--su-good)', fontSize: 15, fontWeight: 600 }}>
      {free < 0 ? `Over your income by ${fmt(-free)} a month` : `Left free each month: ${fmt(free)}`}
    </div>}
    <Main onClick={save} disabled={!picks.some(p => p.on)}>Continue</Main>
  </>;
}

/** The income as one bar: a slice per pocket, the fixed bills, and what's left to save. Sliders change each pocket's month. */
function SplitStep({ onDone }: { onDone: () => void }) {
  const { data: d } = useApp();
  const income = num(d.incomeStr), weeks = d.settings.weeks || 4;
  const bills = d.bills.filter(b => b.kind !== 'Income').reduce((a, b) => a + b.amt, 0);
  const [month, setMonth] = useState<Record<string, number>>(() => Object.fromEntries(d.pockets.map(p => [p.id, num(p.weeklyStr) * periodsInMonth(p, weeks)])));
  if (!income || !d.pockets.length) return <>
    <H>Your split</H>
    <Sub>{!income ? 'Add your monthly income to see how it splits into your pockets. You can do it later in the Budget tab.' : 'Add a pocket to see how your income splits. You can do it later in the Budget tab.'}</Sub>
    <Main onClick={onDone}>Continue</Main>
  </>;
  const used = Object.values(month).reduce((a, m) => a + m, 0) + bills, rest = income - used;
  const max = Math.max(income / 2, ...Object.values(month));
  const pct = (n: number) => `${Math.round(n / income * 100)}%`;
  const color = (h: number) => `oklch(0.74 0.12 ${h})`;
  const whole = Math.max(income, used);
  const segs: [string, number][] = [...d.pockets.map(p => [color(p.hue), month[p.id] ?? 0] as [string, number]), ['var(--su-soft)', bills], ['var(--su-accent)', Math.max(0, rest)]];
  const save = () => {
    setData(x => ({ pockets: x.pockets.map(p => (p.id in month ? { ...p, weeklyStr: String(weeklyOf(month[p.id], periodsInMonth(p, weeks))), perMonth: true } : p)) }));
    onDone();
  };
  return <>
    <H>Here's how your income splits</H>
    <Sub>Each pocket takes a slice of what you earn. Slide to give one more or less; what's left goes to savings.</Sub>
    <div style={{ marginTop: 18, padding: 16, borderRadius: 24, background: 'var(--su-card)', boxShadow: '0 0 0 1px var(--su-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: SOFT }}>Monthly income</span>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(income)}</span>
      </div>
      <div aria-hidden="true" style={{ marginTop: 12, height: 22, borderRadius: 999, background: 'var(--su-fill)', display: 'flex', gap: 2, overflow: 'hidden' }}>
        {segs.map(([c, v], i) => <div key={i} style={{ flex: `0 0 calc(${(v / whole) * 100}% - 2px)`, background: c, opacity: i === segs.length - 1 ? 0.35 : 1, transition: 'flex-basis .25s cubic-bezier(0.23, 1, 0.32, 1)' }} />)}
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 12, fontWeight: 600, color: SOFT }}>
        {[...d.pockets.map(p => [color(p.hue), p.name]), ...(bills ? [['var(--su-soft)', 'Bills']] : []), ['var(--su-accent)', 'Savings']].map(([c, n]) => <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: 4, background: c }} />{n}</span>)}
      </div>
      <div aria-live="polite" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--su-line)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 700, color: rest < 0 ? 'var(--su-red)' : INK }}>
        {rest >= 0 ? <><span>Left to save</span><span>{`${fmt(rest)} · ${pct(rest)}`}</span></> : <><span>Over your income by</span><span>{fmt(-rest)}</span></>}
      </div>
    </div>
    {d.pockets.map(p => {
      const m = month[p.id] ?? 0, c = color(p.hue), txt = `oklch(var(--su-hue-l) 0.13 ${p.hue})`, per = periodsInMonth(p, weeks);
      return <div key={p.id} style={{ marginTop: 10, padding: 14, borderRadius: 22, background: 'var(--su-card)', boxShadow: '0 0 0 1px var(--su-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 28, display: 'inline-flex', justifyContent: 'center', fontSize: 20, color: txt }}>{glyph(p.emoji || 'pk:pocket')}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: txt, fontVariantNumeric: 'tabular-nums' }}>{pct(m)}</span>
        </div>
        <input type="range" className="su-range" min={0} max={max} step={10000} value={m} aria-label={`${p.name} per month`} aria-valuetext={fmt(m)}
          onChange={e => setMonth(x => ({ ...x, [p.id]: Number(e.target.value) }))}
          style={{ '--c': c, '--p': `${(m / max) * 100}%` } as CSSProperties} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
          <span>{`${fmt(m)} a month`}</span>
          <span>{p.period === 'half' ? `${fmt(weeklyOf(m, per))} every 15 days` : `${fmt(weeklyOf(m, per))} a week`}</span>
        </div>
      </div>;
    })}
    <Main onClick={save}>Looks good</Main>
  </>;
}

function BillsStep({ onDone }: { onDone: () => void }) {
  const { data: d } = useApp();
  const [picks, setPicks] = useState<BillPick[]>(() => BILLS.map(b => ({ ...b, on: false, amt: 0, day: 5 })));
  const upd = (key: string, patch: Partial<BillPick>) => setPicks(p => p.map(x => (x.key === key ? { ...x, ...patch } : x)));
  const acct = (d.accounts.find(a => a.type === 'bank' && !a.notMine) ?? d.accounts.find(a => !a.notMine))?.id ?? '';
  const save = () => { const bs = makeBills(picks, acct); if (bs.length) setData(x => ({ bills: [...x.bills, ...bs] })); onDone(); };
  return <>
    <H>Fixed bills</H>
    <Sub>Rent, services and subscriptions. Pockets reminds you the day before and counts them in your month.</Sub>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
      {picks.map(b => <Chip key={b.key} on={b.on} onClick={() => upd(b.key, { on: !b.on })}>{b.name}</Chip>)}
    </div>
    <OwnName placeholder="Another bill" label="Your own bill name" onAdd={n => setPicks(p => [...p, { key: 'own:' + n + p.length, name: n, kind: 'Bill', cat: 'Home', sub: 'Utilities', on: true, amt: 0, day: 5 }])} />
    {picks.some(b => b.on) && <Label>Amount and day of the month</Label>}
    {picks.filter(b => b.on).map(b => (
      <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
        <div style={{ width: '42%' }}><Money value={b.amt ? String(b.amt) : ''} onChange={v => upd(b.key, { amt: num(v) })} label={`Amount of ${b.name}`} /></div>
        <input inputMode="numeric" value={String(b.day)} onChange={e => upd(b.key, { day: num(e.target.value.replace(/\D/g, '').slice(0, 2)) })} aria-label={`Day of ${b.name}`} style={{ ...field, width: 64, textAlign: 'center', padding: '14px 6px' }} />
      </div>
    ))}
    <Main onClick={save}>{picks.some(b => b.on && b.amt > 0) ? 'Continue' : 'No fixed bills'}</Main>
  </>;
}

function ApplePayStep({ onDone }: { onDone: () => void }) {
  const { data: d } = useApp();
  const qa = d.settings.quickAdd;
  const [busy, setBusy] = useState(false);
  // 'ready' → tap Get the Shortcut; 'away' → came back from Shortcuts, confirm it was added; 'added' → build the automation.
  const [stage, setStage] = useState<'ready' | 'away' | 'added'>('ready');
  const turnOn = async () => {
    setBusy(true);
    setData(x => ({ settings: { ...x.settings, quickAdd: { key: newQuickKey(), acct: quickAccount(x) } } }));
    const ok = await pushQuickMenu(true);
    setBusy(false);
    if (!ok) { setData(x => ({ settings: { ...x.settings, quickAdd: undefined } })); flash("Couldn't reach the Pockets server. You can turn this on later in Profile."); }
  };
  const getShortcut = async () => {
    const key = getData().settings.quickAdd?.key;
    try { if (key) await navigator.clipboard.writeText(key); } catch { /* the key is also shown below */ }
    setStage('away');
    // A fresh address each time: opening the very same link again only brought Shortcuts forward without the add screen.
    window.open(`${SHORTCUT_LINK}?open=${Date.now()}`, '_blank');
  };
  const copyKey = async () => { try { await navigator.clipboard.writeText(qa?.key ?? ''); flash('Key copied'); } catch { flash('Press and hold the key to copy it'); } };
  const card = (n: number, title: string, done: boolean, children: ReactNode) => (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 20, background: 'var(--su-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 14, background: MINT, color: DEEP, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{done ? '✓' : n}</span>
        <span style={{ fontSize: 16, fontWeight: 700, opacity: done ? 0.6 : 1 }}>{title}</span>
      </div>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
  const row = (icon: string, text: ReactNode, tint: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--su-row)', marginTop: 6, fontSize: 14, fontWeight: 600 }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flex: 'none' }}>{icon}</span><span>{text}</span>
    </div>
  );
  const btn = (label: string, onClick: () => void, light = false) => <button onClick={onClick} className="pr97" style={{ width: '100%', height: 48, marginTop: 10, borderRadius: 24, border: 0, background: light ? 'var(--su-fill2)' : INK, color: light ? INK : DEEP, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{label}</button>;
  return <>
    <H>Apple Pay</H>
    <Sub>When you pay with your iPhone, it asks for the pocket and Pockets adds the purchase for you.</Sub>
    {!qa ? <>
      <Main onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Yes, set it up'}</Main>
      <button onClick={onDone} style={{ display: 'block', margin: '14px auto 0', border: 0, background: 'transparent', color: SOFT, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Not now</button>
    </> : <>
      <TutorialVideoButton style={{ marginTop: 16, background: MINT, color: DEEP }} />
      {card(1, 'Add the Shortcut', stage === 'added', stage === 'added' ? null : <>
        {stage === 'ready' && <>
          <Sub>We copy your key and open the Shortcut. There: tap Set Up Shortcut, paste the key in the box, then tap Add Shortcut. If nothing happens, tap Skip Setup: your key is kept. Then come back to Pockets.</Sub>
          <Sub>Already have a Pockets shortcut from before? Delete it first in Shortcuts, so there's only one "Pockets Apple Pay".</Sub>
          {btn('Get the Shortcut', getShortcut)}
        </>}
        {stage === 'away' && <>
          <Sub>Did the Shortcut get added? If Pockets shows a blank page when you come back, tap ✕ at the top left.</Sub>
          {btn('Yes, I added it', () => setStage('added'))}
          {btn('Open it again', getShortcut, true)}
          <div style={{ marginTop: 10, fontSize: 13, color: SOFT }}>Your key, if it asks again: <span onClick={copyKey} style={{ color: INK, fontWeight: 600, userSelect: 'all', WebkitUserSelect: 'all', wordBreak: 'break-all', cursor: 'pointer' }}>{qa.key}</span></div>
        </>}
      </>)}
      {stage === 'added' && <>
        {card(2, 'Create the automation', false, <>
          <Sub>In Shortcuts → Automation → +, choose Transaction and your cards, turn Automation on, then add these two actions:</Sub>
          {row('▤', <span>Dictionary: <b>amount</b>, <b>merchant</b>, <b>card</b></span>, '#f2994a')}
          <div style={{ margin: '4px 0 0 46px', fontSize: 13, color: SOFT }}>Each one: Shortcut Input → Type Transaction → Amount, Merchant, Card or Pass</div>
          {row('◆', <span>Run Shortcut (not Open): <b>Pockets Apple Pay</b> · Input: Dictionary</span>, '#7a68b8')}
        </>)}
        {card(3, 'Pay and pick the pocket', false, <Sub>Right after you tap to pay, choose the pocket and category. The purchase shows up next time you open Pockets.</Sub>)}
        <Main onClick={onDone}>Done</Main>
      </>}
      {stage !== 'added' && <button onClick={onDone} style={{ display: 'block', margin: '14px auto 0', border: 0, background: 'transparent', color: SOFT, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Finish this later in Profile</button>}
    </>}
  </>;
}

/** Profile → start over: erases this phone's data (and the cloud copy, once it syncs) and runs the setup again. */
export function StartOverButton() {
  const [ask, setAsk] = useState(false);
  const go = () => {
    const d = getData();
    const e = emptyData(d);
    replaceData({ ...e, settings: { ...e.settings, setupStep: 'hello', tourSeen: true } });
    closeSheet();
    setUI({ setup: true, tab: 'home', page: null });
  };
  return ask ? (
    <div role="alertdialog" aria-label="Start over" style={{ marginTop: 12, background: 'var(--color-accent-100)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-accent-900)' }}>This erases your accounts, pockets, income, bills and transactions on this phone and in your cloud copy, then opens the setup. Your name and settings stay. It can't be undone: make a backup first if you might want them back.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={go} style={{ flex: 1, height: 44, borderRadius: 999, border: 0, background: 'var(--color-accent-700)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Erase and start the setup</button>
        <button onClick={() => setAsk(false)} style={{ flex: 'none', padding: '0 18px', height: 44, borderRadius: 999, border: 0, background: 'var(--surface)', color: 'var(--color-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  ) : <button onClick={() => setAsk(true)} className="hv-n200" style={{ marginTop: 12, height: 46, borderRadius: 999, border: 0, background: 'var(--surface)', color: 'var(--color-accent-700)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Start over with the setup</button>;
}

function Done({ name, onFinish }: { name: string; onFinish: () => void }) {
  const { data: d } = useApp();
  const week = d.pockets.reduce((a, p) => a + num(p.weeklyStr), 0);
  return <>
    <H>{name ? `You're all set, ${name}` : "You're all set"}</H>
    {week > 0 ? <>
      <Sub>This week you can spend</Sub>
      <div style={{ marginTop: 6, fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: MINT }}>{fmt(week)}</div>
      <Sub>Every expense comes out of a pocket. When a pocket runs out, Pockets helps you move money from another one.</Sub>
    </> : <Sub>You can add accounts, income and pockets anytime from their tabs.</Sub>}
    <Main onClick={onFinish}>Go to Pockets</Main>
  </>;
}
