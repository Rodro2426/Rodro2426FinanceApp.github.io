// A credit card's billing cycle. The cycle ends on the cutoff day ("fecha de corte"); what you had spent by then
// is the statement, and it has to be paid by the pay-by day ("fecha límite de pago"). Anything bought after the
// cutoff belongs to the next statement, so it isn't due yet.
import type { Account, Data } from './types';
import { acctTxns } from './derive';
import { daysInMonth, shortDate } from './dates';
import { parseShortDate } from './schedule';

const pad = (n: number) => String(n).padStart(2, '0');
const cents = (n: number) => Math.round(n * 100) / 100;
/** Day `day` of month `m` ("YYYY-MM"); days past the month's end fall on its last day. */
const dayIn = (m: string, day: number) => `${m}-${pad(Math.min(day, daysInMonth(m)))}`;
const shiftMonth = (m: string, by: number) => { const [y, mo] = m.split('-').map(Number); const t = new Date(y, mo - 1 + by, 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`; };
const okDay = (n?: number) => (n && n >= 1 && n <= 31 ? Math.floor(n) : 0);

/** The pay-by day of a card: the one typed in, or the day of the old "Nov 25"-style date. */
export function payDayOf(a: Pick<Account, 'payDay' | 'due'>): number {
  if (okDay(a.payDay)) return okDay(a.payDay);
  const m = /(\d{1,2})\s*$/.exec(a.due || '');
  return m ? okDay(Number(m[1])) : 0;
}
/** The last cutoff on or before `date`. */
export function cutOnOrBefore(cutDay: number, date: string) {
  const m = date.slice(0, 7), here = dayIn(m, cutDay);
  return here <= date ? here : dayIn(shiftMonth(m, -1), cutDay);
}
/** The first cutoff on or after `date`. */
export function cutOnOrAfter(cutDay: number, date: string) {
  const m = date.slice(0, 7), here = dayIn(m, cutDay);
  return here >= date ? here : dayIn(shiftMonth(m, 1), cutDay);
}
/** The first pay-by day strictly after `date`. */
export function payAfter(payDay: number, date: string) {
  const m = date.slice(0, 7), here = dayIn(m, payDay);
  return here > date ? here : dayIn(shiftMonth(m, 1), payDay);
}

export interface CardCycle {
  /** Both the cutoff day and the pay-by day are known. */ cycle: boolean;
  /** The last cutoff (the end of the statement you're paying now). */ lastCut: string | null;
  /** The next cutoff. */ nextCut: string | null;
  /** When the next payment has to be made (null if no date is known). */ due: string | null;
  /** What is due by `due`: the last statement, minus what you've paid since. Without a cutoff day: everything owed. */ statement: number;
  /** Bought after the cutoff: it goes on the next statement. */ later: number;
  /** The minimum payment (never more than what's due). */ min: number;
  /** The pay-by day passed and the statement isn't fully paid. */ overdue: boolean;
}

/** Where a card stands in its billing cycle today. */
export function cardCycle(d: Data, a: Account, today: string): CardCycle {
  const owed = Math.max(0, a.bal), cutDay = okDay(a.cutDay), payDay = payDayOf(a);
  const minOf = (st: number) => cents(Math.min(Math.max(0, a.minPay ?? 0), st));
  if (!cutDay || !payDay) {
    // No cutoff day: the old behavior, where everything owed is due on the pay-by day.
    // A typed pay-by day repeats monthly; the old "Nov 15" text keeps meaning that one date (this or next year).
    const m = today.slice(0, 7);
    const monthly = payDay ? (dayIn(m, payDay) >= today ? dayIn(m, payDay) : dayIn(shiftMonth(m, 1), payDay)) : null;
    const due = okDay(a.payDay) ? monthly : parseShortDate(a.due, today) ?? monthly;
    return { cycle: false, lastCut: null, nextCut: null, due, statement: owed, later: 0, min: minOf(owed), overdue: false };
  }
  const lastCut = cutOnOrBefore(cutDay, today), nextCut = dayIn(shiftMonth(lastCut.slice(0, 7), 1), cutDay);
  // What the card owed at the cutoff, then every payment or refund since comes off that statement first.
  const after = acctTxns(d, a.id).list.filter(t => t.date > lastCut);
  const atCut = a.bal - after.reduce((s, t) => s + t.effect, 0);
  const paid = after.reduce((s, t) => s + (t.effect < 0 ? -t.effect : 0), 0);
  const statement = cents(Math.min(owed, Math.max(0, atCut - paid)));
  const later = cents(owed - statement);
  const thisDue = payAfter(payDay, lastCut);
  const due = statement > 0.004 ? thisDue : payAfter(payDay, nextCut);
  return { cycle: true, lastCut, nextCut, due, statement, later, min: minOf(statement), overdue: statement > 0.004 && thisDue < today };
}

/** When something bought with the card on `date` has to be paid: the pay-by day after the cutoff that closes it. */
export function cardDueFor(d: Data, a: Account, date: string, today: string): string | null {
  const cutDay = okDay(a.cutDay), payDay = payDayOf(a);
  if (!cutDay || !payDay) return cardCycle(d, a, today).due;
  return payAfter(payDay, cutOnOrAfter(cutDay, date));
}

/** "Dec 10" for the card's next payment, or the old free-text date, or nothing. */
export function cardDueLabel(d: Data, a: Account, today: string): string {
  const due = cardCycle(d, a, today).due;
  return due ? shortDate(due) : a.due || '';
}
