import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { makeCtx } from './dates';
import { emptyData, sampleData } from './seed';
import { monthStats, pocketStats } from './derive';
import { largestRemainder, weekShares } from './split';
import { overBy, refillFrom, suggestRefill, addExtraIncome, COVER, coverFirst, coverWith, deleteIncome, editIncomeAmount, findMismatches, markIncluded, monthSummary, splitAmong, suggestCover, transferLeftover, undoMoves, type ExtraIncome } from './plan';

/** November 2026, week 1 (Nov 2–8), today Wednesday Nov 4: 4 weeks in the month, 4 left. */
const c = makeCtx(4, '2026-11-04');
const apply = (d: Data, p: Partial<Data>): Data => ({ ...d, ...p });

/** The user's real November data. */
function november(withOrphans = true): Data {
  const e = emptyData(sampleData());
  const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
  return {
    ...e,
    settings: { ...e.settings, currency: 'COP', weeks: 4 },
    incomeStr: '361058',
    pockets: [
      { id: 'lunch', name: 'Lunch', weeklyStr: '32000', hue: 60 },
      { id: 'wagon', name: 'Wagon', weeklyStr: '25000', hue: 200 },
      { id: 'salidas', name: 'Salidas', weeklyStr: '65000', hue: 320 }
    ],
    // Spending only changes the account balance in the app; the balance here is already after spending.
    accounts: [{ id: 'bank', name: 'Bancolombia', kind: 'Checking', type: 'bank', bal: 361058, hue: 85 }, { id: 'visa', name: 'Visa', kind: 'Credit', type: 'card', bal: 0, limit: 1000000, hue: 250 }],
    expenses: [exp('l1', 'lunch', 16000, '2026-11-03'), exp('w1', 'wagon', 6500, '2026-11-02'), exp('s1', 'salidas', 1000, '2026-11-04')],
    incomes: [],
    // Four "New income" moves left over from incomes that are already part of the typed $361.058.
    moves: withOrphans ? [
      { id: 'mold00001', week: '2026-11-02', from: '_income', to: 'lunch', amt: 16000 },
      { id: 'mold00002', week: '2026-11-02', from: '_income', to: 'lunch', amt: 26000 },
      { id: 'mold00003', week: '2026-11-02', from: '_income', to: 'wagon', amt: 5413 },
      { id: 'mold00004', week: '2026-11-02', from: '_income', to: 'salidas', amt: 60000 }
    ] : []
  };
}
const cleaned = () => { const d = november(); return apply(d, undoMoves(d, findMismatches(d, c).orphan.map(m => m.id))); };
const sami = (toPockets: number, more: Partial<ExtraIncome> = {}): ExtraIncome => ({ amt: 96000, acct: 'bank', note: 'Sami', toPockets, mode: 'month', dist: 'budget', id: 'insami0001', ...more });
const splitOf = (d: Data, incId: string) => Object.fromEntries(d.moves.filter(m => m.income === incId).map(m => [m.to, m.amt]));
const weekly = (d: Data, id: string) => pocketStats(d, id, c)!.mIn;

describe('largest remainder', () => {
  it('adds up exactly and gives leftovers to the largest fractions', () => {
    expect(largestRemainder(96000, [32000, 25000, 65000])).toEqual([25180, 19672, 51148]);
    expect(largestRemainder(33000, [32000, 25000, 65000])).toEqual([8656, 6762, 17582]);
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(weekShares(25180, 4)).toEqual([6295, 6295, 6295, 6295]);
    expect(weekShares(10, 4)).toEqual([3, 3, 2, 2]);
  });
});

describe('case 0: clean-up', () => {
  it('finds the 4 New income moves with no income behind them', () => {
    const d = november(), m = findMismatches(d, c);
    expect(m.orphan.map(x => x.amt).sort((a, b) => a - b)).toEqual([5413, 16000, 26000, 60000]);
    expect(m.orphan.reduce((a, x) => a + x.amt, 0)).toBe(107413);
    expect(monthSummary(d, c).plan).toBe(488000 + 107413);
  });
  it('after undoing them, every number matches', () => {
    const d = cleaned(), s = monthSummary(d, c);
    expect(['lunch', 'wagon', 'salidas'].map(id => monthStats(d, id, c).left)).toEqual([112000, 93500, 259000]);
    expect(s.toSpend).toBe(464500);
    expect(s.income).toBe(361058);
    expect(s.plan).toBe(488000);
    expect(s.planGap).toBe(-126942);
    expect(s.real).toBe(103442);
    expect(findMismatches(d, c).orphan).toHaveLength(0);
  });
});

describe('cases 1–4: Sami, $96.000', () => {
  it('1. all saved', () => {
    const d = apply(cleaned(), addExtraIncome(cleaned(), c, sami(0))), s = monthSummary(d, c);
    expect([s.income, s.plan, s.planGap, s.real]).toEqual([457058, 488000, -30942, 7442]);
  });
  it('2. all to pockets, by budget, rest of month', () => {
    const d = apply(cleaned(), addExtraIncome(cleaned(), c, sami(96000))), s = monthSummary(d, c);
    expect(splitOf(d, 'insami0001')).toEqual({ lunch: 25180, wagon: 19672, salidas: 51148 });
    expect(['lunch', 'wagon', 'salidas'].map(id => weekly(d, id))).toEqual([6295, 4918, 12787]);
    expect([s.income, s.plan, s.planGap, s.real]).toEqual([457058, 584000, -126942, 103442]);
    expect(s.real > 0).toBe(true); // shows the warning
  });
  it('3. $33.000 to pockets by budget, $63.000 saved', () => {
    const d = apply(cleaned(), addExtraIncome(cleaned(), c, sami(33000))), s = monthSummary(d, c);
    expect(splitOf(d, 'insami0001')).toEqual({ lunch: 8656, wagon: 6762, salidas: 17582 });
    expect([s.plan, s.planGap]).toEqual([521000, -63942]);
  });
  it('4. cover the shortfall first: everything is saved', () => {
    expect(coverFirst(cleaned(), c, 96000)).toBe(0);
    // With a smaller shortfall, only the rest goes to pockets.
    const d = apply(cleaned(), { incomeStr: '361058', accounts: cleaned().accounts.map(a => (a.id === 'bank' ? { ...a, bal: 450000 } : a)) });
    expect(coverFirst(d, c, 96000)).toBe(96000 - 14500);
  });
});

describe('invariants', () => {
  const cases: [number, number, 'week' | 'month', 'budget' | 'even'][] = [];
  for (const X of [1, 999, 96000, 123457]) for (const f of [0, 0.37, 1]) for (const mode of ['week', 'month'] as const) for (const dist of ['budget', 'even'] as const) cases.push([X, Math.round(X * f), mode, dist]);
  it.each(cases)('X=%i A=%i %s %s', (X, A, mode, dist) => {
    const d0 = cleaned(), before = monthSummary(d0, c);
    const d1 = apply(d0, addExtraIncome(d0, c, { amt: X, acct: 'bank', note: 'x', toPockets: A, mode, dist, id: 'intest0001' }));
    const after = monthSummary(d1, c);
    expect(after.income).toBe(before.income + X);
    expect(after.plan).toBe(before.plan + A);
    expect(after.planGap).toBe(before.planGap + (X - A));
    const parts = d1.moves.filter(m => m.income === 'intest0001');
    expect(parts.reduce((a, m) => a + m.amt, 0)).toBe(A);
    expect(parts.every(m => Number.isInteger(m.amt))).toBe(true);
    // Each pocket's weekly shares over the rest of the month add up to its part.
    parts.forEach(m => expect(weekShares(m.amt, m.spread ?? 1).reduce((a, x) => a + x, 0)).toBe(m.amt));
    expect(after.balance).toBe(before.balance + X);
  });
  it('manual split and the even split add up exactly', () => {
    expect(Object.values(splitAmong(cleaned(), 100000, 'even')).reduce((a, x) => a + x, 0)).toBe(100000);
    expect(splitAmong(cleaned(), 0, 'manual', { lunch: 5000, salidas: 2500 })).toEqual({ lunch: 5000, wagon: 0, salidas: 2500 });
  });
  it('reopening (saving and loading) never counts an income twice', () => {
    const d1 = apply(cleaned(), addExtraIncome(cleaned(), c, sami(33000)));
    const reloaded = JSON.parse(JSON.stringify(d1)) as Data;
    expect(monthSummary(reloaded, c)).toEqual(monthSummary(d1, c));
    expect(monthSummary(d1, c)).toEqual(monthSummary(d1, c));
  });
  it('editing an income changes the month by the difference only, and shrinks the split if needed', () => {
    const d1 = apply(cleaned(), addExtraIncome(cleaned(), c, sami(96000)));
    const s1 = monthSummary(d1, c);
    const d2 = apply(d1, editIncomeAmount(d1, 'insami0001', 50000));
    const s2 = monthSummary(d2, c);
    expect(s2.income).toBe(s1.income - 46000);
    expect(s2.plan).toBe(s1.plan - 46000);
    expect(d2.moves.filter(m => m.income === 'insami0001').reduce((a, m) => a + m.amt, 0)).toBe(50000);
    const d3 = apply(d2, editIncomeAmount(d2, 'insami0001', 50000)); // same amount again: nothing changes
    expect(monthSummary(d3, c)).toEqual(s2);
  });
  it('deleting an income takes back exactly what it added', () => {
    const d0 = cleaned(), d1 = apply(d0, addExtraIncome(d0, c, sami(33000)));
    expect(monthSummary(apply(d1, deleteIncome(d1, 'insami0001')), c)).toEqual(monthSummary(d0, c));
  });
  it('an income already in the typed amount is not added again; its split can be removed', () => {
    const d1 = apply(cleaned(), addExtraIncome(cleaned(), c, sami(33000)));
    const yes = apply(d1, markIncluded(d1, ['insami0001']));
    const s = monthSummary(yes, c);
    expect(s.income).toBe(361058);
    expect(s.plan).toBe(488000);
    const keep = apply(d1, markIncluded(d1, ['insami0001'], ['insami0001']));
    expect(findMismatches(keep, c).included.reduce((a, m) => a + m.amt, 0)).toBe(33000);
  });
});

describe('moving a pocket\'s leftover', () => {
  const ids = ['lunch', 'wagon', 'salidas'];
  const weekTotal = (d: Data) => ids.reduce((a, id) => a + pocketStats(d, id, c)!.budget, 0);
  const withGoal = (): Data => ({ ...cleaned(), goals: [{ id: 'trip', name: 'Trip', saved: 100000, target: 500000, months: 6, hue: 30 }] });

  it('splits Salidas\' leftover between pockets without creating money', () => {
    const d0 = cleaned(), before = monthSummary(d0, c), wk = weekTotal(d0);
    const p = transferLeftover(d0, c, 'salidas', { lunch: 20000, wagon: 15000 })!;
    const d1 = apply(d0, p), after = monthSummary(d1, c);
    expect(pocketStats(d1, 'salidas', c)!.left).toBe(64000 - 35000);
    expect(pocketStats(d1, 'lunch', c)!.left).toBe(16000 + 20000);
    expect(pocketStats(d1, 'wagon', c)!.left).toBe(18500 + 15000);
    // Only a transfer: income, plan, both gaps, what's left to spend and the accounts are all unchanged.
    expect(after).toEqual(before);
    expect(weekTotal(d1)).toBe(wk);
    expect(findMismatches(d1, c)).toEqual({ orphan: [], included: [] });
  });
  it('can\'t move more than the pocket has left this week, or to itself', () => {
    const d0 = cleaned();
    expect(transferLeftover(d0, c, 'salidas', { lunch: 64001 })).toBeNull();
    expect(transferLeftover(d0, c, 'salidas', { lunch: 40000, wagon: 24001 })).toBeNull();
    expect(transferLeftover(d0, c, 'salidas', { salidas: 1000 })).toBeNull();
    expect(transferLeftover(d0, c, 'salidas', { nope: 1000 })).toBeNull();
    expect(transferLeftover(d0, c, 'salidas', { lunch: 64000 })).not.toBeNull();
  });
  it('sending part to a goal saves it there; the plan and income stay the same', () => {
    const d0 = withGoal(), before = monthSummary(d0, c);
    const d1 = apply(d0, transferLeftover(d0, c, 'salidas', { lunch: 10000, trip: 30000 })!), after = monthSummary(d1, c);
    expect(d1.goals[0].saved).toBe(130000);
    expect([after.income, after.plan, after.planGap, after.balance]).toEqual([before.income, before.plan, before.planGap, before.balance]);
    expect(after.toSpend).toBe(before.toSpend - 30000); // that money is no longer in a pocket to spend
  });
  it('the transfer is only for this week: next week each pocket starts from its own budget', () => {
    const d1 = apply(cleaned(), transferLeftover(cleaned(), c, 'salidas', { lunch: 20000 })!);
    const next = makeCtx(4, '2026-11-11');
    expect(pocketStats(d1, 'lunch', next)!.budget).toBe(32000);
    expect(pocketStats(d1, 'salidas', next)!.budget).toBe(65000);
  });
});

describe('covering the shortfall with leftovers', () => {
  // Pockets still promise $464.500 this month; the bank has less.
  const short = (bal: number): Data => { const d = cleaned(); return { ...d, accounts: d.accounts.map(a => (a.id === 'bank' ? { ...a, bal } : a)) }; };
  it('the leftover given up comes off the shortfall, peso for peso, and nothing else changes', () => {
    const d0 = short(420000), before = monthSummary(d0, c);
    expect(before.real).toBe(44500);
    const parts = suggestCover(d0, c);
    expect(parts).toEqual({ salidas: 44500 }); // biggest leftover first, only what's needed
    const d1 = apply(d0, coverWith(d0, c, parts)!), after = monthSummary(d1, c);
    expect(after.real).toBe(0);
    expect(after.toSpend).toBe(before.toSpend - 44500);
    expect([after.income, after.plan, after.balance]).toEqual([before.income, before.plan, before.balance]);
    expect(pocketStats(d1, 'salidas', c)!.left).toBe(64000 - 44500);
    expect(d1.moves.filter(m => m.to === COVER)).toHaveLength(1);
  });
  it('when leftovers are not enough, it uses them all and says what is still missing', () => {
    const d0 = short(361058 - 60558); // $300.500 in the bank
    const parts = suggestCover(d0, c);
    expect(parts).toEqual({ salidas: 64000, wagon: 18500, lunch: 16000 });
    const d1 = apply(d0, coverWith(d0, c, parts)!);
    expect(monthSummary(d1, c).real).toBe(monthSummary(d0, c).real - 98500);
  });
  it('can\'t give up more than a pocket has left; next week every pocket starts again', () => {
    const d0 = short(420000);
    expect(coverWith(d0, c, { lunch: 16001 })).toBeNull();
    const d1 = apply(d0, coverWith(d0, c, { salidas: 30000, lunch: 10000 })!);
    const next = makeCtx(4, '2026-11-11');
    expect(pocketStats(d1, 'salidas', next)!.budget).toBe(65000);
    expect(pocketStats(d1, 'lunch', next)!.budget).toBe(32000);
  });
  it('no shortfall, no suggestion', () => {
    expect(suggestCover(short(900000), c)).toEqual({});
  });
});

describe('covering an over-budget pocket from the others', () => {
  it('takes from the pockets with the most left, and the total of all pockets stays the same', async () => {
    const { sampleData } = await import('./seed');
    const { makeCtx } = await import('./dates');
    const { pocketStats } = await import('./derive');
    const { overBy, refillFrom, suggestRefill } = await import('./plan');
    const TODAY = '2026-11-11', c = makeCtx(4, TODAY), base: Data = { ...sampleData(TODAY), moves: [] };
    const d: Data = { ...base, expenses: [{ id: 'big', ts: 9, p: 'fun', a: 'a1', amt: 200000, note: 'Concert', date: TODAY, tags: [], cat: 'Entertainment', sub: '' }, ...base.expenses] };
    const left = (x: Data, id: string) => pocketStats(x, id, c)!.left;
    const total = (x: Data) => x.pockets.reduce((a, p) => a + left(x, p.id), 0);
    const over = overBy(d, c, 'fun');
    expect(over).toBe(-left(d, 'fun'));
    expect(over).toBeGreaterThan(0);
    const sug = suggestRefill(d, c, 'fun');
    expect(Object.values(sug).reduce((a, v) => a + v, 0)).toBe(over);
    expect(sug.fun).toBeUndefined();
    const after = { ...d, ...refillFrom(d, c, 'fun', sug)! };
    expect(left(after, 'fun')).toBe(0);
    expect(total(after)).toBe(total(d));
    expect(after.accounts).toEqual(d.accounts);
    // Never more than a pocket has left, and never from itself.
    expect(refillFrom(d, c, 'fun', { groc: left(d, 'groc') + 1 })).toBeNull();
    expect(refillFrom(d, c, 'fun', { fun: 10 })).toBeNull();
    expect(overBy(d, c, 'groc')).toBe(0);
  });
});

describe('refilling across pocket kinds, mid-period start and cents', () => {
  // Wed 18 Nov 2026: week Mon 16 Nov, second quincena (16th-30th). Hand-built data.
  const T = '2026-11-18', cc = makeCtx(4, T);
  const exp = (id: string, p: string, amt: number) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date: T, tags: [], cat: 'Other', sub: '' });
  const mk = (pockets: Data['pockets'], expenses: Data['expenses'], cur: Data['settings']['currency'] = 'COP'): Data => {
    const e = emptyData(sampleData(T));
    return { ...e, settings: { ...e.settings, currency: cur, weeks: 4 }, pockets, expenses, moves: [], incomes: [], accounts: [{ id: 'bank', name: 'B', kind: 'Checking', type: 'bank', bal: 1000000, hue: 85 }] };
  };
  const left = (d: Data, id: string) => pocketStats(d, id, cc)!.left;
  const total = (d: Data) => d.pockets.reduce((a, p) => a + left(d, p.id), 0);
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, v) => a + v, 0);

  it('weekly pocket over by 30000 is refilled from a 15-day pocket (matched by day)', () => {
    // wk 100000 - 130000 = -30000; half 200000 - 50000 = 150000 left
    const d = mk([{ id: 'w', name: 'W', weeklyStr: '100000', hue: 1 }, { id: 'h', name: 'H', weeklyStr: '200000', hue: 2, period: 'half' }], [exp('a', 'w', 130000), exp('b', 'h', 50000)]);
    expect(overBy(d, cc, 'w')).toBe(30000);
    const sug = suggestRefill(d, cc, 'w');
    expect(sug).toEqual({ h: 30000 });
    const a = { ...d, ...refillFrom(d, cc, 'w', sug)! };
    expect(left(a, 'w')).toBe(0); expect(left(a, 'h')).toBe(120000); expect(total(a)).toBe(total(d));
    expect(a.accounts).toEqual(d.accounts);
  });

  it('15-day pocket over budget is refilled from weekly pockets; next week the weekly source starts fresh', () => {
    const d = mk([{ id: 'h', name: 'H', weeklyStr: '100000', hue: 2, period: 'half' }, { id: 'w', name: 'W', weeklyStr: '70000', hue: 1 }, { id: 'v', name: 'V', weeklyStr: '40000', hue: 3 }], [exp('b', 'h', 160000)]);
    expect(overBy(d, cc, 'h')).toBe(60000);
    const sug = suggestRefill(d, cc, 'h'); // w has 70000 -> takes 60000 from the biggest
    expect(sug).toEqual({ w: 60000 });
    const a = { ...d, ...refillFrom(d, cc, 'h', sug)! };
    expect(left(a, 'h')).toBe(0); expect(left(a, 'w')).toBe(10000); expect(total(a)).toBe(total(d));
    const nextWeek = makeCtx(4, '2026-11-25');
    expect(pocketStats(a, 'w', nextWeek)!.left).toBe(70000);
  });

  it('a mid-period start counts: only what the new pocket really has can be taken', () => {
    const d = mk([{ id: 'o', name: 'O', weeklyStr: '50000', hue: 1 }, { id: 'n', name: 'N', weeklyStr: '140000', hue: 2, start: { from: '2026-11-16', amt: 80000 } }], [exp('a', 'o', 90000)]);
    expect(left(d, 'n')).toBe(80000);
    expect(suggestRefill(d, cc, 'o')).toEqual({ n: 40000 });
    expect(refillFrom(d, cc, 'o', { n: 80001 })).toBeNull();
    const a = { ...d, ...refillFrom(d, cc, 'o', { n: 40000 })! };
    expect(left(a, 'n')).toBe(40000); expect(left(a, 'o')).toBe(0);
  });

  it('euro cents: the suggestion adds up exactly to the overspend', () => {
    const d = mk([{ id: 'o', name: 'O', weeklyStr: '10.10', hue: 1 }, { id: 'x', name: 'X', weeklyStr: '3.33', hue: 2 }, { id: 'y', name: 'Y', weeklyStr: '13.34', hue: 3 }], [exp('a', 'o', 17.07)], '€');
    const over = overBy(d, cc, 'o');
    expect(over).toBe(6.97);
    const sug = suggestRefill(d, cc, 'o');
    expect(Math.round(sum(sug) * 100)).toBe(697);
    expect(sug.o).toBeUndefined();
    const p = refillFrom(d, cc, 'o', sug);
    expect(p).not.toBeNull();
    expect(Math.abs(left({ ...d, ...p! }, 'o'))).toBeLessThan(0.005);
  });

  it('not over budget -> empty suggestion; sources run out -> partial', () => {
    const d = mk([{ id: 'o', name: 'O', weeklyStr: '1000', hue: 1 }, { id: 'x', name: 'X', weeklyStr: '300', hue: 2 }], [exp('a', 'o', 1900)]);
    expect(suggestRefill(d, cc, 'x')).toEqual({});
    expect(suggestRefill(d, cc, 'o')).toEqual({ x: 300 });
  });
});
