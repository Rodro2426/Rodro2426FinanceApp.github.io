// Daily compound interest for accounts with an annual return (% E.A.), like Nu's Cajitas.
import type { Account, Data, Income } from './types';
import { addDays, daysBetween, monthKey, todayISO } from './dates';
import { codeOf } from './currency';
import { isCOP } from './derive';

/** Daily rate equivalent to an effective annual rate: (1 + EA)^(1/365) − 1. */
export const dailyRate = (ea: number) => Math.pow(1 + ea / 100, 1 / 365) - 1;
export const monthlyRate = (ea: number) => Math.pow(1 + ea / 100, 1 / 12) - 1;
export const earnsInterest = (a: Account) => a.type !== 'card' && (a.rate ?? 0) > 0;

/** Colombian tax value unit (UVT) by year, set each year by the DIAN.
 *  shortcut: later years reuse the last known value; add each new year's UVT here. */
const UVT: Record<number, number> = { 2024: 47065, 2025: 49799, 2026: 52374 };
const uvtOf = (year: number) => UVT[year] ?? (year < 2024 ? UVT[2024] : UVT[2026]);
/** Retención en la fuente: banks keep 7% of a day's interest when that day's interest is over 0,055 UVT (about $2.880 in 2026). */
export const WITHHOLD_RATE = 0.07;
export const withholdFrom = (day: string) => 0.055 * uvtOf(Number(day.slice(0, 4)));

/** What a balance earns in one day, after withholding when the money is in COP. */
export function dayGain(bal: number, ea: number, day: string, cop: boolean) {
  if (!(bal > 0) || !(ea > 0)) return 0;
  const gross = bal * dailyRate(ea);
  return cop && gross > withholdFrom(day) ? gross * (1 - WITHHOLD_RATE) : gross;
}
/** What the balance earns in one day at its current size. */
export const perDay = (a: Account, cop = isCOP()) => (earnsInterest(a) ? dayGain(a.bal, a.rate!, todayISO(), cop) : 0);

/** Adds interest for every full day since the last run. Idempotent within a day. */
export function runInterest(d: Data, today = todayISO()): Partial<Data> | null {
  let incomes = d.incomes, changed = false;
  const cop = codeOf(d.settings?.currency) === 'COP';
  const accounts = d.accounts.map(a => {
    if (!earnsInterest(a)) return a;
    if (!a.accruedTo) { changed = true; return { ...a, accruedTo: today }; }
    const days = daysBetween(a.accruedTo, today);
    if (days <= 0) return a;
    changed = true;
    // Day by day, because withholding depends on each day's interest.
    let bal = a.bal;
    for (let i = 1; i <= days; i++) bal += dayGain(bal, a.rate!, addDays(a.accruedTo, i), cop);
    const gain = bal - a.bal;
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
