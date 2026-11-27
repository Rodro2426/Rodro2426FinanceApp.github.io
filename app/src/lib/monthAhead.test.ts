import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data, Pocket } from './types';
import { ctxAt } from './dates';
import { emptyData, sampleData } from './seed';
import { monthAhead, monthStats } from './derive';

const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
const P = (id: string, w: number, extra: Partial<Pocket> = {}): Pocket => ({ id, name: id, weeklyStr: String(w), hue: 60, ...extra });
function world(pockets: Pocket[], expenses: ReturnType<typeof exp>[] = []): Data {
  const e = emptyData(sampleData());
  return { ...e, settings: { ...e.settings, currency: 'COP' }, pockets, expenses, incomes: [], moves: [], goals: [], bills: [],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 1_000_000, hue: 85 }] };
}
const three = (extra: Partial<Pocket> = {}) => [P('alm', 32000, extra), P('wag', 25000, extra), P('sal', 65000, extra)];

// November 2026: 6 week pieces: Nov 1 (Sun), 2–8, 9–15, 16–22, 23–29, Nov 30 (Mon). Today Tue Nov 24, week Nov 23-29; Nov 30 is November's last, 1-day week.
// A 1-day week gets 1/7 of the weekly amount (rounded; Almuerzo 32.000 -> 4.571), and the Sunday Nov 1 piece gets the rest of the week of Oct 26: 32.000 - 27.429 = 4.571.
describe('monthAhead: this period plus the periods still to start this month', () => {
  const c = ctxAt('2026-11-24');
  it('nothing spent: budget and left are this week + next week (Nov 30); saved = the 3 finished whole weeks + Nov 1', () => {
    const d = world(three());
    expect(monthAhead(d, 'alm', c)).toEqual({ budget: 36571, spent: 0, left: 36571, saved: 96000 + 4571 });
    expect(monthAhead(d, 'wag', c)).toEqual({ budget: 28571, spent: 0, left: 28571, saved: 75000 + 3571 });
    expect(monthAhead(d, 'sal', c)).toEqual({ budget: 74286, spent: 0, left: 74286, saved: 195000 + 9286 });
  });
  it('spending: this week counts as spent, a finished week over budget lowers saved', () => {
    // Almuerzo: Nov 24 spent 10.000 (this week left 22.000); Nov 10 spent 40.000 (week Nov 9: 32.000 - 40.000 = -8.000)
    const d = world(three(), [exp('a', 'alm', 10000, '2026-11-24'), exp('b', 'alm', 40000, '2026-11-10')]);
    expect(monthAhead(d, 'alm', c)).toEqual({ budget: 36571, spent: 10000, left: 22000 + 4571, saved: 32000 - 8000 + 32000 + 4571 });
    // Oct 31 belongs to the October piece of the week Oct 26: spending then changes nothing here.
    const oct = world(three(), [exp('o', 'alm', 90000, '2026-10-31')]);
    expect(monthAhead(oct, 'alm', c).saved).toBe(100571);
    // Sunday Nov 1 is November's own 1-day week: spending then lowers saved.
    const nov1 = world(three(), [exp('o', 'alm', 90000, '2026-11-01')]);
    expect(monthAhead(nov1, 'alm', c).saved).toBe(100571 - 90000);
  });
  it('carry on: finished weeks already rolled into this week, so saved is 0 and nothing counts twice', () => {
    const d = world(three({ carry: '2026-11-01' }), [exp('a', 'alm', 10000, '2026-11-24'), exp('b', 'alm', 40000, '2026-11-10')]);
    // carry into Nov 23 = 4.571 + 32.000 - 8.000 + 32.000 = 60.571. This week: 92.571 - 10.000 = 82.571 left; next week (Nov 30) adds its own 4.571.
    const m = monthAhead(d, 'alm', c);
    expect(m).toEqual({ budget: 92571 + 4571, spent: 10000, left: 82571 + 4571, saved: 0 });
    // Same number the whole-month view gives: the month's plan (137.142) - everything spent (50.000)
    expect(m.left).toBe(monthStats(d, 'alm', c).left);
  });
  it('first week of the next month (Tue Dec 1 is week 1 of December, Dec 1–6): December has 4 more weeks ahead and no saved', () => {
    const d = world(three(), [exp('a', 'alm', 5000, '2026-12-01')]);
    const m = monthAhead(d, 'alm', ctxAt('2026-12-01'));
    // this week (Dec 1–6) 32.000 − 4.571 (Mon Nov 30 took that) = 27.429, + Dec 7, 14, 21 at 32.000 + Dec 28–31 (4/7 of 32.000 = 18.286)
    expect(m).toEqual({ budget: 27429 + 96000 + 18286, spent: 5000, left: 27429 + 96000 + 18286 - 5000, saved: 0 });
  });
  it('last day of the month: nothing ahead, saved are the finished weeks of the month', () => {
    // Mon Nov 30: the 1-day last week of November (4.571), nothing ahead; saved = 4 whole weeks + the Nov 1 piece.
    const m = monthAhead(world(three()), 'alm', ctxAt('2026-11-30'));
    expect(m).toEqual({ budget: 4571, spent: 0, left: 4571, saved: 4 * 32000 + 4571 });
  });
  it('15-day pocket: second quincena has nothing ahead, saved is the first quincena', () => {
    const d = world([P('q', 300000, { period: 'half' })], [exp('a', 'q', 100000, '2026-11-05'), exp('b', 'q', 50000, '2026-11-20')]);
    expect(monthAhead(d, 'q', ctxAt('2026-11-20'))).toEqual({ budget: 300000, spent: 50000, left: 250000, saved: 200000 });
    // first quincena: the second one is still ahead, nothing finished
    expect(monthAhead(d, 'q', ctxAt('2026-11-10'))).toEqual({ budget: 600000, spent: 100000, left: 450000, saved: 0 });
  });
  it('pocket created mid-period: weeks before it existed do not count as saved', () => {
    // Created in the week of Nov 16 with 20.000 for that first week.
    const d = world([P('n', 32000, { start: { from: '2026-11-16', amt: 20000 } })]);
    expect(monthAhead(d, 'n', c)).toEqual({ budget: 36571, spent: 0, left: 36571, saved: 20000 });
  });
  it('a pocket that does not exist is all zeros', () => {
    expect(monthAhead(world([]), 'x', c)).toEqual({ budget: 0, spent: 0, left: 0, saved: 0 });
  });
});
