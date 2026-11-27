import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { ctxAt, makeCtx, weeksIn } from './dates';
import { emptyData, sampleData } from './seed';
import { dayStats, halfOf, monthPlanOf, monthStats, pocketStats, weekShare } from './derive';
import { addExtraIncome, monthSummary, transferLeftover } from './plan';

const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function data(): Data {
  const e = emptyData(sampleData());
  return {
    ...e,
    settings: { ...e.settings, currency: 'COP', weeks: 4 },
    incomeStr: '2000000',
    pockets: [
      { id: 'wk', name: 'Lunch', weeklyStr: '100000', hue: 60 },
      { id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half' }
    ],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 2000000, hue: 85 }],
    expenses: [exp('a', 'q', 50000, '2026-11-02'), exp('b', 'q', 20000, '2026-11-12'), exp('c', 'q', 99000, '2026-11-16'), exp('d', 'wk', 30000, '2026-11-12')],
    incomes: [], moves: [], goals: []
  };
}

describe('pockets that start over every 15 days', () => {
  it('finds the quincena of a day', () => {
    expect(halfOf('2026-11-01')).toEqual(['2026-11-01', '2026-11-15']);
    expect(halfOf('2026-11-15')).toEqual(['2026-11-01', '2026-11-15']);
    expect(halfOf('2026-11-16')).toEqual(['2026-11-16', '2026-11-30']);
    expect(halfOf('2026-02-20')).toEqual(['2026-02-16', '2026-02-28']);
  });

  it('counts spending from the 1st to the 15th, not the week', () => {
    const c = makeCtx(4, '2026-11-12'); // Thursday; its week is Nov 9–15
    const q = pocketStats(data(), 'q', c)!, wk = pocketStats(data(), 'wk', c)!;
    expect(q.period).toBe('half');
    expect([q.from, q.to]).toEqual(['2026-11-01', '2026-11-15']);
    expect(q.spent).toBe(70000); // Nov 2 + Nov 12, not Nov 16
    expect(q.left).toBe(230000);
    expect([wk.from, wk.to]).toEqual(['2026-11-09', '2026-11-15']);
    expect(wk.spent).toBe(30000);
    const c2 = makeCtx(4, '2026-11-20');
    expect(pocketStats(data(), 'q', c2)!.spent).toBe(99000);
  });

  it('plans 2 periods a month, and the month plan adds up', () => {
    const c = makeCtx(4, '2026-11-12'), d = data();
    expect(monthPlanOf(d.pockets[1], c)).toBe(600000);
    expect(monthStats(d, 'q', c).budget).toBe(600000);
    // Nov 2026 has 30 days = 4 whole weeks + the Sunday Nov 1 and the Monday Nov 30 (1-day weeks): 100.000 × 30/7 = 14.286 + 400.000 + 14.286.
    expect(monthSummary(d, c).plan).toBe(428572 + 600000);
  });

  it('shares the quincena between its days', () => {
    const c = makeCtx(4, '2026-11-12');
    const ds = dayStats(data(), 'q', c);
    expect(ds.week.length).toBe(15);
    // Left this morning: 300.000 − 50.000 = 250.000, shared by Nov 12–15 (4 days).
    expect(ds.allowance).toBe(62500);
  });

  it('a move made this quincena counts there, whatever the week', () => {
    const c = makeCtx(4, '2026-11-12'), d = data();
    const after = { ...d, ...transferLeftover(d, c, 'wk', { q: 40000 })! };
    expect(pocketStats(after, 'q', c)!.budget).toBe(340000);
    expect(pocketStats(after, 'wk', c)!.budget).toBe(60000);
    // Next quincena it's gone again.
    expect(pocketStats(after, 'q', makeCtx(4, '2026-11-16'))!.budget).toBe(300000);
  });

  it('income split "this week" lands in the current quincena even when the week ends in the next one', () => {
    const c = makeCtx(4, '2026-11-14'), d = data(); // week Nov 9–15 … Saturday the 14th
    const after = { ...d, ...addExtraIncome(d, c, { amt: 100000, acct: 'bank', note: 'x', toPockets: 100000, mode: 'week', dist: 'manual', manual: { q: 100000 } }) };
    expect(pocketStats(after, 'q', c)!.budget).toBe(400000);
    expect(pocketStats(after, 'q', makeCtx(4, '2026-11-16'))!.budget).toBe(300000);
  });

  it('a pocket created mid-period starts with what is left, then gets its full budget', () => {
    const d = data();
    d.pockets.push({ id: 'n', name: 'New', weeklyStr: '140000', hue: 10, start: { from: '2026-11-09', amt: 80000 } });
    const c = makeCtx(4, '2026-11-12');
    expect(pocketStats(d, 'n', c)!.budget).toBe(80000);
    expect(pocketStats(d, 'n', makeCtx(4, '2026-11-16'))!.budget).toBe(140000);
    // 140.000 × 30/7 = 600.000 for November, minus the 60.000 the first week did not get.
    expect(monthPlanOf(d.pockets[2], c)).toBe(600000 - 60000);
    expect(monthPlanOf(d.pockets[2], makeCtx(4, '2026-12-03'))).toBe(620000); // 140.000 × 31/7
  });
});

describe('weekShare: a pocket\'s part of the current week', () => {
  it('weekly pocket equals its stats', () => {
    const c = makeCtx(4, '2026-11-12'), d = data(), s = pocketStats(d, 'wk', c)!;
    expect(weekShare(d, 'wk', c)).toEqual({ budget: s.budget, spent: s.spent, left: s.left });
  });
  it('15-day pocket mid-quincena counts only this week\'s active days', () => {
    const c = makeCtx(4, '2026-11-04'), d = data(); // Wed; week Nov 2–8, quincena Nov 1–15 (15 days)
    d.expenses = [exp('x', 'q', 30000, '2026-11-03')];
    const w = weekShare(d, 'q', c);
    // Left 270.000 over Nov 4–15 (12 days) = 22.500 a day; Nov 4–8 is 5 days.
    expect(w.left).toBeCloseTo(112500, 5);
    expect(w.spent).toBe(30000);
    expect(w.budget).toBeCloseTo(142500, 5);
  });
  it('week straddling the quincena end counts only the days up to the 15th', () => {
    const c = makeCtx(4, '2026-10-14'), d = data(); // Wed; week Oct 12–18, quincena ends Thu 15
    d.expenses = [exp('x', 'q', 10000, '2026-10-13'), exp('y', 'q', 5000, '2026-10-05')];
    const w = weekShare(d, 'q', c), s = pocketStats(d, 'q', c)!;
    const ds = dayStats(d, 'q', c, s);
    expect(w.left).toBeCloseTo(ds.left + ds.futureShare, 5); // Wed + Thu only
    expect(w.left).toBeCloseTo(285000 * 2 / 2, 5); // 300.000 − 15.000 left, shared by Wed and Thu = all of it
    expect(w.spent).toBe(10000);
    expect(w.budget).toBeCloseTo(w.spent + w.left, 5);
  });
  it('today overspent on a 15-day pocket does not pull the left below 0 before the last day', () => {
    // Fri Nov 14, the second-to-last day of the quincena and the week (both end Sun Nov 15). Quincena 300.000.
    const c = makeCtx(4, '2026-11-14'), d = data();
    d.expenses = [exp('p', 'q', 200000, '2026-11-09'), exp('t', 'q', 80000, '2026-11-14')];
    const w = weekShare(d, 'q', c);
    // Before today: 100.000 left. Today spends 80.000, so 20.000 is left for Sun Nov 15.
    expect(w.left).toBe(20000);
    expect(w.spent).toBe(280000);
  });
  it('an overspent quincena shows the full negative left', () => {
    const c = makeCtx(4, '2026-11-12'), d = data();
    d.expenses = [exp('z', 'q', 400000, '2026-11-03')];
    expect(weekShare(d, 'q', c).left).toBe(-100000);
  });
});

describe('weeks in a month come from the calendar', () => {
  it('cuts weeks where the month ends: every week piece belongs to one month', () => {
    expect(weeksIn('2026-11')).toBe(6); // Nov 1 (Sun), 2–8, 9–15, 16–22, 23–29, Nov 30 (Mon)
    expect(weeksIn('2026-12')).toBe(5); // Dec 1–6, 7–13, 14–20, 21–27, 28–31
    expect(weeksIn('2026-08')).toBe(6); // Aug 1–2, 3–9, 10–16, 17–23, 24–30, Aug 31
    expect(weeksIn('2027-02')).toBe(4); // Feb 2027 starts on a Monday and has 28 days: exactly 4 whole weeks
  });
  it('gives the 1-day last week of November its own number', () => {
    expect(ctxAt('2026-11-30').weekNo).toBe(6);
    expect(ctxAt('2026-11-30').weeks).toBe(6);
    expect([ctxAt('2026-11-30').weekStart, ctxAt('2026-11-30').weekEnd]).toEqual(['2026-11-30', '2026-11-30']);
    expect([ctxAt('2026-11-01').weekStart, ctxAt('2026-11-01').weekEnd, ctxAt('2026-11-01').weekNo]).toEqual(['2026-11-01', '2026-11-01', 1]);
    expect(ctxAt('2026-12-01').weekNo).toBe(1); // Dec 1 is a Tuesday, still week 1
  });
});

describe('weekly pocket entered per month, created mid-month', () => {
  // Nov 2026 has 6 week pieces (Nov 1, 2–8, 9–15, 16–22, 23–29, Nov 30). Created Wed Nov 18 with 1.000.000 a month (200.000 a week),
  // and 300.000 left for November: shared over the weeks of Nov 16, Nov 23 and the Monday Nov 30 (2 + 1/7 weeks): 140.000 a week,
  // so 140.000 + 140.000 + 20.000 (a 1-day week) = 300.000.
  const mk = (): Data => ({
    ...emptyData(sampleData()), settings: { ...emptyData(sampleData()).settings, currency: 'COP' },
    pockets: [{ id: 'm', name: 'Market', weeklyStr: '200000', hue: 150, perMonth: true, start: { from: '2026-11-16', amt: 140000, until: '2026-11-30' } }],
    expenses: [], incomes: [], moves: [], goals: []
  });
  it('this month plans only what was left', () => {
    expect(monthPlanOf(mk().pockets[0], ctxAt('2026-11-18'))).toBe(300000);
    expect(monthStats(mk(), 'm', ctxAt('2026-11-18')).budget).toBe(300000);
  });
  it('each remaining week gets its share, and weeks before it existed get nothing', () => {
    expect(pocketStats(mk(), 'm', ctxAt('2026-11-18'))!.budget).toBe(140000);
    expect(pocketStats(mk(), 'm', ctxAt('2026-11-27'))!.budget).toBe(140000);
    expect(pocketStats(mk(), 'm', ctxAt('2026-11-30'))!.budget).toBe(20000); // the 1-day week: 1/7 of 140.000
    expect(pocketStats(mk(), 'm', ctxAt('2026-11-10'))!.budget).toBe(0);
  });
  it('next month starts from scratch with the full amount', () => {
    // Mon Nov 30 got 1/7 of the week (28.571), so Tue Dec 1 – Sun Dec 6 gets the rest: 200.000 − 28.571.
    expect(pocketStats(mk(), 'm', ctxAt('2026-12-02'))!.budget).toBe(171429);
    // December: 171.429 + 3 whole weeks (600.000) + Dec 28–31, 4/7 of a week (114.286).
    expect(monthPlanOf(mk().pockets[0], ctxAt('2026-12-10'))).toBe(885715);
  });
});

describe('mid-month weekly start: risks', () => {
  const mk = (start: NonNullable<Data['pockets'][number]['start']>, extra: Partial<Data['pockets'][number]> = {}): Data => ({
    ...emptyData(sampleData()), settings: { ...emptyData(sampleData()).settings, currency: 'COP' },
    pockets: [{ id: 'm', name: 'Market', weeklyStr: '200000', hue: 150, perMonth: true, start, ...extra }],
    expenses: [], incomes: [], moves: [], goals: []
  });
  it('carry turned on at creation: weeks of the start run add up (150.000 each, spent 100.000 in week 1)', () => {
    const d = mk({ from: '2026-11-16', amt: 150000, until: '2026-11-23' }, { carry: '2026-11-16' });
    d.expenses = [exp('s', 'm', 100000, '2026-11-17')];
    expect(pocketStats(d, 'm', ctxAt('2026-11-24'))!.carry).toBe(50000);
    expect(pocketStats(d, 'm', ctxAt('2026-11-24'))!.budget).toBe(200000);
    // The Nov 30 piece carries what was left from before: 50.000 + 150.000.
    expect(pocketStats(d, 'm', ctxAt('2026-11-30'))!.carry).toBe(200000);
  });
  it('rounding: the plan shows the rounded shares, not the amount typed', () => {
    // 100.000 left over Nov 9 – Nov 30 (3 weeks + a 1-day week = 22/7 weeks): 31.818 a week; 31.818 x 3 + 4.545 = 99.999 (1 peso lost)
    const d = mk({ from: '2026-11-09', amt: 31818, until: '2026-11-30' });
    expect(monthPlanOf(d.pockets[0], ctxAt('2026-11-18'))).toBe(99999);
  });
  it('created on the Monday of the last (1-day) week: that week only gets its day', () => {
    const d = mk({ from: '2026-11-30', amt: 70000, until: '2026-11-30' });
    // 70.000 a week, but the week is only Monday Nov 30: 1/7.
    expect(monthPlanOf(d.pockets[0], ctxAt('2026-11-30'))).toBe(10000);
    expect(pocketStats(d, 'm', ctxAt('2026-11-30'))!.budget).toBe(10000);
  });
  it('a week that crosses into the next month is cut: Jun 29–30 is June, Jul 1–5 is July', () => {
    // July 2026: Jul 1–5, 6–12, 13–19, 20–26, Jul 27–31 (5 days). Created Wed Jul 1 with 40.000 for its first week piece.
    const d = mk({ from: '2026-07-01', amt: 40000 });
    expect(monthPlanOf(d.pockets[0], ctxAt('2026-07-01'))).toBe(40000 + 600000 + 142857); // last piece: 200.000 × 5/7
    expect(pocketStats(d, 'm', ctxAt('2026-07-01'))!.budget).toBe(40000);
    expect(pocketStats(d, 'm', ctxAt('2026-07-08'))!.budget).toBe(200000);
  });
  it('June is not touched by a pocket created on Jul 1; Jun 29–30 is its own 2-day week', () => {
    const d = mk({ from: '2026-07-01', amt: 40000 });
    // June 2026: Jun 1, 8, 15, 22 whole weeks (800.000) + Jun 29–30, 2/7 of 200.000 = 57.143.
    expect(monthPlanOf(d.pockets[0], ctxAt('2026-06-15'))).toBe(800000 + 57143);
    expect(pocketStats(d, 'm', ctxAt('2026-06-30'))!.budget).toBe(57143);
  });
});
