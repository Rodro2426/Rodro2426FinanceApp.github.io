import { describe, expect, it } from 'vitest';
import type { Account, Data, Payment } from './types';
import { addTransfer, deleteTransfer, isTransfer } from './transfer';
import { acctTxns } from './derive';

const acct = (id: string, bal: number, type: Account['type'] = 'bank'): Account => ({ id, name: id, type, kind: type, bal, hue: 200 } as unknown as Account);
const data = (accounts: Account[]) => ({ accounts, payments: [], expenses: [], incomes: [], pockets: [], debts: [], investments: { trades: [], quotes: {}, usdRate: 4000, usdRateAt: 0 } } as unknown as Data);
const pay = (from: string, to: string, amt: number): Payment => ({ id: `t-${from}-${to}`, ts: 1, from, to, amt, date: '2026-11-19' });
const bal = (d: Partial<Data>, id: string) => d.accounts!.find(a => a.id === id)!.bal;

describe('transfers between accounts', () => {
  it('bank to bank: one goes down, the other up', () => {
    const r = addTransfer(data([acct('nu', 500000), acct('bc', 100000)]), pay('nu', 'bc', 200000));
    expect([bal(r, 'nu'), bal(r, 'bc')]).toEqual([300000, 300000]);
  });

  it('bank to card pays the card off (same as a card payment)', () => {
    const r = addTransfer(data([acct('nu', 500000), acct('visa', 800000, 'card')]), pay('nu', 'visa', 300000));
    expect([bal(r, 'nu'), bal(r, 'visa')]).toEqual([200000, 500000]);
  });

  it('card to bank is a cash advance: you owe more', () => {
    const r = addTransfer(data([acct('visa', 100000, 'card'), acct('cash', 0, 'cash')]), pay('visa', 'cash', 50000));
    expect([bal(r, 'visa'), bal(r, 'cash')]).toEqual([150000, 50000]);
  });

  it('deleting puts both balances back', () => {
    const d0 = data([acct('nu', 500000), acct('visa', 800000, 'card')]);
    const p = pay('nu', 'visa', 300000);
    const d1 = { ...d0, ...addTransfer(d0, p) } as Data;
    const d2 = { ...d1, ...deleteTransfer(d1, p.id) } as Data;
    expect([bal(d2, 'nu'), bal(d2, 'visa'), d2.payments.length]).toEqual([500000, 800000, 0]);
  });

  it('the account history replays to the opening balance on both sides', () => {
    const d0 = data([acct('nu', 500000), acct('visa', 100000, 'card')]);
    const d1 = { ...d0, ...addTransfer(d0, pay('visa', 'nu', 40000)) } as Data;
    expect(acctTxns(d1, 'nu').opening).toBe(500000);
    expect(acctTxns(d1, 'visa').opening).toBe(100000);
  });

  it('CDT, fund and scheduled payments are not editable transfers', () => {
    expect(isTransfer(pay('a', 'b', 1))).toBe(true);
    expect(isTransfer({ ...pay('a', 'b', 1), cdt: 'c' })).toBe(false);
    expect(isTransfer({ ...pay('a', 'b', 1), ruleId: 'r' })).toBe(false);
  });

  it('history labels: bank to bank is a move, bank to card is a card payment', () => {
    const d0 = data([acct('nu', 500000), acct('bc', 0), acct('visa', 800000, 'card')]);
    const d1 = { ...d0, ...addTransfer(d0, pay('nu', 'bc', 100000)) } as Data;
    const d2 = { ...d1, ...addTransfer(d1, pay('nu', 'visa', 50000)) } as Data;
    expect(acctTxns(d2, 'bc').list[0]).toMatchObject({ note: 'Moved from nu', category: 'Transfer', effect: 100000 });
    expect(acctTxns(d2, 'visa').list[0]).toMatchObject({ note: 'Payment from nu', category: 'Card payment', effect: -50000 });
    expect(acctTxns(d2, 'nu').list.map(t => t.note).sort()).toEqual(['Moved to bc', 'Payment to visa']);
  });

  it('bank to card matches the old card payment: bank -amt, card -amt (owed), history effect -amt on both', () => {
    const d0 = data([acct('nu', 500000), acct('visa', 800000, 'card')]);
    const d1 = { ...d0, ...addTransfer(d0, pay('nu', 'visa', 300000)) } as Data;
    expect(acctTxns(d1, 'nu').list[0].effect).toBe(-300000);
    expect(acctTxns(d1, 'visa').list[0].effect).toBe(-300000);
  });

  it('card to card: source owes more, target owes less, and undo restores both', () => {
    const d0 = data([acct('a', 100000, 'card'), acct('b', 100000, 'card')]);
    const r = addTransfer(d0, pay('a', 'b', 30000));
    expect([bal(r, 'a'), bal(r, 'b')]).toEqual([130000, 70000]);
    const d1 = { ...d0, ...r } as Data;
    expect([bal(deleteTransfer(d1, 't-a-b'), 'a'), bal(deleteTransfer(d1, 't-a-b'), 'b')]).toEqual([100000, 100000]);
  });
});
