import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sampleData } from './seed';
import { makeCtx, addDays } from './dates';
import { acctTxns } from './derive';
import { balanceAt, breakdown, cashflow, catOverTime, compareBudgets, expenseCats, incCatOf, monthsIn, netWorthAt, worthAt } from './reports';

const d = sampleData();
const c = makeCtx(d.settings.weeks);

describe('reports', () => {
  it('net worth today equals accounts minus card debt', () => {
    const direct = d.accounts.reduce((a, x) => a + (x.type === 'card' ? -x.bal : x.bal), 0);
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
