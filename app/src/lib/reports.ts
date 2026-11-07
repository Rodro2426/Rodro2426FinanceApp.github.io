// Data for the Insights reports: categories, accounts and budgets, over a period or over time.
import type { Data, Income } from './types';
import { addDays, daysInMonth, makeCtx, monthKey, prevMonthKey, todayISO, weekStart, type Ctx } from './dates';
import { acctTxns, catOf, ctxOf, monthPlanOf, pocketStats } from './derive';
import { cdtView, cdtsOf } from './cdt';
import { holdings } from './invest';
import { groupValue } from './networth';

/* ---------------- Income categories ---------------- */
export const INCOME_CATS = ['Salary', 'Freelance', 'Business', 'Investments', 'Interest', 'Gift', 'Refund', 'Other income'];
/** An income's category: the one picked, or a sensible one for older and automatic incomes. */
export function incCatOf(d: Data, t: Income): string {
  if (t.cat) return t.cat;
  if (t.interest) return 'Interest';
  if (t.id.startsWith('cdt:')) return 'Investments';
  if (t.ruleId) return d.bills.find(b => b.id === t.ruleId)?.name || 'Salary';
  return 'Other income';
}

/* ---------------- Periods ---------------- */
export type Period = 'week' | 'month' | 'last' | '3m' | 'year' | 'all';
export const PERIODS: [Period, string][] = [['week', 'Week'], ['month', 'Month'], ['last', 'Last month'], ['3m', '3 months'], ['year', 'This year'], ['all', 'All']];
export function inPeriod(p: Period, date: string, c: Ctx): boolean {
  switch (p) {
    case 'week': return date >= c.weekStart && date <= addDays(c.weekStart, 6);
    case 'month': return monthKey(date) === c.month;
    case 'last': return monthKey(date) === prevMonthKey(c.month);
    case '3m': return monthKey(date) >= prevMonthKey(prevMonthKey(c.month)) && date <= c.today;
    case 'year': return date.slice(0, 4) === c.today.slice(0, 4) && date <= c.today;
    default: return date <= c.today;
  }
}

/** Range for over-time reports: the last `n` months ending this month (all = since the first transaction). */
export type Range = 3 | 6 | 12 | 0;
export const RANGES: [Range, string][] = [[3, '3M'], [6, '6M'], [12, '12M'], [0, 'All']];
export function monthsIn(d: Data, c: Ctx, n: Range): string[] {
  let first = c.month;
  if (n) for (let i = 1; i < n; i++) first = prevMonthKey(first);
  else {
    const dates = [...d.expenses.map(e => e.date), ...d.incomes.map(t => t.date)].sort();
    first = dates.length ? monthKey(dates[0]) : c.month;
    if (first > c.month) first = c.month;
  }
  const out: string[] = [];
  for (let m = first; m <= c.month; m = nextMonth(m)) out.push(m);
  return out;
}
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
/** The last day of a month, or today for the current month. */
export const monthEnd = (m: string, c: Ctx) => (m === c.month ? c.today : `${m}-${String(daysInMonth(m)).padStart(2, '0')}`);

/* ---------------- Categories ---------------- */
export interface CatTotal { name: string; sum: number; n: number }
const sortTotals = (m: Map<string, CatTotal>) => [...m.values()].sort((a, b) => b.sum - a.sum);
export function expenseCats(d: Data, c: Ctx, p: Period): CatTotal[] {
  const m = new Map<string, CatTotal>();
  d.expenses.filter(e => inPeriod(p, e.date, c)).forEach(e => { const k = catOf(e)[0]; const t = m.get(k) ?? { name: k, sum: 0, n: 0 }; t.sum += e.amt; t.n++; m.set(k, t); });
  return sortTotals(m);
}
export function incomeCats(d: Data, c: Ctx, p: Period): CatTotal[] {
  const m = new Map<string, CatTotal>();
  d.incomes.filter(t => inPeriod(p, t.date, c)).forEach(t => { const k = incCatOf(d, t); const x = m.get(k) ?? { name: k, sum: 0, n: 0 }; x.sum += t.amt; x.n++; m.set(k, x); });
  return sortTotals(m);
}
export const allExpenseCats = (d: Data) => [...new Set([...d.cats.map(k => k.name), ...d.expenses.map(e => catOf(e)[0])])];
export const allIncomeCats = (d: Data) => [...new Set([...INCOME_CATS, ...d.incomes.map(t => incCatOf(d, t))])];

/**
 * Stable colors for a pie: categories ranked by all-time money get slots 1–7 for good, so a category keeps
 * its color when the period changes. The rest share one gray "Other" slice.
 */
export function pieSlices(d: Data, rows: CatTotal[], kind: 'expense' | 'income', palette: string[], other: string) {
  const all = kind === 'expense' ? expenseCats(d, makeCtx(d.settings.weeks), 'all') : incomeCats(d, makeCtx(d.settings.weeks), 'all');
  const slot = new Map(all.slice(0, 7).map((t, i) => [t.name, i]));
  const named = rows.filter(r => slot.has(r.name) && r.sum > 0).sort((a, b) => slot.get(a.name)! - slot.get(b.name)!);
  const rest = rows.filter(r => !slot.has(r.name)).reduce((a, r) => a + r.sum, 0);
  return [...named.map(r => ({ label: r.name, value: r.sum, color: palette[slot.get(r.name)!] })), ...(rest > 0 ? [{ label: 'Other', value: rest, color: other }] : [])];
}

/** Monthly totals for one category (or all when `cat` is null). */
export function catOverTime(d: Data, months: string[], kind: 'expense' | 'income', cat: string | null): number[] {
  return months.map(m => kind === 'expense'
    ? d.expenses.filter(e => monthKey(e.date) === m && (!cat || catOf(e)[0] === cat)).reduce((a, e) => a + e.amt, 0)
    : d.incomes.filter(t => monthKey(t.date) === m && (!cat || incCatOf(d, t) === cat)).reduce((a, t) => a + t.amt, 0));
}
/** Category × month table, categories with any money in the range, biggest first. */
export function breakdown(d: Data, months: string[], kind: 'expense' | 'income') {
  const names = kind === 'expense' ? allExpenseCats(d) : allIncomeCats(d);
  const rows = names.map(name => ({ name, values: catOverTime(d, months, kind, name) }))
    .map(r => ({ ...r, total: r.values.reduce((a, x) => a + x, 0) })).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const totals = months.map((_, i) => rows.reduce((a, r) => a + r.values[i], 0));
  return { rows, totals, grand: totals.reduce((a, x) => a + x, 0) };
}

/* ---------------- Accounts ---------------- */
/** An account's balance at the end of `date`, rebuilt from today's balance by undoing everything after that day. */
export function balanceAt(d: Data, acctId: string, date: string): number {
  const a = d.accounts.find(x => x.id === acctId);
  if (!a) return 0;
  return acctTxns(d, acctId).list.filter(t => t.date > date).reduce((bal, t) => bal - t.effect, a.bal);
}
/** Signed: what the account adds to your net worth (cards subtract what you owe). */
export const worthAt = (d: Data, acctId: string, date: string) => { const a = d.accounts.find(x => x.id === acctId); const b = balanceAt(d, acctId, date); return a?.type === 'card' ? -b : b; };
export const cdtWorthAt = (d: Data, date: string) => cdtsOf(d).filter(c => c.start <= date && !(c.closed && c.closed.date <= date)).reduce((a, c) => a + cdtView(c, date).value, 0);
/** Stocks held on a date (trades up to then), valued at the latest known price. */
export const stocksAt = (d: Data, date: string) => holdings({ ...d, investments: { ...d.investments, trades: d.investments.trades.filter(t => t.date <= date) } }).reduce((a, h) => a + h.valueLocal, 0);
/** Net worth on a date, with the same rules as the Accounts tab: investments unless excluded, and counted groups at today's value. */
export const netWorthAt = (d: Data, date: string) => d.accounts.reduce((a, x) => a + worthAt(d, x.id, date), 0)
  + (d.settings.excludeInvestments ? 0 : cdtWorthAt(d, date) + stocksAt(d, date))
  + (d.groups ?? []).filter(g => g.inNetWorth).reduce((a, g) => a + groupValue(g), 0);
export const netWorthSeries = (d: Data, months: string[], c: Ctx) => months.map(m => netWorthAt(d, monthEnd(m, c)));
export const balanceSeries = (d: Data, acctId: string, months: string[], c: Ctx) => months.map(m => worthAt(d, acctId, monthEnd(m, c)));

/** Money in and out each month. Card payments, CDT moves and pocket transfers aren't income or spending. */
export function cashflow(d: Data, months: string[]) {
  return months.map(m => {
    const income = d.incomes.filter(t => monthKey(t.date) === m).reduce((a, t) => a + t.amt, 0);
    const expenses = d.expenses.filter(e => monthKey(e.date) === m).reduce((a, e) => a + e.amt, 0);
    return { month: m, income, expenses, net: income - expenses };
  });
}

/* ---------------- Budgets ---------------- */
export interface BudgetRow { id: string; name: string; hue: number; budget: number; spent: number; left: number }
/** Planned vs spent per pocket, this week or this month. */
export function compareBudgets(d: Data, c: Ctx, scope: 'week' | 'month'): BudgetRow[] {
  return d.pockets.map(p => {
    if (scope === 'week') { const s = pocketStats(d, p.id, c)!; return { id: p.id, name: p.name, hue: p.hue, budget: s.budget, spent: s.spent, left: s.left }; }
    const spent = d.expenses.filter(e => e.p === p.id && monthKey(e.date) === c.month).reduce((a, e) => a + e.amt, 0);
    const budget = monthPlanOf(p, c) + d.moves.filter(m => m.to === p.id && (m.month ?? monthKey(addDays(m.week, 6))) === c.month).reduce((a, m) => a + m.amt, 0)
      - d.moves.filter(m => m.from === p.id && (m.month ?? monthKey(addDays(m.week, 6))) === c.month).reduce((a, m) => a + m.amt, 0);
    return { id: p.id, name: p.name, hue: p.hue, budget, spent, left: budget - spent };
  });
}
/** What was left at the end of each of the last `n` weeks (this week so far), for one pocket or all of them. */
export function budgetWeeks(d: Data, c: Ctx, n: number, pocket: string | null) {
  const ids = pocket ? [pocket] : d.pockets.map(p => p.id);
  const out: { week: string; budget: number; spent: number; left: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ws = addDays(weekStart(c.today), -7 * i), cw = makeCtx(c.weeks, i === 0 ? c.today : addDays(ws, 6));
    const s = ids.map(id => pocketStats(d, id, cw)).filter(Boolean) as NonNullable<ReturnType<typeof pocketStats>>[];
    const budget = s.reduce((a, x) => a + x.budget, 0), spent = s.reduce((a, x) => a + x.spent, 0);
    out.push({ week: ws, budget, spent, left: budget - spent });
  }
  return out;
}

export const reportCtx = (d: Data) => ctxOf(d);
export { todayISO };
