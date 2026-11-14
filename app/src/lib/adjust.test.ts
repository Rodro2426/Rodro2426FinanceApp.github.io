import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { sampleData } from './seed';
import { makeCtx } from './dates';
import { pocketStats } from './derive';
import { adjustBalance, adjustGap } from './adjust';
import { cashflow } from './reports';

const TODAY = '2026-11-14', c = makeCtx(4, TODAY);
const base = (): Data => ({ ...sampleData(TODAY), moves: [], incomes: [] });
const bal = (d: Data, id: string) => d.accounts.find(a => a.id === id)!.bal;
const apply = (d: Data, p: Partial<Data> | null): Data => ({ ...d, ...(p ?? {}) });

describe('adjusting an account to its real balance', () => {
  it('less money than Pockets thought: an expense in the chosen pocket, and the pocket has less left', () => {
    const d = base(), before = pocketStats(d, 'groc', c)!.left;
    expect(adjustGap(d, 'a1', 3200000)).toBe(50000);
    const after = apply(d, adjustBalance(d, c, 'a1', 3200000, { pocket: 'groc' }));
    expect(bal(after, 'a1')).toBe(3200000);
    expect(after.expenses[0]).toMatchObject({ amt: 50000, a: 'a1', p: 'groc', date: TODAY, note: 'Balance adjustment' });
    expect(pocketStats(after, 'groc', c)!.left).toBe(before - 50000);
    expect(cashflow(after, ['2026-11'])[0].expenses - cashflow(d, ['2026-11'])[0].expenses).toBe(50000);
  });
  it('with no pocket it still counts as spent, but no pocket changes', () => {
    const d = base(), after = apply(d, adjustBalance(d, c, 'a3', 150000));
    expect(after.expenses[0]).toMatchObject({ amt: 30000, p: '' });
    for (const p of d.pockets) expect(pocketStats(after, p.id, c)!.left).toBe(pocketStats(d, p.id, c)!.left);
  });
  it('more money than Pockets thought: an income; shared into pockets only if asked', () => {
    const d = base();
    expect(adjustGap(d, 'a1', 3350000)).toBe(-100000);
    const plain = apply(d, adjustBalance(d, c, 'a1', 3350000));
    expect(bal(plain, 'a1')).toBe(3350000);
    expect(plain.incomes[0]).toMatchObject({ amt: 100000, a: 'a1', date: TODAY, cat: 'Other income' });
    expect(plain.moves).toHaveLength(0);
    const shared = apply(d, adjustBalance(d, c, 'a1', 3350000, { toPockets: true }));
    const total = (x: Data) => x.pockets.reduce((s, p) => s + pocketStats(x, p.id, c)!.left, 0);
    expect(total(shared) - total(d)).toBe(100000);
  });
  it('credit cards go the other way: owing more is spending, owing less is money in', () => {
    const d = base();
    const more = apply(d, adjustBalance(d, c, 'c1', 1300000, { pocket: 'fun' }));
    expect(bal(more, 'c1')).toBe(1300000);
    expect(more.expenses[0]).toMatchObject({ amt: 60000, a: 'c1', p: 'fun' });
    const less = apply(d, adjustBalance(d, c, 'c1', 1200000));
    expect(bal(less, 'c1')).toBe(1200000);
    expect(less.incomes[0]).toMatchObject({ amt: 40000, a: 'c1' });
  });
  it('no difference, or an unknown account: nothing happens', () => {
    const d = base();
    expect(adjustBalance(d, c, 'a1', bal(d, 'a1'))).toBeNull();
    expect(adjustBalance(d, c, 'nope', 5)).toBeNull();
  });
  it('an account with an interest fraction ends exactly at the typed value', () => {
    const d = base();
    d.accounts = d.accounts.map(a => (a.id === 'a1' ? { ...a, bal: 3250000.4 } : a));
    expect(bal(apply(d, adjustBalance(d, c, 'a1', 3250001)), 'a1')).toBe(3250001); // gap rounds to -1
    expect(bal(apply(d, adjustBalance(d, c, 'a1', 3250000)), 'a1')).toBe(3250000); // gap rounds to 0: just snaps
    expect(bal(apply(d, adjustBalance(d, c, 'a1', 3200000, { pocket: 'groc' })), 'a1')).toBe(3200000);
  });
  it('negative typed balance on a bank account is an overdraft expense', () => {
    const d = base(), g = bal(d, 'a3') + 5000;
    const after = apply(d, adjustBalance(d, c, 'a3', -5000));
    expect(bal(after, 'a3')).toBe(-5000);
    expect(after.expenses[0].amt).toBe(g);
  });
});
