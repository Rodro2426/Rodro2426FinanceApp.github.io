import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Account, Bill, Data, Expense } from './types';
import { emptyData, sampleData } from './seed';
import { cardCycle, cardDueFor, cutOnOrAfter, cutOnOrBefore, payAfter, payDayOf } from './cards';
import { cardPayAmount } from './schedule';
import { neededBy } from './debts';

// A card whose cycle ends on the 25th and is paid by the 10th of the next month.
const visa = (p: Partial<Account> = {}): Account => ({ id: 'visa', name: 'Visa', kind: 'Credit card', type: 'card', bal: 0, limit: 5000000, hue: 250, cutDay: 25, payDay: 10, ...p });
const buy = (id: string, date: string, amt: number): Expense => ({ id, ts: Number(date.replace(/-/g, '')), p: '', a: 'visa', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function data(card: Account, expenses: Expense[] = [], pays: { date: string; amt: number }[] = []): Data {
  const e = emptyData(sampleData('2026-11-14'));
  return {
    ...e, pockets: [], incomes: [], moves: [], goals: [], bills: [], debts: [], expenses,
    payments: pays.map((p, i) => ({ id: 'p' + i, ts: i, from: 'bank', to: 'visa', amt: p.amt, date: p.date })),
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 9000000, hue: 85 }, card]
  };
}

describe('billing cycle dates', () => {
  it('finds the cutoff before and after a day, and the pay-by day after a cutoff', () => {
    expect(cutOnOrBefore(25, '2026-11-14')).toBe('2026-10-25');
    expect(cutOnOrBefore(25, '2026-11-25')).toBe('2026-11-25');
    expect(cutOnOrAfter(25, '2026-11-26')).toBe('2026-12-25');
    expect(cutOnOrAfter(25, '2026-11-25')).toBe('2026-11-25');
    expect(payAfter(10, '2026-10-25')).toBe('2026-11-10');
    expect(payAfter(28, '2026-10-25')).toBe('2026-10-28'); // paid a few days after the cutoff, same month
    expect(payAfter(10, '2026-12-25')).toBe('2027-01-10');
  });
  it('a cutoff on the 31st falls on the last day of shorter months', () => {
    expect(cutOnOrBefore(31, '2027-03-05')).toBe('2027-02-28');
    expect(cutOnOrAfter(31, '2026-11-02')).toBe('2026-11-30');
  });
  it('reads the pay-by day from the old "Nov 15" text', () => {
    expect(payDayOf({ due: 'Nov 15' })).toBe(15);
    expect(payDayOf({ due: 'Nov 15', payDay: 8 })).toBe(8);
    expect(payDayOf({})).toBe(0);
  });
});

describe('what is due on a card', () => {
  it('bought after the cutoff: nothing to pay this cycle, it waits for the next statement', () => {
    const d = data(visa({ bal: 300000 }), [buy('tv', '2026-10-28', 300000)]);
    const cy = cardCycle(d, d.accounts[1], '2026-11-05');
    expect(cy).toMatchObject({ cycle: true, lastCut: '2026-10-25', nextCut: '2026-11-25', statement: 0, later: 300000, overdue: false });
    expect(cy.due).toBe('2026-12-10'); // the payment after the next cutoff
  });
  it('bought before the cutoff: due by the next pay-by day; later purchases are kept apart', () => {
    const d = data(visa({ bal: 500000 }), [buy('shoes', '2026-10-20', 200000), buy('tv', '2026-10-28', 300000)]);
    expect(cardCycle(d, d.accounts[1], '2026-11-05')).toMatchObject({ statement: 200000, later: 300000, due: '2026-11-10', overdue: false });
  });
  it('payments come off the statement first; once it is paid the next due date moves on', () => {
    const half = data(visa({ bal: 400000 }), [buy('shoes', '2026-10-20', 200000), buy('tv', '2026-10-28', 300000)], [{ date: '2026-11-02', amt: 100000 }]);
    expect(cardCycle(half, half.accounts[1], '2026-11-05')).toMatchObject({ statement: 100000, later: 300000, due: '2026-11-10' });
    const paid = data(visa({ bal: 300000 }), [buy('shoes', '2026-10-20', 200000), buy('tv', '2026-10-28', 300000)], [{ date: '2026-11-02', amt: 200000 }]);
    expect(cardCycle(paid, paid.accounts[1], '2026-11-05')).toMatchObject({ statement: 0, later: 300000, due: '2026-12-10' });
  });
  it('after the pay-by day with the statement unpaid: overdue', () => {
    const d = data(visa({ bal: 200000 }), [buy('shoes', '2026-10-20', 200000)]);
    expect(cardCycle(d, d.accounts[1], '2026-11-14')).toMatchObject({ statement: 200000, due: '2026-11-10', overdue: true });
  });
  it('when the cutoff passes, what was "later" becomes the new statement', () => {
    const d = data(visa({ bal: 300000 }), [buy('tv', '2026-10-28', 300000)]);
    expect(cardCycle(d, d.accounts[1], '2026-11-26')).toMatchObject({ lastCut: '2026-11-25', statement: 300000, later: 0, due: '2026-12-10' });
  });
  it('the minimum payment is never more than what is due', () => {
    const d = data(visa({ bal: 500000, minPay: 120000 }), [buy('shoes', '2026-10-20', 200000), buy('tv', '2026-10-28', 300000)]);
    expect(cardCycle(d, d.accounts[1], '2026-11-05').min).toBe(120000);
    const small = data(visa({ bal: 80000, minPay: 120000 }), [buy('shoes', '2026-10-20', 80000)]);
    expect(cardCycle(small, small.accounts[1], '2026-11-05').min).toBe(80000);
    const none = data(visa({ bal: 300000, minPay: 120000 }), [buy('tv', '2026-10-28', 300000)]);
    expect(cardCycle(none, none.accounts[1], '2026-11-05').min).toBe(0);
  });
  it('without a cutoff day it works as before: everything owed is due on the pay-by day', () => {
    const d = data(visa({ bal: 300000, cutDay: undefined, payDay: undefined, due: 'Nov 15' }), [buy('tv', '2026-10-28', 300000)]);
    expect(cardCycle(d, d.accounts[1], '2026-11-05')).toMatchObject({ cycle: false, statement: 300000, later: 0, due: '2026-11-15' });
    const noDate = data(visa({ bal: 300000, cutDay: undefined, payDay: undefined }));
    expect(cardCycle(noDate, noDate.accounts[1], '2026-11-05').due).toBeNull();
  });
});

describe('the cycle in the rest of the app', () => {
  const bill = (payMode: Bill['payMode'], amt = 0): Bill => ({ id: 'b', name: 'Visa payment', kind: 'CardPayment', amt, dueDay: 10, hue: 1, paidMonths: [], acct: 'bank', toCard: 'visa', auto: true, payMode });
  it('a scheduled payment of "what\'s due" pays only the statement; "minimum" pays the minimum', () => {
    const today = new Date(), iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Dates relative to the real "today", because scheduled payments run on the device's date.
    const lastCut = cutOnOrBefore(25, iso), before = lastCut, afterCut = iso > lastCut ? iso : lastCut;
    const d = data(visa({ bal: 500000, minPay: 50000 }), [buy('old', before, 200000), ...(afterCut > lastCut ? [buy('new', afterCut, 300000)] : [])]);
    const d2 = afterCut > lastCut ? d : { ...d, accounts: d.accounts.map(a => (a.id === 'visa' ? { ...a, bal: 200000 } : a)) };
    expect(cardPayAmount(d2, bill('full'))).toBe(200000);
    expect(cardPayAmount(d2, bill('min'))).toBe(50000);
    expect(cardPayAmount(d2, bill('fixed', 70000))).toBe(70000);
  });
  it('money lent with the card is needed by the pay-by day of the statement it falls in', () => {
    const d = data(visa());
    expect(cardDueFor(d, d.accounts[1], '2026-10-20', '2026-11-05')).toBe('2026-11-10');
    expect(cardDueFor(d, d.accounts[1], '2026-10-28', '2026-11-05')).toBe('2026-12-10');
    const lent = { id: 'j', ts: 1, dir: 'owed' as const, name: 'Juan', amt: 78000, date: '2026-10-28', acct: 'visa', pays: [] };
    expect(neededBy(d, lent, '2026-11-05')).toBe('2026-12-10');
  });
});

describe('edge cases', () => {
  const cy = (c: Account, ex: Expense[], today: string, pays: { date: string; amt: number }[] = []) => { const d = data(c, ex, pays); return cardCycle(d, d.accounts[1], today); };
  it('legacy "Nov 15" text keeps meaning that single date, not every month', () => {
    const c = visa({ bal: 100, cutDay: undefined, payDay: undefined, due: 'Nov 15' });
    expect(cy(c, [], '2026-12-01').due).toBe('2027-11-15');
  });
  it('year change: cutoff 25, pay-by 10, today in January', () => {
    const r = cy(visa({ bal: 200000 }), [buy('a', '2026-12-20', 200000)], '2027-01-05');
    expect(r).toMatchObject({ lastCut: '2026-12-25', nextCut: '2027-01-25', statement: 200000, due: '2027-01-10' });
  });
  it('cutoff 31 and pay-by 30 in February', () => {
    const r = cy(visa({ bal: 1000, cutDay: 31, payDay: 30 }), [buy('a', '2027-01-20', 1000)], '2027-02-05');
    expect(r).toMatchObject({ lastCut: '2027-01-31', nextCut: '2027-02-28', statement: 1000, due: '2027-02-28' });
  });
  it('today exactly on the cutoff counts that day in the statement; exactly on the pay-by day is not overdue', () => {
    const d1 = cy(visa({ bal: 500 }), [buy('a', '2026-11-25', 500)], '2026-11-25');
    expect(d1).toMatchObject({ statement: 500, later: 0 });
    const d2 = cy(visa({ bal: 500 }), [buy('a', '2026-10-20', 500)], '2026-11-10');
    expect(d2).toMatchObject({ due: '2026-11-10', overdue: false });
  });
  it('pay-by day before vs after the cutoff day in the month', () => {
    expect(cy(visa({ bal: 5, cutDay: 5, payDay: 20 }), [buy('a', '2026-11-01', 5)], '2026-11-10').due).toBe('2026-11-20');
    expect(cy(visa({ bal: 5, cutDay: 20, payDay: 5 }), [buy('a', '2026-10-01', 5)], '2026-11-10').due).toBe('2026-11-05');
  });
  it('a payment bigger than the statement leaves the later purchases alone', () => {
    const r = cy(visa({ bal: 100 }), [buy('a', '2026-10-20', 200), buy('b', '2026-10-28', 300)], '2026-11-05', [{ date: '2026-11-02', amt: 400 }]);
    expect(r).toMatchObject({ statement: 0, later: 100 });
  });
  it('a card in credit or a hand-edited balance never gives a negative statement', () => {
    expect(cy(visa({ bal: -500 }), [], '2026-11-05')).toMatchObject({ statement: 0, later: 0, min: 0 });
    expect(cy(visa({ bal: 750 }), [], '2026-11-05')).toMatchObject({ statement: 750, later: 0 });
  });
  it('euro cents stay exact', () => {
    const r = cy(visa({ bal: 30.3, minPay: 10.1 }), [buy('a', '2026-10-20', 10.1), buy('b', '2026-10-21', 20.2)], '2026-11-05');
    expect(r.statement).toBe(30.3); expect(r.min).toBe(10.1);
  });
  it('a debt lent with the card is part of the statement it falls in', () => {
    const d = data(visa({ bal: 78000 }));
    d.debts = [{ id: 'j', ts: 1, dir: 'owed', name: 'Juan', amt: 78000, date: '2026-10-20', acct: 'visa', pays: [] }];
    expect(cardCycle(d, d.accounts[1], '2026-11-05')).toMatchObject({ statement: 78000, later: 0 });
    d.debts[0].pays = [{ id: 'pp', ts: 2, amt: 78000, date: '2026-11-02', acct: 'visa' }];
    d.accounts[1].bal = 0;
    expect(cardCycle(d, d.accounts[1], '2026-11-05').statement).toBe(0);
  });
});
