import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyData, sampleData } from './seed';
import { addFund, addFundMove, closeFund, deleteFund, deleteFundMove, fundView, fundsOf, fundsTotal } from './funds';
import type { Data } from './types';

const base = (): Data => { const e = emptyData(sampleData()); return { ...e, settings: { ...e.settings, currency: 'COP' }, accounts: [{ id: 'bank', name: 'Bancolombia', kind: 'Checking', type: 'bank', bal: 5_000_000, hue: 85 }] }; };
const apply = (d: Data, p: Partial<Data>): Data => ({ ...d, ...p });
const info = { name: 'Fiducuenta', manager: 'Fiduciaria Bancolombia', kind: 'vista' as const, risk: 'low' as const, currency: 'COP' as const, hue: 195, rate: 9, fee: 1.5, liquidity: 'vista' as const, start: '2026-01-01' };

describe('investment funds', () => {
  it('a contribution from an account moves the money and grows at the fund return', () => {
    const d1 = apply(base(), addFund(base(), info, { amt: 1_000_000, date: '2026-01-01', acct: 'bank' }, null));
    expect(d1.accounts[0].bal).toBe(4_000_000);
    expect(d1.payments).toHaveLength(1);
    const v = fundView(fundsOf(d1)[0], '2027-01-01');
    expect(v.invested).toBe(1_000_000);
    expect(Math.round(v.value)).toBe(1_090_000); // 9% E.A. over exactly a year
    expect(v.estimated).toBe(true);
  });
  it('a statement balance replaces the estimate; later money adds on top', () => {
    let d = apply(base(), addFund(base(), info, { amt: 1_000_000, date: '2026-01-01' }, null));
    const id = fundsOf(d)[0].id;
    d = apply(d, addFundMove(d, id, { date: '2026-07-01', kind: 'value', amt: 1_030_000 }));
    expect(Math.round(fundView(fundsOf(d)[0], '2026-07-01').value)).toBe(1_030_000);
    d = apply(d, addFundMove(d, id, { date: '2026-07-01', kind: 'in', amt: 500_000 }));
    const v = fundView(fundsOf(d)[0], '2026-07-01');
    expect(Math.round(v.value)).toBe(1_530_000);
    expect(v.invested).toBe(1_500_000);
    expect(Math.round(v.gain)).toBe(30_000);
  });
  it('a withdrawal to an account brings the money back; deleting it undoes that', () => {
    let d = apply(base(), addFund(base(), info, { amt: 1_000_000, date: '2026-01-01', acct: 'bank' }, null));
    const id = fundsOf(d)[0].id;
    d = apply(d, addFundMove(d, id, { date: '2026-02-01', kind: 'out', amt: 200_000, acct: 'bank' }));
    expect(d.accounts[0].bal).toBe(4_200_000);
    const out = fundsOf(d)[0].moves.find(m => m.kind === 'out')!;
    d = apply(d, deleteFundMove(d, id, out.id));
    expect(d.accounts[0].bal).toBe(4_000_000);
    expect(d.payments).toHaveLength(1);
  });
  it('deleting a fund gives everything back to the accounts', () => {
    let d = apply(base(), addFund(base(), info, { amt: 1_000_000, date: '2026-01-01', acct: 'bank' }, null));
    d = apply(d, deleteFund(d, fundsOf(d)[0].id));
    expect(d.accounts[0].bal).toBe(5_000_000);
    expect(d.payments).toHaveLength(0);
    expect(fundsOf(d)).toHaveLength(0);
  });
  it('closing takes the whole value out and the fund stops counting', () => {
    let d = apply(base(), addFund(base(), { ...info, rate: undefined }, { amt: 1_000_000, date: '2026-01-01', acct: 'bank' }, { amt: 1_050_000, date: '2026-06-01' }));
    d = apply(d, closeFund(d, fundsOf(d)[0].id, 'bank', '2026-06-01'));
    expect(d.accounts[0].bal).toBe(5_050_000);
    expect(fundsTotal(d)).toBe(0);
  });
  it('lock-in date and dollar funds in pesos', () => {
    const d = apply(base(), addFund(base(), { ...info, currency: 'USD', liquidity: 'lock', lockDays: 90, rate: undefined }, { amt: 1000, date: '2026-01-01' }, null));
    expect(fundView(fundsOf(d)[0]).freeFrom).toBe('2026-04-01');
    expect(fundsTotal({ ...d, investments: { ...d.investments, usdRate: 4000 } })).toBe(4_000_000);
  });
});
