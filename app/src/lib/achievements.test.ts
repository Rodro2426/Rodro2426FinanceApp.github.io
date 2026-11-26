import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { emptyData, sampleData } from './seed';
import { ACHIEVEMENTS, bestStreak, cleanRange, currentStreak, lateDays, newlyEarned, toggleZero } from './achievements';
import { parse } from './dates';

// Saved at noon of its own day unless `ts` says otherwise.
const exp = (id: string, p: string, amt: number, date: string, ts = parse(date).getTime()) => ({ id, ts, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function base(): Data {
  const e = emptyData(sampleData());
  return {
    ...e, settings: { ...e.settings, currency: 'COP' }, incomeStr: '400000',
    pockets: [{ id: 'food', name: 'Food', weeklyStr: '50000', hue: 60 }],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 300000, hue: 85 }],
    expenses: [], incomes: [], moves: [], bills: []
  };
}
const ach = (id: string) => ACHIEVEMENTS.find(a => a.id === id)!;

describe('streak', () => {
  it('counts expense days and "spent nothing" days in a row', () => {
    const d = { ...base(), expenses: [exp('a', 'food', 1000, '2026-11-20'), exp('b', 'food', 1000, '2026-11-22')], zeroDays: ['2026-11-21'] };
    expect(currentStreak(d, '2026-11-22')).toBe(3);
  });
  it('today not logged yet keeps yesterday\'s run alive; a missed day ends it', () => {
    const d = { ...base(), expenses: [exp('a', 'food', 1000, '2026-11-20'), exp('b', 'food', 1000, '2026-11-21')] };
    expect(currentStreak(d, '2026-11-22')).toBe(2);
    expect(currentStreak(d, '2026-11-23')).toBe(0);
  });
  it('best streak ignores future-dated expenses', () => {
    const d = { ...base(), expenses: ['01', '02', '03', '05', '06'].map((x, i) => exp('e' + i, 'food', 1, `2026-11-${x}`)).concat(exp('f', 'food', 1, '2026-12-01')) };
    expect(bestStreak(d, '2026-11-06')).toBe(3);
  });
  it('an expense logged on a later day is saved but does not keep the streak, and its day shows as late', () => {
    const late = parse('2026-11-22').getTime();
    const d = { ...base(), expenses: [exp('a', 'food', 1000, '2026-11-20'), exp('b', 'food', 1000, '2026-11-21', late), exp('c', 'food', 1000, '2026-11-22')] };
    expect(currentStreak(d, '2026-11-22')).toBe(1);
    expect([...lateDays(d)]).toEqual(['2026-11-21']);
    // One expense logged on time is enough for the day
    const d2 = { ...d, expenses: [...d.expenses, exp('d', 'food', 1, '2026-11-21')] };
    expect(currentStreak(d2, '2026-11-22')).toBe(3);
    expect(lateDays(d2).size).toBe(0);
  });
  it('toggleZero marks and unmarks a day', () => {
    const d = base();
    const on = { ...d, ...toggleZero(d, '2026-11-24') };
    expect(on.zeroDays).toEqual(['2026-11-24']);
    expect(toggleZero(on, '2026-11-24').zeroDays).toEqual([]);
  });
});

describe('clean periods', () => {
  // Week Nov 16–22, 2026: budget 50.000.
  it('a week within budget is clean, an overspent one is not', () => {
    const ok = { ...base(), expenses: [exp('a', 'food', 40000, '2026-11-18')] };
    expect(cleanRange(ok, '2026-11-16', '2026-11-22')).toBe(true);
    const over = { ...base(), expenses: [exp('a', 'food', 60000, '2026-11-18')] };
    expect(cleanRange(over, '2026-11-16', '2026-11-22')).toBe(false);
  });
  it('nothing spent in the range earns nothing', () => {
    expect(cleanRange(base(), '2026-11-16', '2026-11-22')).toBe(false);
  });
  it('a quincena checks every week that ends inside it', () => {
    // Weeks ending Nov 8 and Nov 15 are inside Nov 1–15; the one ending Nov 1 belongs to October's side.
    const d = { ...base(), expenses: [exp('a', 'food', 10000, '2026-11-05'), exp('b', 'food', 70000, '2026-11-12')] };
    expect(cleanRange(d, '2026-11-01', '2026-11-15')).toBe(false);
    const ok = { ...base(), expenses: [exp('a', 'food', 10000, '2026-11-05'), exp('b', 'food', 45000, '2026-11-12')] };
    expect(cleanRange(ok, '2026-11-01', '2026-11-15')).toBe(true);
  });
  it('15-day pockets are checked on their own quincena', () => {
    const d = { ...base(), pockets: [{ id: 'food', name: 'Food', weeklyStr: '100000', hue: 60, period: 'half' as const }], expenses: [exp('a', 'food', 120000, '2026-11-10')] };
    expect(cleanRange(d, '2026-11-01', '2026-11-15')).toBe(false);
  });
});

describe('clean periods: edge cases', () => {
  const pk = (extra: object) => ({ id: 'food', name: 'Food', weeklyStr: '50000', hue: 60, ...extra });
  it('monthly pocket is judged on the whole month', () => {
    // Budget 100.000 for November (ends Nov 30).
    const d = (amt: number) => ({ ...base(), pockets: [pk({ weeklyStr: '100000', period: 'month' })], expenses: [exp('a', 'food', amt, '2026-11-10')] });
    expect(cleanRange(d(120000), '2026-11-01', '2026-11-30')).toBe(false);
    expect(cleanRange(d(90000), '2026-11-01', '2026-11-30')).toBe(true);
    // A week range never contains the month's last day: nothing checked, so not clean.
    expect(cleanRange(d(90000), '2026-11-16', '2026-11-22')).toBe(false);
  });
  it('carry over: an overspend rolls into the next week', () => {
    // Carry on from Nov 2. Week Nov 2-8 spends 70.000 of 50.000 (-20.000). Week Nov 9-15 spends 40.000 of 50.000-20.000 -> -10.000.
    const d = { ...base(), pockets: [pk({ carry: '2026-11-02' })], expenses: [exp('a', 'food', 70000, '2026-11-03'), exp('b', 'food', 40000, '2026-11-10')] };
    expect(cleanRange(d, '2026-11-09', '2026-11-15')).toBe(false);
    expect(cleanRange({ ...d, expenses: [d.expenses[0], exp('b', 'food', 20000, '2026-11-10')] }, '2026-11-09', '2026-11-15')).toBe(true);
  });
  it('spending on an account marked "not mine" is ignored', () => {
    const accounts = [...base().accounts, { id: 'card', name: 'Friend card', kind: 'Credit', type: 'card' as const, bal: 0, hue: 1, notMine: true }];
    const big = { ...exp('a', 'food', 90000, '2026-11-18'), a: 'card' };
    const d = { ...base(), accounts, expenses: [big] };
    expect(cleanRange(d, '2026-11-16', '2026-11-22')).toBe(false); // nothing of mine was spent
    expect(cleanRange({ ...d, expenses: [big, exp('b', 'food', 10000, '2026-11-19')] }, '2026-11-16', '2026-11-22')).toBe(true);
  });
  it('February: the second quincena ends on the 28th', () => {
    const pockets = [pk({ weeklyStr: '100000', period: 'half' })];
    expect(cleanRange({ ...base(), pockets, expenses: [exp('a', 'food', 120000, '2027-02-28')] }, '2027-02-16', '2027-02-28')).toBe(false);
    const ok = { ...base(), pockets, expenses: [exp('a', 'food', 90000, '2027-02-28')] };
    expect(cleanRange(ok, '2027-02-16', '2027-02-28')).toBe(true);
    expect(ach('half').earned(ok, '2027-03-05')).toBe(true); // 16-28 Feb is the last finished quincena
    expect(ach('half').earned(ok, '2027-03-20')).toBe(false); // now 1-15 March
  });
  it('a pocket created mid-period uses its smaller first amount', () => {
    const d = { ...base(), pockets: [pk({ start: { from: '2026-11-16', amt: 10000 } })], expenses: [exp('a', 'food', 20000, '2026-11-18')] };
    expect(cleanRange(d, '2026-11-16', '2026-11-22')).toBe(false);
    expect(cleanRange(d, '2026-11-23', '2026-11-29')).toBe(false); // no spending in that week
  });
  it('clean week = the Mon-Sun week before today', () => {
    const d = { ...base(), expenses: [exp('a', 'food', 40000, '2026-11-18')] };
    expect(ach('week').earned(d, '2026-11-23')).toBe(true);  // Monday: week 16-22 just ended
    expect(ach('week').earned(d, '2026-11-22')).toBe(false); // Sunday: still running
  });
});

describe('achievements', () => {
  it('cushion needs savings that cover the average month of spending', () => {
    const d = { ...base(), accounts: [...base().accounts, { id: 's', name: 'Savings', kind: 'Savings', type: 'savings' as const, bal: 150000, hue: 1 }], expenses: [exp('a', 'food', 100000, '2026-10-10')] };
    expect(ach('cushion1').earned(d, '2026-11-24')).toBe(true);
    expect(ach('cushion3').earned(d, '2026-11-24')).toBe(false);
    expect(ach('cushion1').earned({ ...d, expenses: [] }, '2026-11-24')).toBe(false);
  });
  it('zero weekend needs both days marked and nothing spent', () => {
    const d = { ...base(), zeroDays: ['2026-11-21', '2026-11-22'] };
    expect(ach('weekend').earned(d, '2026-11-24')).toBe(true);
    expect(ach('weekend').earned({ ...d, expenses: [exp('a', 'food', 1, '2026-11-22')] }, '2026-11-24')).toBe(false);
  });
  it('December counts only once it is over', () => {
    const d = { ...base(), expenses: [exp('a', 'food', 1000, '2026-12-10')] };
    expect(ach('december').earned(d, '2026-12-28')).toBe(false);
    expect(ach('december').earned(d, '2027-01-02')).toBe(true);
  });
  it('full plan: pockets add up to the income (within 1%)', () => {
    // One monthly pocket of 400.000 against a 400.000 income.
    const d = { ...base(), pockets: [{ id: 'food', name: 'Food', weeklyStr: '400000', hue: 60, period: 'month' as const }] };
    expect(ach('plan').earned(d, '2026-11-24')).toBe(true);
    expect(ach('plan').earned({ ...d, incomeStr: '500000' }, '2026-11-24')).toBe(false);
  });
  it('earned ones are listed once', () => {
    const d = base();
    expect(newlyEarned(d, '2026-11-24').map(a => a.id)).toContain('pocket');
    expect(newlyEarned({ ...d, trophies: { pocket: '2026-11-01' } }, '2026-11-24').map(a => a.id)).not.toContain('pocket');
  });
});
