import { describe, expect, it } from 'vitest';
import { balances, personTotals, settleUp, sharesOf, splitProblem, type Member, type TripItem } from './settle';

const M: Member[] = [{ id: 'me', name: 'Santi' }, { id: 'ana', name: 'Ana' }, { id: 'juan', name: 'Juan' }, { id: 'g:caro', name: 'Caro' }];
let n = 0;
const exp = (paidBy: string, amount: number, among: string[], mode: 'equal' | 'amounts' | 'percent' = 'equal', values?: Record<string, number>): TripItem =>
  ({ id: 'i' + n++, kind: 'expense', desc: 'x', amount, date: '2026-11-05', createdBy: paidBy, createdAt: n, paidBy, split: { mode, among, values } });
const pay = (from: string, to: string, amount: number): TripItem => ({ id: 'p' + n++, kind: 'payment', desc: 'Payment', amount, date: '2026-11-05', createdBy: from, createdAt: n, paidBy: from, to });
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, x) => a + x, 0);

describe('splitting one expense', () => {
  it('equal shares add up exactly, leftover pesos go to the first people', () => {
    expect(sharesOf(exp('me', 100000, ['me', 'ana', 'juan']))).toEqual({ me: 33334, ana: 33333, juan: 33333 });
  });
  it('percent and fixed amounts', () => {
    expect(sharesOf(exp('me', 200000, ['me', 'ana'], 'percent', { me: 25, ana: 75 }))).toEqual({ me: 50000, ana: 150000 });
    expect(sharesOf(exp('me', 90000, ['ana', 'juan'], 'amounts', { ana: 60000, juan: 30000 }))).toEqual({ ana: 60000, juan: 30000 });
  });
  it('flags splits that do not add up', () => {
    expect(splitProblem(90000, 'amounts', ['ana', 'juan'], { ana: 60000, juan: 20000 })).toMatch(/add up/);
    expect(splitProblem(90000, 'percent', ['ana', 'juan'], { ana: 50, juan: 40 })).toMatch(/100%/);
    expect(splitProblem(90000, 'equal', [], {})).toMatch(/at least one/);
    expect(splitProblem(90000, 'percent', ['ana', 'juan'], { ana: 50, juan: 50 })).toBeNull();
  });
});

describe('balances and settling up', () => {
  const items = [
    exp('me', 300000, ['me', 'ana', 'juan', 'g:caro']), // hotel
    exp('ana', 120000, ['me', 'ana', 'juan']), // dinner
    exp('juan', 60000, ['juan', 'g:caro']), // taxi
    exp('g:caro', 80000, ['me', 'ana', 'juan', 'g:caro'], 'percent', { me: 25, ana: 25, juan: 25, 'g:caro': 25 })
  ];
  it('balances add up to zero', () => {
    const b = balances(M, items);
    expect(sum(b)).toBe(0);
    expect(b).toEqual({ me: 300000 - 75000 - 40000 - 20000, ana: 120000 - 75000 - 40000 - 20000, juan: 60000 - 75000 - 40000 - 30000 - 20000, 'g:caro': 80000 - 75000 - 30000 - 20000 });
  });
  it('settle-up payments make everyone even with few payments', () => {
    const b = balances(M, items), plan = settleUp(b);
    expect(plan.length).toBeLessThanOrEqual(M.length - 1);
    const after = balances(M, [...items, ...plan.map(p => pay(p.from, p.to, p.amount))]);
    Object.values(after).forEach(v => expect(v).toBe(0));
    plan.forEach(p => expect(Number.isInteger(p.amount)).toBe(true));
  });
  it('marking a payment as done updates who owes what', () => {
    const b = balances(M, [exp('me', 100000, ['me', 'ana']), pay('ana', 'me', 30000)]);
    expect(b).toEqual({ me: 20000, ana: -20000, juan: 0, 'g:caro': 0 });
    expect(settleUp(b)).toEqual([{ from: 'ana', to: 'me', amount: 20000 }]);
  });
  it('random trips always settle to zero', () => {
    for (let t = 0; t < 200; t++) {
      const its: TripItem[] = [];
      for (let k = 0; k < 8; k++) {
        const among = M.map(m => m.id).filter((_, i) => (t * 7 + k * 3 + i) % 3 !== 0);
        its.push(exp(M[(t + k) % 4].id, 1000 + ((t * 977 + k * 131) % 500000), among.length ? among : ['me']));
      }
      const b = balances(M, its);
      expect(sum(b)).toBe(0);
      const after = balances(M, [...its, ...settleUp(b).map(p => pay(p.from, p.to, p.amount))]);
      Object.values(after).forEach(v => expect(v).toBe(0));
    }
  });
  it('person totals', () => {
    expect(personTotals('me', items)).toEqual({ share: 75000 + 40000 + 20000, paid: 300000 });
  });
});

describe('trip spending summary', () => {
  it('total, my share and everyone\'s shares add up; payments are not spending', async () => {
    const { tripSpending, tripMonths } = await import('./settle');
    const its = [exp('me', 300000, ['me', 'ana', 'juan']), exp('ana', 90000, ['ana', 'juan']), pay('juan', 'me', 50000)];
    its[1].date = '2026-10-20';
    const all = tripSpending(M, its, 'me', 'all');
    expect(all.total).toBe(390000);
    expect(all.mine).toBe(100000);
    expect(all.people.reduce((a, p) => a + p.share, 0)).toBe(all.total);
    expect(all.pct).toBeCloseTo(100000 / 390000, 6);
    const nov = tripSpending(M, its, 'me', '2026-11');
    expect([nov.total, nov.mine, nov.count]).toEqual([300000, 100000, 1]);
    expect(tripMonths(its)).toEqual(['2026-10', '2026-11']);
  });
});
