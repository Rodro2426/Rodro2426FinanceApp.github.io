import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp, setUI, setTourStep, endTour, flash, type State } from '../lib/store';
import { num } from '../lib/derive';
import type { Tab } from '../lib/types';

/**
 * Guided tour on a practice copy of the app. Each step spotlights the real
 * button or form to use; action steps move on by themselves once done,
 * information steps have a Next button.
 */
interface Counts { accounts: number; pockets: number; expenses: number; incomes: number; bills: number; income: string }
interface Step {
  title: string;
  text: string;
  /** CSS selector of what to spotlight; none = centered card. */
  target?: string;
  /** Done when this becomes true (compared with counts at the start of the step). */
  done?: (s: State, base: Counts) => boolean;
  /** Steps back if this stops being true (e.g. the sheet was closed). */
  needs?: (s: State) => boolean;
  /** Where to be when the step starts. */
  at?: { tab?: Tab; closeSheet?: boolean };
}

const SHEET = '.sheet-panel';
const counts = (s: State): Counts => ({ accounts: s.data.accounts.length, pockets: s.data.pockets.length, expenses: s.data.expenses.length, incomes: s.data.incomes.length, bills: s.data.bills.length, income: s.data.incomeStr });
const tab = (t: Tab) => (s: State) => s.ui.tab === t && !s.ui.sheet;
const sheetIs = (n: string) => (s: State) => s.ui.sheet?.name === n;

const STEPS: Step[] = [
  { title: 'Let’s practice', text: 'This tour uses a practice copy of the app, so try anything. At the end you can keep what you added or start from scratch.' },
  { title: 'Your accounts', target: '[data-tour="tab-accounts"]', text: 'First, your money. Tap Accounts.', done: tab('accounts'), at: { closeSheet: true } },
  { title: 'Add an account', target: '[data-tour="add-account"]', text: 'Add a bank account, savings, cash or a credit card. Tap here.', done: sheetIs('addAcct'), at: { tab: 'accounts', closeSheet: true } },
  { title: 'Fill it in', target: SHEET, text: 'Pick the type, give it a name (like "Bancolombia") and type how much it has. Then tap Add account.', done: (s, b) => s.data.accounts.length > b.accounts, needs: sheetIs('addAcct') },
  { title: 'Plan your month', target: '[data-tour="tab-budget"]', text: 'Now let’s plan. Tap Budget.', done: tab('budget'), at: { closeSheet: true } },
  { title: 'Monthly income', target: '[data-tour="income"]', text: 'Type how much you earn in a month. Dots appear by themselves, like 2.500.000. Tap Next when you’re done.', at: { tab: 'budget' } },
  { title: 'Create a pocket', target: '[data-tour="add-pocket"]', text: 'Pockets are weekly budgets, like Groceries, Transport or Fun. Tap Add pocket.', done: sheetIs('editPocket'), at: { tab: 'budget' } },
  { title: 'Set it up', target: SHEET, text: 'Pick an emoji, name it and set how much it gets each week. Then tap Create pocket.', done: (s, b) => s.data.pockets.length > b.pockets, needs: sheetIs('editPocket') },
  { title: 'Back to Home', target: '[data-tour="tab-home"]', text: 'Tap Home.', done: tab('home'), at: { closeSheet: true } },
  { title: 'Safe to spend', target: '[data-tour="safe"]', text: 'This is what’s left in all your pockets this week. It turns green, yellow or red as you spend, and starts over every Monday. Swipe it left to see what’s left for the whole month; your pockets swipe the same way.', at: { tab: 'home' } },
  { title: 'Add an expense', target: '[data-tour="add"]', text: 'Spent money? Tap the red + button.', done: sheetIs('add'), at: { tab: 'home', closeSheet: true } },
  { title: 'Log it', target: SHEET, text: 'Type the amount and a name, pick a category (every expense needs one), then a pocket, or No pocket, and the account you paid with. Then tap Save expense.', done: (s, b) => s.data.expenses.length > b.expenses, needs: sheetIs('add') },
  { title: 'What’s left', target: SHEET, text: 'This shows how much is left in that pocket. Tap Done.', done: s => !s.ui.sheet },
  { title: 'Add income', target: '[data-tour="add"]', text: 'Got paid? Tap + again.', done: sheetIs('add'), at: { tab: 'home', closeSheet: true } },
  { title: 'Register it', target: SHEET, text: 'Switch to Income at the top. Type the amount, pick the account, and choose "Keep it saved" or "Split into pockets". Then tap Save income.', done: (s, b) => s.data.incomes.length > b.incomes, needs: sheetIs('add') },
  { title: 'Open a pocket', target: '[data-tour="pocket"]', text: 'Tap your pocket to see what you spent in it.', done: sheetIs('pocket'), at: { tab: 'home', closeSheet: true } },
  { title: 'Inside a pocket', target: SHEET, text: 'Here you can edit the pocket, add an expense to it, or move leftover money to another pocket or a savings goal. Tip: tap any transaction anywhere in the app to edit or delete it.' },
  { title: 'Every month', target: '[data-tour="tab-calendar"]', text: 'Tap Calendar.', done: tab('calendar'), at: { closeSheet: true } },
  { title: 'Schedule a payment', target: '[data-tour="add-schedule"]', text: 'Your salary, rent, Netflix or a credit card payment can repeat every month. Tap here.', done: sheetIs('schedule'), at: { tab: 'calendar' } },
  { title: 'Set it once', target: SHEET, text: 'Choose the type, name, amount, day and account. With "automatic" on, the money moves by itself on that day. Then tap Schedule.', done: (s, b) => s.data.bills.length > b.bills, needs: sheetIs('schedule') },
  { title: 'Insights', target: '[data-tour="tab-insights"]', text: 'See where your money goes, first by category: a table you can filter by category and period. Then by pocket, by #tag, and all your bills. Tap Insights to look.', done: tab('insights'), at: { closeSheet: true } },
  { title: 'Investments', target: '[data-tour="invest"]', text: 'In Accounts, this button opens your investments: stocks, CDTs (pick a popular one or make your own) and a returns simulator, like Nu’s Cajitas.', at: { tab: 'accounts', closeSheet: true } },
  { title: 'Excel', target: '[data-tour="excel"]', text: 'Download any month as Excel. It includes a "For AI" page you can send to any AI to ask about your money.', at: { tab: 'accounts' } },
  { title: 'Notifications', target: '[data-tour="bell"]', text: 'Bills due tomorrow, money that arrived or was paid, and budget warnings show up here and at the top of the screen.', at: { tab: 'home', closeSheet: true } },
  { title: 'Search', target: '[data-tour="search"]', text: 'Find any transaction by name, pocket, account or #tag.', at: { tab: 'home' } },
  { title: 'Your profile', target: '[data-tour="profile"]', text: 'Your name, currency, monthly backups to iCloud, and this tour again. Back up often: your data lives only on this phone.', at: { tab: 'home' } },
  { title: 'You’re ready', text: '' }
];

interface Box { x: number; y: number; w: number; h: number }

export default function Tour() {
  const st = useApp();
  const tour = st.ui.tour!;
  const i = Math.min(tour.step, STEPS.length - 1), s = STEPS[i], last = i === STEPS.length - 1;
  const base = useRef<Counts>(counts(st));
  const [box, setBox] = useState<Box | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Arrive where the step happens and remember the counts it compares against.
  useLayoutEffect(() => {
    if (s.at) setUI({ ...(s.at.tab ? { tab: s.at.tab, page: null } : {}), ...(s.at.closeSheet ? { sheet: null } : {}) });
    base.current = counts(st);
  }, [i]);

  // Move on when the step is done; step back if what it needs was closed.
  useEffect(() => {
    if (s.done && s.done(st, base.current)) { const t = setTimeout(() => setTourStep(i + 1), 350); return () => clearTimeout(t); }
    if (s.needs && !s.needs(st)) { const t = setTimeout(() => setTourStep(Math.max(0, i - 1)), 250); return () => clearTimeout(t); }
  }, [st, i]);

  // Follow the target's position (it can move as sheets slide in or the keyboard opens).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const shell = root.current?.parentElement, el = s.target ? document.querySelector(s.target) : null;
      if (shell && el) {
        const r = el.getBoundingClientRect(), p = shell.getBoundingClientRect();
        const nb = { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
        setBox(b => (b && Math.abs(b.x - nb.x) < 0.5 && Math.abs(b.y - nb.y) < 0.5 && Math.abs(b.w - nb.w) < 0.5 && Math.abs(b.h - nb.h) < 0.5 ? b : nb));
      } else setBox(null);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);

  // Bring the target into view inside the scrolling screen.
  useEffect(() => {
    if (!s.target || s.target === SHEET) return;
    const t = setTimeout(() => document.querySelector(s.target!)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [i]);

  const next = () => setTourStep(i + 1);
  /** Exiting goes to the last card, where they choose what happens to the practice data. */
  const exit = () => { setUI({ sheet: null }); setTourStep(STEPS.length - 1); };

  // Spotlight geometry.
  const W = root.current?.clientWidth ?? 400, H = root.current?.clientHeight ?? 800;
  const isSheet = s.target === SHEET;
  const pad = isSheet ? 0 : 8;
  const hole = box ? { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 } : null;
  const radius = isSheet ? 32 : hole ? Math.min(28, hole.h / 2) : 0;
  const below = hole ? H - (hole.y + hole.h) : 0, above = hole ? hole.y : 0;
  const bubblePos: React.CSSProperties = !hole ? { top: '50%', transform: 'translateY(-50%)' }
    : isSheet ? { top: 'calc(var(--top) - 8px)' }
    : below > 230 ? { top: hole.y + hole.h + 14 } : above > 230 ? { bottom: H - hole.y + 14 } : { top: 'calc(var(--top) - 8px)' };

  const counter = `${i + 1} of ${STEPS.length}`;
  const card = (
    <div className="tour-bubble" style={{ position: 'absolute', left: 14, right: 14, ...bubblePos, zIndex: 3, background: '#fff', borderRadius: 24, padding: isSheet ? '12px 14px' : '16px 16px 14px', boxShadow: '0 14px 40px rgba(20,40,28,.28)', display: 'flex', flexDirection: 'column', gap: isSheet ? 4 : 8, pointerEvents: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2f7146' }}>{tour.mode === 'replay' ? 'Practice' : 'Tour'} · {counter}</span>
        {!last && <button onClick={exit} style={{ border: 0, background: 'transparent', color: 'var(--color-neutral-600)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Exit tour</button>}
      </div>
      <span style={{ fontSize: isSheet ? 16 : 19, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{s.title}</span>
      <span style={{ fontSize: isSheet ? 13.5 : 14.5, lineHeight: 1.42, color: 'var(--color-neutral-800)' }}>{s.text}</span>
      {!s.done ? (
        <button onClick={next} style={{ alignSelf: 'flex-end', marginTop: 2, height: 40, padding: '0 20px', borderRadius: 999, border: 0, background: '#232e7a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{i === 0 ? 'Start' : 'Next'}</button>
      ) : (
        <button onClick={next} style={{ alignSelf: 'flex-end', border: 0, background: 'transparent', color: 'var(--color-neutral-600)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '2px 0' }}>Skip this step</button>
      )}
    </div>
  );

  if (last) {
    const first = tour.mode === 'first';
    const d = st.data;
    const made = [d.accounts.length && `${d.accounts.length} account${d.accounts.length > 1 ? 's' : ''}`, d.pockets.length && `${d.pockets.length} pocket${d.pockets.length > 1 ? 's' : ''}`, d.expenses.length && `${d.expenses.length} expense${d.expenses.length > 1 ? 's' : ''}`, (d.incomes.length || num(d.incomeStr) > 0) && 'your income', d.bills.length && `${d.bills.length} scheduled payment${d.bills.length > 1 ? 's' : ''}`].filter(Boolean) as string[];
    return (
      <div ref={root} role="dialog" aria-label="Tour finished" style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'rgba(18,30,22,.55)', display: 'flex', alignItems: 'center', padding: 18 }}>
        <div className="tour-bubble" style={{ width: '100%', background: '#fff', borderRadius: 28, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <img src="./pockets-mark.svg" alt="" width={52} height={63} style={{ alignSelf: 'center' }} />
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center' }}>You’re ready!</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--color-neutral-800)', textAlign: 'center' }}>
            {first
              ? made.length ? `During the practice you added ${made.join(', ')}. Do you want to keep it, or start with a clean app?` : 'Start with a clean app and add your real accounts, income and pockets.'
              : 'That was a practice copy. Your real accounts and transactions were never touched and come back now, exactly as you left them.'}
          </span>
          {first ? <>
            {made.length > 0 && <button onClick={() => endTour('keep')} style={{ height: 52, borderRadius: 999, border: 0, background: '#232e7a', color: '#fff', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>Keep what I added</button>}
            <button onClick={() => endTour('fresh')} style={{ height: 52, borderRadius: 999, border: 0, background: made.length ? 'var(--color-neutral-100)' : '#232e7a', color: made.length ? 'var(--color-text)' : '#fff', fontSize: 15.5, fontWeight: 700, cursor: 'pointer' }}>Start from scratch</button>
          </> : <button onClick={() => { void endTour('restore').then(() => flash('Your data is back, nothing was changed')); }} style={{ height: 52, borderRadius: 999, border: 0, background: '#232e7a', color: '#fff', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>Back to my data</button>}
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'center' }}>Replay this tour anytime from Profile → App tutorial.</span>
        </div>
      </div>
    );
  }

  // Dark layer with a hole over the target; four blockers stop taps outside it.
  const blockers = hole ? [
    { left: 0, top: 0, width: W, height: Math.max(0, hole.y) },
    { left: 0, top: hole.y + hole.h, width: W, height: Math.max(0, H - hole.y - hole.h) },
    { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h },
    { left: hole.x + hole.w, top: hole.y, width: Math.max(0, W - hole.x - hole.w), height: hole.h }
  ] : [{ left: 0, top: 0, width: W, height: H }];

  return (
    <div ref={root} aria-live="polite" className={isSheet ? 'tour-on-sheet' : undefined} style={{ position: 'absolute', inset: 0, zIndex: 95, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="#fff" />
            {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={radius} fill="#000" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={isSheet ? 'rgba(18,30,22,.35)' : 'rgba(18,30,22,.6)'} mask="url(#tour-hole)" />
      </svg>
      {hole && !isSheet && <div className="tour-ring" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: radius }} />}
      {blockers.map((b, k) => <div key={k} style={{ position: 'absolute', ...b, pointerEvents: 'auto' }} />)}
      {card}
    </div>
  );
}
