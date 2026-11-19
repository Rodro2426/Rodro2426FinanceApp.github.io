import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { emptyData, sampleData } from './seed';
import { ctxAt } from './dates';
import { monthSummary } from './plan';
import { runSchedule } from './schedule';
import { makeAccount, makeIncome } from './setup';
import { migrateSalary, salaryShare, setMonthIncome, withIncome } from './salary';
import { monthStats, pocketStats } from './derive';

const world = (pay: 'month' | 'half' = 'half', income = 4_800_001): Data => {
  const e = emptyData(sampleData());
  const acct = makeAccount(e, 'Bancolombia', 0);
  const made = makeIncome(income, pay, 30, acct.id, '2026-11-19');
  return {
    ...e, settings: { ...e.settings, currency: 'COP' }, accounts: [acct], incomeStr: made.incomeStr, bills: made.bills,
    pockets: [{ id: 'g', name: 'Market', weeklyStr: '200000', hue: 150 }, { id: 'f', name: 'Fun', weeklyStr: '100000', hue: 300 }]
  };
};

describe('one income: the salary comes from the monthly income', () => {
  it('a quincena splits the income in two whole pesos, the last payday takes the rounding', () => {
    const d = world();
    const [a, b] = d.bills;
    expect(salaryShare(d, a, '2026-11') + salaryShare(d, b, '2026-11')).toBe(4_800_001);
    expect(salaryShare(d, a, '2026-11')).toBe(2_400_000);
  });
  it('payday brings what Budget says, even if the scheduled item still holds an old number', () => {
    const d = { ...world('month', 3_000_000), incomeStr: '3500000' };
    const after = { ...d, ...(runSchedule(d, '2026-11-30') || {}) };
    expect(after.accounts[0].bal).toBe(3_500_000);
  });
  it('changing the income in Budget updates the salary item too', () => {
    const d = world('month', 3_000_000);
    expect(withIncome(d, '3200000').bills[0].amt).toBe(3_200_000);
  });
});

describe('this month came in different', () => {
  it('less: the month income drops, the pockets give up what you chose, and nothing else changes', () => {
    const d = world('month', 4_000_000), c = ctxAt('2026-11-18');
    const p = setMonthIncome(d, '2026-11', 3_600_000, { g: -300_000, f: -100_000 }, '2026-11-18');
    const after = { ...d, ...p } as Data;
    expect(monthSummary(after, c).income).toBe(3_600_000);
    expect(monthSummary(after, c).plan).toBe(monthSummary(d, c).plan - 400_000);
    expect(monthStats(after, 'g', c).budget).toBe(monthStats(d, 'g', c).budget - 300_000);
    // spread over the 2 weeks left in November (Nov 16 and Nov 23), whole pesos, adding up exactly
    expect(pocketStats(after, 'g', ctxAt('2026-11-18'))!.budget).toBe(200_000 - 150_000);
    expect(pocketStats(after, 'g', ctxAt('2026-11-25'))!.budget).toBe(200_000 - 150_000);
    expect(pocketStats(after, 'g', ctxAt('2026-11-10'))!.budget).toBe(200_000); // before it was set
    expect(pocketStats(after, 'g', ctxAt('2026-12-09'))!.budget).toBe(200_000); // next month is normal again
    expect(monthSummary(after, ctxAt('2026-12-09')).income).toBe(4_000_000);
  });
  it('the payday that month brings what really came in', () => {
    const d = { ...world('month', 4_000_000), ...setMonthIncome(world('month', 4_000_000), '2026-11', 3_600_000) } as Data;
    expect({ ...d, ...(runSchedule(d, '2026-11-30') || {}) }.accounts[0].bal).toBe(3_600_000);
  });
  it('if the salary already arrived, it is corrected, and the account with it', () => {
    const d0 = world('month', 4_000_000), paid = { ...d0, ...(runSchedule(d0, '2026-11-30') || {}) } as Data;
    expect(paid.accounts[0].bal).toBe(4_000_000);
    const less = { ...paid, ...setMonthIncome(paid, '2026-11', 3_600_000) } as Data;
    expect(less.accounts[0].bal).toBe(3_600_000);
    expect(less.incomes[0].amt).toBe(3_600_000);
    const back = { ...less, ...setMonthIncome(less, '2026-11', undefined) } as Data;
    expect(back.accounts[0].bal).toBe(4_000_000);
    expect(back.monthIncome?.['2026-11']).toBeUndefined();
  });
});

describe('older data with a separate Salary item', () => {
  it('the item named Salary becomes the salary and takes the Budget amount', () => {
    const d = sampleData('2026-11-18'); // Salary 4.800.000 and typed 4.800.000
    const m = migrateSalary({ ...d, incomeStr: '5000000', bills: d.bills.map(b => ({ ...b, salary: undefined })) });
    const sal = m.bills.filter(b => b.salary);
    expect(sal.map(b => b.name)).toEqual(['Salary']);
    expect(sal[0].amt).toBe(5_000_000);
  });
  it('other incomes are left alone, and it only happens once', () => {
    const d = world('month', 1_000_000);
    const other = { ...d, bills: [{ ...d.bills[0], salary: undefined, name: 'Rent from flat', amt: 700_000 }] };
    expect(migrateSalary(other).bills.some(b => b.salary)).toBe(false);
    expect(migrateSalary(d)).toBe(d);
  });
});
