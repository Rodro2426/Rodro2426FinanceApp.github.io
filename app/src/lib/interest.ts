// Daily compound interest for accounts with an annual return (% E.A.), like Nu's Cajitas.
import type { Account, Data, Income } from './types';
import { daysBetween, monthKey, todayISO } from './dates';

/** Daily rate equivalent to an effective annual rate: (1 + EA)^(1/365) − 1. */
export const dailyRate = (ea: number) => Math.pow(1 + ea / 100, 1 / 365) - 1;
export const monthlyRate = (ea: number) => Math.pow(1 + ea / 100, 1 / 12) - 1;
export const earnsInterest = (a: Account) => a.type !== 'card' && (a.rate ?? 0) > 0;
/** What the balance earns in one day at its current size. */
export const perDay = (a: Account) => (earnsInterest(a) && a.bal > 0 ? a.bal * dailyRate(a.rate!) : 0);

/** Adds interest for every full day since the last run. Idempotent within a day. */
export function runInterest(d: Data, today = todayISO()): Partial<Data> | null {
  let incomes = d.incomes, changed = false;
  const accounts = d.accounts.map(a => {
    if (!earnsInterest(a)) return a;
    if (!a.accruedTo) { changed = true; return { ...a, accruedTo: today }; }
    const days = daysBetween(a.accruedTo, today);
    if (days <= 0) return a;
    changed = true;
    const gain = a.bal > 0 ? a.bal * (Math.pow(1 + dailyRate(a.rate!), days) - 1) : 0;
    if (gain > 0) {
      // One "Interest" entry per account per month, growing each day.
      const id = `int:${a.id}:${monthKey(today)}`;
      const ex = incomes.find(t => t.id === id);
      const entry: Income = ex ? { ...ex, amt: ex.amt + gain, date: today } : { id, ts: Date.now(), a: a.id, amt: gain, note: 'Interest', date: today, interest: true };
      incomes = [entry, ...incomes.filter(t => t.id !== id)];
    }
    return { ...a, bal: a.bal + gain, earned: (a.earned || 0) + gain, accruedTo: today };
  });
  return changed ? { accounts, incomes } : null;
}
