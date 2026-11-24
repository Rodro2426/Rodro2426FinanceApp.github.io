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
  it('counts the weeks whose Monday is in the month', () => {
    expect(weeksIn('2024-04')).toBe(5); // starts on a Monday; Mondays 1,8,15,22,29 (the Apr 29 week ends May 5)
    expect(weeksIn('2024-05')).toBe(4); // 6,13,20,27
    expect(weeksIn('2026-11')).toBe(5); // 2,9,16,23,30
    expect(weeksIn('2026-03')).toBe(5); // starts on a Sunday: 2,9,16,23,30
    expect(weeksIn('2026-02')).toBe(4); // starts on a Sunday: 2,9,16,23
    expect(weeksIn('2016-02')).toBe(5); // leap, starts Monday: 1,8,15,22,29
  });
  it('week number never passes the weeks; last week has 1 left', () => {
    const c = ctxAt('2026-11-30'); // Monday of week 5
    expect([c.weekNo, c.weeks, weeksLeft(c)]).toEqual([5, 5, 1]);
    const a = ctxAt('2026-11-01'); // Sunday of the week that started in October: week 1
    expect([a.weekNo, weeksLeft(a)]).toEqual([1, 5]);
  });
  it('weekly carry does not depend on the weeks of the month', () => {
    // Nothing spent since Apr 1 2024: carry into the week of May 6 = 5 weeks (Apr 1..29) x 100000.
    const d = base();
    const s = pocketStats(d, 'wk', ctxAt('2024-05-08'))!, old = pocketStats(d, 'wk', makeCtx(4, '2024-05-08'))!;
    expect(s.budget).toBe(old.budget);
    expect(s.budget).toBe(600000); // 100000 this week + 500000 carried
  });
  it('plan follows the month: same weekly, 5 vs 4 weeks', () => {
    const p = base().pockets[0];
    expect(monthPlanOf(p, ctxAt('2026-11-10'))).toBe(500000);
    expect(monthPlanOf(p, ctxAt('2026-12-10'))).toBe(400000);
  });
  it('income split over the month adds up in a 5-week month', () => {
    const d = base(), c = ctxAt('2026-11-04'); // week 1 of 5, started Nov 2
    const up = addExtraIncome(d, c, { amt: 500000, acct: 'bank', note: 'x', toPockets: 500000, mode: 'month', dist: 'even' });
    expect(up.moves![0].spread).toBe(5);
    const after = { ...d, ...up } as Data;
    expect(monthStats(after, 'wk', c).extra).toBe(500000);
  });
});

describe('month view after a month that starts on a Monday', () => {
  it('May 2024: the Apr 29 week belongs to April (its Monday), so plan and carry agree', () => {
    // April's 5 weeks (Apr 1..29) unspent = 500000 carried into May 6; May plan 4 weeks = 400000; May budget = 900000.
    expect(weeksIn('2024-04') + weeksIn('2024-05')).toBe(9);
    expect(monthStats(base(), 'wk', ctxAt('2024-05-10')).budget).toBe(900000);
  });
});
