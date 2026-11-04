import { useApp, openSheet, setData } from '../lib/store';
import { HUES, LINE, ink, mid, tint } from '../lib/constants';
import { allStats, ctxOf, fmt, monthExpenses, pctOf, plural } from '../lib/derive';
import { inRange, monthName } from '../lib/dates';
import { billRows } from '../lib/bills';
import { applyOccurrence, undoOccurrence } from '../lib/schedule';
import { getData } from '../lib/store';
import { Bar, BillBadge, ListCard } from '../ui/bits';
import * as I from '../ui/icons';

export default function Insights() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const all = allStats(d, c);
  const monthExp = monthExpenses(d, c);
  const spentMonth = monthExp.reduce((a, e) => a + e.amt, 0);

  const byPocket = all.map(p => ({ ...p, month: monthExp.filter(e => e.p === p.id).reduce((a, e) => a + e.amt, 0) }));
  const other = monthExp.filter(e => !all.some(p => p.id === e.p)).reduce((a, e) => a + e.amt, 0);
  const split = spentMonth > 0 ? [...byPocket.filter(x => x.month > 0), ...(other > 0 ? [{ id: '_other', name: 'Bills and other', hue: -1, month: other }] : [])].sort((a, b) => b.month - a.month) : [];

  const known = new Set(d.pockets.map(p => p.id));
  const weekSpent = all.reduce((a, x) => a + x.spent, 0);
  const lastWeek = d.expenses.filter(e => known.has(e.p) && inRange(e.date, c.lastWeekStart, c.lastWeekEnd)).reduce((a, e) => a + e.amt, 0);
  const maxW = Math.max(weekSpent, lastWeek, 1);

  const best = all.filter(x => x.budget > 0 && x.left > 0).sort((a, b) => b.left / b.budget - a.left / a.budget)[0];
  const goal0 = d.goals[0];

  const tagHue = (t: string) => HUES[Math.max(0, d.tags.indexOf(t)) % HUES.length];
  const tagTotals = d.tags.map(t => {
    const es = monthExp.filter(e => (e.tags || []).includes(t));
    return { t, n: es.length, sum: es.reduce((a, e) => a + e.amt, 0) };
  }).filter(x => x.n > 0).sort((a, b) => b.sum - a.sum);
  const maxTag = Math.max(1, ...tagTotals.map(x => x.sum));

  const bills = billRows(d, c);
  // Ticking an automatic bill pays it now; unticking a paid one gives the money back.
  const toggleBill = (id: string) => {
    const x = getData(), b = x.bills.find(y => y.id === id);
    if (!b) return;
    setData(b.paidMonths.includes(c.month) ? undoOccurrence(x, b, c.month) : applyOccurrence(x, b, c.month, c.today));
  };
  const card = { background: '#fff', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Insights</div>

      {best && goal0 && (
        <div style={{ background: 'oklch(0.95 0.04 160)', borderRadius: 26, padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: '#fff', color: 'oklch(0.42 0.09 160)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.Bulb size={18} /></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 14, lineHeight: 1.4, color: 'oklch(0.32 0.07 160)', textWrap: 'pretty' }}>{best.name} still has {fmt(best.left)} this week. Move some to {goal0.name}?</span>
            <button onClick={() => openSheet({ name: 'move', id: best.id, to: goal0.id })} style={{ alignSelf: 'flex-start', height: 36, padding: '0 16px', borderRadius: 999, border: 0, background: 'oklch(0.42 0.09 160)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Move to goal</button>
          </div>
        </div>
      )}

      <div style={{ ...card, gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Spent in {monthName(c.month)} so far</span>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>{fmt(spentMonth)}</span>
        </div>
        <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: 3, background: split.length ? 'transparent' : 'var(--color-neutral-200)' }}>
          {split.map(s => <div key={s.id} style={{ height: 14, width: (s.month / spentMonth * 100).toFixed(1) + '%', background: s.hue < 0 ? 'var(--color-neutral-400)' : mid(s.hue), borderRadius: 999 }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {split.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: s.hue < 0 ? 'var(--color-neutral-400)' : mid(s.hue), flex: 'none' }} />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ color: 'var(--color-neutral-700)' }}>{Math.round(s.month / spentMonth * 100)}%</span>
              <span style={{ fontWeight: 700, width: 96, textAlign: 'right' }}>{fmt(s.month)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, gap: 12 }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>This week vs last week</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>This week</span><span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(weekSpent)}</span></div>
          <Bar h={12} pct={pctOf(weekSpent, maxW)} track="var(--color-neutral-200)" fill="var(--color-accent)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Last week</span><span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(lastWeek)}</span></div>
          <Bar h={12} pct={pctOf(lastWeek, maxW)} track="var(--color-neutral-200)" fill="var(--color-neutral-500)" />
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{weekSpent <= lastWeek ? `${fmt(lastWeek - weekSpent)} less than last week so far.` : `${fmt(weekSpent - lastWeek)} more than last week.`}</span>
      </div>

      <div style={{ ...card, gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Spending by tag</span>
          <span onClick={() => openSheet({ name: 'search' })} style={{ fontSize: 13, color: 'var(--color-accent-700)', fontWeight: 600, cursor: 'pointer' }}>Search</span>
        </div>
        {tagTotals.map(x => (
          <div key={x.t} onClick={() => openSheet({ name: 'search', tag: x.t })} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: ink(tagHue(x.t)), background: tint(tagHue(x.t)), padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>#{x.t}</span>
              <span style={{ flex: 1, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{plural(x.n, 'expense')}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(x.sum)}</span>
            </div>
            <Bar h={8} pct={pctOf(x.sum, maxTag)} track="var(--color-neutral-200)" fill={mid(tagHue(x.t))} />
          </div>
        ))}
        {tagTotals.length === 0 && <span style={{ fontSize: 14, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Add tags to your expenses to see them here.</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Bills and subscriptions</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{fmt(bills.reduce((a, b) => a + b.amt, 0))} / mo</span>
      </div>
      <ListCard>
        {bills.map((b, i) => (
          <div key={b.id} onClick={() => openSheet({ name: 'schedule', id: b.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${LINE}`, cursor: 'pointer' }}>
            <BillBadge b={b} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600, textDecoration: b.paid ? 'line-through' : 'none' }}>{b.name}</span>
              <span style={{ fontSize: 12, color: b.dueColor }}>{b.kind} · {b.dueLabel}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', color: b.paid ? 'var(--color-neutral-500)' : 'var(--color-text)' }}>{fmt(b.amt)}</span>
            <button onClick={e => { e.stopPropagation(); toggleBill(b.id); }} aria-label={b.paid ? 'Mark unpaid' : 'Mark paid'} style={{ width: 30, height: 30, borderRadius: 999, border: `2px solid ${b.paid ? 'oklch(0.62 0.12 160)' : 'var(--color-neutral-300)'}`, background: b.paid ? 'oklch(0.62 0.12 160)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}>
              <I.Check size={14} />
            </button>
          </div>
        ))}
        <button onClick={() => openSheet({ name: 'schedule', id: null, kind: 'Bill' })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-accent-700)', fontSize: 15, fontWeight: 700, textAlign: 'left' }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, border: '2px dashed var(--color-accent-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.Plus size={18} /></span>
          Add bill or subscription
        </button>
      </ListCard>
    </div>
  );
}
