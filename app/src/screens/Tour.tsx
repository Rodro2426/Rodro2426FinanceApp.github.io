import { useRef, useState, type ReactNode } from 'react';
import { setUI, setData } from '../lib/store';
import type { Sheet, Tab, UI } from '../lib/types';
import * as I from '../ui/icons';

/** A guided tour of every key feature: one card per feature, with where to find it. */
interface Step {
  icon: (p: { size?: number }) => ReactNode;
  tone: [string, string]; // background, ink
  title: string;
  intro: string;
  points: string[];
  where?: string;
  go?: { tab?: Tab; sheet?: Sheet; page?: UI['page'] };
}

const G: [string, string] = ['oklch(0.94 0.05 155)', 'oklch(0.38 0.09 155)'];
const B: [string, string] = ['oklch(0.94 0.04 250)', 'oklch(0.4 0.1 250)'];
const R: [string, string] = ['var(--color-accent-100)', 'var(--color-accent-700)'];
const Y: [string, string] = ['oklch(0.96 0.055 92)', 'oklch(0.45 0.09 75)'];
const P: [string, string] = ['oklch(0.94 0.04 300)', 'oklch(0.42 0.1 300)'];

const STEPS: Step[] = [
  { icon: I.Wallet, tone: G, title: 'How Pockets works', intro: 'Pockets turns your monthly income into small weekly budgets, so you always know what you can spend.',
    points: ['Set how much you earn in a month.', 'Split it into pockets like Groceries, Transport or Fun.', 'Each pocket gets a weekly amount that starts over every Monday.', 'When you spend, the pocket goes down. Leftovers can move to another pocket or to savings.'] },
  { icon: I.Home, tone: G, title: 'Home', intro: 'Your week at a glance.',
    points: ['"Safe to spend this week" is what’s left across all pockets. It turns green, yellow or red as you spend.', 'Tap any pocket to see what you spent in it, edit it, or move leftover money.', '"Coming up" shows your next bills. "Recent" shows your latest expenses; tap one to edit it.', 'Pull down at the top of any screen to see the Pockets logo.'],
    where: 'First tab', go: { tab: 'home' } },
  { icon: I.Plus, tone: R, title: 'Add an expense', intro: 'Log what you spend in a few seconds with the red + button.',
    points: ['Type the amount (dots appear by themselves: 45.000).', 'Pick the pocket and the account or card you paid with.', 'Optionally add a description, category and #tags so it’s easy to find later.', 'Before saving, it shows how much will be left in that pocket.'],
    where: 'Red + button, bottom right', go: { sheet: { name: 'add' } } },
  { icon: I.Download, tone: G, title: 'Add income', intro: 'Got paid or received money? Use + and switch to Income.',
    points: ['Choose the account it goes into.', '"Keep it saved" just adds it to your balance.', '"Split into pockets" adds it to this week’s pockets: evenly, by budget or by hand.', 'Whatever you don’t assign stays saved in the account.'],
    where: '+ button → Income', go: { sheet: { name: 'add', mode: 'income' } } },
  { icon: I.Wallet, tone: Y, title: 'Budget', intro: 'Plan your month.',
    points: ['Enter your monthly income and see how much is left after your pockets.', 'Change each pocket’s weekly amount, or tap its icon to rename it, pick an emoji or add a photo.', 'Add new pockets and savings goals with a target and a date.'],
    where: 'Third tab', go: { tab: 'budget' } },
  { icon: I.Card, tone: B, title: 'Accounts and cards', intro: 'All your money in one place.',
    points: ['Add bank accounts, savings, cash and credit cards. Net worth is what you have minus what you owe.', 'Tap an account to see its full history with the balance after each movement. Tap a line to edit or delete it.', 'Savings accounts can earn a % E.A. like Nu’s Cajitas: the balance grows every day and a green number shows what it earned.', 'Credit cards show their limit, what’s available and a Pay button.'],
    where: 'Second tab', go: { tab: 'accounts' } },
  { icon: I.Calendar, tone: B, title: 'Calendar and scheduled payments', intro: 'Set things that happen every month once, and Pockets does the rest.',
    points: ['Schedule your salary, rent, bills, subscriptions or a credit card payment on a day of the month.', 'Turn on "automatic" and the money is added or taken from the account on that day.', 'Subscriptions in dollars are converted with that day’s TRM.', 'Tap any day to see what happened or what’s coming.'],
    where: 'Last tab', go: { tab: 'calendar' } },
  { icon: I.Bell, tone: R, title: 'Notifications', intro: 'Pockets reminds you before things happen.',
    points: ['Bills due tomorrow, money that arrived or was paid, pockets over budget and when you’re running low.', 'They slide in at the top on the day. Tap X to dismiss any of them.', 'The bell on Home shows how many are new.'],
    where: 'Bell on Home', go: { tab: 'home', sheet: { name: 'notifications' } } },
  { icon: I.Chart, tone: P, title: 'Insights', intro: 'See where your money goes.',
    points: ['Spending this month by pocket, and this week compared with last week.', 'Spending by #tag, and a tip when a pocket has money left over.', 'All your bills and subscriptions: tap one to edit it, or tick it when paid.'],
    where: 'Fourth tab', go: { tab: 'insights' } },
  { icon: I.Search, tone: Y, title: 'Search', intro: 'Find any transaction.',
    points: ['Search by name, pocket, account, category or #tag.', 'Filter by tag and see the total of what matches.'],
    where: 'Magnifying glass on Home', go: { tab: 'home', sheet: { name: 'search' } } },
  { icon: I.TrendUp, tone: G, title: 'Investments', intro: 'Track your stocks and simulate your savings.',
    points: ['Add each buy or sell with its ticker, shares and price.', 'See your portfolio in a ring chart, with total return and today’s change.', 'Connect a free Finnhub key for live prices, or type prices in yourself.', 'The Returns simulator shows what your money earns per day, per month and in total.'],
    where: 'Accounts → green trend button', go: { tab: 'accounts', page: 'investments' } },
  { icon: I.Download, tone: B, title: 'Excel', intro: 'Download any month as a spreadsheet.',
    points: ['Choose a month and one or all accounts.', 'The "For AI" sheet explains your month so you can send the file to any AI and ask questions.'],
    where: 'Accounts → Excel', go: { tab: 'accounts', sheet: { name: 'export', acct: 'all' } } },
  { icon: I.Refresh, tone: R, title: 'Back up your data', intro: 'Your data lives only on this phone. Back it up so you never lose it.',
    points: ['Profile → Back up → Save to Files → iCloud Drive.', 'A monthly reminder gives you a one-tap "Back up now".', 'If you ever delete the app, reinstall it and choose "Restore a backup".'],
    where: 'Tap your profile circle on Home', go: { tab: 'home', sheet: { name: 'settings' } } },
  { icon: I.Check, tone: G, title: 'You’re all set', intro: 'Start by adding your accounts, your monthly income and a few pockets. You can replay this tour anytime from Profile → App tutorial.', points: [] }
];

export default function Tour() {
  const [i, setI] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const s = STEPS[i], last = i === STEPS.length - 1;
  const finish = (go?: Step['go']) => {
    setData(x => ({ settings: { ...x.settings, tourSeen: true } }));
    setUI({ tour: false, ...(go?.tab ? { tab: go.tab } : {}), page: go?.page ?? null, sheet: go?.sheet ?? null });
  };
  const next = () => (last ? finish() : setI(i + 1));
  const prev = () => setI(Math.max(0, i - 1));
  const Icon = s.icon;

  return (
    <div role="dialog" aria-label="App tutorial" className="noscroll"
      onPointerDown={e => { start.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={e => { const st = start.current; start.current = null; if (!st) return; const dx = e.clientX - st.x; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - st.y)) (dx < 0 ? next : prev)(); }}
      style={{ position: 'absolute', inset: 0, zIndex: 82, background: '#f7f5f3', display: 'flex', flexDirection: 'column', padding: 'calc(var(--top) + 4px) 20px calc(var(--tb) + 14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{i + 1} of {STEPS.length}</span>
        {!last && <button onClick={() => finish()} style={{ border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: 8 }}>Skip</button>}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {STEPS.map((_, k) => <span key={k} style={{ flex: 1, height: 4, borderRadius: 999, background: k <= i ? '#1d4a2e' : 'var(--color-neutral-300)', transition: 'background .2s' }} />)}
      </div>

      <div key={i} className="tour-card noscroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 26 }}>
        <div style={{ width: 76, height: 76, borderRadius: 26, background: s.tone[0], color: s.tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={36} /></div>
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{s.title}</span>
        <span style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--color-neutral-800)' }}>{s.intro}</span>
        {s.points.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 24, padding: '6px 16px', display: 'flex', flexDirection: 'column' }}>
            {s.points.map((p, k) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '11px 0', borderTop: k ? '1px solid var(--color-neutral-200)' : 0 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: s.tone[0], color: s.tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flex: 'none', marginTop: 1 }}>{k + 1}</span>
                <span style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--color-text)' }}>{p}</span>
              </div>
            ))}
          </div>
        )}
        {s.where && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: s.tone[0], borderRadius: 18, padding: '10px 10px 10px 14px' }}>
            <span style={{ fontSize: 13, color: s.tone[1] }}>Where: <b>{s.where}</b></span>
            {s.go && <button onClick={() => finish(s.go)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: '#fff', color: s.tone[1], fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Show me</button>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {i > 0 && <button onClick={prev} aria-label="Previous" style={{ width: 56, height: 56, borderRadius: 999, border: 0, background: '#fff', color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}><I.ChevronLeft size={22} /></button>}
        <button onClick={next} style={{ flex: 1, height: 56, borderRadius: 999, border: 0, background: '#1d4a2e', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{last ? 'Start using Pockets' : i === 0 ? 'Start the tour' : 'Next'}</button>
      </div>
    </div>
  );
}
