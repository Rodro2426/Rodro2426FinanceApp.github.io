import { dateLocale } from './i18n';
// All dates are local calendar days as 'YYYY-MM-DD'.
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayISO = () => iso(new Date());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const monthKey = (s: string) => s.slice(0, 7);
export const prevMonthKey = (m: string) => { const d = parse(m + '-01'); d.setMonth(d.getMonth() - 1); return iso(d).slice(0, 7); };
export const daysInMonth = (m: string) => { const d = parse(m + '-01'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/** Monday of the week containing `s`. */
export const weekStart = (s: string) => { const d = parse(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
export const inRange = (s: string, a: string, b: string) => s >= a && s <= b;

export const fmtDay = (s: string, opts: Intl.DateTimeFormatOptions) => parse(s).toLocaleDateString(dateLocale(), opts);
export const shortDate = (s: string) => fmtDay(s, { month: 'short', day: 'numeric' });
export const monthName = (m: string) => fmtDay(m + '-15', { month: 'long' });
export const monthLabel = (m: string) => (m === 'all' ? 'All months' : cap(fmtDay(m + '-15', { month: 'long', year: 'numeric' })));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Today", a weekday for the last 6 days, otherwise "Oct 31". */
export function relDay(s: string, today: string) {
  const diff = daysBetween(s, today);
  if (diff === 0) return 'Today';
  if (diff > 0 && diff < 7) return fmtDay(s, { weekday: 'short', day: 'numeric' });
  return shortDate(s);
}

export interface Ctx {
  today: string; month: string; weekStart: string; weekEnd: string; lastWeekStart: string; lastWeekEnd: string;
  weekNo: number; weeks: number; daysLeft: number;
}
/** Last day of the month a day is in. */
export const lastOfMonth = (s: string) => `${s.slice(0, 7)}-${pad(daysInMonth(s.slice(0, 7)))}`;
/**
 * The week a day is in, as the app counts it: Monday to Sunday, but cut where a month ends, so every week belongs to
 * exactly one month (Mon Nov 30 is a 1-day week of November; Tue Dec 1–Sun Dec 6 is December's week 1).
 */
export function weekPart(s: string): [string, string] {
  const mon = weekStart(s), sun = addDays(mon, 6), first = s.slice(0, 8) + '01', last = lastOfMonth(s);
  return [mon < first ? first : mon, sun > last ? last : sun];
}
/** A month's weeks, first to last day of each (4 to 6 of them; the first and last can be short). */
export function weekParts(month: string): [string, string][] {
  const out: [string, string][] = [];
  for (let s = month + '-01'; monthKey(s) === month; s = addDays(out[out.length - 1][1], 1)) out.push(weekPart(s));
  return out;
}
/** How many weeks a month has (see weekParts). */
export const weeksIn = (month: string) => weekParts(month).length;
/** "23–29", or "30" for a 1-day week: the days of a week, for labels. */
export const weekDays = (a: string, b: string) => (a === b ? String(Number(a.slice(8))) : `${Number(a.slice(8))}–${Number(b.slice(8))}`);
/** The calendar for a day. */
export const ctxAt = (today = todayISO()) => makeCtx(0, today);
/** The calendar for a day (`_weeks` is ignored: the month decides how many weeks it has). */
export function makeCtx(_weeks: number, today = todayISO()): Ctx {
  const [ws, we] = weekPart(today), parts = weekParts(monthKey(today));
  const [lws, lwe] = weekPart(addDays(ws, -1));
  return {
    today, month: monthKey(today), weekStart: ws, weekEnd: we, lastWeekStart: lws, lastWeekEnd: lwe,
    weekNo: parts.findIndex(x => x[0] === ws) + 1, weeks: parts.length, daysLeft: daysBetween(today, we)
  };
}
