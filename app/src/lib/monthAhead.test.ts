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

// November 2026: Mondays 2, 9, 16, 23, 30 (5 weeks). Today Tue Nov 24, week Nov 23-29; Nov 30 is still November's.
describe('monthAhead: this period plus the periods still to start this month', () => {
  const c = ctxAt('2026-11-24');
  it('nothing spent: budget and left are this week + next week; saved = the 3 finished weeks', () => {
    const d = world(three());
    expect(monthAhead(d, 'alm', c)).toEqual({ budget: 64000, spent: 0, left: 64000, saved: 96000 });
    expect(monthAhead(d, 'wag', c)).toEqual({ budget: 50000, spent: 0, left: 50000, saved: 75000 });
    expect(monthAhead(d, 'sal', c)).toEqual({ budget: 130000, spent: 0, left: 130000, saved: 195000 });
  });
  it('spending: this week counts as spent, a finished week over budget lowers saved', () => {
    // Almuerzo: Nov 24 spent 10.000 (this week left 22.000); Nov 10 spent 40.000 (week Nov 9: 32.000 - 40.000 = -8.000)
    const d = world(three(), [exp('a', 'alm', 10000, '2026-11-24'), exp('b', 'alm', 40000, '2026-11-10')]);
    expect(monthAhead(d, 'alm', c)).toEqual({ budget: 64000, spent: 10000, left: 22000 + 32000, saved: 32000 - 8000 + 32000 });
    // The Oct 26 week belongs to October: spending in it changes nothing here.
    const oct = world(three(), [exp('o', 'alm', 90000, '2026-11-01')]);
    expect(monthAhead(oct, 'alm', c).saved).toBe(96000);
  });
  it('carry on: finished weeks already rolled into this week, so saved is 0 and nothing counts twice', () => {
    const d = world(three({ carry: '2026-11-02' }), [exp('a', 'alm', 10000, '2026-11-24'), exp('b', 'alm', 40000, '2026-11-10')]);
    // carry into Nov 23 = 32.000 - 8.000 + 32.000 = 56.000. This week: 88.000 - 10.000 = 78.000 left; next week adds its own 32.000.
    const m = monthAhead(d, 'alm', c);
    expect(m).toEqual({ budget: 88000 + 32000, spent: 10000, left: 78000 + 32000, saved: 0 });
    // Same number the whole-month view gives: 5 x 32.000 - everything spent (50.000)
    expect(m.left).toBe(monthStats(d, 'alm', c).left);
  });
  it('first week of the next month (Tue Dec 1, week Nov 30 is November): December has 4 weeks ahead and no saved', () => {
    const d = world(three(), [exp('a', 'alm', 5000, '2026-12-01')]);
    const m = monthAhead(d, 'alm', ctxAt('2026-12-01'));
    // this week (Nov 30, November's week) 27.000 + Dec 7, 14, 21, 28 at 32.000
    expect(m).toEqual({ budget: 32000 * 5, spent: 5000, left: 27000 + 128000, saved: 0 });
  });
  it('last day of the month: nothing ahead, saved are the finished weeks of the month', () => {
    // Mon Nov 30: this is the last November week.
    const m = monthAhead(world(three()), 'alm', ctxAt('2026-11-30'));
    expect(m).toEqual({ budget: 32000, spent: 0, left: 32000, saved: 4 * 32000 });
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
    expect(monthAhead(d, 'n', c)).toEqual({ budget: 64000, spent: 0, left: 64000, saved: 20000 });
  });
  it('a pocket that does not exist is all zeros', () => {
    expect(monthAhead(world([]), 'x', c)).toEqual({ budget: 0, spent: 0, left: 0, saved: 0 });
  });
});
