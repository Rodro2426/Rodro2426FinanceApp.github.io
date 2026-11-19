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
