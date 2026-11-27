import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { ctxAt, makeCtx, weeksIn } from './dates';
import { emptyData, sampleData } from './seed';
import { monthPlanOf, monthStats, pocketStats, weeksLeft } from './derive';
import { addExtraIncome } from './plan';

const base = (): Data => ({
  ...emptyData(sampleData()),
  settings: { ...emptyData(sampleData()).settings, currency: 'COP' },
  pockets: [{ id: 'wk', name: 'Lunch', weeklyStr: '100000', hue: 60, carry: '2024-04-01' }],
  accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 0, hue: 85 }],
  expenses: [], incomes: [], moves: [], goals: []
});

describe('weeks counted from the calendar', () => {
  it('counts the week pieces of a month: weeks are cut where the month ends', () => {
    expect(weeksIn('2024-04')).toBe(5); // starts on a Monday; 1, 8, 15, 22 and the 2-day Apr 29–30
    expect(weeksIn('2024-05')).toBe(5); // May 1–5, 6–12, 13–19, 20–26, 27–31
    expect(weeksIn('2026-11')).toBe(6); // Nov 1 (Sun), 2–8, 9–15, 16–22, 23–29, Nov 30 (Mon)
    expect(weeksIn('2026-03')).toBe(6); // starts on a Sunday: 1, 2–8, 9–15, 16–22, 23–29, 30–31
    expect(weeksIn('2026-02')).toBe(5); // starts on a Sunday: 1, 2–8, 9–15, 16–22, 23–28
    expect(weeksIn('2016-02')).toBe(5); // leap, starts Monday: 1–7, 8–14, 15–21, 22–28, 29
    expect(weeksIn('2027-02')).toBe(4); // starts Monday, 28 days: exactly 4 whole weeks
  });
  it('week number never passes the weeks; the 1-day last week has 1 left', () => {
    const c = ctxAt('2026-11-30'); // Monday: the 6th and last piece of November
    expect([c.weekNo, c.weeks, weeksLeft(c)]).toEqual([6, 6, 1]);
    const a = ctxAt('2026-11-01'); // Sunday: a 1-day week 1 (the rest of the week of Oct 26 is October's)
    expect([a.weekNo, weeksLeft(a)]).toEqual([1, 6]);
    expect([a.weekStart, a.weekEnd]).toEqual(['2026-11-01', '2026-11-01']);
  });
  it('weekly carry does not depend on the weeks of the month', () => {
    // Nothing spent since Apr 1 2024: carry into the week of May 6 = Apr 1, 8, 15, 22 (400000) + Apr 29–30 (28571) + May 1–5 (71429) = 500000.
    const d = base();
    const s = pocketStats(d, 'wk', ctxAt('2024-05-08'))!, old = pocketStats(d, 'wk', makeCtx(4, '2024-05-08'))!;
    expect(s.budget).toBe(old.budget);
    expect(s.budget).toBe(600000); // 100000 this week + 500000 carried
  });
  it('plan follows the days of the month: same weekly, 30 vs 31 days', () => {
    const p = base().pockets[0];
    expect(monthPlanOf(p, ctxAt('2026-11-10'))).toBe(428572); // 14.286 + 4 × 100.000 + 14.286 (30/7 weeks)
    expect(monthPlanOf(p, ctxAt('2026-12-10'))).toBe(442857); // 85.714 + 3 × 100.000 + 57.143 (31/7 weeks)
  });
  it('income split over the month adds up (5 week pieces left in November)', () => {
    const d = base(), c = ctxAt('2026-11-04'); // week 2 of 6, started Nov 2
    const up = addExtraIncome(d, c, { amt: 500000, acct: 'bank', note: 'x', toPockets: 500000, mode: 'month', dist: 'even' });
    expect(up.moves![0].spread).toBe(5);
    const after = { ...d, ...up } as Data;
    expect(monthStats(after, 'wk', c).extra).toBe(500000);
  });
});

describe('month view after a month that starts on a Monday', () => {
  it('May 2024: the Apr 29–30 piece is April\'s and May 1–5 is May\'s, so plan and carry agree', () => {
    // April's pieces (4 × 100000 + 28571) unspent = 428571 carried into May 1; May plan 71429 + 3 × 100000 + 71429 = 442858; May budget = 871429.
    expect(weeksIn('2024-04') + weeksIn('2024-05')).toBe(10);
    expect(monthStats(base(), 'wk', ctxAt('2024-05-10')).budget).toBe(871429);
  });
});
