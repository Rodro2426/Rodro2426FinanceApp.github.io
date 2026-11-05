import { useApp, openSheet, setUI } from '../lib/store';
import { LINE, RED, ink, tint } from '../lib/constants';
import { allStats, byDateDesc, ctxOf, dayLabel, dayStats, fmt, monthExpenses, monthStats, pctOf, weekExpenses, type PocketStats } from '../lib/derive';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { daysBetween, daysInMonth, relDay } from '../lib/dates';
import type { PocketView } from '../lib/types';
import { fmtDay, monthName } from '../lib/dates';
import { billRows } from '../lib/bills';
import { BillBadge, ExpRow, ListCard, SectionHead, expView } from '../ui/bits';
import * as I from '../ui/icons';
import { netWorth } from '../lib/networth';
import { monthSummary } from '../lib/plan';
import { billAmount } from '../lib/schedule';

const C = 100.53; // ring circumference (r=16)

/** Light tones for the "Safe to spend" card: >50% left green, 30–50% yellow, under 30% red. */
const SAFE_TONES = {
  green: { bg: 'var(--safe-g-bg)', label: 'var(--safe-g-label)', amount: 'var(--safe-g-amt)', bar: 'var(--safe-g-bar)' },
  yellow: { bg: 'var(--safe-y-bg)', label: 'var(--safe-y-label)', amount: 'var(--safe-y-amt)', bar: 'var(--safe-y-bar)' },
  red: { bg: 'var(--color-accent-100)', label: 'var(--color-accent-800)', amount: 'var(--color-accent-900)', bar: 'var(--color-accent)' }
};

export default function Home() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const all = allStats(d, c);
  const stats = new Map(all.map(x => [x.id, x]));
  const weekBudget = all.reduce((a, x) => a + x.budget, 0);
  const weekLeft = all.reduce((a, x) => a + x.left, 0);
  const weekSpent = weekExpenses(d, c).filter(e => stats.has(e.p)).reduce((a, e) => a + e.amt, 0);
  // CDTs count as money you have: opening one moves money out of an account, not out of your net worth.
  const nw = netWorth(d), assets = nw.assets;
  const debt = nw.debts;
  const spent = monthExpenses(d, c).reduce((a, e) => a + e.amt, 0), income = monthSummary(d, c).income;
  const upcoming = billRows(d, c).filter(b => !b.paid && !b.others).sort((a, b) => a.inDays - b.inDays).slice(0, 3);
  // Latest money in and out together (daily account interest is left out: it updates every day).
  const recent = [
    ...d.expenses.map(e => ({ kind: 'expense' as const, date: e.date, ts: e.ts, id: e.id, e })),
    ...d.incomes.filter(t => !t.interest).map(t => ({ kind: 'income' as const, date: t.date, ts: t.ts, id: t.id, t }))
  ].sort(byDateDesc).slice(0, 8);
  const days = all.map(p => dayStats(d, p.id, c, p));
  const todayActive = days.filter(x => x.active);
  const todayBudget = todayActive.reduce((a, x) => a + x.allowance, 0), todayLeft = days.reduce((a, x) => a + x.left, 0);
  const todaySpent = days.reduce((a, x) => a + x.spentToday, 0);
  const todayTone = toneOf(todayBudget > 0 ? todayLeft / todayBudget : todaySpent > 0 ? 0 : 1);
  const photo = d.settings.profilePhoto;
  const unread = d.notifications.filter(n => !n.read && !n.dismissed).length;
  // Card colour follows how much of the week's budget is still safe to spend.
  const leftRatio = weekBudget > 0 ? weekLeft / weekBudget : 0;
  const tone = toneOf(leftRatio);
  const months = all.map(p => monthStats(d, p.id, c));
  const monthBudget = months.reduce((a, x) => a + x.budget, 0), monthLeft = months.reduce((a, x) => a + x.left, 0);
  const monthTone = toneOf(monthBudget > 0 ? monthLeft / monthBudget : 0);
  const monthDaysLeft = daysBetween(c.today, `${c.month}-${String(daysInMonth(c.month)).padStart(2, '0')}`) + 1;
  const [pocketPage, setPocketPage] = useState(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{fmtDay(c.today, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Hi, {d.settings.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setUI({ page: 'social' })} aria-label="Trips and friends" className="hv-n200" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--surface)', border: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.6c2.6.2 4.5 1.9 5 4.9" /></svg>
          </button>
          <button data-tour="bell" onClick={() => openSheet({ name: 'notifications' })} aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} className="hv-n200" style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, background: 'var(--surface)', border: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <I.Bell size={19} />
            {unread > 0 && <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--color-accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button data-tour="search" onClick={() => openSheet({ name: 'search' })} aria-label="Search transactions" className="hv-n200" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--surface)', border: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <I.Search size={19} />
          </button>
          <button data-tour="profile" onClick={() => openSheet({ name: 'settings' })} aria-label="Profile and settings" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, border: 0, padding: 0, cursor: 'pointer', overflow: 'hidden' }}>
            {photo ? <div style={{ width: '100%', height: '100%', backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <span>{d.settings.name.trim().charAt(0).toUpperCase() || 'S'}</span>}
          </button>
        </div>
      </div>

      <Pager label="Safe to spend" names={['today', 'this week', 'this month']} initial={1} pages={[
        <SafeCard key="d" tone={todayTone} title="Safe to spend today" left={todayLeft} budget={todayBudget} spent={todaySpent}
          sub={todayActive.length ? `of ${fmt(todayBudget)} for ${todayActive.length === all.length ? 'all your pockets' : todayActive.length === 1 ? '1 pocket' : `${todayActive.length} pockets`} today` : 'No pocket has today as a spending day'} />,
        <SafeCard key="w" tour tone={tone} title="Safe to spend this week" left={weekLeft} budget={weekBudget} spent={weekSpent} sub={`of ${fmt(weekBudget)} · ${c.daysLeft === 1 ? '1 day' : `${c.daysLeft} days`} left`} />,
        <SafeCard key="m" tone={monthTone} title={`Left to spend in ${monthName(c.month)}`} left={monthLeft} budget={monthBudget} spent={monthBudget - monthLeft} sub={`of ${fmt(monthBudget)} · ${monthDaysLeft === 1 ? '1 day' : `${monthDaysLeft} days`} left in the month`} />
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        <div onClick={() => setUI({ tab: 'accounts' })} className="hv-n100" style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Net worth</span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt(assets - debt)}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{d.accounts.length} accounts{nw.includeInvestments && nw.investments ? ' + investments' : ''}{nw.groups.some(x => x.counted) ? ' + groups' : ''}</span>
        </div>
        <div onClick={() => setUI({ tab: 'insights' })} className="hv-n100" style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Spent in {monthName(c.month)}</span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt(spent)}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{income > 0 ? Math.round(spent / income * 100) + '%' : '—'} of income</span>
        </div>
      </div>

      <SectionHead title="Pockets" right={pocketPage === 0 ? 'Today' : pocketPage === 1 ? `Week ${c.weekNo} of ${c.weeks}` : `All of ${monthName(c.month)}`} muted />
      {all.length > 0 && <Pager label="Pockets" names={['today', 'this week', 'this month']} initial={1} onPage={setPocketPage} pages={[
        <PocketGrid key="d" view="day" items={all.map((p, i) => ({ p, left: days[i].left, budget: days[i].allowance, off: !days[i].active ? (days[i].spentToday > 0 ? `Spent ${fmt(days[i].spentToday)} today` : days[i].next ? `Not today · ${dayLabel(days[i].next!.date, c).slice(0, 3)} ${fmt(days[i].next!.amount)}` : 'Not today') : undefined }))} />,
        <PocketGrid key="w" view="week" items={all.map(p => ({ p, left: p.left, budget: p.budget }))} tour />,
        <PocketGrid key="m" view="month" items={all.map((p, i) => ({ p, left: months[i].left, budget: months[i].budget }))} />
      ]} />}
      {all.length === 0 && <EmptyHint text="No pockets yet. Create them in the Budget tab." onClick={() => setUI({ tab: 'budget' })} />}

      <SectionHead title="Coming up" right="All bills" onRight={() => setUI({ tab: 'insights' })} />
      <ListCard>
        {upcoming.map((b, i) => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === upcoming.length - 1 ? 'transparent' : LINE}` }}>
            <BillBadge b={b} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</span>
              <span style={{ fontSize: 12, color: b.dueColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.dueLabel}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{billAmount(b)}</span>
          </div>
        ))}
        {upcoming.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>All bills paid for {monthName(c.month)}.</div>}
      </ListCard>

      <SectionHead title="Recent" right="Search" onRight={() => openSheet({ name: 'search' })} />
      <ListCard>
        {recent.map((r, i) => {
          const last = i === recent.length - 1;
          if (r.kind === 'expense') { const v = expView(d, r.e, c, stats); return <ExpRow key={r.id} v={v} last={last} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: r.id })} />; }
          const t = r.t, acct = d.accounts.find(a => a.id === t.a)?.name;
          return <ExpRow key={r.id} last={last} onClick={() => openSheet({ name: 'txn', kind: 'income', id: r.id })}
            v={{ key: r.id, initial: '💰', photoBg: 'none', tint: 'oklch(0.95 0.045 155)', ink: 'oklch(0.42 0.09 155)', note: t.note, meta: ['Income', acct, relDay(t.date, c.today)].filter(Boolean).join(' · '), amtFmt: '+' + fmt(t.amt), tagLine: '', amtColor: 'oklch(0.45 0.11 150)' }} />;
        })}
        {recent.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>Nothing yet. Tap + to add an expense or income.</div>}
      </ListCard>
    </div>
  );
}

const toneOf = (r: number) => (r > 0.5 ? SAFE_TONES.green : r >= 0.3 ? SAFE_TONES.yellow : SAFE_TONES.red);

/** Side-by-side pages you swipe between, with dots below. Opens on page `initial`. */
function Pager({ pages, label, names, initial = 0, onPage }: { pages: ReactNode[]; label: string; names: string[]; initial?: number; onPage?: (i: number) => void }) {
  const [i, setI] = useState(initial);
  const box = useRef<HTMLDivElement>(null);
  const step = () => (box.current ? box.current.clientWidth + 10 : 1);
  useLayoutEffect(() => { box.current?.scrollTo({ left: initial * step() }); }, []);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const n = Math.round(e.currentTarget.scrollLeft / step());
    if (n !== i) { setI(n); onPage?.(n); }
  };
  const go = (n: number) => box.current?.scrollTo({ left: n * step(), behavior: 'smooth' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div ref={box} onScroll={onScroll} className="noscroll" aria-roledescription="carousel" aria-label={label}
        style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', alignItems: 'stretch' }}>
        {pages.map((pg, k) => <div key={k} aria-hidden={k !== i} style={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start', scrollSnapStop: 'always', display: 'flex', flexDirection: 'column' }}>{pg}</div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        {pages.map((_, k) => <button key={k} aria-label={`${label}: ${names[k]}`} aria-current={k === i} onClick={() => go(k)}
          style={{ width: k === i ? 18 : 7, height: 7, borderRadius: 99, border: 0, padding: 0, cursor: 'pointer', background: k === i ? 'var(--color-text)' : 'var(--color-neutral-300)', transition: 'width .2s, background .2s' }} />)}
      </div>
    </div>
  );
}

function SafeCard({ tone, title, left, budget, spent, sub, tour }: { tone: typeof SAFE_TONES.green; title: string; left: number; budget: number; spent: number; sub: string; tour?: boolean }) {
  return (
    <div data-tour={tour ? 'safe' : undefined} style={{ flex: 1, background: tone.bg, borderRadius: 28, padding: '22px 22px 20px', display: 'flex', flexDirection: 'column', gap: 6, transition: 'background .4s ease' }}>
      <span style={{ fontSize: 14, color: tone.label, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: tone.amount }}>{fmt(left)}</span>
      <span style={{ fontSize: 13, color: tone.label }}>{sub}</span>
      <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ height: 10, borderRadius: 999, width: pctOf(spent, budget), background: tone.bar, transition: 'width .5s ease, background .4s ease' }} />
      </div>
    </div>
  );
}

function PocketGrid({ items, tour, view }: { items: { p: PocketStats; left: number; budget: number; off?: string }[]; tour?: boolean; view: PocketView }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
      {items.map(({ p, left, budget, off }) => (
        <div key={p.id} data-tour={tour ? 'pocket' : undefined} onClick={() => openSheet({ name: 'pocket', id: p.id, view })} className="pr97" style={{ background: tint(p.hue), borderRadius: 24, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform .15s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: 'var(--glass)', backgroundImage: p.photoBg, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: ink(p.hue), flex: 'none' }}>{p.initial}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: ink(p.hue), lineHeight: 1.25 }}>{p.name}</span>
            </span>
            <svg width="34" height="34" viewBox="0 0 40 40" style={{ flex: 'none', transform: 'rotate(-90deg)' }}>
              <circle cx="20" cy="20" r="16" style={{ fill: 'none', stroke: 'var(--glass)', strokeWidth: 6 }} />
              <circle cx="20" cy="20" r="16" style={{ fill: 'none', stroke: ink(p.hue), strokeWidth: 6, strokeLinecap: 'round', strokeDasharray: `${(budget > 0 ? Math.max(0, left) / budget : 0) * C} ${C}`, transition: 'stroke-dasharray .5s ease' }} />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {off ? <>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: left < 0 ? RED : ink(p.hue), lineHeight: 1.3 }}>{left < 0 ? fmt(left) : 'No spending today'}</span>
              <span style={{ fontSize: 12, color: ink(p.hue), opacity: 0.8 }}>{off}</span>
            </> : <>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: left < 0 ? RED : ink(p.hue) }}>{fmt(left)}</span>
              <span style={{ fontSize: 12, color: ink(p.hue), opacity: 0.8 }}>left of {fmt(budget)}{view === 'day' ? ' today' : ''}</span>
            </>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ text, onClick }: { text: string; onClick: () => void }) {
  return <div onClick={onClick} style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, fontSize: 14, color: 'var(--color-neutral-700)', cursor: 'pointer' }}>{text}</div>;
}
