import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyData, sampleData } from './seed';
import { makeCtx } from './dates';
import { monthSummary } from './plan';
import { dueDate, runSchedule } from './schedule';
import { bankLogo, leftFree, makeAccount, makeBills, makeCard, makeIncome, makePockets, roundBudget, suggestPockets, BILLS } from './setup';

const d = emptyData(sampleData());

describe('first-time setup', () => {
  it('rounds weekly budgets to $5.000', () => {
    expect(roundBudget(87400)).toBe(85000);
    expect(roundBudget(87600)).toBe(90000);
    expect(roundBudget(-10)).toBe(0);
  });

  it('suggests pockets from the income, four selected, none without income', () => {
    const s = suggestPockets(4_000_000);
    expect(s.filter(p => p.on).length).toBe(4);
    expect(s[0]).toMatchObject({ key: 'Groceries', monthly: 880000, on: true });
    expect(suggestPockets(0).every(p => p.monthly === 0)).toBe(true);
    const free = leftFree(4_000_000, s);
    expect(free).toBe(4_000_000 - (880000 + 400000 + 320000 + 240000));
    expect(free).toBeGreaterThan(0);
  });

  it('counts bills in what is left free, and can go below zero', () => {
    expect(leftFree(1_000_000, [{ on: true, monthly: 800000 }], [{ on: true, amt: 300000 }, { on: false, amt: 999 }])).toBe(-100000);
  });

  it('makes a known bank with its logo, a typed bank without, and cash as a wallet', () => {
    const a = makeAccount(d, 'Davivienda', 1_500_000.4);
    expect(a).toMatchObject({ name: 'Davivienda', type: 'bank', bal: 1500000, photo: bankLogo('Davivienda') });
    expect(a.photo).toContain('davivienda.com');
    const own = makeAccount(d, '  Banco   Pichincha ', -5);
    expect(own).toMatchObject({ name: 'Banco Pichincha', type: 'bank', bal: 0, photo: null });
    expect(makeAccount(d, 'Cash', 50000).type).toBe('cash');
  });

  it('makes a card and drops impossible days', () => {
    const c = makeCard(d, 'Visa Davivienda', 300000, 2_000_000, 25, 40);
    expect(c).toMatchObject({ type: 'card', bal: 300000, limit: 2000000, cutDay: 25, payDay: undefined });
  });

  it('splits a quincena income in two paydays that add up exactly', () => {
    const m = makeIncome(3_000_001, 'half', 0, 'a1', '2026-11-16');
    expect(m.incomeStr).toBe('3000001');
    expect(m.bills.map(b => [b.amt, b.dueDay])).toEqual([[1500000, 15], [1500001, 30]]);
    expect(m.bills.every(b => b.kind === 'Income' && b.auto && b.acct === 'a1' && b.start === '2026-11-17')).toBe(true);
    const one = makeIncome(2_000_000, 'month', 5, 'a1');
    expect(one.bills.map(b => b.dueDay)).toEqual([5]);
    expect(makeIncome(0, 'month', 5, 'a1').bills).toEqual([]);
  });

  it('keeps only chosen pockets and named bills with an amount', () => {
    const picks = suggestPockets(4_000_000).map((p, i) => (i === 5 ? { ...p, on: true, name: '  ' } : p));
    picks.push({ key: 'own', name: 'Plantas', emoji: 'pk:sprout', share: 0, on: true, monthly: 150000 });
    const ps = makePockets(picks, 4);
    expect(ps.map(p => p.name)).toEqual(['Groceries', 'Transport', 'Eating out', 'Fun', 'Plantas']);
    // A monthly amount becomes the budget of each week, and the pocket remembers it was typed per month.
    expect(ps[0].weeklyStr).toBe('220000');
    expect(ps[4]).toMatchObject({ weeklyStr: '37500', perMonth: true });
    expect(makePockets(picks, 5)[4].weeklyStr).toBe('30000');
    const bills = makeBills([
      { ...BILLS[0], on: true, amt: 1_200_000, day: 30 },
      { ...BILLS[1], on: true, amt: 0, day: 10 },
      { key: 'own', name: 'Parqueadero', kind: 'Bill', cat: 'Home', sub: 'Utilities', on: true, amt: 90000, day: 45 }
    ], 'a1');
    expect(bills.map(b => [b.name, b.amt, b.dueDay, b.auto])).toEqual([['Rent', 1200000, 30, false], ['Parqueadero', 90000, 31, false]]);
  });

  it('does not count the automatic salary twice, and leftFree is planGap minus the bills', () => {
    const c = makeCtx(4, '2026-11-20');
    const acct = makeAccount(d, 'Nequi', 100000);
    const inc = makeIncome(4_000_000, 'half', 0, acct.id, '2026-11-20');
    const ps = makePockets(suggestPockets(4_000_000), 4);
    const x = { ...emptyData(sampleData()), accounts: [acct], incomeStr: inc.incomeStr, bills: inc.bills, pockets: ps };
    // 20 Nov: both paydays (15, 30) are not due yet, so no income was added today.
    const run = runSchedule(x, '2026-11-20');
    const after = { ...x, ...(run || {}) };
    expect(after.incomes.length).toBe(0);
    // Salary lands on the 30th: an automatic income (ruleId) must not become "extra income".
    const later = { ...x, ...(runSchedule(x, '2026-11-30') || {}) };
    expect(later.incomes.length).toBe(1);
    const s = monthSummary(later, c);
    expect(s.extra).toBe(0);
    expect(s.income).toBe(4_000_000);
    // Hand-worked: pockets (220000+100000+80000+60000) * 4 = 1.840.000 planned.
    expect(s.planGap).toBe(4_000_000 - 1_840_000);
    expect(leftFree(4_000_000, suggestPockets(4_000_000), [{ on: true, amt: 500000 }])).toBe(s.planGap - 500000);
  });

  it('pays day 30 on the last day of February, and not on the 30th of a 31-day month early', () => {
    const b = makeIncome(1_000_000, 'half', 0, 'a1', '2027-02-01').bills;
    expect(dueDate(b[1], '2027-02')).toBe('2027-02-28');
    expect(dueDate(b[1], '2028-02')).toBe('2028-02-29');
    expect(dueDate(b[0], '2027-02')).toBe('2027-02-15');
  });

  it('does not add the salary on top of the balance typed on payday itself', () => {
    const acct = makeAccount(d, 'Nequi', 100000);
    const made = makeIncome(1_000_000, 'month', 15, acct.id, '2026-11-15');
    const x = { ...emptyData(sampleData()), accounts: [acct], incomeStr: made.incomeStr, bills: made.bills };
    expect(x.bills[0].start).toBe('2026-11-16');
    expect((runSchedule(x, '2026-11-15') || {}).incomes ?? []).toEqual([]);
    // the next payday arrives normally
    const dec = { ...x, ...(runSchedule(x, '2026-12-15') || {}) };
    expect(dec.accounts[0].bal).toBe(1_100_000);
  });
});
