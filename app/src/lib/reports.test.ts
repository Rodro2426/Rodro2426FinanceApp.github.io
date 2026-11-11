import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sampleData } from './seed';
import { makeCtx, addDays } from './dates';
import { acctTxns } from './derive';
import { debtTotals } from './debts';
import { balanceAt, breakdown, cashflow, catOverTime, compareBudgets, expenseCats, incCatOf, monthsIn, netWorthAt, worthAt } from './reports';

const d = sampleData();
const c = makeCtx(d.settings.weeks);

describe('reports', () => {
  it('net worth today equals accounts minus card debt, minus what you owe people', () => {
    const direct = d.accounts.reduce((a, x) => a + (x.type === 'card' ? -x.bal : x.bal), 0) - debtTotals(d).iOwe;
    expect(netWorthAt(d, c.today)).toBeCloseTo(direct, 6);
  });
  it('rebuilding a balance before every transaction gives the opening balance', () => {
    d.accounts.forEach(a => {
      const { opening, list } = acctTxns(d, a.id);
      const before = list.length ? addDays(list[list.length - 1].date, -1) : c.today;
      expect(balanceAt(d, a.id, before)).toBeCloseTo(opening, 6);
    });
  });
  it('worth is signed: cards subtract', () => {
    const card = d.accounts.find(a => a.type === 'card')!;
    expect(worthAt(d, card.id, c.today)).toBe(-card.bal);
  });
  it('category totals and the breakdown table add up', () => {
    const months = monthsIn(d, c, 3);
    const b = breakdown(d, months, 'expense');
    const all = catOverTime(d, months, 'expense', null);
    expect(b.totals).toEqual(all);
    expect(b.rows.reduce((a, r) => a + r.total, 0)).toBe(b.grand);
    const month = expenseCats(d, c, 'month').reduce((a, x) => a + x.sum, 0);
    expect(month).toBe(all[all.length - 1]);
  });
  it('cashflow net = income - expenses', () => {
    cashflow(d, monthsIn(d, c, 6)).forEach(r => expect(r.net).toBe(r.income - r.expenses));
  });
  it('budgets: left = budget - spent', () => {
    compareBudgets(d, c, 'week').forEach(r => expect(r.left).toBe(r.budget - r.spent));
    compareBudgets(d, c, 'month').forEach(r => expect(r.left).toBe(r.budget - r.spent));
  });
  it('income categories fall back sensibly', () => {
    expect(incCatOf(d, { id: 'int:a:2026-11', ts: 1, a: 'x', amt: 1, note: 'Interest', date: '2026-11-01', interest: true })).toBe('Interest');
    expect(incCatOf(d, { id: 'cdt:z:1', ts: 1, a: 'x', amt: 1, note: '', date: '2026-11-01' })).toBe('Investments');
    expect(incCatOf(d, { id: 'in1', ts: 1, a: 'x', amt: 1, note: '', date: '2026-11-01', cat: 'Gift' })).toBe('Gift');
  });
});

describe('pie slices', () => {
  it('add up to the total and keep each category\'s color across periods', async () => {
    const { pieSlices, expenseCats } = await import('./reports');
    const pal = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    const all = pieSlices(d, expenseCats(d, c, 'all'), 'expense', pal, 'gray');
    const month = pieSlices(d, expenseCats(d, c, 'month'), 'expense', pal, 'gray');
    const sum = (xs: { value: number }[]) => xs.reduce((a, x) => a + x.value, 0);
    expect(sum(all)).toBe(expenseCats(d, c, 'all').reduce((a, x) => a + x.sum, 0));
    expect(sum(month)).toBe(expenseCats(d, c, 'month').reduce((a, x) => a + x.sum, 0));
    month.filter(s => s.label !== 'Other').forEach(s => expect(s.color).toBe(all.find(x => x.label === s.label)!.color));
    expect(new Set(all.map(s => s.color)).size).toBe(all.length); // never two slices with one color
  });
});

describe('net worth with investments and groups', () => {
  it('matches the Accounts tab, and the switches work', async () => {
    const { netWorth } = await import('./networth');
    const g = { id: 'g1', name: 'Real estate', emoji: '🏠', hue: 30, inNetWorth: true, items: [{ id: 'a', name: 'Apartment', value: 300000000, updated: '2026-11-05' }, { id: 'm', name: 'Mortgage', value: 120000000, debt: true, updated: '2026-11-05' }] };
    const base = sampleData();
    const d2 = { ...base, groups: [g], investments: { ...base.investments, trades: [{ id: 't', ts: 1, ticker: 'VOO', name: 'VOO', currency: 'USD' as const, side: 'buy' as const, qty: 2, price: 500, fee: 0, date: '2026-10-01' }], quotes: {}, usdRate: 4000 } };
    const accounts = base.accounts.reduce((a, x) => a + (x.type === 'card' ? -x.bal : x.bal), 0) - debtTotals(base).iOwe;
    const nw = netWorth(d2);
    expect(nw.investments).toBe(4000000);
    expect(nw.total).toBe(accounts + 4000000 + 180000000);
    expect(netWorthAt(d2, c.today)).toBeCloseTo(nw.total, 6);
    const off = { ...d2, settings: { ...d2.settings, excludeInvestments: true } };
    expect(netWorth(off).total).toBe(accounts + 180000000);
    expect(netWorthAt(off, c.today)).toBeCloseTo(netWorth(off).total, 6);
    const notCounted = { ...d2, groups: [{ ...g, inNetWorth: false }] };
    expect(netWorth(notCounted).total).toBe(accounts + 4000000);
  });
});

describe('budgetWeeks with 15-day pockets', () => {
  it('splits a quincena across its weeks and the straddling week', async () => {
    const { emptyData } = await import('./seed');
    const { budgetWeeks } = await import('./reports');
    const { pocketStats, weekShare } = await import('./derive');
    const e = emptyData(sampleData());
    const d = { ...e, settings: { ...e.settings, currency: 'COP' as const, weeks: 4 as const }, incomeStr: '2000000',
      pockets: [{ id: 'wk', name: 'Lunch', weeklyStr: '100000', hue: 60 }, { id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half' as const }],
      expenses: [{ id: 'a', ts: 1, p: 'q', a: 'bank', amt: 5000, note: 'a', date: '2026-11-03', tags: [], cat: 'Other', sub: '' }], incomes: [], moves: [], goals: [] };
    const c = makeCtx(4, '2026-11-25'); // week Nov 23-29
    const rows = budgetWeeks(d, c, 4, 'q'); // weeks Nov 2, 9, 16, 23
    const q1 = pocketStats(d, 'q', makeCtx(4, '2026-11-05'))!.budget;
    // Nov 2-8 is 7 of 15 days; Nov 9-15 (Mon-Sun) is 7 of 15 days; Nov 16 is 1 day in the 16-30 quincena
    expect(rows[0].budget).toBeCloseTo(q1 * 7 / 15, 0);
    expect(rows[0].spent).toBe(5000);
    expect(rows[1].budget).toBeCloseTo(q1 * 7 / 15, 0);
    expect(rows[2].budget).toBeGreaterThan(0);
    expect(rows[3].budget).toBe(weekShare(d, 'q', c).budget);
    // weekly pocket unchanged
    const w = budgetWeeks(d, c, 2, 'wk');
    expect(w[0].budget).toBe(pocketStats(d, 'wk', makeCtx(4, '2026-11-22'))!.budget);
  });

  it('past weeks add up to the quincena budget, and the straddling week splits exactly', async () => {
    const { emptyData } = await import('./seed');
    const { budgetWeeks } = await import('./reports');
    const e = emptyData(sampleData());
    const d = { ...e, settings: { ...e.settings, currency: 'COP' as const, weeks: 4 as const }, incomeStr: '2000000',
      pockets: [{ id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half' as const }],
      expenses: [], incomes: [], moves: [], goals: [] };
    const rows = budgetWeeks(d, makeCtx(4, '2026-11-25'), 5, 'q'); // weeks Oct 26, Nov 2, Nov 9, Nov 16, Nov 23
    // Oct 26-Nov 1 straddles: 6 of 16 days (Oct 16-31) + 1 of 15 days (Nov 1-15) = 112.500 + 20.000
    expect(rows[0].budget).toBeCloseTo(132500, 5);
    expect(rows[1].budget).toBeCloseTo(140000, 5); // 7/15
    expect(rows[2].budget).toBeCloseTo(140000, 5);
    // Nov 1-15 quincena: the 1 day in the first row plus two full weeks = the whole 300.000
    expect(20000 + rows[1].budget + rows[2].budget).toBeCloseTo(300000, 5);
  });
});

describe('income categories', () => {
  it('uses the built-in list until you edit it, and keeps deleted ones in charts while incomes use them', async () => {
    const { INCOME_CATS, allIncomeCats, incomeCatList } = await import('./reports');
    const base = sampleData();
    expect(incomeCatList(base)).toEqual(INCOME_CATS);
    const used = { ...base, incCats: ['Salary', 'Rent'], incomes: [...base.incomes, { id: 'in-t1', ts: 1, a: base.accounts[0].id, amt: 50000, note: 'x', date: '2026-11-03', cat: 'Gift' }] };
    expect(incomeCatList(used)).toEqual(['Salary', 'Rent']);
    expect(allIncomeCats(used)).toContain('Gift');
    expect(allIncomeCats(used)).toContain('Rent');
  });
});
