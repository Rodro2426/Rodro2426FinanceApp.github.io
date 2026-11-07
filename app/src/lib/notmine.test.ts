import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { makeCtx } from './dates';
import { emptyData, sampleData } from './seed';
import { monthStats, pocketStats } from './derive';
import { netWorth } from './networth';
import { monthSummary } from './plan';
import { netWorthAt } from './reports';

const exp = (id: string, a: string, amt: number) => ({ id, ts: 1, p: 'groc', a, amt, note: id, date: '2026-11-04', tags: [], cat: 'Groceries', sub: '' });
function data(): Data {
  const e = emptyData(sampleData());
  return {
    ...e,
    pockets: [{ id: 'groc', name: 'Groceries', weeklyStr: '200000', hue: 150 }],
    accounts: [
      { id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 1000000, hue: 85 },
      { id: 'mom', name: "Mom's Visa", kind: 'Credit', type: 'card', bal: 300000, limit: 5000000, hue: 250, notMine: true }
    ],
    expenses: [exp('mine', 'bank', 50000), exp('hers', 'mom', 300000)],
    incomes: [], moves: [], goals: [], payments: []
  };
}

describe("someone else's card", () => {
  const c = makeCtx(4, '2026-11-04');
  it("isn't in net worth", () => {
    expect(netWorth(data()).total).toBe(1000000);
    expect(monthSummary(data(), c).balance).toBe(1000000);
    expect(netWorthAt(data(), '2026-11-04')).toBe(1000000);
  });
  it("what's paid with it isn't your spending", () => {
    expect(pocketStats(data(), 'groc', c)!.spent).toBe(50000);
    expect(monthStats(data(), 'groc', c).spent).toBe(50000);
  });
  it('counts again when it is marked as yours', () => {
    const d = data(); d.accounts[1].notMine = undefined;
    expect(netWorth(d).total).toBe(700000);
    expect(pocketStats(d, 'groc', c)!.spent).toBe(350000);
  });
});
