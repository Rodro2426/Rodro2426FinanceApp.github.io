import type { Bill, Data } from './types';
import { RED } from './constants';
import { daysBetween, shortDate, type Ctx } from './dates';
import { dueDate, isAuto, notMine } from './schedule';

export interface BillRow extends Bill { due: string; inDays: number; paid: boolean; auto: boolean; acctName: string; dueLabel: string; dueColor: string; others: boolean }

/** Bills and subscriptions this month (income is shown on the calendar instead). */
export function billRows(d: Data, c: Ctx, withIncome = false): BillRow[] {
  return d.bills.filter(b => b.kind !== 'CardPayment' && (withIncome || b.kind !== 'Income')).map(b => {
    const due = dueDate(b, c.month);
    const inDays = daysBetween(c.today, due), paid = b.paidMonths.includes(c.month);
    const auto = isAuto(b, d), acctName = d.accounts.find(a => a.id === b.acct)?.name || '';
    // Short, one line: the date and the account or card it uses.
    const others = notMine(b);
    if (others) return { ...b, due, inDays, paid: false, auto: false, acctName, dueLabel: shortDate(due), dueColor: 'var(--color-neutral-600)', others };
    const when = paid ? 'Paid' : inDays < 0 ? `Overdue ${shortDate(due)}` : inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : shortDate(due);
    const dueLabel = [when, acctName].filter(Boolean).join(' · ');
    return { ...b, due, inDays, paid, auto, acctName, dueLabel, dueColor: !paid && inDays <= 7 ? RED : 'var(--color-neutral-700)', others };
  });
}
