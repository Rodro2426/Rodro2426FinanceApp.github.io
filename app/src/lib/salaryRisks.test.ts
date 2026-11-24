import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { emptyData, sampleData } from './seed';
import { ctxAt } from './dates';
import { runSchedule } from './schedule';
import { makeAccount, makeIncome } from './setup';
import { migrateSalary, salaryShare, setMonthIncome } from './salary';
import { monthAdjShare, monthStats, pocketStats } from './derive';

const world = (pay: 'month' | 'half', income: number, period?: 'half' | 'month'): Data => {
  const e = emptyData(sampleData());
  const acct = makeAccount(e, 'Bank', 0);
  const made = makeIncome(income, pay, 30, acct.id, '2026-11-01');
  return { ...e, settings: { ...e.settings, currency: 'COP' }, accounts: [acct], incomeStr: made.incomeStr, bills: made.bills,
    pockets: [{ id: 'g', name: 'Market', weeklyStr: '200000', hue: 150, ...(period ? { period } : {}) }] };
};

describe('salary risks', () => {
  it('migration is idempotent and ignores typed 0 / empty with no salary-like bill', () => {
    const d = { ...world('month', 1_000_000), incomeStr: '0' };
    const old = { ...d, bills: d.bills.map(b => ({ ...b, salary: undefined, name: 'Pay' })) };
    expect(migrateSalary(old).bills.some(b => b.salary)).toBe(false); // typed 0: nothing guessed
    const named = { ...old, bills: old.bills.map(b => ({ ...b, name: 'Salario' })), incomeStr: '' };
    const m = migrateSalary(named);
    expect(m.incomeStr).toBe('1000000');
    expect(migrateSalary(m)).toBe(m);
  });
  it('quincena pair named Salario · 1/2 both migrate and still add to the typed income', () => {
    const d = world('half', 4_800_001);
    const old = { ...d, bills: d.bills.map(b => ({ ...b, salary: undefined, name: b.name.replace('Salary', 'Salario') })) };
    const m = migrateSalary(old);
    expect(m.bills.filter(b => b.salary).length).toBe(2);
    expect(m.bills.reduce((a, b) => a + b.amt, 0)).toBe(4_800_001);
  });
  it('salary paid on a card lowers the debt; correcting it moves the debt the right way', () => {
    const d0 = world('month', 4_000_000);
    const card = { ...d0.accounts[0], id: 'cc', type: 'card' as const, bal: 1_000_000 };
    const d = { ...d0, accounts: [card], bills: d0.bills.map(b => ({ ...b, acct: 'cc' })) };
    const paid = { ...d, ...(runSchedule(d, '2026-11-30') || {}) } as Data;
    const less = { ...paid, ...setMonthIncome(paid, '2026-11', 3_600_000) } as Data;
    expect(paid.accounts[0].bal).toBe(1_000_000 - 4_000_000);
    expect(less.accounts[0].bal).toBe(1_000_000 - 3_600_000);
  });
  it('one quincena paid: only that payday is corrected; both paydays add up to the new income', () => {
    const d0 = world('half', 4_000_000);
    const d1 = { ...d0, ...(runSchedule(d0, '2026-11-15') || {}) } as Data;
    expect(d1.accounts[0].bal).toBe(2_000_000);
    const p = setMonthIncome(d1, '2026-11', 3_000_001);
    const d2 = { ...d1, ...p } as Data;
    expect(d2.accounts[0].bal).toBe(1_500_000);
    const d3 = { ...d2, ...(runSchedule(d2, '2026-11-30') || {}) } as Data;
    expect(d3.accounts[0].bal).toBe(3_000_001);
  });
  it('adj is fully used across a month for weekly, half and month pockets (Nov 2026)', () => {
    for (const period of [undefined, 'half', 'month'] as const) {
      const d0 = world('month', 4_000_000, period);
      const d = { ...d0, ...setMonthIncome(d0, '2026-11', 3_700_001, { g: -100_001 }, '2026-11-10') } as Data;
      const starts = period === 'half' ? ['2026-11-01', '2026-11-16'] : period === 'month' ? ['2026-11-01'] : ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'];
      const got = starts.reduce((a, s) => a + monthAdjShare(d, d.pockets[0], s), 0);
      expect(got, String(period)).toBe(-100_001);
      expect(monthStats(d, 'g', ctxAt('2026-11-18')).budget - monthStats(d0, 'g', ctxAt('2026-11-18')).budget).toBe(-100_001);
    }
  });
  it('weekly: month set on the last Monday (a November week) puts the whole cut in that week', () => {
    const d0 = world('month', 4_000_000);
    const d = { ...d0, ...setMonthIncome(d0, '2026-11', 3_900_000, { g: -100_000 }, '2026-11-30') } as Data;
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'];
    const periods = weeks.reduce((a, s) => a + monthAdjShare(d, d.pockets[0], s), 0);
    // monthStats says the month lost 100.000, so the weeks must add up to the same cut
    expect(periods).toBe(monthStats(d, 'g', ctxAt('2026-11-18')).budget - monthStats(d0, 'g', ctxAt('2026-11-18')).budget);
    expect(periods).toBe(-100_000);
  });
  it('weekly: month set on Tue Dec 1 (week Nov 30 is November) still spreads the cut over December weeks', () => {
    const d0 = world('month', 4_000_000);
    const d = { ...d0, ...setMonthIncome(d0, '2026-12', 3_900_000, { g: -100_000 }, '2026-12-01') } as Data;
    const weeks = ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'];
    expect(weeks.reduce((a, s) => a + monthAdjShare(d, d.pockets[0], s), 0)).toBe(-100_000);
    expect(monthAdjShare(d, d.pockets[0], '2026-11-30')).toBe(0);
    expect(monthStats(d, 'g', ctxAt('2026-12-10')).budget - monthStats(d0, 'g', ctxAt('2026-12-10')).budget).toBe(-100_000);
  });
  it('a cut bigger than what is left of the pocket drives the week negative (no clamp)', () => {
    const d0 = world('month', 4_000_000);
    const d = { ...d0, ...setMonthIncome(d0, '2026-11', 3_000_000, { g: -1_000_000 }, '2026-11-18') } as Data;
    expect(pocketStats(d, 'g', ctxAt('2026-11-18'))!.budget).toBe(200_000 - 333_334) // -1.000.000 over 3 weeks (Nov 16, 23, 30);
  });
  it('salaryShare with a month override splits whole units', () => {
    const d0 = world('half', 4_000_000);
    const d = { ...d0, ...setMonthIncome(d0, '2026-11', 3_000_001) } as Data;
    expect(salaryShare(d, d.bills[0], '2026-11') + salaryShare(d, d.bills[1], '2026-11')).toBe(3_000_001);
  });
});
