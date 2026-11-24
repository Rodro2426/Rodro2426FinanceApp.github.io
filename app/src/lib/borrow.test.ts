import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { emptyData, sampleData } from './seed';
import { ctxAt } from './dates';
import { monthStats, pocketStats } from './derive';
import { addExtraIncome, borrowNext, pocketToSpend } from './plan';
import { editMove, moveMax, undoMove } from './derive';

const exp = (id: string, amt: number, date: string) => ({ id, ts: 1, p: 'food', a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function base(pocket: Partial<Data['pockets'][number]> = {}): Data {
  const e = emptyData(sampleData());
  return { ...e, settings: { ...e.settings, currency: 'COP' }, incomeStr: '400000',
    pockets: [{ id: 'food', name: 'Food', weeklyStr: '50000', hue: 60, ...pocket }],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 300000, hue: 85 }], expenses: [], incomes: [], moves: [], bills: [] };
}
const apply = (d: Data, p: Partial<Data> | null) => ({ ...d, ...(p ?? {}) });

describe('cover from next week', () => {
  it('this week back to 0, next week starts with that much less, the month stays the same', () => {
    const d = { ...base(), expenses: [exp('a', 60000, '2026-11-18')] };
    const c = ctxAt('2026-11-18');
    const before = monthStats(d, 'food', c).budget;
    const b = apply(d, borrowNext(d, c, 'food', 99999));
    expect(b.moves).toHaveLength(1);
    expect(b.moves[0].amt).toBe(10000); // never more than the overspend
    expect(pocketStats(b, 'food', c)!.left).toBe(0);
    expect(pocketStats(b, 'food', ctxAt('2026-11-25'))!.budget).toBe(40000);
    expect(pocketStats(b, 'food', ctxAt('2026-12-02'))!.budget).toBe(50000);
    expect(monthStats(b, 'food', c).budget).toBe(before);
  });
  it('inside the month: week Nov 23 borrows from Nov 30 (a November week), December is untouched', () => {
    const d = { ...base(), expenses: [exp('a', 70000, '2026-11-24')] };
    const c = ctxAt('2026-11-24');
    const b = apply(d, borrowNext(d, c, 'food', 20000));
    expect(monthStats(b, 'food', c).budget - monthStats(d, 'food', c).budget).toBe(0);
    const dec = ctxAt('2026-12-10');
    expect(monthStats(b, 'food', dec).budget - monthStats(d, 'food', dec).budget).toBe(0);
  });
  it('across the month: the month it was made gets it, the next month gives it back (week Dec 28 -> Jan 4)', () => {
    const d = { ...base(), expenses: [exp('a', 70000, '2026-12-29')] };
    const c = ctxAt('2026-12-29');
    const b = apply(d, borrowNext(d, c, 'food', 20000));
    expect(monthStats(b, 'food', c).budget - monthStats(d, 'food', c).budget).toBe(20000);
    const jan = ctxAt('2027-01-12');
    expect(monthStats(b, 'food', jan).budget - monthStats(d, 'food', jan).budget).toBe(-20000);
  });
  it('15-day pockets borrow from the next quincena', () => {
    const d = { ...base({ period: 'half', weeklyStr: '100000' }), expenses: [exp('a', 130000, '2026-11-10')] };
    const c = ctxAt('2026-11-10');
    const b = apply(d, borrowNext(d, c, 'food', 30000));
    expect(pocketStats(b, 'food', c)!.left).toBe(0);
    expect(pocketStats(b, 'food', ctxAt('2026-11-20'))!.budget).toBe(70000);
  });
  it('nothing to cover gives null', () => {
    expect(borrowNext(base(), ctxAt('2026-11-18'), 'food', 5000)).toBeNull();
  });
  it('15-day pocket, 16th to the end: the month it was made gets it, the next month gives it back', () => {
    // Nov 20 is in the quincena 16-30; the next one starts Dec 1.
    const d = { ...base({ period: 'half', weeklyStr: '100000' }), expenses: [exp('a', 130000, '2026-11-20')] };
    const c = ctxAt('2026-11-20');
    const b = apply(d, borrowNext(d, c, 'food', 30000));
    expect(monthStats(b, 'food', c).budget - monthStats(d, 'food', c).budget).toBe(30000);
    const dec = ctxAt('2026-12-03');
    expect(monthStats(b, 'food', dec).budget - monthStats(d, 'food', dec).budget).toBe(-30000);
    expect(pocketStats(b, 'food', dec)!.budget).toBe(70000);
    expect(pocketStats(b, 'food', ctxAt('2026-12-20'))!.budget).toBe(100000);
  });
  it('15-day pocket, 1st to 15th: both halves stay inside the month', () => {
    const d = { ...base({ period: 'half', weeklyStr: '100000' }), expenses: [exp('a', 130000, '2026-11-10')] };
    const c = ctxAt('2026-11-10');
    const b = apply(d, borrowNext(d, c, 'food', 30000));
    expect(monthStats(b, 'food', c).budget).toBe(monthStats(d, 'food', c).budget); // +30000 -30000 in the same month
  });
  it('carry over: the running balance does not double count or lose it', () => {
    const d = { ...base({ carry: '2026-11-16' }), expenses: [exp('a', 60000, '2026-11-18')] };
    const c = ctxAt('2026-11-18');
    const b = apply(d, borrowNext(d, c, 'food', 10000));
    expect(pocketStats(b, 'food', c)!.left).toBe(0);
    const n = pocketStats(b, 'food', ctxAt('2026-11-25'))!;
    expect(n.carry).toBe(0);
    expect(n.budget).toBe(40000);
    // a week later the borrow is gone: week budget 50000 + carry of 40000 left over
    expect(pocketStats(b, 'food', ctxAt('2026-12-02'))!.carry).toBe(40000);
  });
  it('to spend this month is lower by what was borrowed, in the next week', () => {
    const d = { ...base(), expenses: [exp('a', 60000, '2026-11-11')] };
    const c = ctxAt('2026-11-11');
    const b = apply(d, borrowNext(d, c, 'food', 10000));
    const n = ctxAt('2026-11-18');
    // Weeks Nov 16 (40000 after paying back) + Nov 23 + Nov 30 (50000 each, both November weeks) = 140000; without borrowing the overspend is just forgiven (150000).
    expect(pocketToSpend(d, 'food', n)).toBe(150000);
    expect(pocketToSpend(b, 'food', n)).toBe(140000);
  });
  it('edit and undo: lower or undo only, undo brings everything back', () => {
    const d = { ...base(), expenses: [exp('a', 60000, '2026-11-18')] };
    const c = ctxAt('2026-11-18');
    const b = apply(d, borrowNext(d, c, 'food', 10000));
    expect(moveMax(b, b.moves[0], c)).toBe(10000);
    const e = apply(b, editMove(b, b.moves[0].id, 4000));
    expect(pocketStats(e, 'food', c)!.left).toBe(-6000);
    expect(pocketStats(e, 'food', ctxAt('2026-11-25'))!.budget).toBe(46000);
    const u = apply(b, undoMove(b, b.moves[0].id));
    expect(pocketStats(u, 'food', ctxAt('2026-11-25'))!.budget).toBe(50000);
  });
  it('income dated in a past week lands in that week, in a future month it lands there', () => {
    const d = base();
    const x = { amt: 100000, toPockets: 100000, dist: 'manual' as const, manual: { food: 100000 }, mode: 'week' as const, acct: 'bank', note: 'x', cat: 'Other' };
    const past = apply(d, addExtraIncome(d, ctxAt('2026-11-04'), x as never));
    expect(pocketStats(past, 'food', ctxAt('2026-11-04'))!.budget).toBe(150000);
    expect(pocketStats(past, 'food', ctxAt('2026-11-24'))!.budget).toBe(50000);
    const fut = apply(d, addExtraIncome(d, ctxAt('2026-12-10'), { ...x, mode: 'month' } as never));
    expect(pocketStats(fut, 'food', ctxAt('2026-11-24'))!.budget).toBe(50000);
    expect(monthStats(fut, 'food', ctxAt('2026-12-10')).extra).toBe(100000);
  });
});
