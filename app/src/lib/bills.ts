import type { Bill, Data } from './types';
import { RED } from './constants';
import { daysBetween, daysInMonth, shortDate, type Ctx } from './dates';

export interface BillRow extends Bill { due: string; inDays: number; paid: boolean; dueLabel: string; dueColor: string }

/** Bills repeat monthly on `dueDay`; "paid" is tracked per month. */
export function billRows(d: Data, c: Ctx): BillRow[] {
  return d.bills.map(b => {
    const day = Math.min(b.dueDay, daysInMonth(c.month));
    const due = `${c.month}-${String(day).padStart(2, '0')}`;
    const inDays = daysBetween(c.today, due), paid = b.paidMonths.includes(c.month);
    const dueLabel = paid ? 'Paid'
      : inDays < 0 ? `Overdue · ${shortDate(due)}`
      : inDays === 0 ? 'Due today'
      : inDays <= 7 ? `Due in ${inDays === 1 ? '1 day' : inDays + ' days'} · ${shortDate(due)}`
      : `Due ${shortDate(due)}`;
    return { ...b, due, inDays, paid, dueLabel, dueColor: !paid && inDays <= 7 ? RED : 'var(--color-neutral-700)' };
  });
}
