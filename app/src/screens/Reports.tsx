import { useState, type ReactNode } from 'react';
import { useApp, setUI } from '../lib/store';
import { TEXT } from '../lib/constants';
import { ctxOf, fmt } from '../lib/derive';
import { fmtDay, shortDate } from '../lib/dates';
import {
  PERIODS, RANGES, allExpenseCats, allIncomeCats, balanceSeries, breakdown, budgetWeeks, cashflow, catOverTime, compareBudgets,
  expenseCats, incomeCats, monthsIn, netWorthSeries, pieSlices, worthAt, type Period, type Range
} from '../lib/reports';
import { Columns, DataTable, Lines, Meters, Pie, RankedBars, VIZ, compactNum, heat, type Series } from '../ui/charts';
import * as I from '../ui/icons';

type Icon = 'pie' | 'bars' | 'table' | 'pulse';
export interface ReportDef { id: string; group: 'Categories' | 'Accounts' | 'Budgets'; title: string; icon: Icon; tone: string }
export const REPORTS: ReportDef[] = [
  { id: 'cat-exp', group: 'Categories', title: 'Compare expense categories', icon: 'pie', tone: '#e5484d' },
  { id: 'cat-inc', group: 'Categories', title: 'Compare income categories', icon: 'pie', tone: '#30a46c' },
  { id: 'cattime-exp', group: 'Categories', title: 'Expense category over time', icon: 'bars', tone: '#e5484d' },
  { id: 'cattime-inc', group: 'Categories', title: 'Income category over time', icon: 'bars', tone: '#30a46c' },
  { id: 'break-exp', group: 'Categories', title: 'Breakdown expenses over time', icon: 'table', tone: '#e5484d' },
  { id: 'break-inc', group: 'Categories', title: 'Breakdown incomes over time', icon: 'table', tone: '#30a46c' },
  { id: 'networth', group: 'Accounts', title: 'Net worth over time', icon: 'pulse', tone: '#3fb6c9' },
  { id: 'balance', group: 'Accounts', title: 'Balance over time', icon: 'pulse', tone: '#ef8f3c' },
  { id: 'compare-bal', group: 'Accounts', title: 'Compare balances', icon: 'pie', tone: '#e5484d' },
  { id: 'compare-bal-time', group: 'Accounts', title: 'Compare balances over time', icon: 'bars', tone: '#e7b416' },
  { id: 'cashflow', group: 'Accounts', title: 'Cashflow (incomes / expenses)', icon: 'bars', tone: '#30a46c' },
  { id: 'compare-budgets', group: 'Budgets', title: 'Compare budgets', icon: 'pie', tone: '#e5484d' },
  { id: 'budget-time', group: 'Budgets', title: 'Budget balance over time', icon: 'bars', tone: '#e7b416' }
];

export function ReportIcon({ icon, tone, size = 34 }: { icon: Icon; tone: string; size?: number }) {
  const s = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.28, background: tone, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
        {icon === 'pie' && <><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 3.5V12l6 6" {...s} /></>}
        {icon === 'bars' && <><rect x="3.5" y="11" width="4" height="9" rx="1.5" {...s} /><rect x="10" y="7" width="4" height="13" rx="1.5" {...s} /><rect x="16.5" y="4" width="4" height="16" rx="1.5" {...s} /></>}
        {icon === 'table' && <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" {...s} /><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10" {...s} /></>}
        {icon === 'pulse' && <path d="M3 12h4l2-5 4 10 2-5h6" {...s} />}
      </svg>
    </span>
  );
}

/** The grouped list of reports shown in Insights. */
export function ReportList() {
  const groups: ReportDef['group'][] = ['Categories', 'Accounts', 'Budgets'];
  return (
    <>
      {groups.map(g => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ padding: '6px 4px 0', fontSize: 15, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{g}</span>
          <div style={{ background: '#fff', borderRadius: 24, padding: '2px 0' }}>
            {REPORTS.filter(r => r.group === g).map((r, i, arr) => (
              <button key={r.id} onClick={() => setUI({ page: `report:${r.id}` })} className="hv-n100"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
                <ReportIcon icon={r.icon} tone={r.tone} />
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 500, padding: '6px 0', borderBottom: i === arr.length - 1 ? 0 : '1px solid var(--color-neutral-200)' }}>{r.title}</span>
                <I.Chevron size={16} color="var(--color-neutral-500)" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

const monthShort = (m: string, withYear: boolean) => fmtDay(m + '-15', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
const chipRow = (children: ReactNode) => <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>{children}</div>;
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, border: 0, background: on ? TEXT : '#fff', color: on ? '#fff' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--color-neutral-200)' }}>{children}</button>;
}
function Picker({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 16, padding: '6px 6px 6px 14px' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, minWidth: 0, height: 36, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', fontSize: 15, fontWeight: 700, color: TEXT, padding: '0 8px' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
const card = (children: ReactNode, label?: string) => <div aria-label={label} style={{ background: '#fff', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>;
/** Short money for wide month-by-month tables: $469K, $1,4M. */
const short = (n: number) => (n < 0 ? '−$' : '$') + compactNum(Math.abs(n));
const pct = (v: number, t: number) => (t ? `${Math.round((v / t) * 100)}%` : '—');

/** One report, full screen. */
export default function ReportPage({ id }: { id: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const def = REPORTS.find(r => r.id === id) ?? REPORTS[0];
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>(6);
  const expCats = allExpenseCats(d), incCats = allIncomeCats(d);
  const [cat, setCat] = useState<string>('');
  const [acct, setAcct] = useState<string>(d.accounts[0]?.id ?? '');
  const [pocket, setPocket] = useState<string>('');
  const [scope, setScope] = useState<'week' | 'month'>('week');
  const [view, setView] = useState<'bars' | 'pie'>(() => { try { return localStorage.getItem('pockets-cat-view') === 'pie' ? 'pie' : 'bars'; } catch { return 'bars'; } });
  const pickView = (v: 'bars' | 'pie') => { setView(v); try { localStorage.setItem('pockets-cat-view', v); } catch { /* not saved */ } };
  const months = monthsIn(d, c, range), withYear = months.some(m => m.slice(0, 4) !== c.month.slice(0, 4));
  const labels = months.map(m => monthShort(m, withYear));
  const S = VIZ.series;

  const periodChips = chipRow(PERIODS.map(([k, l]) => <Chip key={k} on={period === k} onClick={() => setPeriod(k)}>{l}</Chip>));
  const rangeChips = chipRow(RANGES.map(([k, l]) => <Chip key={k} on={range === k} onClick={() => setRange(k)}>{l}</Chip>));
  let body: ReactNode = null;

  if (id === 'cat-exp' || id === 'cat-inc') {
    const rows = id === 'cat-exp' ? expenseCats(d, c, period) : incomeCats(d, c, period);
    const total = rows.reduce((a, r) => a + r.sum, 0);
    body = <>
      {periodChips}
      {card(<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{id === 'cat-exp' ? 'Spent' : 'Received'}</span><span style={{ fontSize: 24, fontWeight: 700 }}>{fmt(total)}</span></div>
        {chipRow(<><Chip on={view === 'bars'} onClick={() => pickView('bars')}>Bars</Chip><Chip on={view === 'pie'} onClick={() => pickView('pie')}>Pie chart</Chip></>)}
        {!rows.length ? <Empty /> : view === 'pie'
          ? <Pie slices={pieSlices(d, rows, id === 'cat-exp' ? 'expense' : 'income', S, '#9b9797')} fmt={fmt} />
          : <RankedBars rows={rows.map(r => ({ label: r.name, value: r.sum, note: pct(r.sum, total) }))} color={S[0]} fmt={fmt} />}
      </>, 'Chart')}
      {rows.length > 0 && card(<DataTable head={['Category', '#', 'Total', '%']} rows={rows.map(r => [r.name, r.n, fmt(r.sum), pct(r.sum, total)])} foot={['Total', rows.reduce((a, r) => a + r.n, 0), fmt(total), '100%']} />, 'Table')}
    </>;
  } else if (id === 'cattime-exp' || id === 'cattime-inc') {
    const kind = id === 'cattime-exp' ? 'expense' : 'income', names = kind === 'expense' ? expCats : incCats;
    const values = catOverTime(d, months, kind, cat || null), total = values.reduce((a, x) => a + x, 0);
    body = <>
      <Picker label="Category" value={cat} onChange={setCat} options={[['', `All ${kind === 'expense' ? 'expenses' : 'income'}`], ...names.map(n => [n, n] as [string, string])]} />
      {rangeChips}
      {card(<Columns labels={labels} series={[{ name: cat || 'All', values, color: S[0] }]} fmt={fmt} />, 'Chart')}
      {card(<DataTable head={['Month', 'Total']} rows={months.map((m, i) => [monthShort(m, true), fmt(values[i])]).reverse()} foot={['Total', fmt(total)]} />, 'Table')}
      <span style={{ margin: '0 4px', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>Monthly average: <b>{fmt(total / Math.max(1, months.length))}</b></span>
    </>;
  } else if (id === 'break-exp' || id === 'break-inc') {
    const b = breakdown(d, months, id === 'break-exp' ? 'expense' : 'income');
    const max = Math.max(0, ...b.rows.flatMap(r => r.values));
    body = <>
      {rangeChips}
      {card(b.rows.length ? <DataTable head={['Category', ...labels, 'Total']}
        rows={b.rows.map(r => [r.name, ...r.values.map((v, i) => <span key={i} style={{ display: 'inline-block', minWidth: 44, padding: '3px 5px', borderRadius: 6, ...heat(v, max) }}>{v ? short(v) : '—'}</span>), short(r.total)])}
        foot={['Total', ...b.totals.map(t => short(t)), short(b.grand)]} /> : <Empty />, 'Table')}
      <Note>Darker cells are bigger amounts (K = thousand, M = million). Scroll the table sideways for more months; open the category over time report for exact amounts.</Note>
    </>;
  } else if (id === 'networth') {
    const values = netWorthSeries(d, months, c);
    body = <>
      {rangeChips}
      {card(<Lines labels={labels} series={[{ name: 'Net worth', values, color: S[0] }]} fmt={fmt} />, 'Chart')}
      {card(<DataTable head={['Month end', 'Net worth', 'Change']} rows={months.map((m, i) => [monthShort(m, true), fmt(values[i]), i ? fmt(values[i] - values[i - 1], true) : '—']).reverse()} />, 'Table')}
      <Note>Accounts minus card debt, plus open CDTs, at the end of each month (today for this month). Rebuilt from your transactions.</Note>
    </>;
  } else if (id === 'balance') {
    const a = d.accounts.find(x => x.id === acct) ?? d.accounts[0];
    const values = a ? balanceSeries(d, a.id, months, c).map(v => (a.type === 'card' ? -v : v)) : [];
    body = <>
      <Picker label="Account" value={a?.id ?? ''} onChange={setAcct} options={d.accounts.map(x => [x.id, x.name])} />
      {rangeChips}
      {a ? <>
        {card(<Lines labels={labels} series={[{ name: a.name, values, color: S[0] }]} fmt={fmt} />, 'Chart')}
        {card(<DataTable head={['Month end', a.type === 'card' ? 'Owed' : 'Balance']} rows={months.map((m, i) => [monthShort(m, true), fmt(values[i])]).reverse()} />, 'Table')}
      </> : <Empty />}
    </>;
  } else if (id === 'compare-bal') {
    const rows = d.accounts.map(a => ({ label: a.name, value: worthAt(d, a.id, c.today), note: a.type === 'card' ? 'owed' : undefined })).sort((x, y) => y.value - x.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    body = <>
      {card(<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Net of all accounts</span><span style={{ fontSize: 24, fontWeight: 700 }}>{fmt(total)}</span></div>
        {rows.length ? <RankedBars rows={rows} color={S[0]} fmt={fmt} /> : <Empty />}
      </>, 'Chart')}
      {rows.length > 0 && card(<DataTable head={['Account', 'Balance', 'Share of assets']} rows={rows.map(r => [r.label, fmt(r.value), r.value > 0 ? pct(r.value, rows.filter(x => x.value > 0).reduce((s, x) => s + x.value, 0)) : '—'])} foot={['Net', fmt(total), '']} />, 'Table')}
      <Note>Cards show what you owe as a negative amount.</Note>
    </>;
  } else if (id === 'compare-bal-time') {
    // Color follows the account (its position in your list), never its rank. Past 7 accounts, the rest fold into Other.
    const accts = d.accounts.slice(0, 7), rest = d.accounts.slice(7);
    const series: Series[] = accts.map((a, i) => ({ name: a.name, color: S[i], values: months.map(m => worthAt(d, a.id, monthEnd(m))) }));
    if (rest.length) series.push({ name: 'Other', color: '#9b9797', values: months.map(m => rest.reduce((s, a) => s + worthAt(d, a.id, monthEnd(m)), 0)) });
    body = <>
      {rangeChips}
      {card(series.length ? <Lines labels={labels} series={series} fmt={fmt} /> : <Empty />, 'Chart')}
      {series.length > 0 && card(<DataTable head={['Account', ...labels]} rows={series.map(s => [s.name, ...s.values.map(v => short(v))])} />, 'Table')}
      <Note>Balance at the end of each month. Cards show what you owe as a negative amount.</Note>
    </>;
  } else if (id === 'cashflow') {
    const rows = cashflow(d, months);
    const tin = rows.reduce((a, r) => a + r.income, 0), tout = rows.reduce((a, r) => a + r.expenses, 0);
    body = <>
      {rangeChips}
      {card(<Columns labels={labels} series={[{ name: 'Income', values: rows.map(r => r.income), color: S[0] }, { name: 'Expenses', values: rows.map(r => r.expenses), color: S[1] }]} fmt={fmt} />, 'Chart')}
      {card(<DataTable head={['Month', 'Income', 'Expenses', 'Net']} rows={rows.map(r => [monthShort(r.month, true), fmt(r.income), fmt(r.expenses), fmt(r.net, true)]).reverse()} foot={['Total', fmt(tin), fmt(tout), fmt(tin - tout, true)]} />, 'Table')}
      <Note>Card payments, CDT deposits and moves between pockets aren't income or spending, so they're left out.</Note>
    </>;
  } else if (id === 'compare-budgets') {
    const rows = compareBudgets(d, c, scope);
    const tb = rows.reduce((a, r) => a + r.budget, 0), ts = rows.reduce((a, r) => a + r.spent, 0);
    body = <>
      {chipRow(<><Chip on={scope === 'week'} onClick={() => setScope('week')}>This week</Chip><Chip on={scope === 'month'} onClick={() => setScope('month')}>This month</Chip></>)}
      {card(rows.length ? <Meters rows={rows.map(r => ({ label: r.name, used: r.spent, total: r.budget }))} fmt={fmt} /> : <Empty text="No pockets yet." />, 'Chart')}
      {rows.length > 0 && card(<DataTable head={['Pocket', 'Budget', 'Spent', 'Left', 'Used']} rows={rows.map(r => [r.name, fmt(r.budget), fmt(r.spent), fmt(r.left), pct(r.spent, r.budget)])} foot={['Total', fmt(tb), fmt(ts), fmt(tb - ts), pct(ts, tb)]} />, 'Table')}
    </>;
  } else if (id === 'budget-time') {
    const weeks = budgetWeeks(d, c, 8, pocket || null);
    const wl = weeks.map(w => shortDate(w.week));
    body = <>
      <Picker label="Pocket" value={pocket} onChange={setPocket} options={[['', 'All pockets'], ...d.pockets.map(p => [p.id, p.name] as [string, string])]} />
      {card(<Columns labels={wl} series={[{ name: 'Left at the end of the week', values: weeks.map(w => w.left), color: S[0] }]} fmt={v => fmt(v)} />, 'Chart')}
      {card(<DataTable head={['Week of', 'Budget', 'Spent', 'Left']} rows={weeks.map((w, i) => [shortDate(w.week) + (i === weeks.length - 1 ? ' (now)' : ''), fmt(w.budget), fmt(w.spent), fmt(w.left)]).reverse()} />, 'Table')}
      <Note>What was left in the pocket at the end of each week; below zero means it went over. Past weeks use each pocket's current weekly budget.</Note>
    </>;
  }

  function monthEnd(m: string) { return m === c.month ? c.today : `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()).padStart(2, '0')}`; }

  return (
    <div className="page noscroll scroller" style={{ position: 'absolute', inset: 0, zIndex: 25, background: '#f7f5f3' }}>
      <div className="scroll-body" style={{ padding: 'var(--top) 18px calc(var(--tb) + 30px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 2px' }}>
          <button onClick={() => setUI({ page: null })} aria-label="Back to insights" className="hv-n200" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: '#fff', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.ChevronLeft size={20} /></button>
          <ReportIcon icon={def.icon} tone={def.tone} size={30} />
          <span style={{ flex: 1, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{def.title}</span>
        </div>
        {body}
      </div>
    </div>
  );
}

function Empty({ text = 'No data for this period yet.' }: { text?: string }) { return <span style={{ fontSize: 14, color: 'var(--color-neutral-700)', padding: '8px 0' }}>{text}</span>; }
function Note({ children }: { children: ReactNode }) { return <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{children}</span>; }
