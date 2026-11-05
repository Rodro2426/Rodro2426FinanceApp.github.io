// The month's money in one place: income, plan, the two gaps, extra income splits and fixing mismatches.
import type { Data, Income, Move } from './types';
import { monthKey, type Ctx } from './dates';
import { incomeMoves, monthStats, moveMonth, num, pocketStats, uid, weeksLeft } from './derive';
import { largestRemainder, unitsFor } from './split';

const scale = (d: Data) => unitsFor(d.settings.currency);
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
/** Rounds to whole units of the currency (pesos, or cents). */
const whole = (d: Data, n: number) => Math.round(n * scale(d)) / scale(d);

/** Income you register yourself (not a scheduled salary, account interest or CDT interest). */
export const isExtraIncome = (t: Income) => !t.ruleId && !t.interest && !t.id.startsWith('cdt:');
/** Extra income this month that adds to the typed monthly income. */
export const extraIncomes = (d: Data, c: Ctx) => d.incomes.filter(t => isExtraIncome(t) && !t.inBase && monthKey(t.date) === c.month);
/** Pocket moves that came from income ("New income") and count for this month. */
export const incomeSplits = (d: Data, c: Ctx) => d.moves.filter(m => m.from === '_income' && moveMonth(m) === c.month);

export interface MonthSummary {
  /** The typed monthly income. */ base: number;
  /** Extra income registered this month. */ extra: number;
  /** base + extra: all the money for the month. */ income: number;
  /** Weekly budgets × weeks + extra income split into pockets. */ plan: number;
  /** income − plan: positive is free money, negative is planned beyond your income. */ planGap: number;
  /** What's still left to spend in all pockets this month. */ toSpend: number;
  /** Debit, savings and cash accounts minus what you owe on cards. */ balance: number;
  /** toSpend − balance: how much more your pockets promise than you actually have. > 0 is a real shortfall. */ real: number;
}

export function monthSummary(d: Data, c: Ctx): MonthSummary {
  const base = num(d.incomeStr);
  const extra = sum(extraIncomes(d, c).map(t => t.amt));
  const plan = sum(d.pockets.map(p => num(p.weeklyStr) * c.weeks)) + sum(incomeSplits(d, c).map(m => m.amt));
  const toSpend = sum(d.pockets.map(p => Math.max(0, monthStats(d, p.id, c).left)));
  const balance = sum(d.accounts.map(a => (a.type === 'card' ? -a.bal : a.bal)));
  const income = base + extra;
  return { base, extra, income, plan, planGap: income - plan, toSpend, balance, real: toSpend - balance };
}

/* ---------------- Registering extra income ---------------- */
export type SplitMode = 'week' | 'month';
export type SplitDist = 'budget' | 'even' | 'manual';

/** How `A` is shared between pockets: whole units that add up to exactly `A`. */
export function splitAmong(d: Data, A: number, dist: SplitDist, manual: Record<string, number> = {}): Record<string, number> {
  const ps = d.pockets;
  if (dist === 'manual') return Object.fromEntries(ps.map(p => [p.id, whole(d, manual[p.id] || 0)]));
  const parts = largestRemainder(A, ps.map(p => (dist === 'budget' ? num(p.weeklyStr) : 1)), scale(d));
  return Object.fromEntries(ps.map((p, i) => [p.id, parts[i]]));
}

/** Saving all of it first, up to the real shortfall; the rest goes to pockets. Returns what goes to pockets. */
export function coverFirst(d: Data, c: Ctx, X: number) {
  const keep = Math.min(X, Math.max(0, monthSummary(d, c).real));
  return whole(d, X - keep);
}

export interface ExtraIncome { amt: number; acct: string; note: string; toPockets: number; mode: SplitMode; dist: SplitDist; manual?: Record<string, number>; id?: string; ts?: number; cat?: string }

/**
 * Registers income X: the account goes up by X, and A of it is split into pockets for this week or the
 * rest of the month. The split is always tagged with this month, so it counts in this month's plan once.
 */
export function addExtraIncome(d: Data, c: Ctx, x: ExtraIncome): Partial<Data> {
  const X = whole(d, x.amt), A = Math.min(X, Math.max(0, whole(d, x.toPockets)));
  const id = x.id ?? uid('in');
  const parts = A > 0 ? splitAmong(d, A, x.dist, x.manual) : {};
  const spread = x.mode === 'month' ? weeksLeft(c) : 1;
  const moves: Move[] = Object.entries(parts).filter(([, v]) => v > 0)
    .map(([to, amt]) => ({ id: uid('m'), week: c.weekStart, from: '_income', to, amt, income: id, month: c.month, spread }));
  return {
    incomes: [{ id, ts: x.ts ?? Date.now(), a: x.acct, amt: X, note: x.note.trim() || x.cat || 'Income', date: c.today, ...(x.cat ? { cat: x.cat } : {}) }, ...d.incomes],
    accounts: d.accounts.map(y => (y.id === x.acct ? { ...y, bal: y.type === 'card' ? y.bal - X : y.bal + X } : y)),
    moves: [...d.moves, ...moves]
  };
}

/** Changing an income's amount: the account follows, and its pocket split shrinks to fit if it's now bigger than the income. */
export function editIncomeAmount(d: Data, incId: string, amt: number, acct?: string, extra: Partial<Income> = {}): Partial<Data> {
  const inc = d.incomes.find(t => t.id === incId);
  if (!inc) return {};
  const val = whole(d, amt), to = acct ?? inc.a;
  const linked = incomeMoves(d.moves, inc), split = sum(linked.map(m => m.amt));
  let moves = d.moves;
  if (split > val && linked.length) {
    const parts = largestRemainder(val, linked.map(m => m.amt), scale(d));
    const by = new Map(linked.map((m, i) => [m.id, parts[i]]));
    moves = d.moves.map(m => (by.has(m.id) ? { ...m, amt: by.get(m.id)!, income: inc.id } : m)).filter(m => m.amt > 0);
  }
  const credit = (accts: Data['accounts'], id: string, n: number) => accts.map(a => (a.id === id ? { ...a, bal: a.type === 'card' ? a.bal - n : a.bal + n } : a));
  return {
    accounts: credit(credit(d.accounts, inc.a, -inc.amt), to, val),
    incomes: d.incomes.map(t => (t.id === inc.id ? { ...t, ...extra, amt: val, a: to, orig: val === t.amt ? t.orig : undefined } : t)),
    moves
  };
}

/** Deleting an income takes its money out of the account and its split out of the pockets. */
export function deleteIncome(d: Data, incId: string): Partial<Data> {
  const inc = d.incomes.find(t => t.id === incId);
  if (!inc) return {};
  const ids = new Set(incomeMoves(d.moves, inc).map(m => m.id));
  return {
    accounts: d.accounts.map(a => (a.id === inc.a ? { ...a, bal: a.type === 'card' ? a.bal + inc.amt : a.bal - inc.amt } : a)),
    incomes: d.incomes.filter(t => t.id !== inc.id),
    moves: d.moves.filter(m => !ids.has(m.id))
  };
}

/* ---------------- Mismatches ---------------- */
export const backingIncome = (d: Data, m: Move) => d.incomes.find(t => incomeMoves([m], t).length > 0);
export interface Mismatches {
  /** "New income" moves with no income behind them (e.g. the income was deleted before splits were linked). */
  orphan: Move[];
  /** Splits of income that's already counted in the typed monthly income. */
  included: Move[];
}
export function findMismatches(d: Data, c: Ctx): Mismatches {
  const orphan: Move[] = [], included: Move[] = [];
  incomeSplits(d, c).forEach(m => { const t = backingIncome(d, m); if (!t) orphan.push(m); else if (t.inBase) included.push(m); });
  return { orphan, included };
}
export const undoMoves = (d: Data, ids: string[]): Partial<Data> => { const s = new Set(ids); return { moves: d.moves.filter(m => !s.has(m.id)) }; };

/**
 * The typed monthly income already includes these extra incomes: stop adding them on top, and take their
 * pocket splits back out, except for the incomes listed in `keepSplits`.
 */
export function markIncluded(d: Data, incomeIds: string[], keepSplits: string[] = []): Partial<Data> {
  const ids = new Set(incomeIds), keep = new Set(keepSplits);
  const drop = new Set(d.incomes.filter(t => ids.has(t.id) && !keep.has(t.id)).flatMap(t => incomeMoves(d.moves, t).map(m => m.id)));
  return { incomes: d.incomes.map(t => (ids.has(t.id) ? { ...t, inBase: true } : t)), moves: d.moves.filter(m => !drop.has(m.id)) };
}
export const markNotIncluded = (d: Data, incomeId: string): Partial<Data> => ({ incomes: d.incomes.map(t => (t.id === incomeId ? { ...t, inBase: undefined } : t)) });

/* ---------------- Moving a pocket's leftover ---------------- */
/**
 * Moves money left in pocket `from` this week to other pockets and goals, `parts` per destination.
 * Pocket to pocket is only a transfer for this week: it never touches the month income or the month plan,
 * and the total of all pockets stays the same. Money sent to a goal leaves the pockets and is saved there.
 * Returns null if the parts are invalid (negative, unknown destination, or more than the pocket has left).
 */
export function transferLeftover(d: Data, c: Ctx, from: string, parts: Record<string, number>): Partial<Data> | null {
  const src = pocketStats(d, from, c);
  if (!src) return null;
  const entries = Object.entries(parts).map(([to, v]) => [to, whole(d, v)] as const).filter(([, v]) => v > 0);
  const known = (id: string) => id !== from && (d.pockets.some(p => p.id === id) || d.goals.some(g => g.id === id));
  const total = sum(entries.map(([, v]) => v));
  if (!entries.length || entries.some(([to, v]) => !known(to) || v < 0) || total > Math.max(0, src.left) + 1e-9) return null;
  const moves: Move[] = entries.map(([to, amt]) => ({ id: uid('m'), week: c.weekStart, from, to, amt }));
  const toGoal = new Map(entries.filter(([to]) => d.goals.some(g => g.id === to)));
  return {
    moves: [...d.moves, ...moves],
    goals: toGoal.size ? d.goals.map(g => (toGoal.has(g.id) ? { ...g, saved: g.saved + toGoal.get(g.id)! } : g)) : d.goals
  };
}
