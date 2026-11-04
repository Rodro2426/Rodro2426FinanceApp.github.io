import type { Bill, Data } from './types';
import { RED } from './constants';
import { daysBetween, shortDate, type Ctx } from './dates';
import { dueDate, isAuto } from './schedule';

export interface BillRow extends Bill { due: string; inDays: number; paid: boolean; auto: boolean; acctName: string; dueLabel: string; dueColor: string }

/** Bills and subscriptions this month (income is shown on the calendar instead). */
export function billRows(d: Data, c: Ctx, withIncome = false): BillRow[] {
  return d.bills.filter(b => withIncome || b.kind !== 'Income').map(b => {
    const due = dueDate(b, c.month);
    const inDays = daysBetween(c.today, due), paid = b.paidMonths.includes(c.month);
    const auto = isAuto(b, d), acctName = d.accounts.find(a => a.id === b.acct)?.name || '';
    const when = paid ? (auto ? `Paid from ${acctName}` : 'Paid')
      : inDays < 0 ? `Overdue · ${shortDate(due)}`
      : inDays === 0 ? 'Due today'
      : inDays <= 7 ? `Due in ${inDays === 1 ? '1 day' : inDays + ' days'} · ${shortDate(due)}`
      : `Due ${shortDate(due)}`;
    const dueLabel = !paid && auto ? `${when} · auto` : when;
    return { ...b, due, inDays, paid, auto, acctName, dueLabel, dueColor: !paid && inDays <= 7 ? RED : 'var(--color-neutral-700)' };
  });
}
