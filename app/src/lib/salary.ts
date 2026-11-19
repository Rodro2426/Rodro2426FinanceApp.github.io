// One income: the monthly income in Budget is also the salary that arrives in your account on payday.
// The salary's scheduled item(s) (one, or two for a quincena) take their amount from it; a month that came in
// different is saved in `monthIncome` with how the pockets change that month.
import type { Bill, Data } from './types';
import { num } from './derive';
import { unitsFor } from './split';

export const isSalary = (b: Bill) => !!b.salary;
/** The salary's paydays, in order of the day (two for a quincena). */
export const salaryBills = (d: Pick<Data, 'bills'>) => d.bills.filter(isSalary).sort((a, b) => a.dueDay - b.dueDay);
/** The income for a month: what you said came in that month, or your normal monthly income. */
export const baseIncome = (d: Pick<Data, 'incomeStr' | 'monthIncome'>, month: string) => d.monthIncome?.[month]?.amt ?? num(d.incomeStr);

/** What one payday brings in a month: the income split evenly over the paydays (the last one takes the rounding). */
export function salaryShare(d: Pick<Data, 'bills' | 'incomeStr' | 'monthIncome' | 'settings'>, b: Bill, month: string, total = baseIncome(d, month)) {
  const list = salaryBills(d), n = Math.max(1, list.length), i = Math.max(0, list.findIndex(x => x.id === b.id));
  const u = unitsFor(d.settings.currency), all = Math.round(total * u), each = Math.floor(all / n);
  return (i === n - 1 ? all - each * (n - 1) : each) / u;
}

/** Changing the monthly income: the salary paydays follow it. */
export function withIncome(d: Data, incomeStr: string): Pick<Data, 'incomeStr' | 'bills'> {
  const next = { ...d, incomeStr, monthIncome: undefined };
  return { incomeStr, bills: d.bills.map(b => (b.salary ? { ...b, amt: salaryShare(next, b, '') } : b)) };
}

/**
 * Older data had the typed income and a separate "Salary" scheduled income. Once, the salary items (named Salary,
 * or the only automatic income whose amount is the typed income) become the salary, and take the typed amount.
 */
export function migrateSalary(d: Data): Data {
  if (d.bills.some(isSalary)) return d;
  const auto = d.bills.filter(b => b.kind === 'Income' && b.auto && b.acct && !b.notMine && b.currency !== 'USD');
  const named = auto.filter(b => /^(salary|salario|sueldo)(\s*·\s*\d)?$/i.test(b.name.trim()));
  const typed = num(d.incomeStr);
  const pick = named.length ? named : auto.length === 1 && typed > 0 && Math.abs(auto[0].amt - typed) <= typed * 0.01 ? auto : [];
  if (!pick.length) return d;
  const ids = new Set(pick.map(b => b.id));
  const marked = { ...d, bills: d.bills.map(b => (ids.has(b.id) ? { ...b, salary: true } : b)) };
  // No typed income yet: the salary items say what it is.
  const incomeStr = typed > 0 ? d.incomeStr : String(pick.reduce((a, b) => a + b.amt, 0));
  return { ...marked, ...withIncome(marked, incomeStr) };
}

/**
 * This month came in different: save what arrived and how each pocket changes this month (signed, from `from` on),
 * and fix a salary that already arrived this month so the account shows what really came in.
 * `amt` undefined goes back to the normal income for the month.
 */
export function setMonthIncome(d: Data, month: string, amt: number | undefined, adj: Record<string, number> = {}, from = month + '-01'): Partial<Data> {
  const rest = { ...(d.monthIncome ?? {}) };
  if (amt === undefined) delete rest[month];
  else rest[month] = { amt, from, adj: Object.fromEntries(Object.entries(adj).filter(([, v]) => v !== 0)) };
  const after = { ...d, monthIncome: rest };
  const fix = new Map<string, number>();
  for (const b of salaryBills(d)) {
    const paid = d.incomes.find(t => t.ruleId === b.id && t.ruleMonth === month);
    if (paid) fix.set(paid.id, salaryShare(after, b, month) - paid.amt);
  }
  if (![...fix.values()].some(v => v !== 0)) return { monthIncome: rest };
  const byAcct = new Map<string, number>();
  const incomes = d.incomes.map(t => { const dv = fix.get(t.id); if (!dv) return t; byAcct.set(t.a, (byAcct.get(t.a) ?? 0) + dv); return { ...t, amt: t.amt + dv }; });
  const accounts = d.accounts.map(a => (byAcct.has(a.id) ? { ...a, bal: a.type === 'card' ? a.bal - byAcct.get(a.id)! : a.bal + byAcct.get(a.id)! } : a));
  return { monthIncome: rest, incomes, accounts };
}
