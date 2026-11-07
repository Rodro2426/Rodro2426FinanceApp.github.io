import { useState } from 'react';
import { Blocks } from '../ui/Blocks';
import { useApp, openSheet, setData } from '../lib/store';
import { HUES, LINE, ink, mid, tint } from '../lib/constants';
import { allStats, byDateDesc, catOf, ctxOf, fmt, monthExpenses, pctOf, plural, myExpenses } from '../lib/derive';
import { addDays, inRange, monthKey, monthName, prevMonthKey } from '../lib/dates';
import { billRows } from '../lib/bills';
import { applyOccurrence, approxLocal, billAmount, undoOccurrence } from '../lib/schedule';
import { getData } from '../lib/store';
import { Bar, BillBadge, ExpRow, ListCard, expView } from '../ui/bits';
import * as I from '../ui/icons';
import { ReportList } from './Reports';

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
  const lastWeek = myExpenses(d).filter(e => known.has(e.p) && inRange(e.date, c.lastWeekStart, c.lastWeekEnd)).reduce((a, e) => a + e.amt, 0);
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
  const card = { background: 'var(--surface)', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Insights</div>

      <Blocks page="insights" title="Insights" blocks={[
        { id: 'categories', name: 'Spending by category', desc: 'The filterable category table', node: <>
      <CategoryTable />
      </> },
        { id: 'reports', name: 'Reports', desc: 'Your saved charts', node: <>
      <div style={{ padding: '10px 4px 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Reports</div>
      <ReportList />
      </> },
        ...(best && goal0 ? [{ id: 'tip', name: 'Savings tip', desc: 'Move leftovers to a goal', node: (

        <div style={{ background: 'oklch(0.95 0.04 160)', borderRadius: 26, padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--surface)', color: 'oklch(0.42 0.09 160)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.Bulb size={18} /></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 14, lineHeight: 1.4, color: 'oklch(0.32 0.07 160)', textWrap: 'pretty' }}>{best.name} still has {fmt(best.left)} this week. Move some to {goal0.name}?</span>
            <button onClick={() => openSheet({ name: 'move', id: best.id, to: goal0.id })} style={{ alignSelf: 'flex-start', height: 36, padding: '0 16px', borderRadius: 999, border: 0, background: 'oklch(0.42 0.09 160)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Move to goal</button>
          </div>
        </div>
        ) }] : []),
        { id: 'month', name: 'Spent this month', desc: 'Month total by pocket', node: <>
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
      </> },
        { id: 'week', name: 'This week vs last week', desc: 'Weekly comparison', node: <>
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
      </> },
        { id: 'tags', name: 'Spending by tag', desc: 'Totals for each tag', node: <>
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
      </> },
        { id: 'bills', name: 'Bills and subscriptions', desc: 'All your bills this month', node: <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Bills and subscriptions</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{fmt(bills.filter(b => !b.others).reduce((a, b) => a + approxLocal(d, b), 0))} / mo</span>
      </div>
      <ListCard>
        {bills.map((b, i) => (
          <div key={b.id} onClick={() => openSheet({ name: 'schedule', id: b.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${LINE}`, cursor: 'pointer' }}>
            <BillBadge b={b} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600, textDecoration: b.paid ? 'line-through' : 'none' }}>{b.name}</span>
              <span style={{ fontSize: 12, color: b.dueColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.dueLabel}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', color: b.paid || b.others ? 'var(--color-neutral-500)' : 'var(--color-text)' }}>{billAmount(b)}</span>
            {b.others ? <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)', flex: 'none' }}>Not you</span> :
            <button onClick={e => { e.stopPropagation(); toggleBill(b.id); }} aria-label={b.paid ? 'Mark unpaid' : 'Mark paid'} style={{ width: 30, height: 30, borderRadius: 999, border: `2px solid ${b.paid ? 'oklch(0.62 0.12 160)' : 'var(--color-neutral-300)'}`, background: b.paid ? 'oklch(0.62 0.12 160)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}>
              <I.Check size={14} />
            </button>}
          </div>
        ))}
        {bills.some(b => b.others) && <span style={{ display: 'block', padding: '10px 0 2px', fontSize: 12, color: 'var(--color-neutral-600)' }}>Items marked “Not you” are paid by someone else and aren’t in the total.</span>}
        <button onClick={() => openSheet({ name: 'schedule', id: null, kind: 'Bill' })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-accent-700)', fontSize: 15, fontWeight: 700, textAlign: 'left' }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, border: '2px dashed var(--color-accent-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.Plus size={18} /></span>
          Add bill or subscription
        </button>
      </ListCard>
      </> }
      ]} />
    </div>
  );
}

/* ---------------- Spending by category: the main table, filterable ---------------- */
type Period = 'week' | 'month' | 'last' | 'all';
function CategoryTable() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [period, setPeriod] = useState<Period>('month');
  const [sel, setSel] = useState<string[]>([]);
  const inPeriod = (date: string) => period === 'week' ? inRange(date, c.weekStart, addDays(c.weekStart, 6))
    : period === 'month' ? monthKey(date) === c.month : period === 'last' ? monthKey(date) === prevMonthKey(c.month) : true;
  const exps = myExpenses(d).filter(e => inPeriod(e.date));
  const total = exps.reduce((a, e) => a + e.amt, 0);
  const order = d.cats.map(k => k.name);
  const hueOf = (k: string) => HUES[(order.indexOf(k) < 0 ? order.length : order.indexOf(k)) % HUES.length];
  const groups = new Map<string, { n: number; sum: number; subs: Map<string, { n: number; sum: number }> }>();
  exps.forEach(e => {
    const [k, sub] = catOf(e);
    const g = groups.get(k) ?? { n: 0, sum: 0, subs: new Map() };
    g.n++; g.sum += e.amt;
    const sg = g.subs.get(sub || '—') ?? { n: 0, sum: 0 }; sg.n++; sg.sum += e.amt; g.subs.set(sub || '—', sg);
    groups.set(k, g);
  });
  const rows = [...groups.entries()].map(([k, g]) => ({ k, ...g })).sort((a, b) => b.sum - a.sum);
  const active = sel.filter(k => groups.has(k));
  const shownRows = active.length ? rows.filter(r => active.includes(r.k)) : rows;
  const shownTotal = shownRows.reduce((a, r) => a + r.sum, 0), shownN = shownRows.reduce((a, r) => a + r.n, 0);
  const list = active.length ? exps.filter(e => active.includes(catOf(e)[0])).sort(byDateDesc) : [];
  const toggle = (k: string) => setSel(s0 => (s0.includes(k) ? s0.filter(x => x !== k) : [...s0, k]));
  const label = { week: 'this week', month: monthName(c.month), last: monthName(prevMonthKey(c.month)), all: 'all time' }[period];
  const th = { fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)', textTransform: 'uppercase' as const, letterSpacing: '.04em' };
  const chip = (on: boolean) => ({ flex: 'none' as const, height: 34, padding: '0 12px', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const });

  return (
    <div aria-label="Spending by category" style={{ background: 'var(--surface)', borderRadius: 26, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>By category</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', background: 'var(--color-neutral-100)', borderRadius: 999, padding: 3, gap: 2 }}>
        {([['week', 'Week'], ['month', monthName(c.month).slice(0, 3)], ['last', monthName(prevMonthKey(c.month)).slice(0, 3)], ['all', 'All']] as [Period, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{ flex: 1, height: 32, borderRadius: 999, border: 0, background: period === k ? 'var(--surface)' : 'transparent', boxShadow: period === k ? 'var(--shadow-sm)' : 'none', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      <div className="noscroll" aria-label="Filter categories" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
        <button onClick={() => setSel([])} style={{ ...chip(!active.length), background: !active.length ? 'var(--color-text)' : 'var(--color-neutral-100)', color: !active.length ? 'var(--on-text)' : 'var(--color-text)' }}>All</button>
        {rows.map(r => {
          const on = active.includes(r.k), h = hueOf(r.k);
          return <button key={r.k} onClick={() => toggle(r.k)} aria-pressed={on} style={{ ...chip(on), background: on ? ink(h) : tint(h), color: on ? 'var(--on-text)' : ink(h) }}>{r.k}</button>;
        })}
      </div>

      <div role="table" style={{ display: 'flex', flexDirection: 'column' }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, padding: '0 0 6px', borderBottom: `1px solid ${LINE}` }}>
          <span role="columnheader" style={th}>Category</span><span role="columnheader" style={{ ...th, textAlign: 'right' }}>#</span><span role="columnheader" style={{ ...th, textAlign: 'right' }}>Total</span><span role="columnheader" style={{ ...th, textAlign: 'right' }}>%</span>
        </div>
        {shownRows.map(r => {
          const h = hueOf(r.k), open = active.includes(r.k);
          const subs = [...r.subs.entries()].sort((a, b) => b[1].sum - a[1].sum);
          return (
            <div key={r.k} style={{ borderBottom: `1px solid ${LINE}` }}>
              <div role="row" onClick={() => toggle(r.k)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, alignItems: 'center', padding: '10px 0 6px', cursor: 'pointer', fontSize: 14 }}>
                <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: mid(h), flex: 'none' }} />
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.k}</span>
                </span>
                <span role="cell" style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{r.n}</span>
                <span role="cell" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(r.sum)}</span>
                <span role="cell" style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{total ? Math.round(r.sum / total * 100) : 0}%</span>
              </div>
              <div style={{ paddingBottom: open ? 4 : 10 }}><Bar h={6} pct={pctOf(r.sum, rows[0]?.sum || 1)} track="var(--color-neutral-100)" fill={mid(h)} /></div>
              {open && subs.map(([sn, sg]) => (
                <div key={sn} role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  <span role="cell" style={{ paddingLeft: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sn}</span>
                  <span role="cell" style={{ textAlign: 'right' }}>{sg.n}</span>
                  <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(sg.sum)}</span>
                  <span role="cell" style={{ textAlign: 'right' }}>{r.sum ? Math.round(sg.sum / r.sum * 100) : 0}%</span>
                </div>
              ))}
              {open && <div style={{ height: 6 }} />}
            </div>
          );
        })}
        {rows.length === 0 && <span style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No expenses {period === 'all' ? 'yet' : `in ${label}`}.</span>}
        {rows.length > 0 && (
          <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, padding: '10px 0 0', fontSize: 14, fontWeight: 800 }}>
            <span role="cell">{active.length ? 'Selected' : 'Total'}</span>
            <span role="cell" style={{ textAlign: 'right' }}>{shownN}</span>
            <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(shownTotal)}</span>
            <span role="cell" style={{ textAlign: 'right' }}>{total ? Math.round(shownTotal / total * 100) : 0}%</span>
          </div>
        )}
      </div>
      {!active.length && rows.length > 0 && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Tap a category to see its subcategories and transactions. You can pick several.</span>}

      {active.length > 0 && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{plural(list.length, 'transaction')}</span>
          {active.length === 1 && <span onClick={() => openSheet({ name: 'search', cat: active[0] })} style={{ fontSize: 13, color: 'var(--color-accent-700)', fontWeight: 700, cursor: 'pointer' }}>Search in {active[0]}</span>}
        </div>
        <div style={{ margin: '-4px 0 0' }}>
          {list.slice(0, 40).map((e, i) => <ExpRow key={e.id} v={expView(d, e, c)} size={36} last={i === Math.min(list.length, 40) - 1} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: e.id })} />)}
          {list.length > 40 && <span style={{ display: 'block', padding: '10px 0 0', fontSize: 12, color: 'var(--color-neutral-600)' }}>Showing the latest 40.</span>}
        </div>
      </>}
    </div>
  );
}
