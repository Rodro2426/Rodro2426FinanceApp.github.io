// Setting an account to its real balance, with the difference recorded as a transaction: money missing counts as
// spent (an expense, in a pocket if you choose one) and money extra counts as received (an income).
import type { Data, Expense } from './types';
import type { Ctx } from './dates';
import { chargeAccount, roundAmt, uid } from './derive';
import { addExtraIncome } from './plan';

export const ADJUST_NOTE = 'Balance adjustment';

/** How the real balance differs: > 0 you spent that much more than Pockets knew, < 0 you got that much more. */
export function adjustGap(d: Data, acctId: string, real: number): number {
  const a = d.accounts.find(x => x.id === acctId);
  if (!a) return 0;
  // A card that owes more means money spent; a bank account that holds less means money spent.
  return roundAmt(a.type === 'card' ? real - a.bal : a.bal - real);
}

export interface AdjustOpts { /** Spent: the pocket it comes out of ('' = none). */ pocket?: string; /** Got: share it into the pockets this week, by budget. */ toPockets?: boolean; note?: string }

/** Records the difference as an expense or an income dated today, which moves the account to `real`. Null if there's no difference. */
export function adjustBalance(d: Data, c: Ctx, acctId: string, real: number, o: AdjustOpts = {}): Partial<Data> | null {
  const gap = adjustGap(d, acctId, real), note = o.note?.trim() || ADJUST_NOTE;
  const acct = d.accounts.find(x => x.id === acctId);
  if (!acct) return null;
  // The account must end exactly at what was typed, even if it carried an interest fraction (3250000.4) or float dust.
  const snap = (r: Partial<Data>): Partial<Data> => ({ ...r, accounts: (r.accounts ?? d.accounts).map(x => (x.id === acctId ? { ...x, bal: real } : x)) });
  if (Math.abs(gap) < 0.005) return acct.bal === real ? null : snap({});
  if (gap > 0) {
    const p = o.pocket && d.pockets.some(x => x.id === o.pocket) ? o.pocket : '';
    const e: Expense = { id: uid('e'), ts: Date.now(), p, a: acctId, amt: gap, note, date: c.today, tags: [], cat: 'Other', sub: ADJUST_NOTE };
    return snap({ expenses: [e, ...d.expenses], accounts: chargeAccount(d.accounts, acctId, gap) });
  }
  return snap(addExtraIncome(d, c, { amt: -gap, acct: acctId, note, toPockets: o.toPockets ? -gap : 0, mode: 'week', dist: 'budget', cat: 'Other income' }));
}
