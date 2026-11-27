import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data, Move } from './types';
import { makeCtx } from './dates';
import { emptyData, sampleData } from './seed';
import { dayStats, monthOf, monthPlanOf, monthStats, moveInPeriod, periodAt, periodsInMonth, pocketCtx, pocketStats, spanOf, weekShare } from './derive';
import { budgetWeeks } from './reports';

const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
const mv = (o: Partial<Move>): Move => ({ id: 'mv', week: '2026-11-02', day: '2026-11-02', from: 'wk', to: 'm', amt: 0, ...o } as Move);
// Nov 2026: the 1st is a Sunday, the 30th a Monday. Monthly pocket "m" has 300,000 for the whole month.
function data(over: Partial<Data['pockets'][number]> = {}, moves: Move[] = []): Data {
  const e = emptyData(sampleData());
  return {
    ...e,
    settings: { ...e.settings, currency: 'COP', weeks: 4 },
    incomeStr: '2000000',
    pockets: [
      { id: 'wk', name: 'Lunch', weeklyStr: '100000', hue: 60 },
      { id: 'm', name: 'Rent-ish', weeklyStr: '300000', hue: 150, period: 'month', ...over }
    ],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 2000000, hue: 85 }],
    expenses: [exp('o', 'm', 40000, '2026-10-30'), exp('a', 'm', 50000, '2026-11-02'), exp('b', 'm', 20000, '2026-11-12')],
    incomes: [], moves, goals: []
  };
}
const c12 = makeCtx(4, '2026-11-12'); // Thursday; its week is Nov 9-15

describe('monthly pockets: periods', () => {
  it('monthOf / spanOf cover the whole calendar month, February included', () => {
    expect(monthOf('2026-11-12')).toEqual(['2026-11-01', '2026-11-30']);
    expect(monthOf('2026-02-10')).toEqual(['2026-02-01', '2026-02-28']);
    expect(monthOf('2028-02-29')).toEqual(['2028-02-01', '2028-02-29']);
    expect(spanOf({ period: 'month' }, '2026-12-31')).toEqual(['2026-12-01', '2026-12-31']);
    expect(spanOf({ period: 'half' }, '2026-11-20')).toEqual(['2026-11-16', '2026-11-30']);
  });
  it('1 period a month; weekly and quincena unchanged', () => {
    expect(periodsInMonth({ period: 'month' }, '2026-11')).toBe(1);
    expect(periodsInMonth({ period: 'half' }, '2026-11')).toBe(2);
    expect(periodsInMonth({}, '2026-11')).toBeCloseTo(30 / 7);
    expect(periodAt({ period: 'month' }, '2026-11-12')).toEqual(['2026-11-01', '2026-11-30']);
    expect(periodAt({}, '2026-11-12')).toEqual(['2026-11-09', '2026-11-15']);
    const pc = pocketCtx({ period: 'month' }, c12);
    expect([pc.weekStart, pc.weekEnd, pc.daysLeft]).toEqual(['2026-11-01', '2026-11-30', 18]);
  });
});

describe('monthly pockets: stats', () => {
  it('pocketStats: budget is weeklyStr for the month, spent counts only this month', () => {
    const s = pocketStats(data(), 'm', c12)!;
    expect(s.period).toBe('month');
    expect([s.from, s.to]).toEqual(['2026-11-01', '2026-11-30']);
    expect(s.budget).toBe(300000);
    expect(s.spent).toBe(70000); // Nov 2 + Nov 12, not Oct 30
    expect(s.left).toBe(230000);
    expect(monthPlanOf(data().pockets[1], c12)).toBe(300000);
    expect(monthStats(data(), 'm', c12).budget).toBe(300000);
    expect(pocketStats(data(), 'wk', c12)!.period).toBe('week');
  });

  it('dayStats: today = left this morning / spending days left in the month (incl. today)', () => {
    // Left this morning = 300000 - 50000 = 250000; Nov 12 + Nov 13..30 (18) = 19 days.
    const ds = dayStats(data(), 'm', c12);
    expect(ds.week.length).toBe(30);
    expect(ds.allowance).toBeCloseTo(250000 / 19, 4);
    expect(ds.spentToday).toBe(20000);
    expect(ds.left).toBeCloseTo(250000 / 19 - 20000, 4);
    // Spending days only Mon-Fri: Nov 12 (Thu) + Nov 13, 16-20, 23-27, 30 = 1 + 1 + 5 + 5 + 1 = 13
    const wd = dayStats(data({ days: [0, 1, 2, 3, 4] }), 'm', c12);
    expect(wd.allowance).toBeCloseTo(250000 / 13, 4);
  });

  it('weekShare: only the days left this week (Nov 13-15) of the month money count', () => {
    // Overspent today => today's part is 0; the rest 230000 is shared over 18 days; 3 of them are this week.
    const w = weekShare(data(), 'm', c12);
    expect(w.left).toBeCloseTo((230000 / 18) * 3, 4);
    expect(w.spent).toBe(20000); // Nov 9..12 only
    expect(w.budget).toBeCloseTo(w.spent + w.left, 6);
  });

  it('weekShare on the last day of the month stops at the month end (Mon Nov 30)', () => {
    const c = makeCtx(4, '2026-11-30');
    const w = weekShare(data(), 'm', c);
    expect(w.left).toBe(230000); // 300000 - 70000, all of it is today's
    expect(w.spent).toBe(0);
  });

  it('a pocket created mid-month: start only applies to that month', () => {
    const d = data({ start: { from: '2026-11-01', amt: 100000 } });
    expect(pocketStats(d, 'm', c12)!.budget).toBe(100000);
    expect(monthPlanOf(d.pockets[1], c12)).toBe(100000); // 300000 - (300000 - 100000)
    expect(monthStats(d, 'm', c12).budget).toBe(100000);
    const dec = makeCtx(4, '2026-12-03');
    expect(pocketStats(d, 'm', dec)!.budget).toBe(300000);
    expect(monthPlanOf(d.pockets[1], dec)).toBe(300000);
  });
});

describe('monthly pockets: carry and "next" moves', () => {
  it('carry runs across months (and across a year end)', () => {
    const d = data({ carry: '2026-10-01' });
    // Oct: 300000 - 40000 = 260000 carries into November.
    expect(pocketStats(d, 'm', c12)!.carry).toBe(260000);
    expect(pocketStats(d, 'm', c12)!.budget).toBe(560000);
    expect(monthStats(d, 'm', c12).budget).toBe(560000);
    // Nov adds 300000 - 70000 = 230000 more.
    expect(pocketStats(d, 'm', makeCtx(4, '2026-12-03'))!.carry).toBe(490000);
    expect(monthStats(d, 'm', makeCtx(4, '2026-12-03')).budget).toBe(300000 + 490000);
  });

  it('send-to-next-month: leaves in the month it was made, arrives the 1st, never counted twice', () => {
    // Made Wed Oct 28 (its week's Sunday is Nov 1, so moveMonth says November).
    const next = mv({ id: 'n', week: '2026-10-26', day: '2026-10-28', from: 'm', to: 'm', amt: 10000, next: true });
    const d = data({}, [next]);
    const oct = makeCtx(4, '2026-10-28');
    expect(pocketStats(d, 'm', oct)!.budget).toBe(290000);
    expect(monthStats(d, 'm', oct).budget).toBe(290000);
    expect(pocketStats(d, 'm', c12)!.budget).toBe(310000);
    expect(monthStats(d, 'm', c12).budget).toBe(310000);
    expect(monthStats(d, 'm', makeCtx(4, '2026-12-03')).budget).toBe(300000); // not again in December
    expect(moveInPeriod(next, d.pockets[1], oct)).toBe(true);
    expect(moveInPeriod(next, d.pockets[1], c12)).toBe(false);
  });
});

describe('monthly pockets: income split and moves', () => {
  it('a month split spread over 2 weeks lands fully in the monthly pocket, once', () => {
    // 90000 from income, split Nov 16 over the 2 weeks left: 45000 on Nov 16, 45000 on Sunday Nov 29.
    const split = mv({ id: 's', week: '2026-11-16', day: '2026-11-16', from: '_income', to: 'm', amt: 90000, month: '2026-11', spread: 2, income: 'i1' });
    const d = data({}, [split]);
    const c = makeCtx(4, '2026-11-20');
    expect(pocketStats(d, 'm', c)!.mIn).toBe(90000);
    expect(pocketStats(d, 'm', c)!.budget).toBe(390000);
    expect(monthStats(d, 'm', c).budget).toBe(390000);
    expect(monthStats(d, 'm', c).extra).toBe(90000);
  });

  it('a pocket-to-pocket move inside the month counts for the month, and not in the next one', () => {
    const d = data({}, [mv({ from: 'wk', to: 'm', amt: 5000, day: '2026-11-05' })]);
    expect(pocketStats(d, 'm', c12)!.budget).toBe(305000);
    expect(pocketStats(d, 'm', makeCtx(4, '2026-12-03'))!.budget).toBe(300000);
  });
});

describe('monthly pockets: reports', () => {
  it('budgetWeeks gives a week its days / days-in-month share (30 days in November)', () => {
    const r = budgetWeeks(data(), c12, 2, 'm');
    // Week Nov 2-8: 300000 x 7/30 = 70000; spent 50000 on Nov 2.
    expect(r[0].budget).toBeCloseTo(70000, 6);
    expect(r[0].spent).toBe(50000);
    // This week = the Home number.
    const w = weekShare(data(), 'm', c12);
    expect(r[1].budget).toBeCloseTo(w.budget, 6);
    expect(r[1].spent).toBe(w.spent);
  });
});
