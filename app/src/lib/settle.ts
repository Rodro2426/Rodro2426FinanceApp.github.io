// Shared trips: who owes what, and the fewest payments that make everyone even. Pure functions (no Firebase).
import { largestRemainder } from './split';

/** A person in a trip: a friend with an account (their uid) or a guest added by name (id starts with "g:"). */
export interface Member { id: string; name: string }
export type SplitMode = 'equal' | 'amounts' | 'percent';
/** An expense someone paid, or a payment between two people ("settle up"). Amounts are whole pesos (or cents ×100 elsewhere). */
export interface TripItem {
  id: string; kind: 'expense' | 'payment'; desc: string; amount: number; date: string; createdBy: string; createdAt: number;
  /** Expense: who paid. Payment: who paid it back. */
  paidBy: string;
  /** Payment: who received it. */
  to?: string;
  /** Expense: how it's split. `among` are the people sharing it; `values` are amounts or percents per person (equal ignores them). */
  split?: { mode: SplitMode; among: string[]; values?: Record<string, number> };
  cat?: string;
}

/** Each person's share of one expense, in whole units that add up exactly to the amount. */
export function sharesOf(it: TripItem, scale = 1): Record<string, number> {
  if (it.kind !== 'expense' || !it.split) return {};
  const { mode, among, values = {} } = it.split;
  const people = among.filter(Boolean);
  if (!people.length) return {};
  if (mode === 'amounts') return Object.fromEntries(people.map(p => [p, values[p] ?? 0]));
  const weights = people.map(p => (mode === 'percent' ? Math.max(0, values[p] ?? 0) : 1));
  const parts = largestRemainder(it.amount, weights, scale);
  return Object.fromEntries(people.map((p, i) => [p, parts[i]]));
}

/** Whether a split adds up: amounts must total the expense, percents must total 100. */
export function splitProblem(amount: number, mode: SplitMode, among: string[], values: Record<string, number>): string | null {
  if (!among.length) return 'Pick at least one person to split with.';
  if (mode === 'amounts') { const t = among.reduce((a, p) => a + (values[p] ?? 0), 0); return Math.abs(t - amount) > 0.004 ? `The amounts add up to ${t.toLocaleString('es-CO')}, not ${amount.toLocaleString('es-CO')}.` : null; }
  if (mode === 'percent') { const t = among.reduce((a, p) => a + (values[p] ?? 0), 0); return Math.abs(t - 100) > 0.001 ? `The percentages add up to ${t.toLocaleString('es-CO')}%, not 100%.` : null; }
  return null;
}

/**
 * Balance per person: positive = the group owes them, negative = they owe the group.
 * Paying an expense adds to your balance, your share takes from it; paying someone back moves money between the two.
 * The balances always add up to zero.
 */
export function balances(members: Member[], items: TripItem[], scale = 1): Record<string, number> {
  const b: Record<string, number> = Object.fromEntries(members.map(m => [m.id, 0]));
  const add = (id: string, v: number) => { b[id] = (b[id] ?? 0) + v; };
  items.forEach(it => {
    if (it.kind === 'payment') { add(it.paidBy, it.amount); if (it.to) add(it.to, -it.amount); return; }
    add(it.paidBy, it.amount);
    Object.entries(sharesOf(it, scale)).forEach(([p, s]) => add(p, -s));
  });
  Object.keys(b).forEach(k => { b[k] = Math.round(b[k] * scale) / scale; });
  return b;
}

/** The fewest payments that make everyone even: the biggest debtor pays the biggest creditor, and so on. */
export function settleUp(bal: Record<string, number>, scale = 1): { from: string; to: string; amount: number }[] {
  const units = (v: number) => Math.round(v * scale);
  const debt = Object.entries(bal).filter(([, v]) => units(v) < 0).map(([id, v]) => ({ id, v: -units(v) })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
  const cred = Object.entries(bal).filter(([, v]) => units(v) > 0).map(([id, v]) => ({ id, v: units(v) })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const x = Math.min(debt[i].v, cred[j].v);
    if (x > 0) out.push({ from: debt[i].id, to: cred[j].id, amount: x / scale });
    debt[i].v -= x; cred[j].v -= x;
    if (!debt[i].v) i++;
    if (!cred[j].v) j++;
  }
  return out;
}

/** What one person spent in the trip (their shares), and what they paid out of pocket. */
export function personTotals(id: string, items: TripItem[], scale = 1) {
  let share = 0, paid = 0;
  items.forEach(it => { if (it.kind !== 'expense') return; if (it.paidBy === id) paid += it.amount; share += sharesOf(it, scale)[id] ?? 0; });
  return { share, paid };
}

/** Months (YYYY-MM) that have expenses, oldest first. */
export const tripMonths = (items: TripItem[]) => [...new Set(items.filter(i => i.kind === 'expense').map(i => i.date.slice(0, 7)))].sort();

/** Spending in a trip for a period ('all' or 'YYYY-MM'): total, your share and everyone's share. Payments don't count as spending. */
export function tripSpending(members: Member[], items: TripItem[], me: string, period: string, scale = 1) {
  const exp = items.filter(i => i.kind === 'expense' && (period === 'all' || i.date.slice(0, 7) === period));
  const total = exp.reduce((a, i) => a + i.amount, 0);
  const people = members.map(m => {
    let share = 0, paid = 0;
    exp.forEach(i => { share += sharesOf(i, scale)[m.id] ?? 0; if (i.paidBy === m.id) paid += i.amount; });
    return { id: m.id, name: m.name, share, paid };
  });
  const mine = people.find(p => p.id === me)?.share ?? 0;
  return { total, mine, pct: total ? mine / total : 0, people: people.sort((a, b) => b.share - a.share), count: exp.length };
}

/**
 * Expenses split equally among everyone who was in the trip ("the whole group") — the ones that would naturally
 * include people who join later. Splits by amount or percent, or among only some people, are left alone.
 */
export const groupWideItems = (items: TripItem[], people: string[]) =>
  items.filter(it => it.kind === 'expense' && it.split?.mode === 'equal' && people.every(p => it.split!.among.includes(p)));

/** The same expense split equally with more people too. */
export const withMorePeople = (it: TripItem, add: string[]): TripItem =>
  it.split ? { ...it, split: { ...it.split, among: [...it.split.among, ...add.filter(p => !it.split!.among.includes(p))] } } : it;

/** A guest who now has an account: every mention of the guest id becomes their account id. */
export function relinkPerson(it: TripItem, from: string, to: string): TripItem {
  const sw = (x: string) => (x === from ? to : x);
  const out: TripItem = { ...it, paidBy: sw(it.paidBy), createdBy: sw(it.createdBy) };
  if (it.to) out.to = sw(it.to);
  if (it.split) {
    const values = it.split.values ? Object.fromEntries(Object.entries(it.split.values).map(([k, v]) => [sw(k), v])) : undefined;
    out.split = { ...it.split, among: it.split.among.map(sw), ...(values ? { values } : {}) };
  }
  return out;
}
