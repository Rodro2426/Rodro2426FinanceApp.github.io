import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Data, Pocket } from './types';
import { addDays, ctxAt, weekPart, weekParts } from './dates';
import { emptyData, sampleData } from './seed';
import { monthPlanOf, monthStats, moveMonth, pocketStats, roundAmt, weekBase } from './derive';
import { NEXT, addExtraIncome, borrowNext, monthSummary, transferLeftover } from './plan';
import { getData, setData } from './store';
import { budgetWeeks } from './reports';

// A week is Mon–Sun but CUT where a month ends, so every week belongs to exactly one month.
// November 2026: Sun Nov 1 is a 1-day week 1 (the rest of the week of Oct 26 is October's), Mon Nov 30 is a 1-day week 6;
// Tue Dec 1 – Sun Dec 6 is December's week 1. The Monday piece gets round(weekly × its spending days ÷ the week's), the other piece gets the rest.

const setCurrency = (c: string) => setData(x => ({ settings: { ...x.settings, currency: c as never } }));
const before = getData().settings.currency;
beforeAll(() => setCurrency('COP'));
afterAll(() => setCurrency(before));

const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function world(pockets: Pocket[], expenses: ReturnType<typeof exp>[] = [], cur = 'COP'): Data {
  const e = emptyData(sampleData());
  return { ...e, settings: { ...e.settings, currency: cur as never }, pockets, expenses, incomes: [], moves: [], goals: [], bills: [],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 1_000_000, hue: 85 }] };
}
const W = (weekly: string, extra: Partial<Pocket> = {}): Pocket => ({ id: 'w', name: 'Lunch', weeklyStr: weekly, hue: 60, ...extra });
const budget = (d: Data, day: string) => pocketStats(d, 'w', ctxAt(day))!.budget;

describe('week pieces: where the months are cut', () => {
  it('November 2026 has 6 pieces, with Nov 1 and Nov 30 as 1-day weeks', () => {
    expect(weekParts('2026-11')).toEqual([
      ['2026-11-01', '2026-11-01'], ['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15'],
      ['2026-11-16', '2026-11-22'], ['2026-11-23', '2026-11-29'], ['2026-11-30', '2026-11-30']
    ]);
    const c = ctxAt('2026-11-30');
    expect([c.weekNo, c.weeks, c.weekStart, c.weekEnd, c.daysLeft]).toEqual([6, 6, '2026-11-30', '2026-11-30', 0]);
    expect(ctxAt('2026-11-01').weekNo).toBe(1);
  });
  it('the week of Nov 30 is cut: Mon Nov 30 is November, Tue Dec 1 – Sun Dec 6 is December week 1', () => {
    expect(weekPart('2026-11-30')).toEqual(['2026-11-30', '2026-11-30']);
    expect(weekPart('2026-12-04')).toEqual(['2026-12-01', '2026-12-06']);
    const dec = ctxAt('2026-12-04');
    expect([dec.weekNo, dec.weeks, dec.month]).toEqual([1, 5, '2026-12']);
    expect([dec.lastWeekStart, dec.lastWeekEnd]).toEqual(['2026-11-30', '2026-11-30']);
  });
  it('every day of a month is in exactly one piece, and a 28-day February that starts on a Monday has exactly 4', () => {
    for (const m of ['2026-11', '2026-12', '2027-02', '2028-02']) {
      const days = weekParts(m).flatMap(([a, b]) => { const out: string[] = []; for (let x = a; x <= b; x = addDays(x, 1)) out.push(x); return out; });
      expect(days.length).toBe(new Set(days).size);
      expect(days.every(x => x.slice(0, 7) === m)).toBe(true);
      expect(days.length).toBe(m === '2027-02' ? 28 : m === '2028-02' ? 29 : m === '2026-11' ? 30 : 31);
    }
    expect(weekParts('2027-02').length).toBe(4);
  });
});

describe('the two pieces of a cut week add up to exactly the weekly amount', () => {
  it('pesos: Mon Nov 30 + Tue Dec 1–Sun Dec 6, and Sun Nov 1 + the rest of the week of Oct 26', () => {
    for (const amt of ['100000', '65000', '33333', '12345', '1', '999999']) {
      const d = world([W(amt)]);
      const mon = budget(d, '2026-11-30'), rest = budget(d, '2026-12-03');
      expect(mon).toBe(Math.round(Number(amt) / 7));
      expect(mon + rest).toBe(Number(amt));
      expect(weekBase(d.pockets[0], '2026-10-26') + weekBase(d.pockets[0], '2026-11-01')).toBe(Number(amt));
      expect(Number.isInteger(mon) && Number.isInteger(rest)).toBe(true);
    }
    // Hand-worked: 100.000 / 7 = 14.285,7 -> 14.286 for the Monday; 85.714 for Dec 1–6.
    expect(budget(world([W('100000')]), '2026-11-30')).toBe(14286);
    expect(budget(world([W('100000')]), '2026-12-02')).toBe(85714);
  });
  it('euros (cents): the pieces add up to the cent', () => {
    setCurrency('€');
    try {
      for (const amt of ['10.10', '33.33', '0.05', '123.45']) {
        const d = world([W(amt)], [], '€');
        const mon = budget(d, '2026-11-30'), rest = budget(d, '2026-12-01');
        expect(roundAmt(mon + rest)).toBe(Number(amt));
        expect(roundAmt(mon)).toBe(mon); // whole cents
        expect(roundAmt(rest)).toBe(rest);
      }
      // 10.10 / 7 = 1.4428... -> 1.44; the rest 8.66.
      expect(budget(world([W('10.10')], [], '€'), '2026-11-30')).toBe(1.44);
      expect(budget(world([W('10.10')], [], '€'), '2026-12-01')).toBeCloseTo(8.66, 10);
    } finally { setCurrency('COP'); }
  });
  it('a pocket with only some spending days: the share is by spending days, and still adds up', () => {
    // Mon, Wed, Fri: the Monday piece (Nov 30) has 1 of 3 spending days -> a third.
    const mwf = world([W('90000', { days: [0, 2, 4] })]);
    expect(budget(mwf, '2026-11-30')).toBe(30000);
    expect(budget(mwf, '2026-12-02')).toBe(60000);
    // Thu and Fri only: Monday is not a spending day, so Mon Nov 30 gets nothing and Dec 1–6 gets the whole week.
    const thu = world([W('90000', { days: [3, 4] })]);
    expect(budget(thu, '2026-11-30')).toBe(0);
    expect(budget(thu, '2026-12-02')).toBe(90000);
    // Mon–Sat (no Sunday): the Sunday Nov 1 piece gets nothing, and Oct 26–31 gets the whole week.
    const noSun = world([W('60000', { days: [0, 1, 2, 3, 4, 5] })]);
    expect(weekBase(noSun.pockets[0], '2026-11-01')).toBe(0);
    expect(weekBase(noSun.pockets[0], '2026-10-26')).toBe(60000);
    // A 3-day cut (Mon–Wed) of a 5-day pocket (Mon–Fri): 3/5 for the Monday piece, rounded; the rest for the other.
    const wk5 = world([W('100001', { days: [0, 1, 2, 3, 4] })]);
    expect(weekBase(wk5.pockets[0], '2026-12-28')).toBe(roundAmt(100001 * 4 / 5)); // Dec 28–31 is Mon–Thu: 4 of 5 days
    expect(weekBase(wk5.pockets[0], '2026-12-28') + weekBase(wk5.pockets[0], '2027-01-01')).toBe(100001);
  });
});

describe('a month plan is the sum of its pieces', () => {
  it('Nov + Dec plans equal the sum of their pieces, and add up to the weekly amount × the days ÷ 7 (within a peso)', () => {
    const d = world([W('77777')]), p = d.pockets[0];
    const pieces = (m: string) => weekParts(m).reduce((t, [a]) => t + weekBase(p, a), 0);
    expect(monthPlanOf(p, ctxAt('2026-11-10'))).toBe(pieces('2026-11'));
    expect(monthPlanOf(p, ctxAt('2026-12-10'))).toBe(pieces('2026-12'));
    expect(monthStats(d, 'w', ctxAt('2026-11-10')).budget).toBe(pieces('2026-11'));
    expect(monthStats(d, 'w', ctxAt('2026-12-10')).budget).toBe(pieces('2026-12'));
    // And each piece is what pocketStats shows for it.
    expect(weekParts('2026-11').reduce((t, [a]) => t + budget(d, a), 0)).toBe(pieces('2026-11'));
    expect(Math.abs(pieces('2026-11') - 77777 * 30 / 7)).toBeLessThan(1);
    expect(Math.abs(pieces('2026-12') - 77777 * 31 / 7)).toBeLessThan(1);
    // Hand-worked for 100.000: Nov = 14.286 + 400.000 + 14.286, Dec = 85.714 + 300.000 + 57.143.
    const h = world([W('100000')]).pockets[0];
    expect(monthPlanOf(h, ctxAt('2026-11-10'))).toBe(428572);
    expect(monthPlanOf(h, ctxAt('2026-12-10'))).toBe(442857);
  });
  it('the month summary plan is the sum of the pockets\' pieces; quincena and monthly pockets are unchanged', () => {
    const d = world([W('100000'), { id: 'q', name: 'Q', weeklyStr: '300000', hue: 1, period: 'half' }, { id: 'm', name: 'M', weeklyStr: '500000', hue: 2, period: 'month' }]);
    expect(monthSummary(d, ctxAt('2026-11-10')).plan).toBe(428572 + 600000 + 500000);
    expect(monthSummary(d, ctxAt('2026-12-10')).plan).toBe(442857 + 600000 + 500000);
  });
});

describe('carry over, "next" and "cover" across the cut', () => {
  it('carry over: nothing is lost or created between Mon Nov 30 and Dec 1–6', () => {
    const d = world([W('100000', { carry: '2026-11-23' })], [exp('a', 'w', 40000, '2026-11-24'), exp('b', 'w', 4000, '2026-11-30')]);
    expect(budget(d, '2026-11-30')).toBe(14286 + 60000); // its 1/7 + the 60.000 left of Nov 23–29
    const dec = pocketStats(d, 'w', ctxAt('2026-12-01'))!;
    expect(dec.carry).toBe(14286 + 60000 - 4000);
    expect(dec.weekly).toBe(85714);
    expect(dec.budget).toBe(100000 + 60000 - 4000); // the whole weekly amount + what was left, minus what was spent
    // The month view sees December's carry once, in its plan + carry.
    expect(monthStats(d, 'w', ctxAt('2026-12-10')).budget).toBe(442857 + 70286);
  });
  it('overspending the 1-day week carries as a negative into December\'s week 1', () => {
    // Carry on from Nov 23: 100.000 unspent comes into Mon Nov 30 (14.286): 114.286 − 200.000 = −85.714.
    const d = world([W('100000', { carry: '2026-11-23' })], [exp('b', 'w', 200000, '2026-11-30')]);
    expect(pocketStats(d, 'w', ctxAt('2026-11-30'))!.left).toBe(-85714);
    expect(pocketStats(d, 'w', ctxAt('2026-12-02'))!.carry).toBe(-85714);
    expect(budget(d, '2026-12-02')).toBe(0); // 85.714 − 85.714
  });
  it('"send to next week" made on Mon Nov 30 arrives on Dec 1, in December', () => {
    const d0 = world([W('100000')]);
    const d = { ...d0, ...transferLeftover(d0, ctxAt('2026-11-30'), 'w', { [NEXT]: 10000 })! };
    expect(d.moves[0]).toMatchObject({ week: '2026-11-30', day: '2026-11-30', next: true, amt: 10000 });
    expect(pocketStats(d, 'w', ctxAt('2026-11-30'))!.left).toBe(14286 - 10000);
    expect(budget(d, '2026-12-01')).toBe(85714 + 10000);
    expect(monthStats(d, 'w', ctxAt('2026-11-15')).budget).toBe(428572 - 10000); // leaves November
    expect(monthStats(d, 'w', ctxAt('2026-12-15')).budget).toBe(442857 + 10000); // arrives in December
    // Made on Sun Nov 29 it arrives on Nov 30, still November: the month does not change.
    const e = { ...d0, ...transferLeftover(d0, ctxAt('2026-11-29'), 'w', { [NEXT]: 10000 })! };
    expect(budget(e, '2026-11-30')).toBe(14286 + 10000);
    expect(monthStats(e, 'w', ctxAt('2026-11-15')).budget).toBe(428572);
    expect(monthStats(e, 'w', ctxAt('2026-12-15')).budget).toBe(442857);
  });
  it('"cover from next week" made on Mon Nov 30 comes out of December\'s week 1', () => {
    const d0 = world([W('100000')], [exp('a', 'w', 20000, '2026-11-30')]); // budget 14.286: over by 5.714
    const d = { ...d0, ...borrowNext(d0, ctxAt('2026-11-30'), 'w', 99999)! };
    expect(d.moves[0].amt).toBe(5714);
    expect(pocketStats(d, 'w', ctxAt('2026-11-30'))!.left).toBe(0);
    expect(budget(d, '2026-12-01')).toBe(85714 - 5714);
    expect(monthStats(d, 'w', ctxAt('2026-11-15')).budget).toBe(428572 + 5714);
    expect(monthStats(d, 'w', ctxAt('2026-12-15')).budget).toBe(442857 - 5714);
  });
  it('a move belongs to the month of the day it was made (older ones: of their week\'s Monday)', () => {
    expect(moveMonth({ week: '2026-11-30', day: '2026-12-01' })).toBe('2026-12');
    expect(moveMonth({ week: '2026-11-30', day: '2026-11-30' })).toBe('2026-11');
    expect(moveMonth({ week: '2026-10-26' })).toBe('2026-10');
    expect(moveMonth({ week: '2026-11-30', day: '2026-12-01', month: '2026-11' })).toBe('2026-11'); // an income split keeps its tagged month
  });
});

describe('income split over weeks, shared by the days of each week piece', () => {
  it('Nov 24 "rest of the month": Nov 23–29 and Mon Nov 30 share by days (7:1), December gets nothing', () => {
    const d0 = world([W('100000')]);
    const c = ctxAt('2026-11-24');
    const up = addExtraIncome(d0, c, { amt: 80000, acct: 'bank', note: 'x', toPockets: 80000, mode: 'month', dist: 'manual', manual: { w: 80000 } });
    expect(up.moves![0]).toMatchObject({ spread: 2, month: '2026-11', amt: 80000 });
    const d = { ...d0, ...up } as Data;
    expect(pocketStats(d, 'w', c)!.mIn).toBe(70000);
    expect(pocketStats(d, 'w', ctxAt('2026-11-30'))!.mIn).toBe(10000);
    expect(pocketStats(d, 'w', ctxAt('2026-12-01'))!.mIn).toBe(0);
    expect(monthStats(d, 'w', ctxAt('2026-11-15')).extra).toBe(80000);
    expect(monthSummary(d, c).plan).toBe(428572 + 80000);
    expect(monthSummary(d, ctxAt('2026-12-10')).plan).toBe(442857);
  });
  it('made on Mon Nov 30 itself, it all goes to that 1-day week', () => {
    const d0 = world([W('100000')]), c = ctxAt('2026-11-30');
    const d = { ...d0, ...addExtraIncome(d0, c, { amt: 5000, acct: 'bank', note: 'x', toPockets: 5000, mode: 'month', dist: 'manual', manual: { w: 5000 } }) } as Data;
    expect(pocketStats(d, 'w', c)!.mIn).toBe(5000);
    expect(pocketStats(d, 'w', ctxAt('2026-12-02'))!.mIn).toBe(0);
  });
});

describe('reports over calendar weeks', () => {
  it('budgetWeeks adds both pieces of the cut week, without counting carry twice', () => {
    // Calendar week Nov 30 – Dec 6 = Mon Nov 30 (14.286 + 100.000 carried in) + Dec 1–6 (85.714; its carry is Nov 30's leftover, already counted).
    const d = world([W('100000', { carry: '2026-11-23' })], [exp('b', 'w', 4000, '2026-11-30')]);
    const r = budgetWeeks(d, ctxAt('2026-12-10'), 2, 'w');
    expect(r[0].week).toBe('2026-11-30');
    expect(r[0]).toMatchObject({ budget: 114286 + 85714, spent: 4000, left: 196000 });
    // Without carry over: just the two pieces, 14.286 + 85.714 = the weekly amount.
    expect(budgetWeeks(world([W('100000')]), ctxAt('2026-12-10'), 2, 'w')[0].budget).toBe(100000);
  });
});
