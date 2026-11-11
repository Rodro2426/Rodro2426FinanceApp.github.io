import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data, Debt } from './types';
import { emptyData, sampleData } from './seed';
import { addDebtPay, debtOutlook, debtTotals, deleteDebt, leftOf, saveDebt } from './debts';
import { acctTxns } from './derive';
import { netWorth } from './networth';
import { monthSummary } from './plan';
import { makeCtx } from './dates';
import { netWorthAt } from './reports';

const TODAY = '2026-11-11';
function data(owedInNetWorth = false): Data {
  const e = emptyData(sampleData(TODAY));
  return {
    ...e,
    settings: { ...e.settings, currency: 'COP', owedInNetWorth },
    pockets: [], expenses: [], incomes: [], moves: [], goals: [], payments: [], bills: [], debts: [],
    accounts: [
      { id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 1000000, hue: 85 },
      { id: 'visa', name: 'Visa', kind: 'Credit', type: 'card', bal: 0, limit: 5000000, due: 'Nov 25', hue: 250 }
    ]
  };
}
const juan = (p: Partial<Debt> = {}): Debt => ({ id: 'j', ts: 1, dir: 'owed', name: 'Juan', amt: 78000, date: '2026-11-10', acct: 'visa', pays: [], ...p });
const apply = (d: Data, p: Partial<Data> | null) => ({ ...d, ...(p ?? {}) });
const bal = (d: Data, id: string) => d.accounts.find(a => a.id === id)!.bal;

describe('debts: Juan owes me 78.000 that I paid with my card', () => {
  it('the card owes more, and it is not spending', () => {
    const d = apply(data(), saveDebt(data(), juan()));
    expect(bal(d, 'visa')).toBe(78000);
    expect(d.expenses).toHaveLength(0);
    expect(debtTotals(d).owedToMe).toBe(78000);
  });
  it('net worth looks lost without the switch, and whole with it', () => {
    const off = apply(data(false), saveDebt(data(false), juan()));
    const on = apply(data(true), saveDebt(data(true), juan()));
    expect(netWorth(off).total).toBe(1000000 - 78000);
    expect(netWorth(on).total).toBe(1000000);
    expect(netWorthAt(on, TODAY)).toBe(1000000);
    expect(netWorthAt(on, '2026-11-09')).toBe(1000000); // before the loan
  });
  it('pockets do not change if Juan pays back before the card is due', () => {
    const base = data(), c = makeCtx(4, TODAY);
    const d = apply(base, saveDebt(base, juan({ due: '2026-11-20' })));
    expect(monthSummary(d, c).balance).toBe(monthSummary(base, c).balance);
    expect(debtOutlook(d, TODAY)).toMatchObject({ backInTime: 78000, late: 0 });
  });
  it('pockets have to cover it if Juan pays after the card is due (or gives no date)', () => {
    const base = data(), c = makeCtx(4, TODAY);
    for (const due of ['2026-12-05', undefined]) {
      const d = apply(base, saveDebt(base, juan({ due })));
      expect(monthSummary(d, c).balance).toBe(monthSummary(base, c).balance - 78000);
      expect(debtOutlook(d, TODAY).late).toBe(78000);
    }
  });
  it('lending from the bank: back this month is fine, next month is not', () => {
    const base = data(), c = makeCtx(4, TODAY);
    const soon = apply(base, saveDebt(base, juan({ acct: 'bank', due: '2026-11-28' })));
    const later = apply(base, saveDebt(base, juan({ acct: 'bank', due: '2026-12-03' })));
    expect(bal(soon, 'bank')).toBe(922000);
    expect(monthSummary(soon, c).balance).toBe(monthSummary(base, c).balance);
    expect(monthSummary(later, c).balance).toBe(monthSummary(base, c).balance - 78000);
  });
  it('paying back moves the money in, partly or fully, and never more than owed', () => {
    let d = apply(data(), saveDebt(data(), juan()));
    d = apply(d, addDebtPay(d, 'j', { id: 'p1', ts: 2, amt: 30000, date: '2026-11-12', acct: 'bank' }));
    expect(bal(d, 'bank')).toBe(1030000);
    expect(leftOf(d.debts![0])).toBe(48000);
    expect(addDebtPay(d, 'j', { id: 'p2', ts: 3, amt: 50000, date: '2026-11-13', acct: 'bank' })).toBeNull();
    d = apply(d, addDebtPay(d, 'j', { id: 'p2', ts: 3, amt: 48000, date: '2026-11-13', acct: 'bank' }));
    expect(debtTotals(d).owedToMe).toBe(0);
  });
  it('editing and deleting undo the old account moves', () => {
    let d = apply(data(), saveDebt(data(), juan()));
    d = apply(d, saveDebt(d, juan({ amt: 100000, acct: 'bank' })));
    expect(bal(d, 'visa')).toBe(0);
    expect(bal(d, 'bank')).toBe(900000);
    d = apply(d, deleteDebt(d, 'j'));
    expect(bal(d, 'bank')).toBe(1000000);
    expect(d.debts).toHaveLength(0);
  });
  it('the account history shows it, and its balances still add up', () => {
    let d = apply(data(), saveDebt(data(), juan()));
    d = apply(d, addDebtPay(d, 'j', { id: 'p1', ts: 2, amt: 78000, date: '2026-11-12', acct: 'visa' }));
    const h = acctTxns(d, 'visa');
    expect(h.list.map(t => t.note)).toEqual(['Juan paid you back', 'Lent to Juan']);
    expect(h.opening).toBe(0);
  });
});

describe('debts: I owe someone', () => {
  it('borrowed money is in the bank but not yours: net worth and pockets stay the same', () => {
    const base = data(), c = makeCtx(4, TODAY);
    const mama: Debt = { id: 'm', ts: 1, dir: 'owe', name: 'Mamá', amt: 200000, date: TODAY, acct: 'bank', pays: [] };
    const d = apply(base, saveDebt(base, mama));
    expect(bal(d, 'bank')).toBe(1200000);
    expect(netWorth(d).total).toBe(netWorth(base).total);
    expect(monthSummary(d, c).balance).toBe(monthSummary(base, c).balance);
    // Due next month: this month's pockets can use it.
    const later = apply(base, saveDebt(base, { ...mama, due: '2026-12-20' }));
    expect(monthSummary(later, c).balance).toBe(monthSummary(base, c).balance + 200000);
  });
});

describe('debts: edge cases', () => {
  it('cents: lend 10.10 and 0.20 paid back leave no float dust on EUR balances', () => {
    let d = apply(data(), { accounts: data().accounts.map(a => (a.id === 'bank' ? { ...a, bal: 100.3 } : a)) });
    d = apply(d, saveDebt(d, juan({ amt: 10.1, acct: 'bank' })));
    d = apply(d, addDebtPay(d, 'j', { id: 'p1', ts: 2, amt: 0.2, date: '2026-11-12', acct: 'bank' }));
    d = apply(d, deleteDebt(d, 'j'));
    expect(bal(d, 'bank')).toBe(100.3);
  });
  it('editing after a partial payment re-applies the payment to its own account', () => {
    let d = apply(data(), saveDebt(data(), juan({ acct: 'bank' })));
    d = apply(d, addDebtPay(d, 'j', { id: 'p1', ts: 2, amt: 30000, date: '2026-11-12', acct: 'visa' }));
    expect(bal(d, 'visa')).toBe(-30000);
    d = apply(d, saveDebt(d, { ...d.debts![0], amt: 90000 }));
    expect(bal(d, 'bank')).toBe(910000);
    expect(bal(d, 'visa')).toBe(-30000);
    d = apply(d, deleteDebt(d, 'j'));
    expect(bal(d, 'bank')).toBe(1000000);
    expect(bal(d, 'visa')).toBe(0);
  });
  it('a deleted account does not break anything', () => {
    const d0 = apply(data(), saveDebt(data(), juan()));
    const d = { ...d0, accounts: d0.accounts.filter(a => a.id !== 'visa') };
    expect(() => debtOutlook(d, TODAY)).not.toThrow();
    expect(() => deleteDebt(d, 'j')).not.toThrow();
    expect(debtOutlook(d, TODAY).late).toBe(78000);
  });
  it('a debt dated in the future is worth nothing in net worth until then, and history still reconciles', () => {
    const d = apply(data(true), saveDebt(data(true), juan({ date: '2026-12-01', acct: 'bank' })));
    expect(netWorthAt(d, '2026-11-30')).toBe(1000000);
    expect(netWorthAt(d, '2026-12-01')).toBe(1000000);
    expect(acctTxns(d, 'bank').opening).toBe(1000000);
  });
  it('netWorth and netWorthAt(today) agree with debts in both directions', () => {
    for (const on of [false, true]) {
      let d = apply(data(on), saveDebt(data(on), juan({ acct: 'bank' })));
      d = apply(d, saveDebt(d, { id: 'm', ts: 1, dir: 'owe', name: 'Mamá', amt: 50000, date: '2026-11-01', acct: 'bank', pays: [] }));
      d = apply(d, addDebtPay(d, 'j', { id: 'p1', ts: 2, amt: 8000, date: '2026-11-10', acct: 'bank' }));
      expect(netWorthAt(d, TODAY)).toBe(netWorth(d).total);
    }
  });
  it('money owed to me that is overdue and still open is not "back in time"', () => {
    const d = apply(data(), saveDebt(data(), juan({ acct: 'bank', due: '2026-11-05' })));
    expect(debtOutlook(d, TODAY).late).toBe(78000);
  });
});
