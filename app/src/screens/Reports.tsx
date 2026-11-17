import { useState, type ReactNode } from 'react';
import { useApp, setUI } from '../lib/store';
import { TEXT } from '../lib/constants';
import { ctxOf, fmt } from '../lib/derive';
import { fmtDay } from '../lib/dates';
import {
  PERIODS, RANGES, allExpenseCats, cashflow, catOverTime, compareBudgets, expenseCats, monthsIn, netWorthSeries, pieSlices, type Period, type Range
} from '../lib/reports';
import { Columns, DataTable, Lines, Meters, Pie, RankedBars, VIZ } from '../ui/charts';
import * as I from '../ui/icons';

type Icon = 'pie' | 'bars' | 'table' | 'pulse';
export interface ReportDef { id: string; title: string; icon: Icon; tone: string }
/** The charts people use most, in plain words. Ids stay the same so older links still open. */
export const REPORTS: ReportDef[] = [
  { id: 'cat-exp', title: 'Where your money goes', icon: 'pie', tone: '#e5484d' },
  { id: 'cattime-exp', title: 'Spending month by month', icon: 'bars', tone: '#ef8f3c' },
  { id: 'cashflow', title: 'Money in vs. money out', icon: 'bars', tone: '#30a46c' },
  { id: 'compare-budgets', title: 'Pockets: budget vs. spent', icon: 'pie', tone: '#e7b416' },
  { id: 'networth', title: 'Your net worth over time', icon: 'pulse', tone: '#3fb6c9' }
]

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

/** The list of reports shown in Insights. */
export function ReportList() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '2px 0' }}>
      {REPORTS.map((r, i, arr) => (
        <button key={r.id} onClick={() => setUI({ page: `report:${r.id}` })} className="hv-n100"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
          <ReportIcon icon={r.icon} tone={r.tone} />
          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 500, padding: '6px 0', borderBottom: i === arr.length - 1 ? 0 : '1px solid var(--color-neutral-200)' }}>{r.title}</span>
          <I.Chevron size={16} color="var(--color-neutral-500)" />
        </button>
      ))}
    </div>
  );
}

const monthShort = (m: string, withYear: boolean) => fmtDay(m + '-15', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
const chipRow = (children: ReactNode) => <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>{children}</div>;
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--color-neutral-200)' }}>{children}</button>;
}
function Picker({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 16, padding: '6px 6px 6px 14px' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, minWidth: 0, height: 36, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', fontSize: 15, fontWeight: 700, color: TEXT, padding: '0 8px' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
const card = (children: ReactNode, label?: string) => <div aria-label={label} style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>;
const pct = (v: number, t: number) => (t ? `${Math.round((v / t) * 100)}%` : '—');

/** One report, full screen. */
export default function ReportPage({ id }: { id: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const def = REPORTS.find(r => r.id === id) ?? REPORTS[0];
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>(6);
  const expCats = allExpenseCats(d);
  const [cat, setCat] = useState<string>('');
  const [scope, setScope] = useState<'week' | 'month'>('week');
  const [view, setView] = useState<'bars' | 'pie'>(() => { try { return localStorage.getItem('pockets-cat-view') === 'pie' ? 'pie' : 'bars'; } catch { return 'bars'; } });
  const pickView = (v: 'bars' | 'pie') => { setView(v); try { localStorage.setItem('pockets-cat-view', v); } catch { /* not saved */ } };
  const months = monthsIn(d, c, range), withYear = months.some(m => m.slice(0, 4) !== c.month.slice(0, 4));
  const labels = months.map(m => monthShort(m, withYear));
  const S = VIZ.series;

  const periodChips = chipRow(PERIODS.map(([k, l]) => <Chip key={k} on={period === k} onClick={() => setPeriod(k)}>{l}</Chip>));
  const rangeChips = chipRow(RANGES.map(([k, l]) => <Chip key={k} on={range === k} onClick={() => setRange(k)}>{l}</Chip>));
  let body: ReactNode = null;

  if (id === 'cat-exp') {
    const rows = expenseCats(d, c, period);
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
  } else if (id === 'cattime-exp') {
    const kind = 'expense', names = expCats;
    const values = catOverTime(d, months, kind, cat || null), total = values.reduce((a, x) => a + x, 0);
    body = <>
      <Picker label="Category" value={cat} onChange={setCat} options={[['', `All ${kind === 'expense' ? 'expenses' : 'income'}`], ...names.map(n => [n, n] as [string, string])]} />
      {rangeChips}
      {card(<Columns labels={labels} series={[{ name: cat || 'All', values, color: S[0] }]} fmt={fmt} />, 'Chart')}
      {card(<DataTable head={['Month', 'Total']} rows={months.map((m, i) => [monthShort(m, true), fmt(values[i])]).reverse()} foot={['Total', fmt(total)]} />, 'Table')}
      <span style={{ margin: '0 4px', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>Monthly average: <b>{fmt(total / Math.max(1, months.length))}</b></span>
    </>;
  } else if (id === 'networth') {
    const values = netWorthSeries(d, months, c);
    body = <>
      {rangeChips}
      {card(<Lines labels={labels} series={[{ name: 'Net worth', values, color: S[0] }]} fmt={fmt} />, 'Chart')}
      {card(<DataTable head={['Month end', 'Net worth', 'Change']} rows={months.map((m, i) => [monthShort(m, true), fmt(values[i]), i ? fmt(values[i] - values[i - 1], true) : '—']).reverse()} />, 'Table')}
      <Note>Accounts minus card debt{d.settings.excludeInvestments ? '' : ', plus stocks and open CDTs'}{(d.groups ?? []).some(g => g.inNetWorth) ? ', plus your groups at their current value' : ''}, at the end of each month (today for this month). Rebuilt from your transactions; past stock values use today's prices.</Note>
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
  }

  return <SubPage title={def.title} icon={<ReportIcon icon={def.icon} tone={def.tone} size={30} />} back={() => setUI({ page: 'reports' })} backLabel="Back to reports">{body}</SubPage>;
}

/** A full page over the Insights tab, with a back button and a title. */
export function SubPage({ title, icon, back, backLabel, children }: { title: string; icon?: ReactNode; back: () => void; backLabel: string; children: ReactNode }) {
  return (
    <div className="page noscroll scroller" style={{ position: 'absolute', inset: 0, zIndex: 25, background: 'var(--page)' }}>
      <div className="scroll-body" style={{ padding: 'var(--top) 18px calc(var(--tb) + 30px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 2px' }}>
          <button onClick={back} aria-label={backLabel} data-back className="hv-n200" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.ChevronLeft size={20} /></button>
          {icon}
          <span style={{ flex: 1, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Every chart, grouped; opened from the Reports card on Insights. */
export function ReportsIndex() {
  return (
    <SubPage title="Reports" back={() => setUI({ page: null })} backLabel="Back to insights">
      <ReportList />
    </SubPage>
  );
}

function Empty({ text = 'No data for this period yet.' }: { text?: string }) { return <span style={{ fontSize: 14, color: 'var(--color-neutral-700)', padding: '8px 0' }}>{text}</span>; }
function Note({ children }: { children: ReactNode }) { return <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{children}</span>; }
