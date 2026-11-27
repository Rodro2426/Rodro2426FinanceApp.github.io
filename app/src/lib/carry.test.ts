import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data, Pocket } from './types';
import { makeCtx } from './dates';
import { emptyData, sampleData } from './seed';
import { monthStats, moveMax, pocketStats } from './derive';
import { NEXT, transferLeftover } from './plan';

const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function data(pockets: Pocket[], expenses: ReturnType<typeof exp>[] = []): Data {
  const e = emptyData(sampleData());
  return {
    ...e, settings: { ...e.settings, currency: 'COP', weeks: 4 }, incomeStr: '2000000', pockets,
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 2000000, hue: 85 }],
    expenses, incomes: [], moves: [], goals: []
  };
}
const W = (carry?: string): Pocket => ({ id: 'w', name: 'Lunch', weeklyStr: '100000', hue: 60, ...(carry ? { carry } : {}) });
const bud = (d: Data, day: string, id = 'w') => pocketStats(d, id, makeCtx(4, day))!;

describe('carry over: weekly pocket', () => {
  // Week pieces of November: Nov 1, 2–8, 9–15, 16–22, 23–29, Nov 30 (cut where the month ends); December starts with Dec 1–6.
  it('unspent money moves into the next week', () => {
    const d = data([W('2026-11-02')], [exp('a', 'w', 50000, '2026-11-03')]);
    expect(bud(d, '2026-11-04').carry).toBe(0);
    expect(bud(d, '2026-11-10').budget).toBe(150000);
    expect(bud(d, '2026-11-10').carry).toBe(50000);
  });
  it('an overspend lowers next week', () => {
    const d = data([W('2026-11-02')], [exp('a', 'w', 120000, '2026-11-03')]);
    expect(bud(d, '2026-11-10').budget).toBe(80000);
  });
  it('keeps going over 3 weeks', () => {
    const d = data([W('2026-11-02')], [exp('a', 'w', 50000, '2026-11-03'), exp('b', 'w', 130000, '2026-11-10'), exp('c', 'w', 10000, '2026-11-17')]);
    expect(bud(d, '2026-11-10').budget).toBe(150000);
    expect(bud(d, '2026-11-17').budget).toBe(120000); // 100 + (150 − 130)
    expect(bud(d, '2026-11-24').budget).toBe(210000); // 100 + (120 − 10)
  });
  it('crosses a month boundary', () => {
    const d = data([W('2026-11-23')], [exp('a', 'w', 40000, '2026-11-24')]);
    // Nov 30 (1/7 = 14.286, unspent) + the 60.000 left of Nov 23–29 carry into Dec 1–6 (85.714): 160.000, nothing lost at the cut.
    expect(bud(d, '2026-12-01').budget).toBe(160000);
  });
  it('off: nothing changes', () => {
    const d = data([W()], [exp('a', 'w', 50000, '2026-11-03')]);
    expect(bud(d, '2026-11-10')).toMatchObject({ budget: 100000, carry: 0 });
  });
  it('turned on this week: none now, next week yes', () => {
    const d = data([W('2026-11-09')], [exp('a', 'w', 10000, '2026-11-03'), exp('b', 'w', 30000, '2026-11-10')]);
    expect(bud(d, '2026-11-11').carry).toBe(0);
    expect(bud(d, '2026-11-17').carry).toBe(70000);
  });
  it('month budget gets the carry into its first week', () => {
    const d = data([W('2026-11-02')], [exp('a', 'w', 50000, '2026-11-03')]);
    // December carries into Dec 1: the Nov 2 week's 50.000 + Nov 9, 16, 23 unspent (300.000) + Nov 30 (a 1-day week, 14.286) = 364.286.
    // December's own plan: 85.714 (Dec 1–6) + 3 whole weeks + 57.143 (Dec 28–31) = 442.857.
    const dec = monthStats(d, 'w', makeCtx(4, '2026-12-10'));
    expect(dec.budget).toBe(442857 + 364286);
    // Nov: 14.286 (Nov 1) + 4 whole weeks + 14.286 (Nov 30); carry starts Nov 2, so none comes in.
    expect(monthStats(d, 'w', makeCtx(4, '2026-11-12')).budget).toBe(428572);
  });
});

describe('carry over: 15-day pocket', () => {
  const Q: Pocket = { id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half', carry: '2026-11-03' };
  it('quincena 1 leftover goes to quincena 2', () => {
    const d = data([Q], [exp('a', 'q', 100000, '2026-11-05')]);
    expect(bud(d, '2026-11-12', 'q').carry).toBe(0);
    expect(bud(d, '2026-11-20', 'q').budget).toBe(500000);
    expect(bud(d, '2026-12-02', 'q').budget).toBe(800000 - 0); // 300 + (500 − 0)
    expect(monthStats(d, 'q', makeCtx(4, '2026-12-03')).budget).toBe(600000 + 500000);
  });
});

describe('send to next week', () => {
  it('leaves this week and arrives next week, with or without carry', () => {
    for (const carry of [undefined, '2026-11-02']) {
      const d0 = data([W(carry)]), c = makeCtx(4, '2026-11-11');
      const d = { ...d0, ...transferLeftover(d0, c, 'w', { [NEXT]: 40000 })! };
      expect(d.moves[0]).toMatchObject({ from: 'w', to: 'w', amt: 40000, next: true });
      const extra = carry ? 100000 : 0; // carry: week 1 left 100.000 flows into week 2
      expect(bud(d, '2026-11-11').budget).toBe(100000 + extra - 40000);
      expect(bud(d, '2026-11-18').budget).toBe(carry ? 300000 : 140000);
    }
  });
  it('rejects more than what is left', () => {
    const d = data([W()]);
    expect(transferLeftover(d, makeCtx(4, '2026-11-11'), 'w', { [NEXT]: 100001 })).toBeNull();
  });
  it('edited from the arrival side (made last week): max is the amount itself, it cannot be raised', () => {
    const d0 = data([W()]);
    const d = { ...d0, ...transferLeftover(d0, makeCtx(4, '2026-11-11'), 'w', { [NEXT]: 40000 })! };
    expect(moveMax(d, d.moves[0], makeCtx(4, '2026-11-18'))).toBe(40000);
  });
  it('month stats: cancels inside a month, moves to the next month when crossing', () => {
    const d0 = data([W()]);
    const inMonth = { ...d0, ...transferLeftover(d0, makeCtx(4, '2026-11-11'), 'w', { [NEXT]: 40000 })! };
    expect(monthStats(inMonth, 'w', makeCtx(4, '2026-11-11')).budget).toBe(428572);
    // Week Nov 23–29 -> Mon Nov 30 (a 1-day November week): nothing changes in November.
    const still = { ...d0, ...transferLeftover(d0, makeCtx(4, '2026-11-25'), 'w', { [NEXT]: 40000 })! };
    expect(monthStats(still, 'w', makeCtx(4, '2026-11-11')).budget).toBe(428572);
    // Mon Nov 30 (November, 1 day: 14.286) -> Tue Dec 1 (December): it leaves November and arrives in December.
    const cross = { ...d0, ...transferLeftover(d0, makeCtx(4, '2026-11-30'), 'w', { [NEXT]: 10000 })! };
    expect(monthStats(cross, 'w', makeCtx(4, '2026-11-11')).budget).toBe(418572);
    expect(monthStats(cross, 'w', makeCtx(4, '2026-12-10')).budget).toBe(452857);
    expect(bud(cross, '2026-12-01').budget).toBe(85714 + 10000);
    // Dec 2 (December) -> Dec 7 (December): December keeps its 442.857.
    const inDec = { ...d0, ...transferLeftover(d0, makeCtx(4, '2026-12-02'), 'w', { [NEXT]: 40000 })! };
    expect(monthStats(inDec, 'w', makeCtx(4, '2026-11-11')).budget).toBe(428572);
    expect(monthStats(inDec, 'w', makeCtx(4, '2026-12-10')).budget).toBe(442857);
  });
});

describe('carry over: edge cases', () => {
  it('15-day pocket with a smaller first quincena (p.start) carries what is really left', () => {
    // Created Nov 10 with 100.000 for quincena 1 (normal 300.000); carry on from then. Nothing spent.
    const Q: Pocket = { id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half', carry: '2026-11-01', start: { from: '2026-11-01', amt: 100000 } };
    const d = data([Q]);
    expect(bud(d, '2026-11-05', 'q').budget).toBe(100000);
    expect(bud(d, '2026-11-20', 'q').budget).toBe(400000); // 300 + 100 carried
    expect(bud(d, '2026-12-02', 'q').budget).toBe(700000); // 300 + (400 − 0)
  });
  it('February: the second quincena ends on the 28th and carries into March', () => {
    const Q: Pocket = { id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half', carry: '2027-02-01' };
    const d = data([Q], [exp('a', 'q', 100000, '2027-02-28')]);
    expect(bud(d, '2027-02-20', 'q').budget).toBe(600000);
    expect(bud(d, '2027-03-02', 'q').budget).toBe(300000 + 600000 - 100000);
  });
  it('carry is counted once in the month: a month with carry on from before shows left = plan − spent + entry carry', () => {
    const d = data([W('2026-11-02')], [exp('a', 'w', 50000, '2026-11-03'), exp('b', 'w', 20000, '2026-11-10')]);
    const m = monthStats(d, 'w', makeCtx(4, '2026-11-12'));
    expect(m.budget).toBe(428572); // 14.286 + 4 × 100.000 + 14.286, no carry in
    expect(m.left).toBe(358572);
  });
  it('overspend carries into the next month as a negative', () => {
    const d = data([W('2026-11-02')], [exp('a', 'w', 600000, '2026-11-25')]);
    // weeks Nov 2, 9, 16 unspent (+300); Nov 23–29: 100 + 300 − 600 = −200; Nov 30 (1 day, +14.286) → carry into Dec 1 = −185.714
    expect(bud(d, '2026-12-02').carry).toBe(-185714);
    expect(monthStats(d, 'w', makeCtx(4, '2026-12-10')).budget).toBe(442857 - 185714);
  });
  it('data replaced on change: new object, new numbers (memo not stale)', () => {
    const d = data([W('2026-11-02')]);
    expect(bud(d, '2026-11-10').budget).toBe(200000);
    const d2 = { ...d, expenses: [exp('a', 'w', 60000, '2026-11-03')] };
    expect(bud(d2, '2026-11-10').budget).toBe(140000);
    expect(bud(d, '2026-11-10').budget).toBe(200000);
  });
  it('a long chain (3 years of weeks) is fast', () => {
    const d = data([W('2023-01-02')]);
    const t = Date.now();
    expect(bud(d, '2026-01-05').carry).toBe(100000 * 157);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe('next-move + carry on a 15-day pocket, week straddling the month end', () => {
  it('Nov 30 -> Dec: the amount must not be lost from December', () => {
    const Q: Pocket = { id: 'q', name: 'Market', weeklyStr: '300000', hue: 150, period: 'half', carry: '2026-11-01' };
    const d0 = data([Q]);
    const d = { ...d0, ...transferLeftover(d0, makeCtx(4, '2026-11-30'), 'q', { [NEXT]: 50000 })! };
    // Q1 carries 300; Q2 = 300 + 300 − 50 out; carry into Dec 1 = 300 + 250 = 550; Dec 1 quincena = 300 + 550 + 50 arriving.
    expect(bud(d, '2026-12-02', 'q').budget).toBe(900000);
    // December month: plan 600 + carry 550 + the 50 that arrives = 1.200
    expect(monthStats(d, 'q', makeCtx(4, '2026-12-03')).budget).toBe(1200000);
  });
});
