import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { runInterest } from './interest';

const cajita = (bal: number, accruedTo: string) =>
  ({ accounts: [{ id: 'nu', name: 'NU', kind: 'Savings', type: 'savings', bal, hue: 0, rate: 9.35, accruedTo }], incomes: [] }) as unknown as Data;

describe('interest matches Nu Cajitas', () => {
  it('one day at 9,35% E.A. adds what Nu added (real case, Nov 2026)', () => {
    // Nu: $518.222,98 one day, $518.349,89 the next.
    const out = runInterest(cajita(518222.98, '2026-11-19'), '2026-11-20')!;
    expect(out.accounts![0].bal).toBeCloseTo(518349.89, 0);
  });

  it('several missed days compound the same as one day at a time', () => {
    let d = cajita(1_000_000, '2026-11-01');
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-04']) d = { ...d, ...runInterest(d, day) };
    const once = runInterest(cajita(1_000_000, '2026-11-01'), '2026-11-04')!;
    expect(once.accounts![0].bal).toBeCloseTo(d.accounts[0].bal, 6);
  });
});

describe('withholding (retención en la fuente)', () => {
  const big = (currency?: string) => ({ ...cajita(20_000_000, '2026-11-19'), settings: { currency } }) as unknown as Data;
  const gross = 20_000_000 * (Math.pow(1.0935, 1 / 365) - 1); // about $4.898 a day, over the $2.880 line

  it('keeps 7% of the day when interest is over 0,055 UVT', () => {
    const out = runInterest(big('COP'), '2026-11-20')!;
    expect(out.accounts![0].bal - 20_000_000).toBeCloseTo(gross * 0.93, 6);
  });

  it('does not apply outside Colombian pesos', () => {
    const out = runInterest(big('USD'), '2026-11-20')!;
    expect(out.accounts![0].bal - 20_000_000).toBeCloseTo(gross, 6);
  });

  it('does not apply under the daily line', () => {
    const out = runInterest({ ...cajita(518222.98, '2026-11-19'), settings: { currency: 'COP' } } as unknown as Data, '2026-11-20')!;
    expect(out.accounts![0].bal).toBeCloseTo(518349.89, 0);
  });
});
