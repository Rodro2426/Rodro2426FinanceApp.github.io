// Moving money between your own accounts. It's stored as a Payment (like a card payment) and is never income or
// spending: one account goes down and the other goes up, so net worth stays the same.
// A card's balance is what you owe, so money into a card lowers it (you paid it) and money out of a card raises it
// (a cash advance). Card payments made before this file existed follow the same rule.
import type { Account, Data, Payment } from './types';

/** How much `acct`'s balance changes because of `p` (+ goes up, − goes down). 0 if the account isn't in it. */
export function transferEffect(acct: Account, p: Payment): number {
  const side = p.from === acct.id ? -1 : p.to === acct.id ? 1 : 0;
  return side * p.amt * (acct.type === 'card' ? -1 : 1);
}

const apply = (accounts: Account[], p: Payment, k: 1 | -1) =>
  accounts.map(a => {
    const e = transferEffect(a, p);
    return e ? { ...a, bal: Math.round((a.bal + k * e) * 100) / 100 } : a;
  });

/** A plain move between two accounts (not a CDT, fund or scheduled card payment): the ones you can edit or undo. */
export const isTransfer = (p: Payment) => !p.cdt && !p.fund && !p.ruleId;

export function addTransfer(d: Data, p: Payment): Partial<Data> {
  return { accounts: apply(d.accounts, p, 1), payments: [...d.payments, p] };
}

/** Undoes a transfer: both balances go back to what they were. */
export function deleteTransfer(d: Data, id: string): Partial<Data> {
  const p = d.payments.find(x => x.id === id);
  if (!p) return {};
  return { accounts: apply(d.accounts, p, -1), payments: d.payments.filter(x => x.id !== id) };
}
