import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { setData } from './store';
import { makeBills, makeIncome, suggestPockets } from './setup';

const setCurrency = (c: string) => setData(x => ({ settings: { ...x.settings, currency: c as never } }));
const netflix = (amt: number) => [{ key: 'x', name: 'Netflix', kind: 'Subscription' as const, cat: 'Fun', sub: 'x', on: true, amt, day: 5 }];

describe('setup in a currency with cents', () => {
  afterEach(() => setCurrency('COP'));
  it('suggests non-zero pocket amounts for a USD income', () => {
    setCurrency('USD');
    expect(suggestPockets(3000).map(p => p.monthly).slice(0, 4)).toEqual([660, 300, 240, 180]);
  });
  it('keeps cents in a salary and a bill', () => {
    setCurrency('USD');
    expect(makeIncome(3500.5, 'month', 1, 'a').bills[0].amt).toBe(3500.5);
    expect(makeBills(netflix(9.99) as never, 'a')[0].amt).toBe(9.99);
  });
  it('a quincena splits to the cent and adds back up', () => {
    setCurrency('EUR');
    const [a, b] = makeIncome(1000.01, 'half', 1, 'a').bills;
    expect([a.amt, b.amt]).toEqual([500, 500.01]);
  });
  it('pesos are unchanged: steps of 5.000, whole pesos', () => {
    expect(suggestPockets(1_100_000)[0].monthly).toBe(240_000);
    expect(makeIncome(1_100_001, 'half', 1, 'a').bills.map(b => b.amt)).toEqual([550_000, 550_001]);
  });
});
